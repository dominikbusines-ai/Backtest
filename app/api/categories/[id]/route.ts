import { NextResponse } from "next/server";
import { requireSupabase } from "@/lib/supabase-server";
import { z } from "zod";

const inputSchema = z.object({ name: z.string().trim().min(1).max(80) });
type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const input = inputSchema.parse(await request.json());
    const supabase = requireSupabase();
    const { error } = await supabase.from("tag_categories").update(input).eq("id", (await params).id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kategorie konnte nicht geändert werden." }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const supabase = requireSupabase();
    const { error } = await supabase.from("tag_categories").delete().eq("id", (await params).id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kategorie konnte nicht gelöscht werden." }, { status: 400 });
  }
}
