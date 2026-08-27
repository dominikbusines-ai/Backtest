"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { calculateStats, hasEveryTag } from "@/lib/stats";
import type { Stats, Tag, Trade } from "@/lib/types";
import { MetricCard } from "@/components/metric-card";

const format = (value: number, suffix = "") => `${value.toFixed(2)}${suffix}`;
const pf = (value: number | null) => value === null ? "∞" : value.toFixed(2);

function TagChooser({ tags, value, onChange }: { tags: Tag[]; value: string[]; onChange: (ids: string[]) => void }) {
  return <div className="flex flex-wrap gap-2">{tags.map((tag) => <button key={tag.id} onClick={() => onChange(value.includes(tag.id) ? value.filter((id) => id !== tag.id) : [...value, tag.id])} className={`chip py-1.5 ${value.includes(tag.id) ? "chip-active" : ""}`}>{tag.name}</button>)}</div>;
}

function ComparisonStats({ stats }: { stats: Stats }) {
  return <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-5 lg:grid-cols-1 xl:grid-cols-5">{[["Trades", String(stats.trades)], ["Winrate", format(stats.winrate, "%")], ["Avg R", format(stats.avgR, "R")], ["Expectancy", format(stats.expectancy, "R")], ["Profit Factor", pf(stats.profitFactor)]].map(([label,value]) => <div key={label}><span className="label">{label}</span><p className="text-lg font-bold tabular-nums">{value}</p></div>)}</div>;
}

