import { NextResponse } from "next/server";
import { requireSupabase } from "@/lib/supabase-server";
import { noteInputSchema, noteUpdateSchema, noteVersionSchema, type JournalNote } from "@/lib/note-schema";
import { completeNoteTitle } from "@/lib/note-ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
const columns = "id,title,content,created_at,updated_at";

function failure(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  const message = code === "PGRST205" || code === "42P01"
    ? "Die Notizablage ist noch nicht eingerichtet. Bitte einmal die Datei 007_journal_notes.sql in Supabase ausführen. Ihr Entwurf bleibt erhalten."
    : "Die Notizen konnten nicht gespeichert oder geladen werden. Bitte die Verbindung prüfen und erneut versuchen.";
  return NextResponse.json({ error: message }, { status: 503 });
}

export async function GET() {
  try {
    const supabase = requireSupabase();
    const notes: JournalNote[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("journal_notes").select(columns)
        .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 499);
      if (error) throw error;
      notes.push(...(data ?? []) as JournalNote[]);
      if (!data || data.length < 500) break;
    }
    return NextResponse.json({ notes });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  const parsed = noteInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bitte einen Notiztext mit maximal 10.000 Zeichen und einen Titel mit maximal 120 Zeichen eingeben." }, { status: 400 });
  try {
    const supabase = requireSupabase();
    const matchesInput = (note: JournalNote) => note.content === parsed.data.content && (!parsed.data.title || note.title === parsed.data.title);
    // Check retries before generating a paid title again.
    const { data: previous, error: previousError } = await supabase.from("journal_notes").select(columns).eq("id", parsed.data.id).maybeSingle();
    if (previousError) throw previousError;
    if (previous) {
      if (matchesInput(previous)) return NextResponse.json({ note: previous });
      return NextResponse.json({ error: "Diese Notiz wurde bereits gespeichert. Bitte den gespeicherten Eintrag bearbeiten. Ihr Entwurf bleibt erhalten." }, { status: 409 });
    }
    const { title, warning } = await completeNoteTitle(parsed.data);
    const { data, error } = await supabase.from("journal_notes").insert({ ...parsed.data, title }).select(columns).single();
    // A retry after a lost response must not create a duplicate note.
    if (error?.code === "23505") {
      const { data: existing, error: readError } = await supabase.from("journal_notes").select(columns).eq("id", parsed.data.id).single();
      if (readError) throw readError;
      if (matchesInput(existing)) return NextResponse.json({ note: existing });
      return NextResponse.json({ error: "Diese Notiz wurde bereits gespeichert. Bitte die Seite neu laden und den gespeicherten Eintrag bearbeiten. Ihr Entwurf bleibt erhalten." }, { status: 409 });
    }
    if (error) throw error;
    return NextResponse.json({ note: data, warning }, { status: 201 });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  const parsed = noteUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Die Notizdaten sind ungültig. Bitte Text und Titel prüfen." }, { status: 400 });
  try {
    const { id, updated_at, ...changes } = parsed.data;
    const supabase = requireSupabase();
    const { data: current, error: readError } = await supabase.from("journal_notes").select("id").eq("id", id).eq("updated_at", updated_at).maybeSingle();
    if (readError) throw readError;
    if (!current) return NextResponse.json({ error: "Die Notiz wurde inzwischen geändert oder gelöscht. Ihr Entwurf bleibt erhalten. Bitte den aktuellen Eintrag neu laden." }, { status: 409 });
    const { title, warning } = await completeNoteTitle(changes);
    const { data, error } = await supabase.from("journal_notes").update({ ...changes, title, updated_at: new Date().toISOString() })
      .eq("id", id).eq("updated_at", updated_at).select(columns).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Die Notiz wurde inzwischen geändert oder gelöscht. Ihr Entwurf bleibt erhalten. Bitte den aktuellen Eintrag neu laden." }, { status: 409 });
    return NextResponse.json({ note: data, warning });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  const parsed = noteVersionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Notiz." }, { status: 400 });
  try {
    const { data, error } = await requireSupabase().from("journal_notes").delete()
      .eq("id", parsed.data.id).eq("updated_at", parsed.data.updated_at).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Die Notiz wurde inzwischen geändert oder gelöscht. Bitte die Liste neu laden." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}
