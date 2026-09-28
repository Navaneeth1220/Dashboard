/**
 * Ollama provider for AI-drafted narrative reports (docs/ai-report-spec.md, Step 4).
 *
 * The only module in src/report/ with side effects (network, console
 * warnings). generate.js depends only on the call shape
 *   provider({ model, system, user, schema, timeoutMs, signal })
 *     → { content, promptEvalCount, evalCount, evalDurationMs, doneReason, durationMs }
 * so another backend can be added without touching anything else.
 *
 * Failures to get a response throw ProviderUnavailableError with a reason:
 * not_running | model_missing | timeout | cancelled | provider_error.
 * Content that is not valid JSON is returned as-is: that is a model output
 * problem, handled as a failed attempt by generate.js.
 */

// num_ctx 4096: the 6 GB GPU keeps qwen2.5:7b at a 16%/84% CPU/GPU split;
// 8192 would push more onto the CPU. num_predict bounds a runaway output.
export const OLLAMA_OPTIONS = { temperature: 0.2, num_ctx: 4096, num_predict: 1024 };

/** Above this many prompt tokens, raise num_ctx to 6144. */
export const PROMPT_TOKEN_WARNING = 3000;

// 300 s: in the first manual check the laptop GPU throttled to ~3 tokens/s,
// and a ~550-token draft then takes ~3 minutes.
export const DEFAULT_TIMEOUT_MS = 300_000;

export class ProviderUnavailableError extends Error {
  constructor(reason, message) {
    super(message);
    this.name = 'ProviderUnavailableError';
    this.reason = reason;
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Classify a non-2xx response. The Vite proxy answers 502 with an empty body when Ollama is down. */
function unavailableForStatus(status, text, json) {
  if (status === 502 && text.trim() === '') {
    return new ProviderUnavailableError('not_running', 'Ollama is not reachable through the dev server proxy.');
  }
  if (status === 404 && typeof json?.error === 'string') {
    return new ProviderUnavailableError('model_missing', json.error);
  }
  return new ProviderUnavailableError('provider_error',
    typeof json?.error === 'string' ? json.error : `Ollama returned HTTP ${status}.`);
}

export async function callOllama({
  model, system, user, schema,
  baseUrl = '/ollama', timeoutMs = DEFAULT_TIMEOUT_MS, signal,
  fetchImpl = globalThis.fetch, warn = console.warn,
}) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onCallerAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', onCallerAbort, { once: true });

  const started = Date.now();
  try {
    let response;
    let text;
    try {
      response = await fetchImpl(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          format: schema,
          stream: false,
          options: OLLAMA_OPTIONS,
        }),
        signal: controller.signal,
      });
      text = await response.text();
    } catch {
      if (timedOut) throw new ProviderUnavailableError('timeout', `No response from Ollama within ${Math.round(timeoutMs / 1000)} s.`);
      if (signal?.aborted) throw new ProviderUnavailableError('cancelled', 'Generation was cancelled.');
      throw new ProviderUnavailableError('not_running', `Ollama is not reachable at ${baseUrl}.`);
    }

    const json = parseJson(text);
    if (!response.ok) throw unavailableForStatus(response.status, text, json);

    const content = json?.message?.content;
    if (typeof content !== 'string') {
      throw new ProviderUnavailableError('provider_error', 'Ollama returned a response without message content.');
    }

    const promptEvalCount = json.prompt_eval_count ?? null;
    const evalCount = json.eval_count ?? null;
    const evalDurationMs = typeof json.eval_duration === 'number' ? json.eval_duration / 1e6 : null;   // ns → ms
    const doneReason = json.done_reason ?? null;

    if (promptEvalCount !== null && promptEvalCount > PROMPT_TOKEN_WARNING) {
      warn(`Ollama prompt used ${promptEvalCount} tokens (warning above ${PROMPT_TOKEN_WARNING}): raise num_ctx to 6144.`);
    }
    if (doneReason === 'length') {
      warn(`Ollama output was cut off (done_reason "length"; num_predict ${OLLAMA_OPTIONS.num_predict}, num_ctx ${OLLAMA_OPTIONS.num_ctx}).`);
    }

    return { content, promptEvalCount, evalCount, evalDurationMs, doneReason, durationMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }
}
