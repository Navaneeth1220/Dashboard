/**
 * Narrative generation (docs/ai-report-spec.md, Step 4).
 *
 * Hybrid report: generateNarrative(assessment, options) builds the facts,
 * generates four sections from them with templates (no model), and asks the
 * provider for the two MODEL_PARTS (headline and overview) from the reduced
 * fact set (attempt 1). Attempts 2 and 3 repair only the parts that failed
 * validation: each failing part gets its own call with just its facts, its
 * errors and its description, and a part that passed is kept exactly as it
 * is. Only when there is no usable draft at all are both parts asked for
 * again. Retries run at a higher temperature so the model does not repeat a
 * rejected sentence word for word. The validator checks the model parts
 * against all facts; the generated sections are not validated at runtime
 * (a property test covers them).
 *
 * It never throws. `generated` is returned whatever the status. A draft that
 * fails validation is never returned: `failed` carries no narrative, and
 * attempt records hold errors and token counts only.
 */

import { buildAssessmentFacts } from './facts.js';
import { SYSTEM_PROMPT, SECTION_DESCRIPTIONS, buildUserMessage, selectModelFacts } from './prompt.js';
import { buildOutputSchema, buildSectionSchema, MODEL_PARTS, GENERATED_KEYS } from './schema.js';
import { buildGeneratedSections } from './templates.js';
import { validateNarrative } from './validator.js';
import { callOllama, OLLAMA_OPTIONS, ProviderUnavailableError } from './providers/ollama.js';

export const DEFAULT_MODEL = 'qwen2.5:7b';

/** At most this many errors are fed back to the model on a retry. */
export const MAX_RETRY_ERRORS = 10;

/** Retries (whole or per part) run warmer than the first attempt. */
export const RETRY_TEMPERATURE = 0.5;

/** Who wrote each part of the assembled report. */
const ORIGIN = Object.fromEntries([
  ...MODEL_PARTS.map(key => [key, 'ai']),
  ...GENERATED_KEYS.map(key => [key, 'generated']),
]);

const UNPARSEABLE = {
  section: null,
  sentence: null,
  rule: 'shape',
  detail: 'The response was cut off or was not valid JSON.',
};