export function AnalysisDashboard() {
  const [trades, setTrades] = useState<Trade[]>([]); const [tags, setTags] = useState<Tag[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]); const [groupA, setGroupA] = useState<string[]>([]); const [groupB, setGroupB] = useState<string[]>([]);
  useEffect(() => { Promise.all([fetch("/api/trades"), fetch("/api/tags")]).then(async ([a,b]) => { const tradeData = await a.json(); const tagData = await b.json(); if (!a.ok) throw new Error(tradeData.error); if (!b.ok) throw new Error(tagData.error); setTrades(tradeData.trades); setTags(tagData.tags); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Analyse konnte nicht geladen werden.")).finally(() => setLoading(false)); }, []);

  const filtered = useMemo(() => trades.filter((trade) => hasEveryTag(trade, selected)), [trades, selected]);
  const stats = useMemo(() => calculateStats(filtered), [filtered]);
  const tagStats = useMemo(() => tags.map((tag) => ({ tag, stats: calculateStats(trades.filter((trade) => hasEveryTag(trade, [tag.id]))) })).filter((row) => row.stats.trades > 0).sort((a,b) => b.stats.trades - a.stats.trades), [trades, tags]);
  const statsA = useMemo(() => calculateStats(trades.filter((trade) => hasEveryTag(trade, groupA))), [trades, groupA]);
  const statsB = useMemo(() => calculateStats(trades.filter((trade) => hasEveryTag(trade, groupB))), [trades, groupB]);

  if (loading) return <div className="panel flex min-h-72 items-center justify-center text-sm text-zinc-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyse wird berechnet</div>;
  if (error) return <div className="panel p-8"><p className="text-sm font-semibold">Supabase-Verbindung erforderlich</p><p className="mt-2 text-sm text-zinc-500">{error}</p></div>;

  return <div className="space-y-8">
    <section className="panel p-5"><div className="mb-4 flex items-end justify-between"><div><p className="text-sm font-semibold">Auswertung nach Tags</p><p className="mt-1 text-xs text-zinc-600">Ein Trade muss alle gewählten Tags enthalten.</p></div>{selected.length > 0 && <button onClick={() => setSelected([])} className="text-xs text-zinc-500 hover:text-white">Auswahl leeren</button>}</div><TagChooser tags={tags} value={selected} onChange={setSelected} /></section>

    <section><div className="mb-4 flex items-end justify-between"><div><p className="text-sm font-semibold">{selected.length ? "Gefilterte Kennzahlen" : "Gesamtübersicht"}</p><p className="mt-1 text-xs text-zinc-600">Nur dokumentierte R-Ergebnisse fließen in R-Kennzahlen ein.</p></div><p className="text-xs text-zinc-600">{filtered.length} von {trades.length} Trades</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
      <MetricCard label="Trades" value={String(stats.trades)} /><MetricCard label="Wins" value={String(stats.wins)} tone="positive" /><MetricCard label="Losses" value={String(stats.losses)} tone="negative" /><MetricCard label="Break-even" value={String(stats.breakeven)} /><MetricCard label="Winrate" value={format(stats.winrate, "%")} /><MetricCard label="Ø R" value={format(stats.avgR, "R")} tone={stats.avgR > 0 ? "positive" : stats.avgR < 0 ? "negative" : "default"} />
      <MetricCard label="Gesamtes R" value={format(stats.totalR, "R")} tone={stats.totalR > 0 ? "positive" : stats.totalR < 0 ? "negative" : "default"} /><MetricCard label="Ø Gewinner" value={format(stats.avgWinner, "R")} /><MetricCard label="Ø Verlierer" value={format(stats.avgLoser, "R")} /><MetricCard label="Ø geplantes R:R" value={format(stats.avgPlannedRr)} /><MetricCard label="Profit Factor" value={pf(stats.profitFactor)} /><MetricCard label="Expectancy" value={format(stats.expectancy, "R")} />
    </div></section>

    <section className="panel overflow-hidden"><div className="border-b border-line px-5 py-4"><p className="text-sm font-semibold">Einzelne Tags</p><p className="mt-1 text-xs text-zinc-600">Schneller Überblick über die bisherige Stichprobe.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left"><thead className="bg-ink/50 text-[10px] uppercase tracking-[0.13em] text-zinc-600"><tr><th className="px-5 py-3">Tag</th><th className="px-4 py-3">Trades</th><th className="px-4 py-3">Winrate</th><th className="px-4 py-3">Ø R</th><th className="px-4 py-3">Gesamtes R</th><th className="px-5 py-3">Profit Factor</th></tr></thead><tbody className="divide-y divide-line">{tagStats.map(({ tag, stats: row }) => <tr key={tag.id} className="text-sm"><td className="px-5 py-3 font-medium">{tag.name}</td><td className="px-4 py-3 text-zinc-400">{row.trades}</td><td className="px-4 py-3 tabular-nums text-zinc-400">{format(row.winrate, "%")}</td><td className="px-4 py-3 tabular-nums">{format(row.avgR, "R")}</td><td className={`px-4 py-3 tabular-nums ${row.totalR > 0 ? "text-emerald-400" : row.totalR < 0 ? "text-rose-400" : ""}`}>{format(row.totalR, "R")}</td><td className="px-5 py-3 tabular-nums text-zinc-400">{pf(row.profitFactor)}</td></tr>)}{tagStats.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-zinc-600">Noch keine Tag-Daten vorhanden.</td></tr>}</tbody></table></div></section>

    <section><div className="mb-4"><p className="text-sm font-semibold">Gruppenvergleich</p><p className="mt-1 text-xs text-zinc-600">Prüfen Sie, ob eine zusätzliche Confluence messbaren Mehrwert liefert.</p></div><div className="grid gap-5 lg:grid-cols-[1fr_auto_1fr]">
      <div className="panel p-5"><span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-lime">Gruppe A</span><p className="mb-4 text-xs text-zinc-600">{groupA.length ? `${groupA.length} Tags kombiniert` : "Alle Trades"}</p><TagChooser tags={tags} value={groupA} onChange={setGroupA} /><div className="my-5 border-t border-line" /><ComparisonStats stats={statsA} /></div>
      <div className="hidden items-center lg:flex"><ArrowRight className="h-5 w-5 text-zinc-700" /></div>
      <div className="panel p-5"><span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-lime">Gruppe B</span><p className="mb-4 text-xs text-zinc-600">{groupB.length ? `${groupB.length} Tags kombiniert` : "Alle Trades"}</p><TagChooser tags={tags} value={groupB} onChange={setGroupB} /><div className="my-5 border-t border-line" /><ComparisonStats stats={statsB} /></div>
    </div></section>
  </div>;
}
