import { NextResponse } from "next/server";
import { requireSupabase } from "@/lib/supabase-server";
import { z } from "zod";

const inputSchema = z.object({ name: z.string().trim().min(1).max(80) });

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json());
    const supabase = requireSupabase();
    const { data, error } = await supabase.from("tag_categories").insert(input).select("*").single();
    if (error) throw error;
    return NextResponse.json({ category: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kategorie konnte nicht erstellt werden." }, { status: 400 });
  }
}
