import { createHash } from "node:crypto";
import { z } from "zod";
import { requireSupabase } from "@/lib/supabase-server";
import { mistakeReportSchema, type MistakeReport, type MistakeSource } from "@/lib/mistake-patterns";

const bucket = "edgelog-ai-reports-v1";
const snapshotSchema = z.object({ fingerprint: z.string().regex(/^[a-f0-9]{64}$/), report: mistakeReportSchema });
const scopePath = (tradeId?: string) => tradeId ? `live/${z.string().uuid().parse(tradeId)}` : "all";
const fileName = (fingerprint: string) => `${z.string().regex(/^[a-f0-9]{64}$/).parse(fingerprint)}.json`;

function missing(error: unknown) {
  const value = error && typeof error === "object" ? error as Record<string, unknown> : {};
  return Number(value.statusCode ?? value.status) === 404 || ["NoSuchKey", "NoSuchBucket", "not_found"].includes(String(value.code))
    || /^(bucket not found|object not found|the resource was not found)$/i.test(String(value.message));
}

async function bucketExists() {
  const { data, error } = await requireSupabase().storage.getBucket(bucket);
  if (error) {
    if (missing(error)) return false;
    throw new Error("Die gespeicherten KI-Auswertungen sind gerade nicht erreichbar.");
  }
  if (data?.public !== false) throw new Error("Der Speicher für KI-Auswertungen muss privat sein.");
  return true;
}

export async function ensureMistakeReportStore() {
  if (await bucketExists()) return;
  const { error } = await requireSupabase().storage.createBucket(bucket, { public: false, allowedMimeTypes: ["application/json"], fileSizeLimit: 1048576 });
  // A second request may have created the same private bucket in the meantime.
  if (error && !(await bucketExists())) throw new Error("Der dauerhafte KI-Speicher konnte nicht eingerichtet werden. Es wurde keine KI-Anfrage gestartet.");
}

export function mistakeFingerprint(sources: MistakeSource[], tradeId?: string) {
  return createHash("sha256").update(JSON.stringify({ version: 2, tradeId: tradeId ?? "", sources })).digest("hex");
}

async function download(path: string) {
  const { data, error } = await requireSupabase().storage.from(bucket).download(path);
  if (error) {
    if (missing(error)) return null;
    throw new Error("Die gespeicherte Fehlerliste konnte nicht geladen werden. Es wurde keine KI angefragt.");
  }
  const parsed = snapshotSchema.safeParse(JSON.parse(await data.text()));
  if (!parsed.success) throw new Error("Die gespeicherte Auswertung hat ein ungültiges Format.");
  return parsed.data;
}

export async function readMistakeReport(tradeId?: string, fingerprint?: string, latestFallback = true) {
  if (!(await bucketExists())) return null;
  const folder = scopePath(tradeId);
  if (fingerprint) {
    const exact = await download(`${folder}/${fileName(fingerprint)}`);
    if (exact) {
      if (exact.fingerprint !== fingerprint) throw new Error("Die gespeicherte Auswertung passt nicht zum angefragten Datenstand.");
      return exact;
    }
    if (!latestFallback) return null;
  }
  const { data, error } = await requireSupabase().storage.from(bucket).list(folder, { limit: 1, sortBy: { column: "created_at", order: "desc" } });
  if (error) throw new Error("Die gespeicherten Auswertungen konnten nicht aufgelistet werden.");
  const name = data?.[0]?.name;
  if (!name) return null;
  if (!/^[a-f0-9]{64}\.json$/.test(name)) throw new Error("Unerwartetes Format im KI-Speicher.");
  return download(`${folder}/${name}`);
}

export async function saveMistakeReport(report: MistakeReport, fingerprint: string, tradeId?: string) {
  const snapshot = snapshotSchema.parse({ fingerprint, report });
  const body = JSON.stringify(snapshot);
  if (Buffer.byteLength(body) > 1048576) throw new Error("Die Auswertung überschreitet die Speichergröße.");
  // Immutable, content-addressed snapshots: late/failed requests never overwrite a newer report.
  const { error } = await requireSupabase().storage.from(bucket).upload(`${scopePath(tradeId)}/${fileName(fingerprint)}`, body, { contentType: "application/json", cacheControl: "0", upsert: false });
  if (error) {
    if (Number(error.statusCode) === 409 || error.message === "The resource already exists") return;
    throw new Error("Die KI-Auswertung ist fertig, konnte aber nicht dauerhaft gespeichert werden.");
  }
}
