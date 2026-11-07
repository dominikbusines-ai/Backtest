import { requireSupabase } from "@/lib/supabase-server";
import type { MistakeSource } from "@/lib/mistake-patterns";

const fields = ["context", "entry_note", "pre_trade_assessment", "review_observation", "review_mistake", "review_invalidation", "review_illogical"] as const;

export async function loadMistakeSources(): Promise<MistakeSource[]> {
  const supabase = requireSupabase();
  const sources: MistakeSource[] = [];
  let total = 0;
  for (const table of ["trades", "journal_notes"] as const) {
    for (let offset = 0; ; offset += 500) {
      const columns = table === "trades" ? `id,created_at,trade_date,trade_mode,instrument,result_type,${fields.join(",")}` : "id,created_at,updated_at,title,content";
      const { data, error } = await supabase.from(table).select(columns).order("created_at", { ascending: true }).order("id", { ascending: true }).range(offset, offset + 499);
      if (error) throw new Error("Notizen oder Trades konnten nicht geladen werden. Bitte Supabase-Verbindung prüfen.");
      const rows = (data ?? []) as unknown as Record<string, string | null>[];
      total += rows.length;
      if (total > 1000) throw new Error("Mehr als 1.000 Einträge: Für diese Datenmenge ist eine aufgeteilte Auswertung nötig. Es wurden keine Texte gekürzt oder an die KI gesendet.");
      for (const row of rows) {
        if (table === "trades" && row.trade_mode !== "live" && row.trade_mode !== "backtest") throw new Error("Ein Trade hat keine gültige Art. Bitte Live/Backtest prüfen.");
        sources.push({
          id: `${table === "trades" ? "trade" : "note"}:${row.id}`,
          kind: table === "trades" ? row.trade_mode as "live" | "backtest" : "note",
          created_at: row.created_at ?? "", updated_at: row.updated_at ?? row.created_at ?? "",
          date: table === "trades" ? row.trade_date ?? "" : "",
          title: table === "trades" ? row.instrument ?? "Trade" : row.title || "Notiz ohne Titel",
          noTrade: table === "trades" && row.result_type === "no_trade",
          fields: table === "trades" ? Object.fromEntries(fields.map((field) => [field, row[field] ?? ""])) : { content: row.content ?? "" },
        });
      }
      if (rows.length < 500) break;
    }
  }
  return sources;
}
