"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, NotebookPen, Pencil, Trash2 } from "lucide-react";
import { z } from "zod";
import type { JournalNote } from "@/lib/note-schema";

const storageKey = "edgelog:note-draft:v1";
const draftSchema = z.object({
  id: z.string().uuid(), title: z.string().max(120), content: z.string().max(10000),
  updated_at: z.string().datetime({ offset: true }).nullable(),
});
type Draft = z.infer<typeof draftSchema>;
const emptyDraft = (): Draft => ({ id: crypto.randomUUID(), title: "", content: "", updated_at: null });
const dateLabel = (value: string) => new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const orderNotes = (notes: JournalNote[]) => [...notes].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id.localeCompare(a.id));

export function NotesBoard() {
  const [notes, setNotes] = useState<JournalNote[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let restored: Draft | null = null;
    let warning = "";
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const result = draftSchema.safeParse(JSON.parse(raw));
        if (result.success) restored = result.data;
        else warning = "Der gespeicherte Entwurf konnte nicht wiederhergestellt werden.";
      }
    } catch { warning = "Die lokale Entwurfssicherung ist nicht verfügbar. Bitte vor dem Verlassen speichern."; }
    const frame = requestAnimationFrame(() => { setDraft(restored ?? emptyDraft()); setStorageError(warning); });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/notes", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Notizen konnten nicht geladen werden.");
        setNotes(orderNotes(data.notes));
      })
      .catch((reason) => { if (!controller.signal.aborted) setLoadError(reason instanceof Error ? reason.message : "Notizen konnten nicht geladen werden."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  // Store on input, so navigation immediately after typing cannot lose text.
  function keepDraft(next: Draft) {
    setDraft(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setStorageError(""); }
    catch { setStorageError("Der Entwurf kann auf diesem Gerät nicht gesichert werden. Bitte vor dem Verlassen speichern."); }
  }

  function resetDraft() {
    setDraft(emptyDraft());
    try { localStorage.removeItem(storageKey); setStorageError(""); }
    catch { setStorageError("Der lokale Entwurf konnte nicht entfernt werden."); }
  }

  function hasChanges() {
    if (!draft) return false;
    const original = notes.find((note) => note.id === draft.id);
    return original ? original.title !== draft.title || original.content !== draft.content : Boolean(draft.title || draft.content);
  }

  function edit(note: JournalNote) {
    if (draft?.id === note.id) { textareaRef.current?.focus(); return; }
    if (hasChanges() && !window.confirm("Ungespeicherten Entwurf verwerfen und diese Notiz bearbeiten?")) return;
    keepDraft({ id: note.id, title: note.title, content: note.content, updated_at: note.updated_at });
    setError(""); setMessage("");
    textareaRef.current?.focus();
    textareaRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function discard() {
    if (hasChanges() && !window.confirm("Diesen ungespeicherten Entwurf verwerfen?")) return;
    resetDraft(); setError(""); setMessage("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft?.content.trim() || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/notes", {
        method: draft.updated_at ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Die Notiz konnte nicht gespeichert werden.");
      const saved = data.note as JournalNote;
      setNotes((current) => orderNotes([saved, ...current.filter((note) => note.id !== saved.id)]));
      resetDraft(); setMessage("Notiz gespeichert.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Speichern fehlgeschlagen. Ihr Entwurf bleibt erhalten."); }
    finally { setBusy(false); }
  }

  async function remove(note: JournalNote) {
    if (busy || !window.confirm(`Notiz „${note.title || "Ohne Titel"}“ endgültig löschen?`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/notes", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: note.id, updated_at: note.updated_at }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Die Notiz konnte nicht gelöscht werden.");
      setNotes((current) => current.filter((item) => item.id !== note.id));
      if (draft?.id === note.id) resetDraft();
      setMessage("Notiz gelöscht.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Löschen fehlgeschlagen."); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-7">
      <form onSubmit={(event) => void save(event)} className="panel space-y-4 p-4 sm:p-6" aria-label="Notiz verfassen">
        <h2 className="text-sm font-semibold">{draft?.updated_at ? "Notiz bearbeiten" : "Gedanken festhalten"}</h2>
        <label className="block"><span className="label">Titel <span className="normal-case tracking-normal">· optional</span></span>
          <input className="field" maxLength={120} placeholder="Worum geht es?" value={draft?.title ?? ""} disabled={!draft || busy}
            onChange={(event) => { if (draft) { keepDraft({ ...draft, title: event.target.value }); setMessage(""); } }} />
        </label>
        <label className="block"><span className="label">Ihre Notiz</span>
          <textarea ref={textareaRef} className="field !h-auto min-h-48 resize-y py-3 leading-7" rows={7} maxLength={10000} required
            placeholder="Was ist Ihnen eingefallen? Was möchten Sie sich merken?" value={draft?.content ?? ""} disabled={!draft || busy}
            onChange={(event) => { if (draft) { keepDraft({ ...draft, content: event.target.value }); setMessage(""); } }} />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={!draft?.content.trim() || busy || loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-lime px-5 text-sm font-bold text-ink disabled:cursor-not-allowed disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {draft?.updated_at ? "Änderungen speichern" : "Notiz speichern"}
          </button>
          {draft && (draft.updated_at || draft.title || draft.content) && <button type="button" disabled={busy} onClick={discard} className="min-h-11 px-2 text-xs text-zinc-400 hover:text-white disabled:opacity-50">{draft.updated_at ? "Bearbeitung beenden" : "Entwurf verwerfen"}</button>}
        </div>
        <p className="text-xs leading-5 text-zinc-500">Entwürfe bleiben auf diesem Gerät erhalten. Gespeicherte Notizen sind auch auf Ihren anderen Geräten verfügbar.</p>
        {storageError && <p role="alert" className="text-xs leading-5 text-amber-400">{storageError}</p>}
      </form>

      {error && <p role="alert" className="panel border-rose-500/20 p-4 text-sm text-rose-400">{error}</p>}
      {message && <p role="status" className="text-sm text-lime">{message}</p>}
      <section aria-labelledby="saved-notes-title" className="space-y-3">
        <div className="flex items-center justify-between gap-3"><h2 id="saved-notes-title" className="text-sm font-semibold">Gespeicherte Notizen</h2><span className="text-xs text-zinc-500">Neueste zuerst</span></div>
        {loading && <p role="status" className="flex items-center gap-2 py-6 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /> Notizen werden geladen…</p>}
        {loadError && <div role="alert" className="panel p-4 text-sm leading-6 text-amber-400"><p>{loadError}</p><button type="button" onClick={() => window.location.reload()} className="mt-2 min-h-11 text-xs underline">Erneut laden</button></div>}
        {!loading && !loadError && notes.length === 0 && <div className="panel px-5 py-10 text-center"><NotebookPen className="mx-auto mb-3 h-6 w-6 text-zinc-600" /><p className="text-sm text-zinc-400">Noch keine Notizen.</p><p className="mt-1 text-xs text-zinc-500">Halten Sie oben Ihren ersten Gedanken fest.</p></div>}
        {notes.map((note) => <article key={note.id} className={`panel p-4 sm:p-5 ${draft?.id === note.id ? "border-lime/40" : ""}`}>
          <p className="text-xs text-zinc-500"><time dateTime={note.created_at}>{dateLabel(note.created_at)}</time>{note.updated_at !== note.created_at ? " · bearbeitet" : ""}</p>
          {note.title && <h3 className="mt-3 whitespace-pre-wrap break-words text-base font-semibold">{note.title}</h3>}
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-zinc-300">{note.content}</p>
          <div className="mt-4 flex flex-wrap gap-4 border-t border-line pt-2">
            <button type="button" disabled={busy || !draft} onClick={() => edit(note)} className="inline-flex min-h-11 items-center gap-2 text-xs font-medium text-zinc-400 hover:text-lime disabled:opacity-50"><Pencil className="h-3.5 w-3.5" /> Bearbeiten</button>
            <button type="button" disabled={busy} onClick={() => void remove(note)} className="inline-flex min-h-11 items-center gap-2 text-xs text-zinc-500 hover:text-rose-400 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Löschen</button>
          </div>
        </article>)}
      </section>
    </div>
  );
}
