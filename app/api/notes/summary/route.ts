import { NextResponse } from "next/server";
import { requireSupabase } from "@/lib/supabase-server";
import { noteVersionSchema } from "@/lib/note-schema";
import { generateNoteText } from "@/lib/note-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const parsed = noteVersionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bitte eine gespeicherte Notiz auswählen." }, { status: 400 });
  try {
    const supabase = requireSupabase();
    const { id, updated_at } = parsed.data;
    const { data: note, error } = await supabase.from("journal_notes").select("content,updated_at").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!note) return NextResponse.json({ error: "Die Notiz wurde nicht gefunden." }, { status: 404 });
    if (note.updated_at !== updated_at) return NextResponse.json({ error: "Diese Notiz wurde inzwischen geändert. Bitte die Seite neu laden." }, { status: 409 });
    const summary = await generateNoteText(note.content, "summary");
    const { data: latest, error: latestError } = await supabase.from("journal_notes").select("id").eq("id", id).eq("updated_at", updated_at).maybeSingle();
    if (latestError) throw latestError;
    if (!latest) return NextResponse.json({ error: "Die Notiz wurde während der Zusammenfassung geändert oder gelöscht. Bitte die Seite neu laden." }, { status: 409 });
    return NextResponse.json({ summary, updated_at });
  } catch {
    return NextResponse.json({ error: "Die KI-Zusammenfassung ist gerade nicht verfügbar. Bitte später erneut versuchen. Ihre Notiz bleibt unverändert." }, { status: 503 });
  }
}