/** The parsed reply as an object, or null when it was cut off, is not JSON, or is not an object. */
function parseObject(response) {
  if (response?.doneReason === 'length') return null;
  try {
    const value = JSON.parse(response?.content);
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/** The model's { headline, overview } in the validator's narrative shape. */
function asNarrative(draft) {
  return { headline: draft.headline, sections: { overview: draft.overview } };
}

function validateDraft(draft, facts) {
  return validateNarrative(asNarrative(draft), facts, { parts: MODEL_PARTS }).errors;
}

function errorLines(errors, format) {
  const lines = errors.slice(0, MAX_RETRY_ERRORS).map(format);
  if (errors.length > MAX_RETRY_ERRORS) lines.push(`- …and ${errors.length - MAX_RETRY_ERRORS} more.`);
  return lines;
}

/** Whole-draft retry: the unchanged fact list plus the latest errors (never the draft). */
function buildRetryMessage(baseMessage, errors) {
  return [
    baseMessage,
    '',
    'Your previous draft broke these rules:',
    ...errorLines(errors, e => {
      const where = e.section ?? 'narrative';
      return e.sentence ? `- ${where}, "${e.sentence}": ${e.detail}` : `- ${where}: ${e.detail}`;
    }),
    'Write the whole summary again from the facts above, following every rule.',
  ].join('\n');
}

/** Part repair: only that part's facts, its errors and its description. */
function buildSectionMessage(sectionFacts, key, errors) {
  return [
    buildUserMessage(sectionFacts),
    '',
    `Write only the ${key} part: ${SECTION_DESCRIPTIONS[key]}`,
    'Your previous version broke these rules:',
    ...errorLines(errors, e => (e.sentence ? `- "${e.sentence}": ${e.detail}` : `- ${e.detail}`)),
    'Write this part again from the facts above, following every rule.',
  ].join('\n');
}

/** The facts a part cited (existing IDs, in fact order); all given facts if it cited none. */
function factsOfPart(part, facts) {
  const cited = new Set(Array.isArray(part?.factIds) ? part.factIds : []);
  const own = facts.filter(f => cited.has(f.id));
  return own.length > 0 ? own : facts;
}

function record(attempt, section, errors, response) {
  return {
    attempt,
    section,
    errors,
    promptEvalCount: response?.promptEvalCount ?? null,
    evalCount: response?.evalCount ?? null,
    doneReason: response?.doneReason ?? null,
    durationMs: response?.durationMs ?? null,
  };
}

/**
 * generateNarrative(assessment, options) →
 *   { status: 'ok' | 'failed' | 'unavailable', reason?, message?, narrative, generated, origin,
 *     errors, facts, attempts, model }
 *
 * narrative (ok only): { headline, sections: { overview, ...generated } }.
 * origin: 'ai' | 'generated' per part.
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
  const modelFacts = selectModelFacts(facts);
  const generated = buildGeneratedSections(facts);
  const schema = buildOutputSchema(modelFacts.map(f => f.id));
  const baseMessage = buildUserMessage(modelFacts);
  const attempts = [];
  const common = { generated, origin: ORIGIN, facts, attempts, model };
  let draft = null;   // the model's current { headline, overview }, once one is usable
  let errors = [];

  const unavailable = error => {
    const e = error instanceof ProviderUnavailableError
      ? error
      : new ProviderUnavailableError('provider_error', String(error?.message ?? error));
    return { status: 'unavailable', reason: e.reason, message: e.message, narrative: null, errors: [], ...common };
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      onAttempt?.({ attempt, maxAttempts });
    } catch (error) {
      console.warn(`onAttempt callback threw; continuing generation: ${error?.message ?? error}`);
    }
    const temperature = attempt === 1 ? OLLAMA_OPTIONS.temperature : RETRY_TEMPERATURE;
    const call = async (user, callSchema) => provider({
      model, system: SYSTEM_PROMPT, user, schema: callSchema, temperature, timeoutMs, signal,
    });

    const failing = draft === null ? [] : MODEL_PARTS.filter(key => errors.some(e => e.section === key));

    if (failing.length === 0) {
      // Both parts: attempt 1, or no usable draft yet.
      let response;
      try {
        response = await call(attempt === 1 ? baseMessage : buildRetryMessage(baseMessage, errors), schema);
      } catch (error) {
        return unavailable(error);
      }
      draft = parseObject(response);
      errors = draft === null ? [UNPARSEABLE] : validateDraft(draft, facts);
      attempts.push(record(attempt, null, errors, response));
    } else {
      // Repair each failing part; a part that passed stays exactly as it is.
      const calls = [];
      const unusable = new Set();
      for (const key of failing) {
        const partFacts = factsOfPart(draft[key], modelFacts);
        let response;
        try {
          response = await call(
            buildSectionMessage(partFacts, key, errors.filter(e => e.section === key)),
            buildSectionSchema(partFacts.map(f => f.id)),
          );
        } catch (error) {
          return unavailable(error);
        }
        const part = parseObject(response);
        if (part === null) unusable.add(key);
        else draft = { ...draft, [key]: part };
        calls.push({ key, response });
      }

      const validated = validateDraft(draft, facts);
      errors = MODEL_PARTS.flatMap(key => [
        ...(unusable.has(key) ? [{ ...UNPARSEABLE, section: key }] : []),
        ...validated.filter(e => e.section === key),
      ]);
      for (const { key, response } of calls) {
        attempts.push(record(attempt, key, errors.filter(e => e.section === key), response));
      }
    }

    if (errors.length === 0) {
      const narrative = { headline: draft.headline, sections: { overview: draft.overview, ...generated } };
      return { status: 'ok', narrative, errors: [], ...common };
    }
  }

  return { status: 'failed', narrative: null, errors, ...common };
}
