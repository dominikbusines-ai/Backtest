/* eslint-disable @next/next/no-img-element -- Private Screenshots werden über kurzlebige signierte URLs geladen. */
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DeleteTradeButton } from "@/components/delete-trade-button";
import { getTrade } from "@/lib/trade-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  try {
    const trade = await getTrade((await params).id);
    if (!trade) return { title: "Trade nicht gefunden | EdgeLog" };
    const title = `${trade.instrument} ${trade.result_type === "no_trade" ? "KEIN TRADE" : trade.direction?.toUpperCase() ?? ""} · ${trade.trade_date} | EdgeLog`;
    const description = `${trade.trade_mode === "live" ? "Live Trade" : "Backtest"} · ${trade.result_type === "no_trade" ? "Kein Trade" : trade.result_r === null ? "ohne R-Ergebnis" : `${trade.result_r}R`} · ${trade.tags.map((tag) => tag.name).slice(0, 3).join(", ") || "ohne Tags"}`;
    return { title, description, openGraph: { title, description, images: [] }, twitter: { title, description, images: [] } };
  } catch { return { title: "Trade | EdgeLog", openGraph: { images: [] }, twitter: { images: [] } }; }
}

export default async function TradeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  let trade; try { trade = await getTrade((await params).id); } catch { return <AppShell><div className="panel p-8 text-sm text-zinc-500">Supabase ist noch nicht eingerichtet.</div></AppShell>; }
  if (!trade) notFound();
  const details = [["Typ", trade.trade_mode === "live" ? "Live Trade" : "Backtest"], ["Datum", new Intl.DateTimeFormat("de-DE").format(new Date(`${trade.trade_date}T12:00:00`))], ["Uhrzeit", trade.trade_time?.slice(0,5) ?? "—"], ["Instrument", trade.instrument], ["Timeframe", trade.timeframe ?? "—"], ["Richtung", trade.direction?.toUpperCase() ?? "—"], ["Entry", trade.entry ?? "—"], ["Stop Loss", trade.stop_loss ?? "—"], ["Take Profit", trade.take_profit ?? "—"], ["Geplantes R:R", trade.planned_rr?.toFixed(2) ?? "—"], ["Ergebnis", trade.result_type === "no_trade" ? "Kein Trade" : trade.result_r === null ? "—" : `${trade.result_r}R`], ["Confidence", trade.confidence ? `${trade.confidence}/5` : "—"], ["MFE / MAE", `${trade.mfe ?? "—"} / ${trade.mae ?? "—"}`]];
  return <AppShell>
    <div className="mb-6 flex flex-col items-stretch gap-4 sm:mb-7 sm:flex-row sm:items-end sm:justify-between"><div><Link href="/trades" className="mb-4 flex min-h-11 items-center gap-2 text-xs text-zinc-500 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> Alle Einträge</Link><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lime">{trade.trade_mode === "live" ? "Live-Trade-Detail" : "Backtest-Detail"}</p><h1 className="mt-2 text-2xl font-bold sm:text-3xl">{trade.instrument} · {trade.result_type === "no_trade" ? "KEIN TRADE" : trade.direction?.toUpperCase() ?? "—"}</h1></div><div className="grid grid-cols-2 gap-2 sm:flex"><Link href={`/trades/${trade.id}/bearbeiten`} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-600"><Pencil className="h-3.5 w-3.5" /> Bearbeiten</Link><DeleteTradeButton id={trade.id} /></div></div>
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <section className="panel overflow-hidden">{trade.screenshot_signed_url ? <img src={trade.screenshot_signed_url} alt={`Chart zu ${trade.instrument}`} className="min-h-52 w-full object-contain sm:min-h-72" /> : <div className="flex min-h-52 items-center justify-center text-sm text-zinc-700 sm:min-h-72">Kein Screenshot</div>}</section>
      <div className="space-y-6"><section className="panel p-4 sm:p-5"><div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:gap-x-5">{details.map(([label,value]) => <div key={label} className="min-w-0"><span className="label">{label}</span><p className="break-words text-sm font-medium text-zinc-200">{String(value)}</p></div>)}</div></section><section className="panel p-4 sm:p-5"><span className="label">Tags</span><div className="flex flex-wrap gap-2">{trade.tags.map((tag) => <span key={tag.id} className="chip chip-active py-1.5">{tag.name}</span>)}{!trade.tags.length && <span className="text-sm text-zinc-600">Keine Tags</span>}</div></section>{(trade.context || trade.entry_note) && <section className="panel space-y-5 p-4 sm:p-5">{trade.context && <div><span className="label">Marktkontext</span><p className="whitespace-pre-wrap text-sm leading-6 text-zinc-400">{trade.context}</p></div>}{trade.entry_note && <div><span className="label">{trade.result_type === "no_trade" ? "Warum kein Entry" : "Warum Entry?"}</span><p className="whitespace-pre-wrap text-sm leading-6 text-zinc-400">{trade.entry_note}</p></div>}</section>}{(trade.review_observation || trade.review_mistake || trade.review_invalidation || trade.review_illogical) && <section className="panel space-y-5 p-4 sm:p-5"><p className="text-sm font-semibold">Nachträgliche Auswertung</p>{trade.review_observation && <div><span className="label">Aufgefallen</span><p className="whitespace-pre-wrap text-sm leading-6 text-zinc-400">{trade.review_observation}</p></div>}{trade.result_type === "no_trade" ? trade.review_illogical && <div><span className="label">Was erschien unlogisch</span><p className="whitespace-pre-wrap text-sm leading-6 text-zinc-400">{trade.review_illogical}</p></div> : <>{trade.review_mistake && <div><span className="label">Missachtet</span><p className="whitespace-pre-wrap text-sm leading-6 text-zinc-400">{trade.review_mistake}</p></div>}{trade.review_invalidation && <div><span className="label">Entry entkräftet durch</span><p className="whitespace-pre-wrap text-sm leading-6 text-zinc-400">{trade.review_invalidation}</p></div>}</>}</section>}</div>
    </div>
  </AppShell>;
}
