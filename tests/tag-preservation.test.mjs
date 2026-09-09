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

for (const [label, submittedTags] of [["empty", []], ["stale", ["old-tag"]], ["different", ["replacement-tag"]]]) {
  test(`Trade editing with ${label} tag_ids never touches saved tag links`, async () => {
    const savedLinks = Object.freeze([Object.freeze({ trade_id: "trade-1", tag_id: "old-tag" }), Object.freeze({ trade_id: "trade-1", tag_id: "added-after-draft" })]);
    const savedTrade = { id: "trade-1", trade_mode: "backtest", instrument: "MNQ SEP26", created_at: "2026-09-01T12:00:00Z", review_observation: "Original" };
    const calls = [];
    const data = load("lib/trade-data.ts", {
      "@/lib/instruments": instruments,
      "@/lib/supabase-server": { requireSupabase: () => ({ from: (table) => {
        calls.push(table);
        assert.equal(table, "trades", "Editing must not read, delete or insert any tag relationships");
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: savedTrade, error: null }) }) }),
          update: (values) => ({ eq: async (column, id) => {
            assert.equal(column, "id"); assert.equal(id, "trade-1");
            assert.ok(!("tag_ids" in values));
            Object.assign(savedTrade, values);
            return { error: null };
          } }),
        };
      } }) },
    });
    await data.updateTrade("trade-1", { trade_mode: "backtest", instrument: "MNQ SEP26", review_observation: "Updated reflection", tag_ids: submittedTags });
    assert.equal(savedTrade.review_observation, "Updated reflection");
    assert.equal(savedTrade.created_at, "2026-09-01T12:00:00Z");
    assert.deepEqual(savedLinks.map((link) => link.tag_id), ["old-tag", "added-after-draft"]);
    assert.deepEqual(calls, ["trades", "trades"]);
  });
}

test("Saving an older new draft retains its previously selected tag IDs", async () => {
  const inserts = [];
  const data = load("lib/trade-data.ts", {
    "@/lib/instruments": instruments,
    "@/lib/supabase-server": { requireSupabase: () => ({ from: (table) => ({
      insert: (values) => {
        inserts.push({ table, values });
        return table === "trades" ? { select: () => ({ single: async () => ({ data: { id: "new-trade" }, error: null }) }) } : Promise.resolve({ error: null });
      },
    }) }) },
  });
  const id = await data.createTrade({ trade_mode: "backtest", instrument: "MES SEP26", tag_ids: ["saved-draft-tag"] });
  assert.equal(id, "new-trade");
  assert.deepEqual(inserts[1], { table: "trade_tags", values: [{ trade_id: "new-trade", tag_id: "saved-draft-tag" }] });
});
