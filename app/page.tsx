import { AppShell } from "@/components/app-shell";
import { BacktestForm } from "@/components/backtest-form";

export default function HomePage() {
  return (
    <AppShell>
      <div className="mb-7"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lime">Neuer Backtest</p><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Trade erfassen</h1><p className="mt-2 text-sm text-zinc-600">Screenshot ablegen, erkannte Werte prüfen, Beobachtungen anklicken.</p></div>
      <BacktestForm />
    </AppShell>
  );
}
