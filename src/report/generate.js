/**
 * Narrative generation (docs/ai-report-spec.md, Step 4).
 *
 * generateNarrative(assessment, options) builds the facts, asks the provider
 * for a draft, validates it, and retries with the validator's errors. It
 * never throws. A draft that fails validation is never returned: `failed`
 * carries no narrative, and attempt records hold errors and token counts
 * only.
 */

import { buildAssessmentFacts } from './facts.js';
import { SYSTEM_PROMPT, buildUserMessage } from './prompt.js';
import { buildOutputSchema } from './schema.js';
import { validateNarrative } from './validator.js';
import { callOllama, ProviderUnavailableError } from './providers/ollama.js';

export const DEFAULT_MODEL = 'qwen2.5:7b';

/** At most this many errors are fed back to the model on a retry. */
export const MAX_RETRY_ERRORS = 10;

const UNPARSEABLE = {
  section: null,
  sentence: null,
  rule: 'shape',
  detail: 'The response was cut off or was not valid JSON.',
};

/** The parsed draft, or null when the output was cut off or is not JSON. */
function parseDraft(response) {
  if (response?.doneReason === 'length') return null;
  try {
    return JSON.parse(response?.content);
  } catch {
    return null;
  }
}

/** The unchanged fact list plus the latest attempt's errors (never the draft). */
function buildRetryMessage(baseMessage, errors) {
  const lines = errors.slice(0, MAX_RETRY_ERRORS).map(e => {
    const where = e.section ?? 'narrative';
    return e.sentence ? `- ${where}, "${e.sentence}": ${e.detail}` : `- ${where}: ${e.detail}`;
  });
  if (errors.length > MAX_RETRY_ERRORS) lines.push(`- …and ${errors.length - MAX_RETRY_ERRORS} more.`);
  return [
    baseMessage,
    '',
    'Your previous draft broke these rules:',
    ...lines,
    'Write the whole summary again from the facts above, following every rule.',
  ].join('\n');
}

/**
 * generateNarrative(assessment, options) →
 *   { status: 'ok' | 'failed' | 'unavailable', reason?, message?, narrative, errors, facts, attempts, model }
 */
export async function generateNarrative(assessment, {
  model = DEFAULT_MODEL,
  provider = callOllama,
  maxAttempts = 3,
  timeoutMs,
  signal,
  onAttempt,
} = {}) {
  const facts = buildAssessmentFacts(assessment);
  const schema = buildOutputSchema(facts.map(f => f.id));
  const baseMessage = buildUserMessage(facts);
  const attempts = [];
  let user = baseMessage;
  let errors = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      onAttempt?.({ attempt, maxAttempts });
    } catch (error) {
      console.warn(`onAttempt callback threw; continuing generation: ${error?.message ?? error}`);
    }

    let response;
    try {
      response = await provider({ model, system: SYSTEM_PROMPT, user, schema, timeoutMs, signal });
    } catch (error) {
      const unavailable = error instanceof ProviderUnavailableError
        ? error
        : new ProviderUnavailableError('provider_error', String(error?.message ?? error));
      return {
        status: 'unavailable', reason: unavailable.reason, message: unavailable.message,
        narrative: null, errors: [], facts, attempts, model,
      };
    }

    const draft = parseDraft(response);
    errors = draft === null ? [UNPARSEABLE] : validateNarrative(draft, facts).errors;
    attempts.push({
      attempt,
      errors,
      promptEvalCount: response?.promptEvalCount ?? null,
      evalCount: response?.evalCount ?? null,
      doneReason: response?.doneReason ?? null,
      durationMs: response?.durationMs ?? null,
    });

    if (errors.length === 0) {
      return { status: 'ok', narrative: draft, errors: [], facts, attempts, model };
    }
    user = buildRetryMessage(baseMessage, errors);
  }

  return { status: 'failed', narrative: null, errors, facts, attempts, model };
}
