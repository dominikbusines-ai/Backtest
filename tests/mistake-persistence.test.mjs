import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as crypto from "node:crypto";
import test from "node:test";
import ts from "typescript";
import { z } from "zod";

function load(file, dependencies = {}) {
  const code = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", code)((name) => {
    if (!(name in dependencies)) throw Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const helpers = load("lib/mistake-patterns.ts", { zod: { z } });
const resolutionHelpers = load("lib/mistake-resolutions.ts", { zod: { z }, "@/lib/mistake-patterns": helpers });
const report = helpers.makeReport([], [], undefined, 0, new Date("2026-11-07T10:00:00Z"));
const fp = "a".repeat(64), nextFp = "b".repeat(64);
const tradeId = "10000000-0000-4000-8000-000000000001";

function storeMock() {
  const state = { exists: false, public: false, failUpload: false, creates: [], uploads: [], files: new Map() };
  const storage = {
    getBucket: async () => state.exists ? { data: { public: state.public } } : { error: { statusCode: 404 } },
    createBucket: async (name, options) => { state.creates.push({ name, options }); state.exists = true; return {}; },
    from: () => ({
      download: async (path) => state.files.has(path) ? { data: new Blob([state.files.get(path)]) } : { error: { statusCode: 404 } },
      list: async (folder, options) => ({ data: [...state.files.keys()].filter((path) => path.startsWith(`${folder}/`)).reverse().slice(options.offset ?? 0, (options.offset ?? 0) + options.limit).map((path) => ({ name: path.slice(folder.length + 1) })) }),
      upload: async (path, body, options) => {
        state.uploads.push({ path, options });
        if (state.failUpload) return { error: { statusCode: 503, message: "Unavailable" } };
        if (state.files.has(path) && !options.upsert) return { error: { statusCode: 409, message: "The resource already exists" } };
        state.files.set(path, body); return {};
      },
    }),
  };
  const api = load("lib/mistake-report-store.ts", { "node:crypto": crypto, zod: { z }, "@/lib/supabase-server": { requireSupabase: () => ({ storage }) }, "@/lib/mistake-patterns": helpers, "@/lib/mistake-resolutions": resolutionHelpers });
  return { state, api };
}

test("Reading a missing archive never creates storage; setup creates only a private bucket", async () => {
  const { state, api } = storeMock();
  assert.equal(await api.readMistakeReport(), null); assert.equal(state.creates.length, 0);
  await api.ensureMistakeReportStore(); await api.ensureMistakeReportStore();
  assert.equal(state.creates.length, 1); assert.equal(state.creates[0].options.public, false);
  state.public = true;
  await assert.rejects(api.readMistakeReport(), /privat/);
});

test("Snapshots survive reload and failed updates, never overwrite, and keep Live separate", async () => {
  const { state, api } = storeMock(); await api.ensureMistakeReportStore();
  await api.saveMistakeReport(report, fp);
  assert.deepEqual((await api.readMistakeReport(undefined, fp)).report, report);
  await api.saveMistakeReport({ ...report, sourceCount: 99 }, fp);
  assert.equal((await api.readMistakeReport(undefined, fp)).report.sourceCount, 0);
  assert.ok(state.uploads.every((upload) => upload.options.upsert === false));
  state.failUpload = true;
  await assert.rejects(api.saveMistakeReport(report, nextFp), /dauerhaft/);
  assert.equal((await api.readMistakeReport(undefined, nextFp)).fingerprint, fp);
  assert.equal(await api.readMistakeReport(undefined, nextFp, false), null);
  assert.equal(await api.readMistakeReport(tradeId, fp), null);
  state.failUpload = false;
  await api.saveMistakeReport(report, nextFp, tradeId);
  assert.equal((await api.readMistakeReport(tradeId, nextFp)).fingerprint, nextFp);
  assert.equal((await api.readMistakeReport()).fingerprint, fp);
});

test("Fingerprint changes with source text and scope; corrupt snapshots fail closed", async () => {
  const { state, api } = storeMock();
  const source = { fields: { review_mistake: "Zu früh" } };
  assert.equal(api.mistakeFingerprint([source]), api.mistakeFingerprint([source]));
  assert.notEqual(api.mistakeFingerprint([source]), api.mistakeFingerprint([{ fields: { review_mistake: "Zu spät" } }]));
  assert.notEqual(api.mistakeFingerprint([source]), api.mistakeFingerprint([source], tradeId));
  await api.ensureMistakeReportStore();
  state.files.set(`all/${fp}.json`, JSON.stringify({ fingerprint: nextFp, report }));
  await assert.rejects(api.readMistakeReport(undefined, fp), /Datenstand/);
});

test("Resolution status survives report replacements, reopening and updates to other problems", async () => {
  const { state, api } = storeMock();
  const pattern = { label: "Zu früher Entry", evidence: [], live: 1, backtest: 0, notes: 0, previous: 0 };
  assert.deepEqual(await api.readMistakeResolutions(), []); assert.equal(state.creates.length, 0);
  await api.saveMistakeResolution(pattern, true);
  await api.saveMistakeResolution({ ...pattern, label: "Stopp verschoben" }, true);
  await api.saveMistakeReport(report, fp);
  assert.equal((await api.readMistakeResolutions()).length, 2);
  await api.saveMistakeResolution(pattern, false);
  const entries = await api.readMistakeResolutions();
  assert.equal(entries.find((entry) => entry.key === "zu früher entry").resolved, false);
  assert.equal(entries.find((entry) => entry.key === "stopp verschoben").resolved, true);
  assert.equal((await api.readMistakeReport()).fingerprint, fp);
  state.failUpload = true;
  await assert.rejects(api.saveMistakeResolution(pattern, true), /nicht gespeichert/);
  assert.equal((await api.readMistakeResolutions()).find((entry) => entry.key === "zu früher entry").resolved, false);
});

test("Resolution reader paginates beyond the first hundred records", async () => {
  const { api } = storeMock();
  for (let i = 0; i < 101; i++) await api.saveMistakeResolution({ label: `Problem ${i}`, evidence: [], live: 0, backtest: 0, notes: 1, previous: 0 }, true);
  assert.equal((await api.readMistakeResolutions()).length, 101);
});

test("Client persists completed results independently of navigation and deduplicates the same Live save", async () => {
  const originalFetch = globalThis.fetch, originalWindow = globalThis.window;
  const entries = new Map(); let requests = 0;
  globalThis.window = { localStorage: { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) } };
  globalThis.fetch = async () => { requests++; return Response.json({ ...report, persisted: true }); };
  try {
    const client = load("lib/mistake-report-client.ts", { "@/lib/mistake-patterns": helpers });
    assert.equal(client.readBrowserReport(), null); assert.equal(requests, 0);
    await Promise.all([client.requestMistakeReport(tradeId, "save-1"), client.requestMistakeReport(tradeId, "save-1")]);
    assert.equal(requests, 1); assert.deepEqual(client.readBrowserReport(tradeId), report);
    const reload = load("lib/mistake-report-client.ts", { "@/lib/mistake-patterns": helpers });
    assert.deepEqual(reload.readBrowserReport(tradeId), report); assert.equal(requests, 1);
    assert.equal(reload.completedLiveCheck(tradeId, "save-1"), true);
    assert.equal(reload.completedLiveCheck(tradeId, "save-2"), false);
    globalThis.fetch = async () => new Response("<html>Server timeout</html>", { status: 504 });
    await assert.rejects(reload.requestMistakeReport(tradeId), /unterbrochen/);
    assert.deepEqual(reload.readBrowserReport(tradeId), report);
  } finally { globalThis.fetch = originalFetch; globalThis.window = originalWindow; }
});

test("Streaming waits for a complete message; stalled streams abort at the total deadline", async () => {
  const { streamMistakeMessage } = load("lib/mistake-stream.ts");
  const message = { stop_reason: "tool_use" };
  const client = { messages: { stream: (params, { signal }) => ({ finalMessage: async () => { assert.equal(params.model, "test"); assert.equal(signal.aborted, false); return message; } }) } };
  assert.equal(await streamMistakeMessage(client, { model: "test" }, 100), message);
  let aborted = false;
  const stalled = { messages: { stream: (_, { signal }) => ({ finalMessage: () => new Promise((resolve, reject) => signal.addEventListener("abort", () => { aborted = true; reject(Error("abort")); })) }) } };
  await assert.rejects(streamMistakeMessage(stalled, {}, 5), /timed out/); assert.equal(aborted, true);
  const failure = Error("Provider unavailable");
  const failing = { messages: { stream: () => ({ finalMessage: async () => { throw failure; } }) } };
  await assert.rejects(streamMistakeMessage(failing, {}, 100), (error) => error === failure);
});
