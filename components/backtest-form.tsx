"use client";
/* eslint-disable @next/next/no-img-element -- Vorschauen nutzen lokale Blob- und kurzlebige signierte URLs. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Loader2, Plus, Sparkles, X } from "lucide-react";
import { usePendingScreenshot, type PendingScreenshot } from "@/components/pending-screenshot-provider";
import type { AnalysisResult, Direction, ResultType, Tag, Trade, TradeInput } from "@/lib/types";

const LOCAL_TAGS: Tag[] = [
  ["10000000-0000-4000-8000-000000000001", "1m BOS"], ["10000000-0000-4000-8000-000000000002", "5m BOS"],
  ["10000000-0000-4000-8000-000000000003", "FVG"], ["10000000-0000-4000-8000-000000000004", "FVG Pullback"],
  ["10000000-0000-4000-8000-000000000005", "IFVG"], ["10000000-0000-4000-8000-000000000006", "FVG respected"],
  ["10000000-0000-4000-8000-000000000007", "FVG disrespected"], ["10000000-0000-4000-8000-000000000008", "Orderflow disrespected"],
  ["10000000-0000-4000-8000-000000000009", "Liquidity Sweep"], ["10000000-0000-4000-8000-000000000010", "Sell-Side Liquidity"],
  ["10000000-0000-4000-8000-000000000011", "Buy-Side Liquidity"], ["10000000-0000-4000-8000-000000000012", "5m Abflachung"],
  ["10000000-0000-4000-8000-000000000013", "Konsolidierung"], ["10000000-0000-4000-8000-000000000014", "Trendfortsetzung"],
  ["10000000-0000-4000-8000-000000000015", "Reversal"], ["10000000-0000-4000-8000-000000000016", "HTF FVG"],
  ["10000000-0000-4000-8000-000000000017", "4h FVG"], ["10000000-0000-4000-8000-000000000018", "Rejection"],
  ["10000000-0000-4000-8000-000000000019", "Displacement"],
].map(([id, name]) => ({ id, name, category_id: null, is_default: true }));

const today = () => new Date().toISOString().slice(0, 10);

type FormState = {
  trade_date: string; trade_time: string; instrument: string; timeframe: string; direction: Direction;
  entry: string; stop_loss: string; take_profit: string; result_r: string; result_type: ResultType;
  confidence: number | null; context: string; entry_note: string; review_observation: string;
  review_mistake: string; review_invalidation: string; mfe: string; mae: string;
};

const emptyForm = (): FormState => ({
  trade_date: today(), trade_time: "", instrument: "", timeframe: "", direction: "long", entry: "", stop_loss: "",
  take_profit: "", result_r: "", result_type: "win", confidence: null, context: "", entry_note: "", review_observation: "",
  review_mistake: "", review_invalidation: "", mfe: "", mae: "",
});

const num = (value: string) => value.trim() === "" ? null : Number(value);
const displayNum = (value: number | null) => value === null ? "" : String(value);

async function optimizeImage(file: File): Promise<File> {
  if (file.size <= 4 * 1024 * 1024) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob) throw new Error("Bild konnte nicht vorbereitet werden.");
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}

export function BacktestForm({ initialTrade }: { initialTrade?: Trade }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { screenshot: pendingScreenshot, setScreenshot: setPendingScreenshot, clearScreenshot: clearPendingScreenshot } = usePendingScreenshot();
  const [form, setForm] = useState<FormState>(() => initialTrade ? {
    trade_date: initialTrade.trade_date, trade_time: initialTrade.trade_time?.slice(0, 5) ?? "", instrument: initialTrade.instrument,
    timeframe: initialTrade.timeframe ?? "", direction: initialTrade.direction, entry: displayNum(initialTrade.entry),
    stop_loss: displayNum(initialTrade.stop_loss), take_profit: displayNum(initialTrade.take_profit), result_r: displayNum(initialTrade.result_r),
    result_type: initialTrade.result_type, confidence: initialTrade.confidence, context: initialTrade.context ?? "", entry_note: initialTrade.entry_note ?? "",
    review_observation: initialTrade.review_observation ?? "", review_mistake: initialTrade.review_mistake ?? "", review_invalidation: initialTrade.review_invalidation ?? "",
    mfe: displayNum(initialTrade.mfe), mae: displayNum(initialTrade.mae),
  } : emptyForm());
  const [tags, setTags] = useState<Tag[]>(LOCAL_TAGS);
  const [selected, setSelected] = useState<string[]>(initialTrade?.tags.map((tag) => tag.id) ?? []);
  const [detected, setDetected] = useState<Set<string>>(new Set());
  const [editedScreenshot, setEditedScreenshot] = useState<PendingScreenshot>({
    path: initialTrade?.screenshot_url ?? "",
    preview: initialTrade?.screenshot_signed_url ?? "",
    fileName: "",
  });
  const [isDragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [addingTag, setAddingTag] = useState(false);
  const [newTag, setNewTag] = useState("");
  const screenshot = initialTrade ? editedScreenshot : pendingScreenshot;
  const { path: screenshotPath, preview, fileName } = screenshot;

  function updateScreenshot(update: Partial<PendingScreenshot>) {
    if (initialTrade) setEditedScreenshot((current) => ({ ...current, ...update }));
    else setPendingScreenshot((current) => ({ ...current, ...update }));
  }

  function removeScreenshot() {
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    if (initialTrade) setEditedScreenshot({ path: "", preview: "", fileName: "" });
    else clearPendingScreenshot();
    if (inputRef.current) inputRef.current.value = "";
    setMessage(null);
  }

  useEffect(() => {
    fetch("/api/tags").then(async (response) => response.ok ? response.json() : Promise.reject()).then((data) => setTags(data.tags)).catch(() => undefined);
  }, []);

  const plannedRr = useMemo(() => {
    const entry = num(form.entry); const stop = num(form.stop_loss); const tp = num(form.take_profit);
    if (entry === null || stop === null || tp === null || entry === stop) return null;
    return Math.abs((tp - entry) / (entry - stop));
  }, [form.entry, form.stop_loss, form.take_profit]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function toggle(tag: string) { setSelected((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]); }

  async function handleFile(file?: File) {
    if (!file) return;
    if (!(["image/png", "image/jpeg", "image/webp"].includes(file.type))) { setMessage({ type: "error", text: "Bitte PNG, JPG oder WebP auswählen." }); return; }
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    const localPreview = URL.createObjectURL(file);
    setAnalyzing(true); setMessage(null); updateScreenshot({ path: "", fileName: file.name, preview: localPreview });
    try {
      const optimized = await optimizeImage(file);
      const body = new FormData(); body.append("image", optimized);
      const response = await fetch("/api/analyze", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analyse fehlgeschlagen.");
      applyAnalysis(data as AnalysisResult, localPreview);
      setMessage({ type: "ok", text: "Screenshot analysiert. Bitte erkannte Werte kurz prüfen." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Analyse fehlgeschlagen." });
    } finally { setAnalyzing(false); }
  }

  function applyAnalysis(data: AnalysisResult, localPreview: string) {
    const recognized = new Set<string>();
    setForm((current) => {
      const next = { ...current };
      const assign = <K extends keyof FormState>(key: K, value: FormState[K] | null) => { if (value !== null && value !== "") { next[key] = value as FormState[K]; recognized.add(key); } };
      assign("instrument", data.instrument); assign("trade_date", data.date); assign("trade_time", data.time); assign("timeframe", data.timeframe);
      assign("direction", data.direction); assign("entry", data.entry === null ? null : String(data.entry)); assign("stop_loss", data.stopLoss === null ? null : String(data.stopLoss));
      assign("take_profit", data.takeProfit === null ? null : String(data.takeProfit)); assign("result_type", data.resultType); assign("result_r", data.resultR === null ? null : String(data.resultR));
      return next;
    });
    const names = new Set(data.detectedObservations.map((name) => name.toLocaleLowerCase("de")));
    setSelected((current) => [...new Set([...current, ...tags.filter((tag) => names.has(tag.name.toLocaleLowerCase("de"))).map((tag) => tag.id)])]);
    if (data.screenshotUrl) URL.revokeObjectURL(localPreview);
    setDetected(recognized); updateScreenshot({ path: data.screenshotPath, preview: data.screenshotUrl || localPreview });
  }

  async function createTag() {
    const name = newTag.trim(); if (!name) return;
    try {
      const response = await fetch("/api/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, category_id: null }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setTags((current) => [...current, data.tag]); setSelected((current) => [...current, data.tag.id]); setNewTag(""); setAddingTag(false);
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "Tag konnte nicht erstellt werden." }); }
  }

  async function save() {
    if (!form.trade_date || !form.instrument.trim()) { setMessage({ type: "error", text: "Datum und Instrument sind erforderlich." }); return; }
    setSaving(true); setMessage(null);
    const body: TradeInput = {
      trade_date: form.trade_date, trade_time: form.trade_time || null, instrument: form.instrument.trim().toUpperCase(), timeframe: form.timeframe.trim() || null,
      direction: form.direction, entry: num(form.entry), stop_loss: num(form.stop_loss), take_profit: num(form.take_profit), planned_rr: plannedRr,
      result_r: num(form.result_r), result_type: form.result_type, confidence: form.confidence, context: form.context.trim() || null,
      entry_note: form.entry_note.trim() || null, review_observation: form.review_observation.trim() || null,
      review_mistake: form.review_mistake.trim() || null, review_invalidation: form.review_invalidation.trim() || null,
      screenshot_url: screenshotPath || null, mfe: num(form.mfe), mae: num(form.mae), tag_ids: selected,
    };
    try {
      const response = await fetch(initialTrade ? `/api/trades/${initialTrade.id}` : "/api/trades", { method: initialTrade ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      if (initialTrade) { router.push(`/trades/${initialTrade.id}`); router.refresh(); return; }
      setForm(emptyForm()); setSelected([]); setDetected(new Set()); clearPendingScreenshot();
      setMessage({ type: "ok", text: "Trade gespeichert. Das Formular ist bereit für den nächsten Trade." });
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "Trade konnte nicht gespeichert werden." }); }
    finally { setSaving(false); }
  }

  const marker = (key: keyof FormState) => detected.has(key) ? <span className="ml-1 normal-case tracking-normal text-lime">· KI erkannt</span> : null;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_370px]">
      <div className="space-y-6">
        <div onDragEnter={(e) => { e.preventDefault(); setDragging(true); }} onDragOver={(e) => e.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); void handleFile(e.dataTransfer.files[0]); }} className={`panel relative min-h-52 overflow-hidden border-dashed transition ${isDragging ? "border-lime bg-lime/[0.04]" : "hover:border-lime/40"}`}>
          {preview && <img src={preview} alt="Ausgewählter Chart-Screenshot" className="absolute inset-0 h-full w-full object-cover opacity-25" />}
          {(preview || screenshotPath) && <button type="button" onClick={removeScreenshot} disabled={analyzing} className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-ink/90 px-3 py-2 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Screenshot entfernen"><X className="h-3.5 w-3.5" /> Entfernen</button>}
          <button type="button" onClick={() => inputRef.current?.click()} disabled={analyzing} className="relative z-10 flex min-h-52 w-full flex-col items-center justify-center p-8 text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-ink/90 text-zinc-400">{analyzing ? <Loader2 className="h-5 w-5 animate-spin text-lime" /> : <ImagePlus className="h-5 w-5" />}</span>
            <span className="text-base font-semibold">{analyzing ? "Screenshot wird analysiert…" : fileName || (initialTrade ? "Screenshot ersetzen" : "Chart Screenshot hochladen")}</span>
            <span className="mt-2 text-xs text-zinc-500">PNG, JPG oder WebP ablegen · große Bilder werden optimiert</span>
            <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-lime/10 px-3 py-1.5 text-[11px] font-semibold text-lime"><Sparkles className="h-3 w-3" /> Ausschließlich sichtbare Daten</span>
          </button>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => void handleFile(event.target.files?.[0])} />
        </div>

        <section className="panel p-5 lg:p-6">
          <div className="mb-5"><p className="text-sm font-semibold">Trade-Daten</p><p className="mt-1 text-xs text-zinc-600">Erkannte Werte bleiben immer bearbeitbar.</p></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label><span className="label">Datum{marker("trade_date")}</span><input className="field" type="date" value={form.trade_date} onChange={(e) => update("trade_date", e.target.value)} /></label>
            <label><span className="label">Uhrzeit{marker("trade_time")}</span><input className="field" type="time" value={form.trade_time} onChange={(e) => update("trade_time", e.target.value)} /></label>
            <label><span className="label">Instrument{marker("instrument")}</span><input className="field" placeholder="MNQ" value={form.instrument} onChange={(e) => update("instrument", e.target.value)} /></label>
            <label><span className="label">Timeframe{marker("timeframe")}</span><input className="field" placeholder="1m" value={form.timeframe} onChange={(e) => update("timeframe", e.target.value)} /></label>
            <div className="sm:col-span-2"><span className="label">Richtung{marker("direction")}</span><div className="grid grid-cols-2 gap-2 rounded-lg bg-ink p-1">{(["long", "short"] as const).map((value) => <button key={value} type="button" onClick={() => update("direction", value)} className={`h-9 rounded-md text-xs font-bold uppercase transition ${form.direction === value ? value === "long" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400" : "text-zinc-600"}`}>{value}</button>)}</div></div>
            <label><span className="label">Confidence</span><div className="flex h-11 gap-1">{[1,2,3,4,5].map((value) => <button key={value} type="button" onClick={() => update("confidence", value)} className={`flex-1 rounded-md border text-xs font-semibold ${form.confidence === value ? "border-lime/50 bg-lime/10 text-lime" : "border-line text-zinc-500"}`}>{value}</button>)}</div></label>
            <label><span className="label">Ergebnis{marker("result_type")}</span><select className="field" value={form.result_type} onChange={(e) => update("result_type", e.target.value as ResultType)}><option value="win">Gewinn</option><option value="loss">Verlust</option><option value="breakeven">Break-even</option></select></label>
            <label><span className="label">Entry{marker("entry")}</span><input className="field" type="number" step="any" placeholder="23450.25" value={form.entry} onChange={(e) => update("entry", e.target.value)} /></label>
            <label><span className="label">Stop Loss{marker("stop_loss")}</span><input className="field" type="number" step="any" placeholder="23472.50" value={form.stop_loss} onChange={(e) => update("stop_loss", e.target.value)} /></label>
            <label><span className="label">Take Profit{marker("take_profit")}</span><input className="field" type="number" step="any" placeholder="23395.00" value={form.take_profit} onChange={(e) => update("take_profit", e.target.value)} /></label>
            <label><span className="label">Geplantes R:R</span><input className="field" readOnly value={plannedRr === null ? "" : plannedRr.toFixed(2)} placeholder="Wird berechnet" /></label>
          </div>
        </section>

        <section className="panel p-5 lg:p-6">
          <div className="mb-5"><p className="text-sm font-semibold">Nachträgliche Auswertung <span className="font-normal text-zinc-600">· optional</span></p><p className="mt-1 text-xs text-zinc-600">Eigene Erkenntnisse werden später gesammelt in der Analyse angezeigt.</p></div>
          <div className="grid gap-4 lg:grid-cols-3">
            <label><span className="label">Was ist aufgefallen?</span><textarea className="field min-h-32 resize-y py-3" maxLength={5000} value={form.review_observation} onChange={(e) => update("review_observation", e.target.value)} placeholder="Was war im Nachhinein deutlich zu erkennen?" /></label>
            <label><span className="label">Was wurde missachtet?</span><textarea className="field min-h-32 resize-y py-3" maxLength={5000} value={form.review_mistake} onChange={(e) => update("review_mistake", e.target.value)} placeholder="Welches Signal oder Risiko wurde übersehen?" /></label>
            <label><span className="label">Was entkräftet den Entry?</span><textarea className="field min-h-32 resize-y py-3" maxLength={5000} value={form.review_invalidation} onChange={(e) => update("review_invalidation", e.target.value)} placeholder="Was nimmt der ursprünglichen Entry-Logik ihre Gültigkeit?" /></label>
          </div>
        </section>

        <section className="panel p-5 lg:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">Bestätigungen & Beobachtungen</p><p className="mt-1 text-xs text-zinc-600">Mehrfachauswahl möglich.</p></div><button type="button" onClick={() => setAddingTag(true)} className="flex items-center gap-1 text-xs font-semibold text-lime"><Plus className="h-3.5 w-3.5" /> hinzufügen</button></div>
          {addingTag && <div className="mb-4 flex gap-2"><input autoFocus className="field" maxLength={80} placeholder="Eigener Tag" value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void createTag(); if (e.key === "Escape") setAddingTag(false); }} /><button type="button" onClick={() => void createTag()} className="rounded-lg bg-lime px-4 text-ink"><Check className="h-4 w-4" /></button><button type="button" onClick={() => setAddingTag(false)} className="rounded-lg border border-line px-4 text-zinc-500"><X className="h-4 w-4" /></button></div>}
          <div className="flex flex-wrap gap-2">{tags.map((tag) => <button type="button" key={tag.id} onClick={() => toggle(tag.id)} className={`chip ${selected.includes(tag.id) ? "chip-active" : ""}`}>{tag.name}</button>)}</div>
        </section>
      </div>

      <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
        <section className="panel p-5"><p className="mb-4 text-sm font-semibold">Notizen</p><label><span className="label">Marktkontext <i className="normal-case tracking-normal">optional</i></span><textarea className="field min-h-32 resize-y py-3" value={form.context} onChange={(e) => update("context", e.target.value)} placeholder="5m bearish, Verkaufsdruck flacht ab…" /></label><label className="mt-4 block"><span className="label">Warum Entry? <i className="normal-case tracking-normal">optional</i></span><textarea className="field min-h-24 resize-y py-3" value={form.entry_note} onChange={(e) => update("entry_note", e.target.value)} placeholder="Kurze Notiz zum Entry" /></label></section>
        <section className="panel p-5"><label><span className="label">Tatsächliches Ergebnis in R{marker("result_r")}</span><input className="field text-lg font-bold" type="number" step="any" placeholder="z. B. 1.82 oder -1" value={form.result_r} onChange={(e) => update("result_r", e.target.value)} /></label><div className="mt-4 grid grid-cols-2 gap-3"><label><span className="label">MFE</span><input className="field" type="number" step="any" placeholder="optional" value={form.mfe} onChange={(e) => update("mfe", e.target.value)} /></label><label><span className="label">MAE</span><input className="field" type="number" step="any" placeholder="optional" value={form.mae} onChange={(e) => update("mae", e.target.value)} /></label></div></section>
        {message && <div role="status" className={`rounded-xl border p-3 text-xs ${message.type === "ok" ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400" : "border-rose-500/20 bg-rose-500/5 text-rose-400"}`}>{message.text}</div>}
        <button type="button" onClick={() => void save()} disabled={saving || analyzing} className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-lime text-sm font-extrabold text-ink transition hover:bg-[#c5ff5b] disabled:cursor-not-allowed disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{initialTrade ? "Änderungen speichern" : "Trade speichern"}</button>
        {!initialTrade && <p className="text-center text-[11px] text-zinc-700">Nach dem Speichern ist das Formular direkt bereit.</p>}
      </aside>
    </div>
  );
}
