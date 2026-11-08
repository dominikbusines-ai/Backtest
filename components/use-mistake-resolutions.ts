"use client";

import { useEffect, useRef, useState } from "react";
import type { MistakePattern } from "@/lib/mistake-patterns";
import { findResolution, resolutionKey, resolutionSchema, resolutionsSchema, type MistakeResolution } from "@/lib/mistake-resolutions";

const storageKey = "edgelog:mistake-resolutions:v1";
function remember(entries: MistakeResolution[]) {
  try { window.localStorage.setItem(storageKey, JSON.stringify(entries)); } catch { /* Cloud remains authoritative. */ }
}

export function useMistakeResolutions() {
  const [entries, setEntries] = useState<MistakeResolution[]>([]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const local = window.localStorage.getItem(storageKey);
        if (local) {
          const parsed = resolutionsSchema.safeParse(JSON.parse(local));
          if (parsed.success) setEntries(parsed.data);
        }
      } catch { /* The server can load the status even without browser storage. */ }
      try {
        const response = await fetch("/api/mistake-patterns/resolutions", { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Problemstatus nicht erreichbar.");
        const entries = resolutionsSchema.parse(data.resolutions);
        if (!controller.signal.aborted) { setEntries(entries); remember(entries); setReady(true); }
      } catch {
        if (!controller.signal.aborted) setError("Gelöste Probleme konnten nicht aktuell geladen werden. Bitte die Seite neu laden, bevor Sie Markierungen ändern.");
      }
    }, 0);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, []);

  async function changeStatus(pattern: MistakePattern, resolved: boolean) {
    if (!ready || pending.current) return;
    pending.current = true; setSaving(true); setError("");
    const existing = findResolution(pattern, entries);
    // A renamed AI pattern retains the original problem's identity, including on reopening.
    const original = existing?.pattern ?? pattern;
    const key = existing?.key ?? resolutionKey(original.label);
    const previous = entries;
    const optimistic = { key, pattern: original, resolved, updatedAt: new Date().toISOString() };
    setEntries([...previous.filter((entry) => entry.key !== key), optimistic]);
    try {
      const response = await fetch("/api/mistake-patterns/resolutions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pattern: original, resolved }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Markierung nicht gespeichert.");
      const saved = resolutionSchema.parse(data.resolution);
      const next = [...previous.filter((entry) => entry.key !== key), saved];
      // Persist even if the user navigated away while the request completed.
      remember(next); setEntries(next);
    } catch {
      setEntries(previous);
      setError("Die Markierung konnte nicht gespeichert werden und wurde zurückgenommen. Bitte erneut versuchen.");
    } finally { pending.current = false; setSaving(false); }
  }

  return { entries, ready, saving, error, changeStatus };
}
