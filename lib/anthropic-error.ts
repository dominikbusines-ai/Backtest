// Classify provider failures without exposing credentials, prompts, headers or raw response bodies.
export function explainAnthropicError(error: unknown) {
  const value = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const status = typeof value.status === "number" ? value.status : 0;
  const body = value.error && typeof value.error === "object" ? value.error as Record<string, unknown> : {};
  const detail = body.error && typeof body.error === "object" ? body.error as Record<string, unknown> : body;
  const message = [value.message, detail.message].filter((item) => typeof item === "string").join(" ").toLowerCase();
  const type = typeof value.type === "string" ? value.type : detail.type;
  const name = error instanceof Error ? error.constructor.name : value.name;
  let code = "PROVIDER_ERROR";
  let description = "Anthropic konnte die Anfrage nicht verarbeiten. Bitte den Fehlercode und die Anfrage-ID zur Prüfung weitergeben.";
  if (/credit balance|insufficient.{0,30}(credit|balance)|billing|payment required/.test(message) || status === 402) {
    code = "CREDIT_BALANCE";
    description = "Anthropic meldet fehlendes API-Guthaben oder ein Abrechnungsproblem. Bitte das Guthaben des API-Workspaces prüfen, zu dem der hinterlegte Schlüssel gehört. Ein Claude-Abonnement ist davon getrennt.";
  } else if (status === 401 || type === "authentication_error") {
    code = "API_KEY_INVALID";
    description = "Anthropic lehnt den API-Schlüssel ab. Bitte ANTHROPIC_API_KEY in Vercel prüfen und nach einer Korrektur neu deployen.";
  } else if (status === 403 || type === "permission_error") {
    code = "API_PERMISSION";
    description = "Der hinterlegte Anthropic-Schlüssel hat keine Berechtigung für diese Anfrage. Bitte die Workspace- und Modellberechtigungen prüfen.";
  } else if (status === 404 || /model.{0,100}(not found|not available|does not exist|not supported|deprecated|retired)/.test(message)) {
    code = "MODEL_UNAVAILABLE";
    description = "Das konfigurierte Anthropic-Modell ist nicht verfügbar. Bitte ANTHROPIC_TEXT_MODEL bzw. ANTHROPIC_VISION_MODEL in Vercel prüfen.";
  } else if (status === 429 || type === "rate_limit_error") {
    code = "RATE_LIMIT";
    description = "Anthropic begrenzt gerade die Anfragen oder Tokenmenge. Bitte kurz warten und erneut prüfen. Das ist kein Nachweis für fehlendes Guthaben.";
  } else if (name === "APIConnectionTimeoutError" || /timed out|timeout/.test(message)) {
    code = "TIMEOUT";
    description = "Die Anthropic-Anfrage hat das Zeitlimit von zwei Minuten überschritten. Die letzte erfolgreich gespeicherte Auswertung bleibt erhalten.";
  } else if (name === "APIConnectionError" || /connection error|fetch failed/.test(message)) {
    code = "CONNECTION";
    description = "Der Server konnte Anthropic nicht erreichen. Bitte später erneut versuchen.";
  } else if (status === 529 || type === "overloaded_error" || status >= 500) {
    code = "PROVIDER_UNAVAILABLE";
    description = "Anthropic meldet eine vorübergehende Störung oder Überlastung. Bitte später erneut versuchen.";
  } else if (status === 400 || status === 422) {
    code = /max_tokens/.test(message) ? "TOKEN_CONFIGURATION" : "REQUEST_INVALID";
    description = code === "TOKEN_CONFIGURATION"
      ? "Anthropic lehnt die konfigurierte Ausgabelänge ab. Die Token-Einstellung muss zum verwendeten Modell passen."
      : "Anthropic lehnt das Anfrageformat ab. Das muss im Code geprüft werden; bitte nicht auf Verdacht Guthaben nachladen.";
  }
  const requestId = typeof value.requestID === "string" && /^req_[a-zA-Z0-9_-]{1,100}$/.test(value.requestID) ? value.requestID : "";
  return {
    error: `${description} Gespeicherte Daten bleiben unverändert. [${code}${status ? ` · HTTP ${status}` : ""}${requestId ? ` · ${requestId}` : ""}]`,
    code, providerStatus: status, requestId,
  };
}
