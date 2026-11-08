import { z } from "zod";

export type MistakeSource = {
  id: string;
  kind: "live" | "backtest" | "note";
  created_at: string;
  updated_at: string;
  date: string;
  title: string;
  noTrade: boolean;
  fields: Record<string, string>;
};

const evidenceSchema = z.object({
  source_id: z.string().min(1), field: z.string().min(1), quote: z.string().trim().min(2).max(120000),
});
export const patternInputSchema = z.object({ patterns: z.array(z.object({
  label: z.string().trim().min(3).max(100),
  evidence: z.array(evidenceSchema).min(1).max(1000),
})).max(200) });

export type MistakeEvidence = z.infer<typeof evidenceSchema> & {
  kind: MistakeSource["kind"]; title: string; date: string; href: string;
};
export type MistakePattern = { label: string; evidence: MistakeEvidence[]; live: number; backtest: number; notes: number; previous: number; resolutionKey?: string };
export type MistakeReport = {
  patterns: MistakePattern[];
  status: "repeated" | "documented" | "no_evidence" | "insufficient" | "no_trade";
  generatedAt: string;
  sourceCount: number;
  excludedCount: number;
  targetDate: string;
  isToday: boolean;
  rejectedPatternCount?: number;
};

export const mistakeReportSchema = z.object({
  patterns: z.array(z.object({
    label: z.string(), resolutionKey: z.string().min(1).max(100).optional(), evidence: z.array(evidenceSchema.extend({
      kind: z.enum(["live", "backtest", "note"]), title: z.string(), date: z.string(),
      href: z.string().regex(/^(\/trades\/[a-f0-9-]+|\/#note-[a-f0-9-]+)$/),
    })), live: z.number().int().nonnegative(), backtest: z.number().int().nonnegative(),
    notes: z.number().int().nonnegative(), previous: z.number().int().nonnegative(),
  })),
  status: z.enum(["repeated", "documented", "no_evidence", "insufficient", "no_trade"]),
  generatedAt: z.string().datetime(), sourceCount: z.number().int().nonnegative(),
  excludedCount: z.number().int().nonnegative(), targetDate: z.string(), isToday: z.boolean(),
  rejectedPatternCount: z.number().int().nonnegative().optional(),
});

// The model selects references; original wording never needs to be copied by the model.
export function mistakeEvidenceCatalog(sources: MistakeSource[]) {
  const references = new Map<string, z.infer<typeof evidenceSchema>>();
  const records = sources.map((source) => ({ ...source, fields: Object.fromEntries(
    Object.entries(source.fields).filter(([, text]) => text.trim()).map(([field, text]) => {
      const ref = `E${references.size + 1}`;
      references.set(ref, { source_id: source.id, field, quote: text });
      return [field, { ref, text }];
    }),
  ) }));
  return { records, references };
}

export function resolveMistakeReferences(raw: unknown, sources: MistakeSource[], target?: MistakeSource, resolvedProblems: { key: string }[] = []) {
  const input = z.object({ patterns: z.array(z.unknown()).max(200) }).parse(raw);
  const itemSchema = z.object({ label: z.string().trim().min(3).max(100), evidence_refs: z.array(z.string()).min(1).max(1000), resolved_key: z.string().max(100).optional() });
  const { references } = mistakeEvidenceCatalog(sources);
  const grouped = new Map<string, MistakePattern>();
  let rejectedPatternCount = 0;
  for (const item of input.patterns) {
    const parsed = itemSchema.safeParse(item);
    if (!parsed.success || parsed.data.evidence_refs.some((ref) => !references.has(ref))) {
      rejectedPatternCount++; continue;
    }
    const evidence = [...new Set(parsed.data.evidence_refs)].map((ref) => references.get(ref)!);
    if (target && !evidence.some((entry) => entry.source_id === target.id)) {
      rejectedPatternCount++; continue;
    }
    try {
      const [pattern] = validatePatterns({ patterns: [{ label: parsed.data.label, evidence }] }, sources, target);
      // Only known user-marked problems may be hidden. Unknown model IDs stay visible.
      if (parsed.data.resolved_key && resolvedProblems.some((entry) => entry.key === parsed.data.resolved_key)) pattern.resolutionKey = parsed.data.resolved_key;
      const key = pattern.label.toLocaleLowerCase("de");
      const previous = grouped.get(key);
      const merged = previous ? validatePatterns({ patterns: [{ label: previous.label, evidence: [...previous.evidence, ...pattern.evidence] }] }, sources, target)[0] : pattern;
      if (previous?.resolutionKey || pattern.resolutionKey) merged.resolutionKey = previous?.resolutionKey || pattern.resolutionKey;
      grouped.set(key, merged);
    } catch {
      // Reject the entire questionable pattern, never invent a replacement source or quote.
      rejectedPatternCount++;
    }
  }
  if (rejectedPatternCount && !grouped.size) throw new Error("Keine KI-Zuordnung konnte bestätigt werden. Die bisherige Auswertung bleibt erhalten; es wird keine Fehlerfreiheit behauptet.");
  return { patterns: [...grouped.values()].sort((a, b) => b.previous - a.previous || b.evidence.length - a.evidence.length), rejectedPatternCount };
}

export function berlinDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function comparisonSources(sources: MistakeSource[], target?: MistakeSource) {
  if (sources.some((source) => !Number.isFinite(Date.parse(source.created_at)) || !Number.isFinite(Date.parse(source.updated_at)))) {
    throw new Error("Ein gültiger Erstellungszeitpunkt fehlt. Der zeitliche Vergleich ist nicht möglich.");
  }
  // Never treat a later entry (or a subsequently edited general note) as prior evidence.
  return sources.filter((source) => !target || source.id === target.id || (
    Date.parse(source.created_at) < Date.parse(target.created_at)
    && (source.kind !== "note" || Date.parse(source.updated_at) <= Date.parse(target.created_at))
  )).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id));
}

