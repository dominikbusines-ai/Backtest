import type { TradeMode } from "@/lib/types";

// CME customary US equity-index roll: 14 September 2026 (expiry: 18 September).
// https://www.cmegroup.com/trading/equity-index/rolldates.html
// App selection switches at 00:00 Europe/Berlin, not at the expiration time.
export const SEPTEMBER_ROLLOVER = Date.parse("2026-09-14T00:00:00+02:00");
const backtestInstruments = ["MNQ SEP26", "MES SEP26"] as const;
const septemberInstruments = ["MNQU26", "MESU26"] as const;
const decemberInstruments = ["MNQZ26", "MESZ26"] as const;

type InstrumentRecord = { trade_mode: TradeMode; instrument: string };

export function instrumentOptions(mode: TradeMode, now = new Date()): readonly string[] {
  if (mode === "backtest") return backtestInstruments;
  return now.getTime() >= SEPTEMBER_ROLLOVER ? decemberInstruments : septemberInstruments;
}

export function instrumentForMode(value: string | null, mode: TradeMode, now = new Date()): string {
  const match = /^(MNQ|MES)(?:[UZ]26|SEP26|DEC26)?$/.exec((value ?? "").toUpperCase().replace(/\s+/g, ""));
  if (!match) return "";
  return instrumentOptions(mode, now)[match[1] === "MNQ" ? 0 : 1];
}

export function selectedInstrument(input: InstrumentRecord, existing?: InstrumentRecord, now = new Date()): string {
  // Retain the actual contract of saved trades, including legacy free-text names.
  if (existing && input.trade_mode === existing.trade_mode && input.instrument === existing.instrument) return existing.instrument;
  return instrumentForMode(input.instrument, input.trade_mode, now);
}

export function assertInstrument(input: InstrumentRecord, existing?: InstrumentRecord, now = new Date()) {
  if (existing && input.trade_mode === existing.trade_mode && input.instrument === existing.instrument) return;
  const allowed = instrumentOptions(input.trade_mode, now);
  if (!allowed.includes(input.instrument)) {
    throw new Error(`Bitte als Instrument ${allowed.join(" oder ")} auswählen. Falls die Seite vor dem Rollover geöffnet wurde, bitte neu laden; Ihr Entwurf bleibt erhalten.`);
  }
}
