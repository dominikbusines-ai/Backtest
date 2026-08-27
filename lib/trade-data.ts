import { requireSupabase, signScreenshot } from "@/lib/supabase-server";
import type { Tag, Trade, TradeInput } from "@/lib/types";

type TradeRow = Omit<Trade, "tags" | "screenshot_signed_url">;

export async function listTrades(): Promise<Trade[]> {
  const supabase = requireSupabase();
  const { data: rows, error } = await supabase.from("trades").select("*").order("trade_date", { ascending: false }).order("trade_time", { ascending: false });
  if (error) throw error;
  const trades = (rows ?? []) as TradeRow[];
  if (!trades.length) return [];

  const ids = trades.map((trade) => trade.id);
  const { data: links, error: linkError } = await supabase.from("trade_tags").select("trade_id, tag_id").in("trade_id", ids);
  if (linkError) throw linkError;
  const tagIds = [...new Set((links ?? []).map((link) => link.tag_id as string))];
  let tags: Tag[] = [];
  if (tagIds.length) {
    const { data: tagRows, error: tagError } = await supabase.from("tags").select("*, category:tag_categories(*)").in("id", tagIds);
    if (tagError) throw tagError;
    tags = (tagRows ?? []) as unknown as Tag[];
  }
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]));
  const tradeTags = new Map<string, Tag[]>();
  for (const link of links ?? []) {
    const tag = tagMap.get(link.tag_id as string);
    if (tag) tradeTags.set(link.trade_id as string, [...(tradeTags.get(link.trade_id as string) ?? []), tag]);
  }

  return Promise.all(trades.map(async (trade) => ({
    ...trade,
    tags: tradeTags.get(trade.id) ?? [],
    screenshot_signed_url: await signScreenshot(trade.screenshot_url),
  })));
}

export async function getTrade(id: string): Promise<Trade | null> {
  const trades = await listTrades();
  return trades.find((trade) => trade.id === id) ?? null;
}

export async function createTrade(input: TradeInput): Promise<string> {
  const supabase = requireSupabase();
  const { tag_ids, ...trade } = input;
  const { data, error } = await supabase.from("trades").insert(trade).select("id").single();
  if (error) throw error;
  if (tag_ids.length) {
    const { error: linkError } = await supabase.from("trade_tags").insert(tag_ids.map((tag_id) => ({ trade_id: data.id, tag_id })));
    if (linkError) {
      await supabase.from("trades").delete().eq("id", data.id);
      throw linkError;
    }
  }
  return data.id as string;
}

export async function updateTrade(id: string, input: TradeInput) {
  const supabase = requireSupabase();
  const { tag_ids, ...trade } = input;
  const { error } = await supabase.from("trades").update(trade).eq("id", id);
  if (error) throw error;
  const { error: deleteError } = await supabase.from("trade_tags").delete().eq("trade_id", id);
  if (deleteError) throw deleteError;
  if (tag_ids.length) {
    const { error: linkError } = await supabase.from("trade_tags").insert(tag_ids.map((tag_id) => ({ trade_id: id, tag_id })));
    if (linkError) throw linkError;
  }
}

export async function deleteTrade(id: string) {
  const supabase = requireSupabase();
  const { data: trade } = await supabase.from("trades").select("screenshot_url").eq("id", id).single();
  const { error } = await supabase.from("trades").delete().eq("id", id);
  if (error) throw error;
  if (trade?.screenshot_url) await supabase.storage.from("trade-screenshots").remove([trade.screenshot_url]);
}
