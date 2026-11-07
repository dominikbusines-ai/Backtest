import { mistakeReportSchema, type MistakeReport } from "@/lib/mistake-patterns";

export const reportStorageKey = (tradeId?: string) => tradeId ? `edgelog:mistake-check:v2:${tradeId}` : "edgelog:mistake-patterns:v1";
export function readBrowserReport(tradeId?: string): MistakeReport | null {
  try {
    const raw = window.localStorage.getItem(reportStorageKey(tradeId));
    const parsed = raw ? mistakeReportSchema.safeParse(JSON.parse(raw)) : null;
    return parsed?.success ? parsed.data : null;
  } catch { return null; }
}
export function rememberBrowserReport(report: MistakeReport, tradeId?: string) {
  try { window.localStorage.setItem(reportStorageKey(tradeId), JSON.stringify(report)); return true; }
  catch { return false; }
}
export function completedLiveCheck(tradeId: string, token: string) {
  try { return window.localStorage.getItem(`${reportStorageKey(tradeId)}:token`) === token; }
  catch { return false; }
}

type ReportResult = { report: MistakeReport; persisted: boolean; warning: string; cached: boolean; browserSaved: boolean };
const pending = new Map<string, Promise<ReportResult>>();
export async function requestMistakeReport(tradeId?: string, token?: string): Promise<ReportResult> {
  const key = tradeId && token ? `${tradeId}:${token}` : "";
  if (key && pending.has(key)) return pending.get(key)!;
  const request = (async () => {
    const response = await fetch("/api/mistake-patterns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(tradeId ? { trade_id: tradeId } : {}) });
    const data = await response.json().catch(() => { throw new Error("Der Server hat die Prüfung unterbrochen. Die bisher gespeicherte Liste bleibt erhalten."); });
    if (!response.ok) throw new Error(data.error || "KI-Prüfung fehlgeschlagen.");
    const parsed = mistakeReportSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige KI-Auswertung erhalten. Bitte erneut prüfen.");
    // Save even when the view has unmounted during the analysis.
    const browserSaved = rememberBrowserReport(parsed.data, tradeId);
    if (browserSaved && tradeId && token) {
      try { window.localStorage.setItem(`${reportStorageKey(tradeId)}:token`, token); } catch { /* Optional duplicate protection. */ }
    }
    return { report: parsed.data, persisted: data.persisted === true, cached: data.cached === true,
      warning: typeof data.storageWarning === "string" ? data.storageWarning : "", browserSaved };
  })();
  if (key) {
    if (pending.size >= 20) pending.delete(pending.keys().next().value!);
    pending.set(key, request);
    request.catch(() => pending.delete(key));
  }
  return request;
}
