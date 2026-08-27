import { AppShell } from "@/components/app-shell";
import { TradesTable } from "@/components/trades-table";

export default function TradesPage() {
  return <AppShell><div className="mb-7"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lime">Journal</p><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Trades</h1><p className="mt-2 text-sm text-zinc-600">Filtern, öffnen und Muster im Detail prüfen.</p></div><TradesTable /></AppShell>;
}
