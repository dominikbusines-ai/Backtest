"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { calculateStats } from "@/lib/stats";
import type { Trade, TradeMode } from "@/lib/types";
import { MetricCard } from "@/components/metric-card";
import { TradeReviews } from "@/components/trade-reviews";

const format = (value: number, suffix = "") => `${value.toFixed(2)}${suffix}`;
const pf = (value: number | null) => value === null ? "∞" : value.toFixed(2);

export function AnalysisDashboard() {
  const progressRequest = useRef(0);
  const [trades, setTrades] = useState<Trade[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [tradeMode, setTradeMode] = useState<TradeMode>("backtest");
  const [progressScope, setProgressScope] = useState<TradeMode | "all">("backtest"); const [progressLoading, setProgressLoading] = useState(false); const [progressError, setProgressError] = useState(""); const [progressResult, setProgressResult] = useState("");
  useEffect(() => { fetch("/api/trades").then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setTrades(data.trades); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Analyse konnte nicht geladen werden.")).finally(() => setLoading(false)); }, []);

  const modeTrades = useMemo(() => trades.filter((trade) => trade.trade_mode === tradeMode), [trades, tradeMode]);
  const stats = useMemo(() => calculateStats(modeTrades), [modeTrades]);
  const reviewedTrades = useMemo(() => modeTrades.filter((trade) => trade.review_observation || trade.review_mistake || trade.review_invalidation || trade.review_illogical), [modeTrades]);

  function changeTradeMode(value: TradeMode) {
    setTradeMode(value);
    changeProgressScope(value);
  }

  function changeProgressScope(value: TradeMode | "all") {
    progressRequest.current += 1;
    setProgressScope(value);
    setProgressLoading(false); setProgressError(""); setProgressResult("");
  }

  async function analyzeProgress() {
    const requestId = ++progressRequest.current;
    setProgressLoading(true); setProgressError(""); setProgressResult("");
    try {
      const response = await fetch("/api/analyze-progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trade_mode: progressScope }) });
      const data = await response.json() as { analysis?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Lernanalyse konnte nicht erstellt werden.");
      if (requestId !== progressRequest.current) return;
      setProgressResult(data.analysis || "Keine auswertbare Antwort erhalten.");
    } catch (reason) {
      if (requestId !== progressRequest.current) return;
      setProgressError(reason instanceof Error ? reason.message : "Lernanalyse konnte nicht erstellt werden.");
    } finally { if (requestId === progressRequest.current) setProgressLoading(false); }
  }

  if (loading) return <div className="panel flex min-h-72 items-center justify-center text-sm text-zinc-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyse wird berechnet</div>;
  if (error) return <div className="panel p-5 sm:p-8"><p className="text-sm font-semibold">Supabase-Verbindung erforderlich</p><p className="mt-2 text-sm text-zinc-500">{error}</p></div>;

  return <div className="space-y-8">
    <section className="panel p-2"><div className="grid grid-cols-2 gap-2">{(["backtest", "live"] as const).map((value) => { const count = trades.filter((trade) => trade.trade_mode === value).length; return <button key={value} type="button" onClick={() => changeTradeMode(value)} className={`rounded-xl px-4 py-3 text-left transition ${tradeMode === value ? "bg-lime/10 text-lime ring-1 ring-lime/30" : "text-zinc-500 hover:bg-white/[0.02] hover:text-zinc-300"}`}><span className="block text-sm font-bold">{value === "backtest" ? "Backtests" : "Live Trades"}</span><span className="mt-1 block text-[10px] font-normal text-zinc-600">{count} {count === 1 ? "Eintrag" : "Einträge"}</span></button>; })}</div></section>

    <section className="panel p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold">Lernfortschritt objektiv vergleichen</p><p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">Vergleicht Marktkontext, „Warum Entry?“, „Aufgefallen“ und „Missachtet“ in der Erstellungsreihenfolge. Die KI nennt Belege und Unsicherheiten. Eigene Notizen allein können tatsächlichen Lernfortschritt nicht sicher beweisen.</p></div><button type="button" onClick={() => void analyzeProgress()} disabled={progressLoading} className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-lime px-4 text-xs font-extrabold text-ink transition hover:bg-[#c5ff5b] disabled:cursor-not-allowed disabled:opacity-50"><Loader2 className={progressLoading ? "h-4 w-4 animate-spin" : "hidden"} />{progressLoading ? "Vergleich läuft…" : "Vergleich starten"}</button></div><div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,260px)_1fr]"><label><span className="label">Einträge für den Vergleich</span><select className="field" value={progressScope} onChange={(event) => changeProgressScope(event.target.value as TradeMode | "all")}><option value="backtest">Nur Backtests</option><option value="live">Nur Live Trades</option><option value="all">Backtests und Live Trades</option></select></label><div className="flex items-end text-xs leading-5 text-zinc-600">Der Vergleich sendet Ihre Notizen an Anthropic und nutzt Ihr API-Guthaben. Sortiert wird ausschließlich nach dem unsichtbaren Erstellungszeitstempel – nicht nach dem eingetragenen Marktdatum.</div></div>{progressError && <p role="alert" className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-400">{progressError}</p>}{progressResult && <div className="mt-5 border-t border-line pt-5"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-lime">Dokumentierter Lernvergleich</p><div className="whitespace-pre-wrap text-sm leading-6 text-zinc-300">{progressResult}</div></div>}</section>

    <section><div className="mb-4 flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold">{tradeMode === "live" ? "Live-Trade-Übersicht" : "Backtest-Übersicht"}</p><p className="mt-1 text-xs text-zinc-600">Wins und Losses folgen dem tatsächlichen R-Ergebnis. „Kein Trade“ wird separat gezählt.</p></div><p className="text-xs text-zinc-600">{modeTrades.length} Einträge</p></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
      <MetricCard label="Trades" value={String(stats.trades)} /><MetricCard label="Kein Trade" value={String(stats.noTrades)} /><MetricCard label="Wins" value={String(stats.wins)} tone="positive" /><MetricCard label="Losses" value={String(stats.losses)} tone="negative" /><MetricCard label="Break-even" value={String(stats.breakeven)} /><MetricCard label="Winrate" value={format(stats.winrate, "%")} /><MetricCard label="Ø R" value={format(stats.avgR, "R")} tone={stats.avgR > 0 ? "positive" : stats.avgR < 0 ? "negative" : "default"} />
      <MetricCard label="Gesamtes R" value={format(stats.totalR, "R")} tone={stats.totalR > 0 ? "positive" : stats.totalR < 0 ? "negative" : "default"} /><MetricCard label="Ø Gewinner" value={format(stats.avgWinner, "R")} /><MetricCard label="Ø Verlierer" value={format(stats.avgLoser, "R")} /><MetricCard label="Ø geplantes R:R" value={format(stats.avgPlannedRr)} /><MetricCard label="Profit Factor" value={pf(stats.profitFactor)} /><MetricCard label="Expectancy" value={format(stats.expectancy, "R")} />
    </div></section>


    <TradeReviews key={tradeMode} trades={reviewedTrades} />


  </div>;
}
