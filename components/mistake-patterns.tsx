"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { mistakeReportSchema, type MistakeReport, type MistakePattern } from "@/lib/mistake-patterns";
import { completedLiveCheck, readBrowserReport, rememberBrowserReport, requestMistakeReport } from "@/lib/mistake-report-client";
import { findResolution, visibleMistakePatterns } from "@/lib/mistake-resolutions";
import { useMistakeResolutions } from "@/components/use-mistake-resolutions";
import { mistakeAnchor, mistakeEvidenceHref, revealMistakeAnchor } from "@/lib/mistake-navigation";

const names = { live: "Live", backtest: "Backtest", note: "Notiz" };
const fields: Record<string, string> = { content: "Notiztext", context: "Marktkontext", entry_note: "Entry-Begründung", pre_trade_assessment: "Pre-Trade", review_observation: "Aufgefallen", review_mistake: "Missachtet", review_invalidation: "Entry entkräftet", review_illogical: "Unlogisch" };

function PatternItem({ pattern, tradeId, solved, disabled, onToggle }: { pattern: MistakePattern; tradeId?: string; solved: boolean; disabled: boolean; onToggle: () => void }) {
  return <li id={mistakeAnchor(pattern.label)} className="scroll-mt-32 rounded-xl border border-line px-3 py-3">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <p className="min-w-0 break-words text-sm font-semibold text-zinc-200">{pattern.label}</p>
      <button type="button" onClick={onToggle} disabled={disabled} aria-label={`${pattern.label}: ${solved ? "Wieder öffnen" : "Als gelöst markieren"}`} className="min-h-11 shrink-0 rounded-lg border border-line px-3 text-xs font-semibold text-lime disabled:opacity-50">{solved ? "Wieder öffnen" : "Als gelöst markieren"}</button>
    </div>
    <p className="mt-1 text-xs text-zinc-500">{tradeId && (pattern.previous ? `${pattern.previous} frühere belegte ${pattern.previous === 1 ? "Erwähnung" : "Erwähnungen"} · ` : "Keine frühere Erwähnung · ")}{pattern.live} Live · {pattern.backtest} Backtest · {pattern.notes} Notizen</p>
    <details className="mt-2"><summary className="cursor-pointer py-1 text-xs text-lime">Textbelege anzeigen</summary><ul className="mt-2 space-y-3">{pattern.evidence.map((item, i) => <li key={`${item.source_id}:${i}`} className="border-l-2 border-line pl-3 text-xs leading-5"><Link href={mistakeEvidenceHref(item.href, pattern.label, tradeId)} className="text-lime underline underline-offset-4">{names[item.kind]} · {item.title}{item.date ? ` · ${item.date}` : ""}</Link><span className="block text-zinc-500">{fields[item.field] || item.field}{item.source_id === `trade:${tradeId}` ? " · Dieser Trade" : ""}</span><p className="break-words text-zinc-300">„{item.quote}“</p></li>)}</ul></details>
  </li>;
}

