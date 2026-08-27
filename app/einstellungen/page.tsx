import { AppShell } from "@/components/app-shell";
import { SettingsManager } from "@/components/settings-manager";

export default function SettingsPage() {
  return <AppShell><div className="mb-7"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lime">Konfiguration</p><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Einstellungen</h1><p className="mt-2 text-sm text-zinc-600">Kategorien und Beobachtungen ohne feste Einschränkungen verwalten.</p></div><SettingsManager /></AppShell>;
}
