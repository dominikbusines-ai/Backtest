import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const tradeId = "10000000-0000-4000-8000-000000000002";
function descendants(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(descendants);
  return [node, ...descendants(node.props?.children)];
}
async function simulateSave({ mode, edit = false, success = true, brokenStorage = false }) {
  const calls = [], pushes = [], states = [];
  const source = readFileSync(new URL("../components/backtest-form.tsx", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const deps = {
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    react: { useEffect: () => {}, useMemo: (fn) => fn(), useRef: (current) => ({ current }), useState: (initial) => {
      let value = typeof initial === "function" ? initial() : initial;
      if (value && typeof value === "object" && "trade_date" in value) value = { ...value, trade_mode: mode, instrument: mode === "live" ? "MNQZ26" : "MNQ SEP26" };
      return [value, (next) => { states.push(next); }];
    } },
    "next/navigation": { useRouter: () => ({ push: (url) => pushes.push(url), refresh: () => {} }) },
    "lucide-react": {},
    "@/components/pending-screenshot-provider": { usePendingScreenshot: () => ({ screenshot: { path: "", preview: "", fileName: "" }, setScreenshot: () => {}, clearScreenshot: () => {} }) },
    "@/components/trade-image-viewer": {},
    "@/lib/instruments": { instrumentOptions: () => ["MNQZ26", "MNQ SEP26"], selectedInstrument: (form) => form.instrument },
  };
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", code)((name) => { if (!(name in deps)) throw Error(name); return deps[name]; }, loadedModule, loadedModule.exports);
  const priorFetch = globalThis.fetch, priorWindow = globalThis.window;
  globalThis.window = { localStorage: { removeItem: () => { if (brokenStorage) throw Error("Storage denied"); } }, setTimeout: (fn) => fn() };
  globalThis.fetch = async (url, init) => { calls.push({ url, ...init }); return Response.json(success ? { id: tradeId } : { error: "Save failed" }, { status: success ? 201 : 400 }); };
  try {
    const initialTrade = edit ? { id: tradeId, tags: [], trade_mode: mode, instrument: "MNQZ26", trade_date: "2026-11-07", result_type: "win" } : undefined;
    const tree = loadedModule.exports.BacktestForm({ initialTrade });
    const buttons = descendants(tree).filter((node) => node.type === "button" && node.props.disabled !== undefined && JSON.stringify(node.props.children).includes(edit ? "Änderungen speichern" : mode === "live" ? "Live Trade speichern" : "Backtest speichern"));
    assert.equal(buttons.length, 1);
    buttons[0].props.onClick();
    for (let i = 0; i < 4; i++) await new Promise((resolve) => setImmediate(resolve));
    return { calls, pushes, states };
  } finally { globalThis.fetch = priorFetch; if (priorWindow === undefined) delete globalThis.window; else globalThis.window = priorWindow; }
}

for (const edit of [false, true]) {
  test(`Successful ${edit ? "edited" : "new"} live save navigates to independent check even with unavailable local storage`, async () => {
    const result = await simulateSave({ mode: "live", edit, brokenStorage: true });
    assert.equal(result.calls.length, 1);
    assert.equal(result.calls[0].method, edit ? "PATCH" : "POST");
    assert.match(result.pushes[0], new RegExp(`^/trades/${tradeId}\\?mistake_check=[a-f0-9-]{36}$`));
    assert.ok(!result.states.some((state) => state?.type === "error"));
  });
}
test("Failed save never navigates to or starts an AI check", async () => {
  const result = await simulateSave({ mode: "live", success: false });
  assert.equal(result.pushes.length, 0); assert.equal(result.calls.length, 1);
  assert.ok(result.states.some((state) => state?.text === "Save failed"));
});
test("Backtest save retains existing workflow and never starts automatic AI", async () => {
  const result = await simulateSave({ mode: "backtest" });
  assert.equal(result.pushes.length, 0); assert.equal(result.calls.length, 1);
  assert.ok(result.states.some((state) => state?.type === "ok"));
});
