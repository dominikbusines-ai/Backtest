import { NextResponse } from "next/server";
import { requireSupabase } from "@/lib/supabase-server";
import { z } from "zod";

const inputSchema = z.object({ name: z.string().trim().min(1).max(80), category_id: z.string().uuid().nullable() });
type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const input = inputSchema.parse(await request.json());
    const supabase = requireSupabase();
    const { error } = await supabase.from("tags").update(input).eq("id", (await params).id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Tag konnte nicht geändert werden." }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const supabase = requireSupabase();
    const { error } = await supabase.from("tags").delete().eq("id", (await params).id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Tag konnte nicht gelöscht werden." }, { status: 400 });
  }
}
