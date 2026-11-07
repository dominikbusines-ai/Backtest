"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { mistakeReportSchema, type MistakeReport } from "@/lib/mistake-patterns";

const listKey = "edgelog:mistake-patterns:v1";
// Deduplicate development Strict Mode and back/forward navigation for one save.
const pending = new Map<string, Promise<MistakeReport>>();
async function requestReport(tradeId?: string, token?: string) {
  const key = tradeId && token ? `${tradeId}:${token}` : "";
  if (key && pending.has(key)) return pending.get(key)!;
  const request = (async () => {
    const response = await fetch("/api/mistake-patterns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(tradeId ? { trade_id: tradeId } : {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "KI-Prüfung fehlgeschlagen.");
    const parsed = mistakeReportSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige KI-Auswertung erhalten. Bitte erneut prüfen.");
    return parsed.data;
  })();
  if (key) {
    if (pending.size >= 20) pending.delete(pending.keys().next().value!);
    pending.set(key, request);
    request.catch(() => pending.delete(key));
  }
  return request;
}

const names = { live: "Live", backtest: "Backtest", note: "Notiz" };
const fields: Record<string, string> = { content: "Notiztext", context: "Marktkontext", entry_note: "Entry-Begründung", pre_trade_assessment: "Pre-Trade", review_observation: "Aufgefallen", review_mistake: "Missachtet", review_invalidation: "Entry entkräftet", review_illogical: "Unlogisch" };

export function MistakePatterns({ tradeId, autoToken }: { tradeId?: string; autoToken?: string }) {
  const [report, setReport] = useState<MistakeReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const storageKey = tradeId ? `edgelog:mistake-check:v1:${tradeId}:${autoToken || "manual"}` : listKey;
  const run = useCallback(async (automatic = false) => {
    const id = ++requestId.current;
    setBusy(true); setError("");
    try {
      const result = await requestReport(tradeId, automatic ? autoToken : undefined);
      if (id !== requestId.current) return;
      setReport(result);
      try {
        (tradeId ? window.sessionStorage : window.localStorage).setItem(storageKey, JSON.stringify(result));
      } catch { /* Storage is optional; show the successful check regardless. */ }
    } catch (reason) {
      if (id === requestId.current) setError(reason instanceof Error ? reason.message : "KI-Prüfung fehlgeschlagen.");
    } finally { if (id === requestId.current) setBusy(false); }
  }, [tradeId, autoToken, storageKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = (tradeId ? window.sessionStorage : window.localStorage).getItem(storageKey);
        const saved = stored ? mistakeReportSchema.safeParse(JSON.parse(stored)) : null;
        if (saved?.success) { setReport(saved.data); return; }
      } catch { /* Ignore unavailable or damaged local snapshots. */ }
      if (tradeId && autoToken) void run(true);
    }, 0);
    return () => { window.clearTimeout(timer); requestId.current += 1; };
  }, [tradeId, autoToken, storageKey, run]);

  const summary = !report ? "" : report.status === "no_trade" ? "Kein ausgeführter Trade: keine automatische Wiederholungsbewertung."
    : report.status === "insufficient" ? "Nicht beurteilbar: Es fehlen eigene Notizen oder Nachbetrachtungen."
    : report.status === "repeated" ? "Ein früher dokumentiertes Fehlermuster ist auch in diesem Live-Trade belegt."
    : report.status === "documented" ? tradeId ? "Fehler dokumentiert, aber keine frühere passende Erwähnung gefunden." : "Diese Verhaltensweisen sind in Ihren Texten dokumentiert."
    : `Keine ausreichend belegten Fehlermuster gefunden. Das bedeutet nicht, dass ${tradeId ? "der Trade fehlerfrei war" : "keine Fehler vorliegen"}.`;

  return <section className="panel p-4 sm:p-5" aria-label={tradeId ? "Live-Fehlerprüfung" : "Meine Fehlermuster"}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><h2 className="text-sm font-semibold">{tradeId ? "Live-Trade · Wiederholte Fehler?" : "Meine Fehlermuster"}</h2>
        <p className="mt-2 text-xs leading-5 text-zinc-500">{tradeId ? "Der Trade ist gespeichert. Diese separate KI-Prüfung vergleicht seine Angaben mit früher angelegten Einträgen und Notizen." : "Kurze Liste aus Ihren allgemeinen Notizen und Nachbetrachtungen – Live und Backtest gemeinsam, mit getrennt gekennzeichneten Belegen."}</p>
      </div>
      <button type="button" onClick={() => void run()} disabled={busy} className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-lime px-4 text-xs font-bold text-ink disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? "KI prüft…" : report || error ? "Erneut prüfen" : tradeId ? "Fehler prüfen" : "Liste erstellen"}</button>
    </div>
    <p className="mt-3 text-[11px] leading-5 text-zinc-600">Sendet die relevanten Texte an Anthropic und nutzt API-Guthaben. Keine Charakterbewertung. Textbelege sind Selbstauskünfte, kein unabhängiger Nachweis.</p>
    {busy && <p role="status" className="mt-4 text-sm text-zinc-300">{tradeId ? "Gespeichert. Wiederholungen werden geprüft…" : "Fehlermuster werden aus den gespeicherten Texten zusammengestellt…"}</p>}
    {error && <p role="alert" className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-sm text-amber-200">{tradeId && "Trade gespeichert. "}{error} {report && "Die unten stehende Auswertung ist weiterhin der ältere Stand."}</p>}
    {report && <div className="mt-5 space-y-4">
      <p className="text-[11px] text-zinc-500">Auswertungsstand: {new Date(report.generatedAt).toLocaleString("de-DE")} · {report.sourceCount} Texteinträge{tradeId && ` · Trade-Datum ${report.targetDate}`}</p>
      <p className={`text-sm ${report.status === "repeated" ? "text-amber-300" : "text-zinc-300"}`}>{summary}</p>
      {!tradeId && <p className="text-xs text-zinc-500">Gespeicherte Momentaufnahme in diesem Browser. Nach neuen oder bearbeiteten Einträgen bitte erneut prüfen. Es werden keine Originaltexte verändert.</p>}
      {tradeId && <p className="text-xs leading-5 text-zinc-500">Gilt für diesen Trade, nicht pauschal für den ganzen Tag. Verglichen wird nach Erstellungsreihenfolge. Später bearbeitete Trade-Texte können rückblickende Erkenntnisse enthalten.{report.excludedCount > 0 && ` ${report.excludedCount} spätere/zeitgleiche Einträge oder später bearbeitete allgemeine Notizen wurden nicht als frühere Belege verwendet.`}</p>}
      {report.patterns.length > 0 && <ul className="space-y-2">{report.patterns.map((pattern, index) => <li key={`${pattern.label}:${index}`} className="rounded-xl border border-line px-3 py-3">
        <p className="break-words text-sm font-semibold text-zinc-200">{pattern.label}</p>
        <p className="mt-1 text-xs text-zinc-500">{tradeId && (pattern.previous ? `${pattern.previous} frühere belegte ${pattern.previous === 1 ? "Erwähnung" : "Erwähnungen"} · ` : "Keine frühere Erwähnung · ")}{pattern.live} Live · {pattern.backtest} Backtest · {pattern.notes} Notizen</p>
        <details className="mt-2"><summary className="cursor-pointer py-1 text-xs text-lime">Textbelege anzeigen</summary><ul className="mt-2 space-y-3">{pattern.evidence.map((item, i) => <li key={`${item.source_id}:${i}`} className="border-l-2 border-line pl-3 text-xs leading-5"><Link href={item.href} className="text-lime underline underline-offset-4">{names[item.kind]} · {item.title}{item.date ? ` · ${item.date}` : ""}</Link><span className="block text-zinc-500">{fields[item.field] || item.field}{item.source_id === `trade:${tradeId}` ? " · Dieser Trade" : ""}</span><p className="break-words text-zinc-300">„{item.quote}“</p></li>)}</ul></details>
      </li>)}</ul>}
      <p className="text-[11px] leading-5 text-zinc-600">Gezählt werden unterschiedliche dokumentierte Einträge je Muster, nicht sicher unterschiedliche reale Fehlerereignisse. Mehrere Felder desselben Trades zählen nur einmal. Die KI kann Zusammenhänge übersehen oder falsch zuordnen; bitte die Belege prüfen.</p>
    </div>}
    {tradeId && <Link href="/fehlermuster" className="mt-4 inline-flex min-h-11 items-center text-xs font-semibold text-lime">Zur separaten Fehlermuster-Liste →</Link>}
  </section>;
}
