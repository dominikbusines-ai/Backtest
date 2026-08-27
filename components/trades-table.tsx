"use client";
/* eslint-disable @next/next/no-img-element -- Private Screenshots werden über kurzlebige signierte URLs geladen. */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Filter, Image as ImageIcon, Loader2, Search, X } from "lucide-react";
import type { Direction, ResultType, Tag, Trade } from "@/lib/types";
import { hasEveryTag } from "@/lib/stats";

export function TradesTable() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [instrument, setInstrument] = useState("");
  const [direction, setDirection] = useState<Direction | "">(""); const [result, setResult] = useState<ResultType | "">("");
  const [confidence, setConfidence] = useState(""); const [context, setContext] = useState(""); const [minRr, setMinRr] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([fetch("/api/trades"), fetch("/api/tags")]).then(async ([tradesResponse, tagsResponse]) => {
      const tradeData = await tradesResponse.json(); const tagData = await tagsResponse.json();
      if (!tradesResponse.ok) throw new Error(tradeData.error); if (!tagsResponse.ok) throw new Error(tagData.error);
      setTrades(tradeData.trades); setTags(tagData.tags);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Daten konnten nicht geladen werden.")).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => trades.filter((trade) => {
    if (from && trade.trade_date < from) return false; if (to && trade.trade_date > to) return false;
    if (instrument && trade.instrument !== instrument) return false; if (direction && trade.direction !== direction) return false;
    if (result && trade.result_type !== result) return false; if (confidence && trade.confidence !== Number(confidence)) return false;
    if (context && !(trade.context ?? "").toLocaleLowerCase("de").includes(context.toLocaleLowerCase("de"))) return false;
    if (minRr && (trade.planned_rr === null || trade.planned_rr < Number(minRr))) return false;
    return hasEveryTag(trade, selectedTags);
  }), [trades, from, to, instrument, direction, result, confidence, context, minRr, selectedTags]);

  const instruments = [...new Set(trades.map((trade) => trade.instrument))].sort();
  const active = [from, to, instrument, direction, result, confidence, context, minRr].filter(Boolean).length + selectedTags.length;
  function reset() { setFrom(""); setTo(""); setInstrument(""); setDirection(""); setResult(""); setConfidence(""); setContext(""); setMinRr(""); setSelectedTags([]); }

  if (loading) return <div className="panel flex min-h-72 items-center justify-center text-sm text-zinc-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Trades werden geladen</div>;
  if (error) return <div className="panel p-8"><p className="text-sm font-semibold">Supabase-Verbindung erforderlich</p><p className="mt-2 max-w-xl text-sm text-zinc-500">{error} Führen Sie das Schema aus und tragen Sie die Variablen aus .env.example ein.</p></div>;

  return <div className="space-y-5">
    <section className="panel p-5">
      <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold"><Filter className="h-4 w-4 text-lime" /> Filter {active > 0 && <span className="rounded-full bg-lime/10 px-2 py-0.5 text-[10px] text-lime">{active}</span>}</div>{active > 0 && <button onClick={reset} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-white"><X className="h-3.5 w-3.5" /> zurücksetzen</button>}</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <label><span className="label">Von</span><input className="field" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label><span className="label">Bis</span><input className="field" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label><span className="label">Instrument</span><select className="field" value={instrument} onChange={(e) => setInstrument(e.target.value)}><option value="">Alle</option>{instruments.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span className="label">Richtung</span><select className="field" value={direction} onChange={(e) => setDirection(e.target.value as Direction | "")}><option value="">Alle</option><option value="long">Long</option><option value="short">Short</option></select></label>
        <label><span className="label">Ergebnis</span><select className="field" value={result} onChange={(e) => setResult(e.target.value as ResultType | "")}><option value="">Alle</option><option value="win">Gewinn</option><option value="loss">Verlust</option><option value="breakeven">Break-even</option></select></label>
        <label><span className="label">Confidence</span><select className="field" value={confidence} onChange={(e) => setConfidence(e.target.value)}><option value="">Alle</option>{[1,2,3,4,5].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span className="label">Min. R:R</span><input className="field" type="number" min="0" step="0.1" value={minRr} onChange={(e) => setMinRr(e.target.value)} placeholder="z. B. 2" /></label>
        <label><span className="label">Kontext</span><span className="relative block"><Search className="absolute left-3 top-3.5 h-3.5 w-3.5 text-zinc-700" /><input className="field pl-9" value={context} onChange={(e) => setContext(e.target.value)} placeholder="Suchtext" /></span></label>
      </div>
      {tags.length > 0 && <div className="mt-4"><span className="label">Tags · alle gewählten müssen vorkommen</span><div className="flex flex-wrap gap-2">{tags.map((tag) => <button key={tag.id} onClick={() => setSelectedTags((current) => current.includes(tag.id) ? current.filter((id) => id !== tag.id) : [...current, tag.id])} className={`chip py-1.5 ${selectedTags.includes(tag.id) ? "chip-active" : ""}`}>{tag.name}</button>)}</div></div>}
    </section>

    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-4"><p className="text-sm font-semibold">{filtered.length} {filtered.length === 1 ? "Trade" : "Trades"}</p><p className="text-xs text-zinc-600">{trades.length !== filtered.length ? `${trades.length} gesamt` : "Neueste zuerst"}</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left"><thead className="bg-ink/50 text-[10px] uppercase tracking-[0.13em] text-zinc-600"><tr><th className="px-5 py-3">Datum</th><th className="px-4 py-3">Instrument</th><th className="px-4 py-3">Richtung</th><th className="px-4 py-3">Ergebnis</th><th className="px-4 py-3">R:R</th><th className="px-4 py-3">Confidence</th><th className="px-4 py-3">Tags</th><th className="px-5 py-3 text-right">Chart</th></tr></thead>
      <tbody className="divide-y divide-line">{filtered.map((trade) => <tr key={trade.id} className="group text-sm transition hover:bg-white/[0.02]">
        <td className="px-5 py-4"><Link href={`/trades/${trade.id}`} className="font-medium text-zinc-200 group-hover:text-lime">{new Intl.DateTimeFormat("de-DE").format(new Date(`${trade.trade_date}T12:00:00`))}</Link><span className="ml-2 text-xs text-zinc-600">{trade.trade_time?.slice(0,5)}</span></td>
        <td className="px-4 py-4 font-semibold">{trade.instrument}<span className="ml-2 text-xs font-normal text-zinc-600">{trade.timeframe}</span></td>
        <td className={`px-4 py-4 text-xs font-semibold uppercase ${trade.direction === "long" ? "text-emerald-400" : "text-rose-400"}`}>{trade.direction}</td>
        <td className={`px-4 py-4 font-semibold tabular-nums ${(trade.result_r ?? 0) > 0 ? "text-emerald-400" : (trade.result_r ?? 0) < 0 ? "text-rose-400" : "text-zinc-400"}`}>{trade.result_r === null ? "—" : `${trade.result_r > 0 ? "+" : ""}${trade.result_r.toFixed(2)}R`}</td>
        <td className="px-4 py-4 tabular-nums text-zinc-400">{trade.planned_rr?.toFixed(2) ?? "—"}</td><td className="px-4 py-4 text-zinc-400">{trade.confidence ?? "—"}/5</td>
        <td className="max-w-sm px-4 py-4"><div className="flex flex-wrap gap-1">{trade.tags.slice(0,3).map((tag) => <span key={tag.id} className="rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-400">{tag.name}</span>)}{trade.tags.length > 3 && <span className="px-1 py-1 text-[10px] text-zinc-600">+{trade.tags.length - 3}</span>}</div></td>
        <td className="px-5 py-4 text-right">{trade.screenshot_signed_url ? <img src={trade.screenshot_signed_url} alt="Chart" className="ml-auto h-10 w-16 rounded object-cover" /> : <ImageIcon className="ml-auto h-4 w-4 text-zinc-700" />}</td>
      </tr>)}{filtered.length === 0 && <tr><td colSpan={8} className="px-5 py-16 text-center text-sm text-zinc-600">Keine Trades für diese Filter.</td></tr>}</tbody></table></div>
    </section>
  </div>;
}
