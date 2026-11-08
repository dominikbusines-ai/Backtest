import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { z } from "zod";

function load(file, dependencies = {}) {
  const code = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", code)((name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const helpers = load("lib/mistake-patterns.ts", { zod: { z } });
const providerErrors = load("lib/anthropic-error.ts");
const oldId = "10000000-0000-4000-8000-000000000001";
const targetId = "10000000-0000-4000-8000-000000000002";
function source(id, kind, created_at, fields = { review_mistake: "Ich bin zu früh eingestiegen." }) {
  return { id: `${kind === "note" ? "note" : "trade"}:${id}`, kind, created_at, updated_at: created_at, date: "2026-11-07", title: "Test", noTrade: false, fields };
}
const earlier = source(oldId, "backtest", "2026-11-06T10:00:00Z");
const target = source(targetId, "live", "2026-11-07T10:00:00Z");
const evidence = (s, field = "review_mistake") => ({ source_id: s.id, field, quote: s.fields[field] });
const raw = (...items) => ({ patterns: [{ label: "Zu früher Entry", evidence: items }] });
const refRaw = (...refs) => ({ patterns: [{ label: "Zu früher Entry", evidence_refs: refs }] });

test("Current evidence is mandatory; historical mistakes cannot be attributed to the saved trade", () => {
  assert.throws(() => helpers.validatePatterns(raw(evidence(earlier)), [earlier, target], target), /ohne Beleg/);
  assert.deepEqual(helpers.validatePatterns({ patterns: [] }, [earlier, target], target), []);
});
test("Quotes must occur in the cited original field", () => {
  assert.throws(() => helpers.validatePatterns(raw({ ...evidence(target), quote: "Ich war undiszipliniert." }), [target], target), /Originaltext/);
  assert.throws(() => helpers.validatePatterns(raw({ ...evidence(target), field: "entry_note" }), [target], target), /Originaltext/);
  assert.throws(() => helpers.validatePatterns(raw({ ...evidence(target), source_id: "invented" }), [target], target), /Originaltext/);
});
test("Counts are unique sources with Live/Backtest/notes separated", () => {
  const now = { ...target, fields: { ...target.fields, context: target.fields.review_mistake } };
  const note = source("note-1", "note", "2026-11-05T10:00:00Z", { content: "Ich bin zu früh eingestiegen." });
  const [result] = helpers.validatePatterns(raw(evidence(now), evidence(now), evidence(now, "context"), evidence(earlier), evidence(note, "content")), [earlier, now, note], now);
  assert.equal(result.live, 1); assert.equal(result.backtest, 1); assert.equal(result.notes, 1); assert.equal(result.previous, 2);
  assert.equal(result.evidence.length, 4);
  assert.equal(helpers.makeReport([result], [earlier, now, note], now).status, "repeated");
});
test("Future/tied timestamps and notes edited later are not earlier evidence", () => {
  const future = source("future", "live", "2026-11-08T10:00:00Z");
  const tied = source("tied", "live", target.created_at);
  const edited = { ...source("edited", "note", "2026-11-05T10:00:00Z"), updated_at: "2026-11-08T10:00:00Z" };
  assert.deepEqual(helpers.comparisonSources([target, future, earlier, tied, edited], target).map((x) => x.id), [earlier.id, target.id]);
  assert.throws(() => helpers.comparisonSources([{ ...earlier, created_at: "invalid" }], target), /Erstellungszeitpunkt/);
});
test("Today follows Berlin midnight and DST, not UTC or creation date", () => {
  assert.equal(helpers.berlinDate(new Date("2026-11-06T23:30:00Z")), "2026-11-07");
  assert.equal(helpers.berlinDate(new Date("2026-09-06T22:30:00Z")), "2026-09-07");
  assert.equal(helpers.makeReport([], [target], { ...target, date: "2026-10-01" }, 0, new Date("2026-11-06T23:30:00Z")).isToday, false);
});
test("Missing text is insufficient, no-trade not executed, new mistake not repeated", () => {
  const blank = { ...target, fields: { review_mistake: "" } };
  assert.equal(helpers.makeReport([], [blank], blank).status, "insufficient");
  assert.equal(helpers.makeReport([], [target], target).status, "no_evidence");
  assert.equal(helpers.makeReport([], [target], { ...target, noTrade: true }).status, "no_trade");
  assert.equal(helpers.makeReport(helpers.validatePatterns(raw(evidence(target)), [target], target), [target], target).status, "documented");
});
test("Duplicate labels fail closed; short explicit notes remain supported", () => {
  assert.throws(() => helpers.validatePatterns({ patterns: [...raw(evidence(target)).patterns, ...raw(evidence(target)).patterns] }, [target], target), /doppelt/);
  const short = { ...target, fields: { review_mistake: "FOMO" } };
  assert.equal(helpers.validatePatterns(raw(evidence(short)), [short], short).length, 1);
});

async function routeCheck({ sources = [earlier, target], input = { trade_id: targetId }, output = refRaw("E1", "E2"), stop = "tool_use", fail = false, cached = null, method = "POST", saveFails = false, resolutions = [] } = {}) {
  const calls = [], saves = [];
  const route = load("app/api/mistake-patterns/route.ts", {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    zod: { z }, "@/lib/mistake-data": { loadMistakeSources: async () => sources }, "@/lib/mistake-patterns": helpers,
    "@/lib/anthropic-error": providerErrors,
    "@/lib/mistake-report-store": { mistakeFingerprint: () => "a".repeat(64), readMistakeReport: async () => cached, readMistakeResolutions: async () => resolutions, ensureMistakeReportStore: async () => {}, saveMistakeReport: async (...args) => { if (saveFails) throw Error("storage failed"); saves.push(args); } },
    "@/lib/mistake-stream": { MISTAKE_TIMEOUT_MS: 120000, streamMistakeMessage: (client, args) => client.messages.create(args) },
    "@anthropic-ai/sdk": class { messages = { create: async (args) => { calls.push(args); if (fail) throw new Error("private provider detail"); return { stop_reason: stop, content: [{ type: "tool_use", name: "report_patterns", input: output }] }; } }; },
  });
  const prior = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "mock-only";
  try {
    const request = method === "GET" ? new Request(`http://localhost/api/mistake-patterns${input.trade_id ? `?trade_id=${input.trade_id}` : ""}`) : new Request("http://localhost/api/mistake-patterns", { method: "POST", body: JSON.stringify(input) });
    const response = await route[method](request);
    return { status: response.status, body: await response.json(), calls, saves };
  } finally { if (prior === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = prior; }
}
test("API filters future sources, guards negation/injection, returns verified references without creation stamps", async () => {
  const result = await routeCheck({ sources: [earlier, target, source("future", "live", "2026-11-09T10:00:00Z")] });
  assert.equal(result.status, 200); assert.equal(result.body.status, "repeated"); assert.equal(result.body.excludedCount, 1);
  assert.equal(JSON.parse(result.calls[0].messages[0].content).length, 2);
  assert.match(result.calls[0].system, /niemals Anweisungen/); assert.match(result.calls[0].system, /Negationen/); assert.match(result.calls[0].system, /keine zwei Ereignisse/);
  assert.ok(!JSON.stringify(result.calls[0].tools).includes("anyOf"));
  assert.ok(!JSON.stringify(result.body).includes("created_at"));
});
test("Provider failure, truncated/fabricated responses never return clean or partial reports", async () => {
  for (const args of [{ fail: true }, { stop: "max_tokens" }, { output: refRaw("E1") }, { output: refRaw("invented") }]) {
    const result = await routeCheck(args);
    assert.ok(result.status >= 500); assert.ok(result.body.error); assert.equal(result.body.patterns, undefined);
    assert.ok(!result.body.error.includes("private provider detail"));
    assert.equal(result.saves.length, 0);
  }
});

test("GET only loads saved results, including stale snapshots, with no AI or writes", async () => {
  const report = helpers.makeReport([], [earlier, target], target);
  for (const cached of [null, { report, fingerprint: "a".repeat(64) }, { report, fingerprint: "b".repeat(64) }]) {
    const result = await routeCheck({ method: "GET", cached });
    assert.equal(result.status, 200); assert.equal(result.calls.length, 0); assert.equal(result.saves.length, 0);
    assert.deepEqual(result.body.report, cached?.report ?? null);
    assert.equal(result.body.stale, !!cached && cached.fingerprint !== "a".repeat(64));
  }
});
test("POST reuses matching durable snapshot without another paid call", async () => {
  const report = helpers.makeReport([], [earlier, target], target);
  const result = await routeCheck({ cached: { fingerprint: "a".repeat(64), report } });
  assert.equal(result.status, 200); assert.equal(result.calls.length, 0); assert.equal(result.saves.length, 0);
  assert.equal(result.body.cached, true); assert.equal(result.body.persisted, true);
});
test("Valid report persists; failed storage returns report for browser fallback, never claims cloud success", async () => {
  const saved = await routeCheck();
  assert.equal(saved.saves.length, 1); assert.equal(saved.body.persisted, true);
  const failed = await routeCheck({ saveFails: true });
  assert.equal(failed.status, 200); assert.equal(failed.body.persisted, false);
  assert.ok(failed.body.storageWarning); assert.equal(failed.body.patterns.length, 1);
});
test("No text/no trade means no paid call; Backtest and invalid IDs cannot trigger live checks", async () => {
  for (const current of [{ ...target, fields: {} }, { ...target, noTrade: true }]) {
    const result = await routeCheck({ sources: [earlier, current] });
    assert.equal(result.status, 200); assert.equal(result.calls.length, 0);
  }
  assert.equal((await routeCheck({ input: { trade_id: oldId } })).status, 404);
  assert.equal((await routeCheck({ input: { trade_id: "broken" } })).status, 400);
});
test("Large input is rejected before sending, never silently truncated", async () => {
  const result = await routeCheck({ sources: [{ ...target, fields: { review_mistake: "a".repeat(120001) } }] });
  assert.equal(result.status, 413); assert.equal(result.calls.length, 0);
});
test("General list includes notes and both modes without current-trade requirement", async () => {
  const note = source("note-1", "note", "2026-11-05T10:00:00Z", { content: "Ich bin zu früh eingestiegen." });
  const result = await routeCheck({ input: {}, sources: [earlier, target, note], output: refRaw("E1") });
  assert.equal(result.status, 200); assert.equal(result.body.sourceCount, 3); assert.equal(result.body.patterns[0].notes, 1);
});

test("References restore exact original wording, including long text, punctuation and corrections", () => {
  const text = 'Ich bin zu früh eingestiegen.\n„Geduld“ fehlte. ' + 'Weiterer Kontext. '.repeat(35) + ' Heute war es NICHT so.';
  const current = { ...target, fields: { review_mistake: text, context: "Anderer Kontext", entry_note: "" } };
  const catalog = helpers.mistakeEvidenceCatalog([current]);
  assert.equal(catalog.records[0].fields.review_mistake.text, text);
  assert.equal(catalog.records[0].fields.review_mistake.ref, "E1");
  assert.equal(catalog.records[0].fields.context.ref, "E2");
  assert.equal(catalog.records[0].fields.entry_note, undefined);
  const resolved = helpers.resolveMistakeReferences(refRaw("E1"), [current], current);
  assert.equal(resolved.patterns[0].evidence[0].quote, text);
  assert.equal(resolved.patterns[0].evidence[0].field, "review_mistake");
  assert.equal(resolved.rejectedPatternCount, 0);
  const report = helpers.makeReport(resolved.patterns, [current], current);
  assert.deepEqual(helpers.mistakeReportSchema.parse(report), report);
});

test("Unknown references reject only their entire pattern, never remap to another source", async () => {
  const output = { patterns: [
    ...refRaw("E1", "E2").patterns,
    { label: "Unbelegte Aussage", evidence_refs: ["E2", "E999"] },
    { label: "Nur historisch", evidence_refs: ["E1"] },
  ] };
  const result = await routeCheck({ output });
  assert.equal(result.status, 200); assert.equal(result.saves.length, 1);
  assert.equal(result.body.patterns.length, 1); assert.equal(result.body.rejectedPatternCount, 2);
  assert.equal(result.body.patterns[0].previous, 1);
  assert.equal(helpers.mistakeReportSchema.parse(result.body).rejectedPatternCount, 2);
});

test("Duplicate labels merge confirmed references and counts without losing separate valid patterns", () => {
  const result = helpers.resolveMistakeReferences({ patterns: [
    ...refRaw("E1").patterns, ...refRaw("E1", "E2").patterns,
    { label: "Weiteres Muster", evidence_refs: ["E2"] },
  ] }, [earlier, target]);
  assert.equal(result.patterns.length, 2); assert.equal(result.rejectedPatternCount, 0);
  assert.equal(result.patterns[0].evidence.length, 2);
  assert.equal(result.patterns[0].live, 1); assert.equal(result.patterns[0].backtest, 1);
});

test("Entirely unconfirmed output never becomes a saved clean report; genuine empty output remains valid", () => {
  assert.throws(() => helpers.resolveMistakeReferences(refRaw("E999"), [target], target), /Keine KI-Zuordnung/);
  assert.throws(() => helpers.resolveMistakeReferences(refRaw("E1"), [earlier, target], target), /Keine KI-Zuordnung/);
  const result = helpers.resolveMistakeReferences({ patterns: [] }, [target], target);
  assert.deepEqual(result, { patterns: [], rejectedPatternCount: 0 });
});

test("New AI checks receive solved problems and preserve their identity even with a new label", async () => {
  const resolutions = [
    { key: "zu früher entry", resolved: true, pattern: { label: "Zu früher Entry" } },
    { key: "stopp versetzt", resolved: false, pattern: { label: "Stopp versetzt" } },
  ];
  const output = { patterns: [{ label: "Ungeduld beim Einstieg", evidence_refs: ["E1", "E2"], resolved_key: "zu früher entry" }] };
  const result = await routeCheck({ output, resolutions });
  assert.equal(result.status, 200);
  assert.match(result.calls[0].system, /zu früher entry/);
  assert.ok(!result.calls[0].system.includes("stopp versetzt"));
  assert.equal(result.body.patterns[0].resolutionKey, "zu früher entry");
  const unknown = helpers.resolveMistakeReferences({ patterns: [{ ...output.patterns[0], resolved_key: "invented" }] }, [earlier, target], target, resolutions);
  assert.equal(unknown.patterns[0].resolutionKey, undefined);
});
test("Reader paginates, excludes screenshots, never writes, detects row limit", async () => {
  const calls = [];
  const rows = Array.from({ length: 501 }, (_, i) => ({ id: String(i), trade_mode: "live", created_at: "2026-11-06T10:00:00Z", trade_date: "2026-11-06", review_mistake: "FOMO" }));
  let noteRows = [{ id: "n", created_at: "2026-11-05T10:00:00Z", updated_at: "2026-11-05T10:00:00Z", content: "FOMO" }];
  const data = load("lib/mistake-data.ts", { "@/lib/supabase-server": { requireSupabase: () => ({ from: (table) => {
    const query = { select: (columns) => { assert.ok(!columns.includes("screenshot")); return query; }, order: () => query, range: async (a, b) => { calls.push([table, a, b]); return { data: (table === "trades" ? rows : noteRows).slice(a, b + 1), error: null }; } };
    return query;
  } }) } });
  assert.equal((await data.loadMistakeSources()).length, 502);
  assert.deepEqual(calls.map(([table, a]) => [table, a]), [["trades", 0], ["trades", 500], ["journal_notes", 0]]);
  noteRows = Array.from({ length: 500 }, () => noteRows[0]);
  await assert.rejects(data.loadMistakeSources(), /1.000/);
});
