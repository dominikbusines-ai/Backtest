import { AppShell } from "@/components/app-shell";
import { AnalysisDashboard } from "@/components/analysis-dashboard";

export default function AnalysisPage() {
  return <AppShell><div className="mb-7"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lime">Statistik</p><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Analyse</h1><p className="mt-2 text-sm text-zinc-600">Messen Sie, welche Beobachtungen Ihren Edge tatsächlich verbessern.</p></div><AnalysisDashboard /></AppShell>;
}