export function MistakePatterns({ tradeId, autoToken }: { tradeId?: string; autoToken?: string }) {
  const resolution = useMistakeResolutions();
  const solvedSection = useRef<HTMLDetailsElement>(null);
  const restoredAnchor = useRef("");
  const [report, setReport] = useState<MistakeReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [persisted, setPersisted] = useState(false);
  const [browserSaved, setBrowserSaved] = useState(false);
  const [stale, setStale] = useState(false);
  const [notice, setNotice] = useState("");
  const requestId = useRef(0);
  const run = useCallback(async (automatic = false) => {
    const id = ++requestId.current;
    setBusy(true); setError("");
    try {
      const result = await requestMistakeReport(tradeId, automatic ? autoToken : undefined);
      if (id !== requestId.current) return;
      setReport(result.report); setPersisted(result.persisted); setBrowserSaved(result.browserSaved); setStale(false);
      setNotice(result.warning || (result.cached ? "Keine inhaltliche Änderung: gespeicherte Auswertung geladen, ohne neue KI-Anfrage." : ""));
      if (!result.persisted && !result.browserSaved) setNotice("Die Auswertung ist sichtbar, konnte aber weder in Supabase noch im Browser gespeichert werden. Bitte den Inhalt sichern.");
    } catch (reason) {
      if (id === requestId.current) setError(reason instanceof Error ? reason.message : "KI-Prüfung fehlgeschlagen.");
    } finally { if (id === requestId.current) setBusy(false); }
  }, [tradeId, autoToken]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(async () => {
      const local = readBrowserReport(tradeId);
      if (local) { setReport(local); setBrowserSaved(true); setNotice("Gespeicherte Browser-Kopie wird angezeigt; Cloud-Speicher wird geprüft."); }
      try {
        const response = await fetch(`/api/mistake-patterns${tradeId ? `?trade_id=${encodeURIComponent(tradeId)}` : ""}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Gespeicherte Liste nicht erreichbar.");
        if (!active) return;
        const saved = data.report ? mistakeReportSchema.safeParse(data.report) : null;
        if (data.report && !saved?.success) throw new Error("Die gespeicherte Liste hat ein ungültiges Format.");
        if (saved?.success && (!local || Date.parse(saved.data.generatedAt) >= Date.parse(local.generatedAt))) {
          setReport(saved.data); setPersisted(true); setStale(data.stale === true);
          setBrowserSaved(rememberBrowserReport(saved.data, tradeId));
          setNotice(typeof data.warning === "string" ? data.warning : "");
        } else {
          setNotice(local ? "Eine neuere Auswertung liegt nur in diesem Browser vor. Die Browser-Kopie bleibt sichtbar." : "Noch keine erfolgreiche Auswertung gespeichert. Einmal erstellen, danach ohne KI-Anfrage öffnen.");
          setStale(!!local);
        }
        setLoadingSaved(false);
        // Only a save-triggered Live check may auto-generate, never a list visit.
        if (tradeId && autoToken && (!saved?.success || data.stale === true) && !(local && completedLiveCheck(tradeId, autoToken))) void run(true);
      } catch (reason) {
        if (active) { setError(reason instanceof Error ? reason.message : "Gespeicherte Auswertung nicht erreichbar."); setLoadingSaved(false); }
      }
    }, 0);
    return () => { active = false; controller.abort(); window.clearTimeout(timer); requestId.current += 1; };
  }, [tradeId, autoToken, run]);

  useEffect(() => {
    if (loadingSaved || !resolution.ready) return;
    const restore = () => {
      const hash = window.location.hash;
      if (hash !== restoredAnchor.current && revealMistakeAnchor(hash)) restoredAnchor.current = hash;
    };
    restore();
    window.addEventListener("hashchange", restore);
    return () => window.removeEventListener("hashchange", restore);
  }, [loadingSaved, resolution.ready, report, resolution.entries]);

  const openPatterns = visibleMistakePatterns(report?.patterns ?? [], resolution.entries, !tradeId);
  const solvedEntries = resolution.entries.filter((entry) => entry.resolved && (!tradeId || report?.patterns.some((pattern) => findResolution(pattern, [entry]))));
  const summary = !report ? "" : report.patterns.length > 0 && !openPatterns.length ? "Die angezeigten Fehlermuster sind von Ihnen als gelöst markiert."
    : report.status === "no_trade" ? "Kein ausgeführter Trade: keine automatische Wiederholungsbewertung."
    : report.status === "insufficient" ? "Nicht beurteilbar: Es fehlen eigene Notizen oder Nachbetrachtungen."
    : openPatterns.some((pattern) => pattern.previous > 0) ? "Ein früher dokumentiertes offenes Fehlermuster ist auch in diesem Live-Trade belegt."
    : openPatterns.length ? tradeId ? "Fehler dokumentiert, aber keine frühere passende offene Erwähnung gefunden." : "Diese Verhaltensweisen sind in Ihren Texten dokumentiert."
    : `Keine ausreichend belegten Fehlermuster gefunden. Das bedeutet nicht, dass ${tradeId ? "der Trade fehlerfrei war" : "keine Fehler vorliegen"}.`;

  return <section className="panel p-4 sm:p-5" aria-label={tradeId ? "Live-Fehlerprüfung" : "Meine Fehlermuster"}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><h2 className="text-sm font-semibold">{tradeId ? "Live-Trade · Wiederholte Fehler?" : "Meine Fehlermuster"}</h2>
        <p className="mt-2 text-xs leading-5 text-zinc-500">{tradeId ? "Der Trade ist gespeichert. Diese separate KI-Prüfung vergleicht seine Angaben mit früher angelegten Einträgen und Notizen." : "Kurze Liste aus Ihren allgemeinen Notizen und Nachbetrachtungen – Live und Backtest gemeinsam, mit getrennt gekennzeichneten Belegen."}</p>
      </div>
      <button type="button" onClick={() => void run()} disabled={busy || loadingSaved || resolution.saving || !resolution.ready} className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-lime px-4 text-xs font-bold text-ink disabled:opacity-50">{(busy || loadingSaved) && <Loader2 className="h-4 w-4 animate-spin" />}{loadingSaved ? "Liste laden…" : busy ? "KI prüft…" : report ? "Aktualisieren" : tradeId ? "Fehler prüfen" : "Einmalig erstellen"}</button>
    </div>
    <p className="mt-3 text-[11px] leading-5 text-zinc-500">Das Öffnen lädt nur gespeicherte Ergebnisse – ohne KI-Anfrage. Erst Erstellen oder Aktualisieren bei geänderten Inhalten sendet Texte an Anthropic und nutzt API-Guthaben. Keine Charakterbewertung.</p>
    {busy && <p role="status" className="mt-4 text-sm text-zinc-300">{tradeId ? "Trade gespeichert. Wiederholungen werden geprüft…" : "Fehlermuster werden zusammengestellt…"} Das kann bis zu zwei Minuten dauern. Eine vorhandene Liste bleibt sichtbar.</p>}
    {notice && <p className="mt-3 text-xs leading-5 text-zinc-400">{notice}</p>}
    {resolution.error && <p role="alert" className="mt-3 text-sm text-amber-300">{resolution.error}</p>}
    {resolution.saving && <p role="status" className="mt-3 text-xs text-zinc-400">Markierung wird gespeichert…</p>}
    {error && <p role="alert" className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-sm text-amber-200">{tradeId && "Trade gespeichert. "}{error} {report && "Die unten stehende Auswertung ist weiterhin der ältere Stand."}</p>}
    {report && <div className="mt-5 space-y-4">
      <p className="text-[11px] text-zinc-500">Auswertungsstand: {new Date(report.generatedAt).toLocaleString("de-DE")} · {report.sourceCount} Texteinträge{tradeId && ` · Trade-Datum ${report.targetDate}`}</p>
      <p className={`text-sm ${openPatterns.some((pattern) => pattern.previous > 0) ? "text-amber-300" : "text-zinc-300"}`}>{summary}</p>
      {!!report.rejectedPatternCount && <p role="status" className="text-xs leading-5 text-amber-300">Teilweise bestätigte Auswertung: {report.rejectedPatternCount} KI-Zuordnung(en) konnten nicht sicher belegt werden und wurden weggelassen. Die bestätigten Muster sind gespeichert; diese Liste ist möglicherweise unvollständig.</p>}
      <p className="text-xs text-zinc-500">{persisted ? "In Supabase gespeichert – auch auf anderen Geräten abrufbar." : browserSaved ? "Gespeicherte Browser-Kopie." : "Noch nicht dauerhaft gespeichert."} Es werden keine Originaltexte verändert.</p>
      {stale && <p className="text-xs text-amber-300">Seit dieser Auswertung haben sich Einträge geändert oder die Aktualität ist unklar. Die bisherige Liste bleibt verfügbar. Bei Bedarf „Aktualisieren“ wählen.</p>}
      {tradeId && <p className="text-xs leading-5 text-zinc-500">Gilt für diesen Trade, nicht pauschal für den ganzen Tag. Verglichen wird nach Erstellungsreihenfolge. Später bearbeitete Trade-Texte können rückblickende Erkenntnisse enthalten.{report.excludedCount > 0 && ` ${report.excludedCount} spätere/zeitgleiche Einträge oder später bearbeitete allgemeine Notizen wurden nicht als frühere Belege verwendet.`}</p>}
      <p className="text-[11px] leading-5 text-zinc-600">Gezählt werden unterschiedliche dokumentierte Einträge je Muster, nicht sicher unterschiedliche reale Fehlerereignisse. Mehrere Felder desselben Trades zählen nur einmal. Die KI kann Zusammenhänge übersehen oder falsch zuordnen; bitte die Belege prüfen.</p>
    </div>}
    {openPatterns.length > 0 && <div className="mt-5 space-y-3"><h3 className="text-sm font-semibold">Offene Probleme ({openPatterns.length})</h3><ul className="space-y-2">{openPatterns.map((pattern, index) => <PatternItem key={`${pattern.label}:${index}`} pattern={pattern} tradeId={tradeId} solved={false} disabled={!resolution.ready || resolution.saving || busy} onToggle={() => { if (solvedSection.current) solvedSection.current.open = false; void resolution.changeStatus(pattern, true); }} />)}</ul></div>}
    {solvedEntries.length > 0 && <details ref={solvedSection} className="mt-5 rounded-xl border border-line p-3">
      <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-zinc-400">Bereits gelöste Probleme ({solvedEntries.length})</summary>
      <p className="mb-3 text-xs leading-5 text-zinc-500">Von Ihnen als gelöst markiert. Diese Probleme bleiben bei weiteren Prüfungen ausgeblendet, bis Sie sie wieder öffnen. Ihre Belege bleiben erhalten.</p>
      <ul className="space-y-2">{solvedEntries.map((entry) => <PatternItem key={entry.key} pattern={entry.pattern} tradeId={tradeId} solved disabled={!resolution.ready || resolution.saving || busy} onToggle={() => void resolution.changeStatus(entry.pattern, false)} />)}</ul>
    </details>}
    {tradeId && <Link href="/fehlermuster" className="mt-4 inline-flex min-h-11 items-center text-xs font-semibold text-lime">Zur separaten Fehlermuster-Liste →</Link>}
  </section>;
}