const normalized = (value: string) => value.replace(/\s+/g, " ").trim();

export function validatePatterns(raw: unknown, sources: MistakeSource[], target?: MistakeSource): MistakePattern[] {
  const input = patternInputSchema.parse(raw);
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const labels = new Set<string>();
  return input.patterns.map((pattern) => {
    const label = normalized(pattern.label);
    if (labels.has(label.toLocaleLowerCase("de"))) throw new Error("Die KI hat ein Fehlermuster doppelt geliefert.");
    labels.add(label.toLocaleLowerCase("de"));
    const unique = new Map<string, MistakeEvidence>();
    for (const evidence of pattern.evidence) {
      const source = sourceMap.get(evidence.source_id);
      const original = source?.fields[evidence.field];
      if (!source || !original || !normalized(original).includes(normalized(evidence.quote))) {
        throw new Error("Ein KI-Beleg konnte nicht im Originaltext bestätigt werden. Bitte erneut prüfen.");
      }
      const key = `${source.id}:${evidence.field}:${normalized(evidence.quote)}`;
      unique.set(key, { ...evidence, kind: source.kind, title: source.title, date: source.date,
        href: source.kind === "note" ? `/#note-${source.id.slice(5)}` : `/trades/${source.id.slice(6)}` });
    }
    const evidence = [...unique.values()];
    if (target && !evidence.some((item) => item.source_id === target.id)) {
      throw new Error("Die KI hat ein Muster ohne Beleg im gespeicherten Live-Trade geliefert.");
    }
    const distinct = [...new Set(evidence.map((item) => item.source_id))].map((id) => sourceMap.get(id)!);
    return { label, evidence,
      live: distinct.filter((source) => source.kind === "live").length,
      backtest: distinct.filter((source) => source.kind === "backtest").length,
      notes: distinct.filter((source) => source.kind === "note").length,
      previous: target ? distinct.filter((source) => source.id !== target.id).length : 0,
    };
  }).sort((a, b) => b.previous - a.previous || b.evidence.length - a.evidence.length);
}

export function makeReport(patterns: MistakePattern[], sources: MistakeSource[], target?: MistakeSource, excludedCount = 0, now = new Date()): MistakeReport {
  const hasText = target ? Object.values(target.fields).some((value) => value.trim()) : sources.length > 0;
  return {
    patterns,
    status: target?.noTrade ? "no_trade" : !hasText ? "insufficient" : patterns.some((pattern) => pattern.previous > 0) ? "repeated" : patterns.length ? "documented" : "no_evidence",
    generatedAt: now.toISOString(), sourceCount: sources.length, excludedCount,
    targetDate: target?.date ?? "", isToday: target?.date === berlinDate(now),
  };
}
