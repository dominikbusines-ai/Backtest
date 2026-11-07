import { AppShell } from "@/components/app-shell";
import { MistakePatterns } from "@/components/mistake-patterns";

export default function MistakePatternsPage() {
  return <AppShell><div className="mx-auto max-w-3xl"><div className="mb-6"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lime">Selbstreflexion</p><h1 className="mt-2 text-2xl font-bold sm:text-3xl">Fehlermuster</h1><p className="mt-2 text-sm text-zinc-500">Was in Ihren eigenen Texten auffällt – kurz, nachvollziehbar und ohne pauschale Urteile.</p></div><MistakePatterns /></div></AppShell>;
}
