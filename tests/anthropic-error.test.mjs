import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const code = ts.transpileModule(readFileSync(new URL("../lib/anthropic-error.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const loaded = { exports: {} };
new Function("exports", code)(loaded.exports);
const classify = loaded.exports.explainAnthropicError;

for (const [error, expected] of [
  [{ status: 400, error: { error: { message: "Your credit balance is too low" } } }, "CREDIT_BALANCE"],
  [{ status: 401 }, "API_KEY_INVALID"], [{ status: 403 }, "API_PERMISSION"],
  [{ status: 404 }, "MODEL_UNAVAILABLE"], [{ status: 429 }, "RATE_LIMIT"],
  [{ name: "APIConnectionTimeoutError" }, "TIMEOUT"], [{ name: "APIConnectionError" }, "CONNECTION"],
  [{ status: 529 }, "PROVIDER_UNAVAILABLE"], [{ status: 500 }, "PROVIDER_UNAVAILABLE"],
  [{ status: 400, message: "max_tokens exceeds allowed range" }, "TOKEN_CONFIGURATION"],
  [{ status: 400, message: "invalid schema" }, "REQUEST_INVALID"],
]) {
  test(`Provider error maps to ${expected}`, () => assert.equal(classify(error).code, expected));
}
test("Raw text, credentials, headers and workspace IDs are never returned", () => {
  const result = classify({ status: 400, message: "SECRET_PRIVATE_TEXT sk-ant-secret", error: { token: "SECRET" }, headers: { Authorization: "SECRET" }, workspaceID: "PRIVATE", requestID: "req_safe123" });
  assert.ok(!JSON.stringify(result).includes("SECRET")); assert.ok(!JSON.stringify(result).includes("PRIVATE"));
  assert.equal(result.requestId, "req_safe123"); assert.match(result.error, /HTTP 400/);
  assert.equal(classify({ requestID: "<script>secret</script>" }).requestId, "");
});
