"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

export function NoteSummary({ id, updatedAt, disabled }: { id: string; updatedAt: string; disabled: boolean }) {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cacheWarning, setCacheWarning] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const cacheKey = `edgelog:note-summary:v1:${id}`;

  useEffect(() => {
    let cachedSummary = "";
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached.updated_at === updatedAt && typeof cached.summary === "string" && cached.summary.length <= 800) cachedSummary = cached.summary;
        else localStorage.removeItem(cacheKey);
      }
    } catch { /* An unavailable cache must not prevent using the summary. */ }
    const frame = requestAnimationFrame(() => setSummary(cachedSummary));
    return () => { cancelAnimationFrame(frame); requestRef.current?.abort(); };
  }, [cacheKey, updatedAt]);

  async function summarize() {
    if (requestRef.current || disabled) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true); setError(""); setCacheWarning("");
    try {
      const response = await fetch("/api/notes/summary", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ id, updated_at: updatedAt }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Die Zusammenfassung konnte nicht erstellt werden.");
      if (typeof data.summary !== "string" || !data.summary.trim() || data.updated_at !== updatedAt) throw new Error("Keine passende Zusammenfassung erhalten.");
      setSummary(data.summary);
      try { localStorage.setItem(cacheKey, JSON.stringify({ updated_at: updatedAt, summary: data.summary })); }
      catch { setCacheWarning("Diese Kurzfassung kann gerade nicht auf dem Gerät zwischengespeichert werden."); }
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Die Zusammenfassung konnte nicht erstellt werden.");
    } finally {
      if (!controller.signal.aborted) { setLoading(false); requestRef.current = null; }
    }
  }

  return (
    <div className="mt-4">
      <button type="button" disabled={disabled || loading} onClick={() => void summarize()}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-lime/20 px-3 text-xs font-medium text-lime transition hover:bg-lime/5 disabled:cursor-not-allowed disabled:opacity-50">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {loading ? "Wird zusammengefasst…" : summary ? "Kurzfassung neu erstellen" : "Kurz zusammenfassen"}
      </button>
      {summary && <div role="status" className="mt-3 rounded-lg border border-lime/15 bg-lime/5 p-4"><p className="mb-2 text-[11px] font-semibold text-lime">Kern der Notiz · KI</p><p className="whitespace-pre-wrap break-words text-sm leading-6 text-zinc-300">{summary}</p><p className="mt-2 text-[11px] text-zinc-500">Auf diesem Gerät gespeichert. Bitte kurz auf Richtigkeit prüfen.</p></div>}
      {error && <p role="alert" className="mt-2 text-xs leading-5 text-rose-400">{error}</p>}
      {cacheWarning && <p role="status" className="mt-2 text-xs leading-5 text-amber-400">{cacheWarning}</p>}
    </div>
  );
}
