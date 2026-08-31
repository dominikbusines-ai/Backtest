import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BacktestForm } from "@/components/backtest-form";
import { getTrade } from "@/lib/trade-data";

export const dynamic = "force-dynamic";

export default async function EditTradePage({ params }: { params: Promise<{ id: string }> }) {
  let trade; try { trade = await getTrade((await params).id); } catch { return <AppShell><div className="panel p-8 text-sm text-zinc-500">Supabase ist noch nicht eingerichtet.</div></AppShell>; }
  if (!trade) notFound();
  return <AppShell><div className="mb-7"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lime">{trade.trade_mode === "live" ? "Live Trade bearbeiten" : "Backtest bearbeiten"}</p><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{trade.instrument} · {trade.trade_date}</h1></div><BacktestForm initialTrade={trade} /></AppShell>;
}
