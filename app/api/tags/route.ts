import { NextResponse } from "next/server";
import { requireSupabase } from "@/lib/supabase-server";
import { z } from "zod";

const inputSchema = z.object({ name: z.string().trim().min(1).max(80), category_id: z.string().uuid().nullable().optional() });

export async function GET() {
  try {
    const supabase = requireSupabase();
    const [{ data: tags, error }, { data: categories, error: categoryError }] = await Promise.all([
      supabase.from("tags").select("*, category:tag_categories(*)").order("name"),
      supabase.from("tag_categories").select("*").order("sort_order").order("name"),
    ]);
    if (error) throw error;
    if (categoryError) throw categoryError;
    return NextResponse.json({ tags, categories });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Tags konnten nicht geladen werden." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json());
    const supabase = requireSupabase();
    const { data, error } = await supabase.from("tags").insert({ ...input, category_id: input.category_id ?? null, is_default: false }).select("*, category:tag_categories(*)").single();
    if (error) throw error;
    return NextResponse.json({ tag: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Tag konnte nicht erstellt werden." }, { status: 400 });
  }
}
