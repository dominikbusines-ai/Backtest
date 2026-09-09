import { AppShell } from "@/components/app-shell";

export default function SettingsPage() {
  return <AppShell><div className="mb-7"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lime">Konfiguration</p><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Einstellungen</h1></div><div className="panel p-4 text-sm text-zinc-500 sm:p-5">Derzeit sind keine weiteren Einstellungen erforderlich.</div></AppShell>;
}
