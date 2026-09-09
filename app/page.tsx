import { AppShell } from "@/components/app-shell";
import { NotesBoard } from "@/components/notes-board";

export default function HomePage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lime">Startseite</p><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Meine Notizen</h1><p className="mt-2 text-sm text-zinc-500">Platz für Einfälle, Erkenntnisse und alles, was Sie festhalten möchten.</p></div>
        <NotesBoard />
      </div>
    </AppShell>
  );
}
