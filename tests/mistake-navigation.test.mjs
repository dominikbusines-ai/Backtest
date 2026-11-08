import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

function load(file, dependencies = {}) {
  const code = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", code)((name) => dependencies[name], loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const navigation = load("lib/mistake-navigation.ts");
const id = "10000000-0000-4000-8000-000000000001";

test("Trade and note evidence preserve their destination and the exact return pattern", () => {
  const label = "Zu früher Entry / ohne Bestätigung?";
  for (const href of [`/trades/${id}`, `/#note-${id}`]) {
    const result = new URL(navigation.mistakeEvidenceHref(href, label), "https://example.test");
    assert.equal(`${result.pathname}${result.hash}`, href);
    assert.equal(result.searchParams.get("return_to"), `/fehlermuster#${navigation.mistakeAnchor(label)}`);
    assert.equal(navigation.mistakeReturnTarget(result.searchParams.get("return_to")), result.searchParams.get("return_to"));
  }
  const live = new URL(navigation.mistakeEvidenceHref(`/#note-${id}`, label, id), "https://example.test");
  assert.equal(live.searchParams.get("return_to"), `/trades/${id}#${navigation.mistakeAnchor(label)}`);
  assert.ok(!live.searchParams.get("return_to").includes("mistake_check"));
});

test("Return links reject external, scripted and unrelated navigation targets", () => {
  for (const value of [null, "", "//example.com", "https://example.com", "javascript:alert(1)", "/fehlermuster?redirect=https://example.com", "/trades/../admin", "/fehlermuster#unknown", "/backtest"]) {
    assert.equal(navigation.mistakeReturnTarget(value), null);
  }
  assert.equal(navigation.mistakeReturnTarget("/fehlermuster"), "/fehlermuster");
});

test("Returning opens the referenced evidence and its solved subsection before scrolling", () => {
  const evidence = { open: false }, solved = { open: false, parentElement: null };
  let scrolled = false;
  const root = { getElementById: (id) => id === "problem-61" ? { querySelector: () => evidence, parentElement: { closest: () => solved }, scrollIntoView: () => { scrolled = true; assert.equal(evidence.open, true); assert.equal(solved.open, true); } } : null };
  assert.equal(navigation.revealMistakeAnchor("#problem-61", root), true);
  assert.equal(scrolled, true);
  assert.equal(navigation.revealMistakeAnchor("#problem-62", root), false);
  assert.equal(navigation.revealMistakeAnchor("#other", root), false);
});

test("A visible return control is rendered only for a valid evidence origin", () => {
  for (const target of ["/fehlermuster#problem-61", `/trades/${id}#problem-61`, "https://example.com", null]) {
    const component = load("components/evidence-return-link.tsx", {
      "react/jsx-runtime": jsx,
      "next/link": { __esModule: true, default: (props) => jsx.jsx("a", props) },
      "next/navigation": { useSearchParams: () => new URLSearchParams(target ? { return_to: target } : {}) },
      "lucide-react": { ArrowLeft: "span" }, "@/lib/mistake-navigation": navigation,
    });
    const html = renderToStaticMarkup(component.EvidenceReturnLink());
    if (!navigation.mistakeReturnTarget(target)) assert.equal(html, "");
    else {
      assert.ok(html.includes(`href="${target}"`)); assert.match(html, /sticky/);
      assert.ok(html.includes(target.startsWith("/fehlermuster") ? "Zurück zu Fehlermustern" : "Zurück zur Fehlerprüfung"));
    }
  }
});
