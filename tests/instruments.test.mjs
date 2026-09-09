import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function load(file, dependencies = {}) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", code)((name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

const instruments = load("lib/instruments.ts");
const { instrumentOptions, instrumentForMode, selectedInstrument, assertInstrument } = instruments;
const before = new Date("2026-09-13T21:59:59.999Z");
const after = new Date("2026-09-13T22:00:00.000Z");

test("Live switches at midnight Berlin on 14 September, independent of machine timezone", () => {
  assert.deepEqual(instrumentOptions("live", before), ["MNQU26", "MESU26"]);
  assert.deepEqual(instrumentOptions("live", after), ["MNQZ26", "MESZ26"]);
  assert.deepEqual(instrumentOptions("live", new Date("2026-09-18T12:00:00Z")), ["MNQZ26", "MESZ26"]);
});

test("Backtests always retain the requested September labels", () => {
  for (const now of [before, after, new Date("2026-10-10T12:00:00Z")]) {
    assert.deepEqual(instrumentOptions("backtest", now), ["MNQ SEP26", "MES SEP26"]);
  }
});

test("Mode changes, AI results and restored new drafts preserve the micro product", () => {
  assert.equal(instrumentForMode("MES SEP26", "live", before), "MESU26");
  assert.equal(instrumentForMode("MNQU26", "backtest", after), "MNQ SEP26");
  assert.equal(selectedInstrument({ trade_mode: "live", instrument: "MESU26" }, undefined, after), "MESZ26");
  for (const value of [null, "", "NQU26", "ESU26", "CL", "MNQ arbitrary"]) {
    assert.equal(instrumentForMode(value, "live", after), "");
  }
});

test("Server rejects arbitrary, wrong-mode and outdated contracts for new entries", () => {
  for (const instrument of ["MNQ", "NQU26", "MNQ SEP26", "MNQU26", "MESU26"]) {
    assert.throws(() => assertInstrument({ trade_mode: "live", instrument }, undefined, after));
  }
  assert.throws(() => assertInstrument({ trade_mode: "backtest", instrument: "MNQZ26" }, undefined, after));
  assert.doesNotThrow(() => assertInstrument({ trade_mode: "live", instrument: "MNQZ26" }, undefined, after));
});

test("Editing saved trades preserves their actual contract, but does not allow arbitrary replacements", () => {
  for (const instrument of ["MNQU26", "MESU26", "old custom instrument"]) {
    const original = { trade_mode: "live", instrument };
    assert.equal(selectedInstrument(original, original, after), instrument);
    assert.doesNotThrow(() => assertInstrument(original, original, after));
    assert.throws(() => assertInstrument({ ...original, instrument: "CLZ26" }, original, after));
    assert.throws(() => assertInstrument({ ...original, trade_mode: "backtest" }, original, after));
  }
});

test("Screenshot API passes exactly the mode-specific enum to Anthropic without extra unions", async () => {
  let captured;
  let aiCalls = 0;
  class FakeAnthropic {
    messages = { parse: async (request) => { captured = request; aiCalls++; return { parsed_output: { instrument: null } }; } };
  }
  const route = load("app/api/analyze/route.ts", {
    "next/server": { NextResponse: { json: (data, init) => Response.json(data, init) } },
    "@anthropic-ai/sdk": FakeAnthropic,
    "@anthropic-ai/sdk/helpers/json-schema": { jsonSchemaOutputFormat: (schema) => schema },
    "@/lib/instruments": instruments,
    "@/lib/supabase-server": { requireSupabase: () => ({ storage: { from: () => ({
      upload: async () => ({ error: null }), createSignedUrl: async () => ({ data: { signedUrl: "https://example.invalid/test" } }),
    }) } }) },
  });
  const oldKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-only-not-a-real-key";
  try {
    for (const mode of ["live", "backtest"]) {
      const body = new FormData();
      body.append("trade_mode", mode);
      body.append("image", new File(["synthetic test image"], "test.png", { type: "image/png" }));
      const response = await route.POST(new Request("https://example.invalid/api/analyze", { method: "POST", body }));
      assert.equal(response.status, 200);
      assert.deepEqual(captured.output_config.format.properties.instrument.enum, [...instrumentOptions(mode), null]);
      const countUnions = (value) => !value || typeof value !== "object" ? 0 :
        (Array.isArray(value.type) || value.anyOf ? 1 : 0) + Object.values(value).reduce((sum, child) => sum + countUnions(child), 0);
      assert.ok(countUnions(captured.output_config.format) <= 16);
    }
    const invalidBody = new FormData(); invalidBody.append("trade_mode", "invalid");
    assert.equal((await route.POST(new Request("https://example.invalid/api/analyze", { method: "POST", body: invalidBody }))).status, 400);
    assert.equal(aiCalls, 2);
  } finally {
    if (oldKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = oldKey;
  }
});
