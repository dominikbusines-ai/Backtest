import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { z } from "zod";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

function load(file, dependencies = {}) {
  const code = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", code)((name) => {
    if (!(name in dependencies)) throw Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const patterns = load("lib/mistake-patterns.ts", { zod: { z } });
const resolutions = load("lib/mistake-resolutions.ts", { zod: { z }, "@/lib/mistake-patterns": patterns });
const pattern = { label: "Zu früher Entry", evidence: [], live: 1, backtest: 1, notes: 0, previous: 1 };
const entry = { key: "zu früher entry", pattern, resolved: true, updatedAt: "2026-11-08T10:00:00.000Z" };
const another = { ...pattern, label: "Stopp verschoben", previous: 0 };

test("Solved patterns stay hidden across cached reports, punctuation changes and AI paraphrases", () => {
  for (const item of [pattern, { ...pattern, label: "ZU FRÜHER ENTRY!" }, { ...pattern, label: "Ungeduldiger Einstieg", resolutionKey: entry.key }]) {
    assert.deepEqual(resolutions.openMistakePatterns([item, another], [entry]), [another]);
  }
  assert.deepEqual(resolutions.visibleMistakePatterns([], [entry]), []);
  assert.deepEqual(resolutions.visibleMistakePatterns([], [{ ...entry, resolved: false }]), [pattern]);
  assert.deepEqual(resolutions.visibleMistakePatterns([pattern], [{ ...entry, resolved: false }]), [pattern]);
  assert.deepEqual(resolutions.visibleMistakePatterns([], [{ ...entry, resolved: false }], false), []);
});

test("Resolution API only reads/writes status, validates input, and reports storage failures", async () => {
  const writes = [];
  let fail = false;
  const route = load("app/api/mistake-patterns/resolutions/route.ts", {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } }, zod: { z },
    "@/lib/mistake-resolutions": resolutions,
    "@/lib/mistake-report-store": { readMistakeResolutions: async () => [entry], saveMistakeResolution: async (pattern, resolved) => { if (fail) throw Error("Private connection details"); writes.push({ pattern, resolved }); return { ...entry, pattern, resolved }; } },
  });
  assert.deepEqual((await (await route.GET()).json()).resolutions, [entry]);
  assert.equal(writes.length, 0);
  for (const resolved of [true, false]) {
    const result = await route.PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ pattern, resolved }) }));
    assert.equal(result.status, 200); assert.equal((await result.json()).resolution.resolved, resolved);
  }
  assert.equal((await route.PATCH(new Request("http://localhost", { method: "PATCH", body: "{}" }))).status, 400);
  assert.equal(writes.length, 2);
  fail = true;
  const failed = await route.PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ pattern, resolved: true }) }));
  assert.equal(failed.status, 503); assert.ok(!(await failed.text()).includes("Private connection"));
});

test("Marking moves immediately, persists without AI, and a failed reopening rolls back", async () => {
  const priorWindow = globalThis.window, priorFetch = globalThis.fetch;
  const local = new Map(), slots = [], effects = [], calls = [];
  let index = 0, mounted = false, finishPatch;
  const react = {
    useState: (initial) => { const slot = index++; if (!(slot in slots)) slots[slot] = initial; return [slots[slot], (value) => { slots[slot] = typeof value === "function" ? value(slots[slot]) : value; }]; },
    useRef: (initial) => { const slot = index++; if (!(slot in slots)) slots[slot] = { current: initial }; return slots[slot]; },
    useEffect: (effect) => { if (!mounted) effects.push(effect); },
  };
  globalThis.window = { setTimeout, clearTimeout, localStorage: { getItem: (key) => local.get(key) ?? null, setItem: (key, value) => local.set(key, value) } };
  globalThis.fetch = async (url, init) => {
    calls.push({ url, method: init.method || "GET" });
    if (init.method !== "PATCH") return Response.json({ resolutions: [] });
    return new Promise((resolve) => { finishPatch = resolve; });
  };
  try {
    const hook = load("components/use-mistake-resolutions.ts", { react, "@/lib/mistake-resolutions": resolutions });
    const render = () => { index = 0; const result = hook.useMistakeResolutions(); mounted = true; return result; };
    render(); const cleanups = effects.map((effect) => effect());
    await new Promise((resolve) => setTimeout(resolve, 10));
    let state = render(); assert.equal(state.ready, true);
    const saving = state.changeStatus(pattern, true);
    state = render(); assert.equal(state.saving, true);
    assert.deepEqual(resolutions.openMistakePatterns([pattern], state.entries), []);
    finishPatch(Response.json({ resolution: entry })); await saving;
    state = render(); assert.equal(state.saving, false); assert.equal(state.entries[0].resolved, true);
    assert.equal(JSON.parse(local.get("edgelog:mistake-resolutions:v1"))[0].resolved, true);
    const reopening = state.changeStatus(pattern, false);
    assert.equal(render().entries[0].resolved, false);
    finishPatch(Response.json({ error: "failed" }, { status: 503 })); await reopening;
    state = render(); assert.equal(state.entries[0].resolved, true); assert.match(state.error, /zurückgenommen/);
    assert.deepEqual(calls.map((call) => call.method), ["GET", "PATCH", "PATCH"]);
    assert.ok(calls.every((call) => call.url === "/api/mistake-patterns/resolutions"));
    cleanups.forEach((cleanup) => cleanup());
  } finally { globalThis.window = priorWindow; globalThis.fetch = priorFetch; }
});

test("UI separates open problems and a closed solved section with reopening controls", () => {
  const report = patterns.makeReport([pattern, another], [], undefined);
  const component = load("components/mistake-patterns.tsx", {
    "react/jsx-runtime": jsx, react: { useState: (initial) => [initial === null ? report : initial, () => {}], useEffect: () => {}, useCallback: (fn) => fn, useRef: (current) => ({ current }) },
    "next/link": { __esModule: true, default: ({ href, children }) => jsx.jsx("a", { href, children }) }, "lucide-react": { Loader2: "span" },
    "@/lib/mistake-patterns": patterns, "@/lib/mistake-report-client": {}, "@/lib/mistake-resolutions": resolutions,
    "@/components/use-mistake-resolutions": { useMistakeResolutions: () => ({ entries: [entry], ready: true, saving: false, error: "", changeStatus: () => {} }) },
  });
  const html = renderToStaticMarkup(component.MistakePatterns({}));
  assert.match(html, /Offene Probleme \(1\)/);
  assert.match(html, /Bereits gelöste Probleme \(1\)/);
  assert.match(html, /Zu früher Entry: Wieder öffnen/);
  assert.match(html, /Stopp verschoben: Als gelöst markieren/);
  assert.ok(!html.includes("Zu früher Entry: Als gelöst markieren"));
  assert.ok(!/<details[^>]*\sopen(?:\s|=|>)/.test(html));
  assert.ok(!html.includes("Ein früher dokumentiertes offenes Fehlermuster"));
});
