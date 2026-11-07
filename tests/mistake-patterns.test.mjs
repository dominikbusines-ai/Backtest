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
const oldId = "10000000-0000-4000-8000-000000000001";
const targetId = "10000000-0000-4000-8000-000000000002";
function source(id, kind, created_at, fields = { review_mistake: "Ich bin zu früh eingestiegen." }) {
  return { id: `${kind === "note" ? "note" : "trade"}:${id}`, kind, created_at, updated_at: created_at, date: "2026-11-07", title: "Test", noTrade: false, fields };
}
const earlier = source(oldId, "backtest", "2026-11-06T10:00:00Z");
const target = source(targetId, "live", "2026-11-07T10:00:00Z");
const evidence = (s, field = "review_mistake") => ({ source_id: s.id, field, quote: s.fields[field] });
const raw = (...items) => ({ patterns: [{ label: "Zu früher Entry", evidence: items }] });

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

async function routeCheck({ sources = [earlier, target], input = { trade_id: targetId }, output = raw(evidence(earlier), evidence(target)), stop = "tool_use", fail = false } = {}) {
  const calls = [];
  const route = load("app/api/mistake-patterns/route.ts", {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    zod: { z }, "@/lib/mistake-data": { loadMistakeSources: async () => sources }, "@/lib/mistake-patterns": helpers,
    "@anthropic-ai/sdk": class { messages = { create: async (args) => { calls.push(args); if (fail) throw new Error("private provider detail"); return { stop_reason: stop, content: [{ type: "tool_use", name: "report_patterns", input: output }] }; } }; },
  });
  const prior = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "mock-only";
  try {
    const response = await route.POST(new Request("http://localhost/api/mistake-patterns", { method: "POST", body: JSON.stringify(input) }));
    return { status: response.status, body: await response.json(), calls };
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
  for (const args of [{ fail: true }, { stop: "max_tokens" }, { output: raw(evidence(earlier)) }]) {
    const result = await routeCheck(args);
    assert.ok(result.status >= 500); assert.ok(result.body.error); assert.equal(result.body.patterns, undefined);
    assert.ok(!result.body.error.includes("private provider detail"));
  }
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
  const result = await routeCheck({ input: {}, sources: [earlier, target, note], output: raw(evidence(note, "content")) });
  assert.equal(result.status, 200); assert.equal(result.body.sourceCount, 3); assert.equal(result.body.patterns[0].notes, 1);
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
