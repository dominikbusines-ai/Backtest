import type Anthropic from "@anthropic-ai/sdk";

export const MISTAKE_TIMEOUT_MS = 120000;

export async function streamMistakeMessage(client: Anthropic, params: Anthropic.MessageCreateParamsNonStreaming, timeoutMs = MISTAKE_TIMEOUT_MS) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    // Consume SSE internally so long responses do not wait silently on a single HTTP body.
    // Only a complete, validated result is exposed to the browser or saved.
    return await client.messages.stream(params, { signal: controller.signal }).finalMessage();
  } catch (error) {
    if (timedOut) throw new Error("Mistake analysis timed out");
    throw error;
  } finally { clearTimeout(timer); }
}
