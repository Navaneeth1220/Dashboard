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
 * Where to start (Step 9) follows as its own stage, whatever the headline
 * and overview gave (unless the provider was unavailable): the model picks
 * min(3, n) of the matched actions and writes one reason each. A broken set
 * of picks is asked for again whole; otherwise only the failing reasons are
 * repaired, one call each, and passing picks are kept exactly. Its failure
 * or unavailability never touches the rest of the report.
 *
 * It never throws. `generated` is returned whatever the status. A draft that
 * fails validation is never returned: `failed` carries no narrative (and a
 * failed Where to start no picks), and attempt records hold errors and token
 * counts only.
 */

import { buildAssessmentFacts, triggerFacts } from './facts.js';
import {
  SYSTEM_PROMPT, SECTION_DESCRIPTIONS, buildUserMessage, selectModelFacts,
  WHERE_TO_START_PROMPT, buildWhereToStartMessage, buildPickMessage,
} from './prompt.js';
import {
  buildOutputSchema, buildSectionSchema, buildPicksSchema, buildReasonSchema, MODEL_PARTS, GENERATED_KEYS, WHERE_TO_START_KEY,
} from './schema.js';
import { buildGeneratedSections, buildWhereToStartPart } from './templates.js';
import { matchAssessmentActions } from '../engine/actions.js';
import { ACTION_CATALOGUE } from '../data/actionCatalogue.js';
import { validateNarrative, validatePicks, CONTEXT_KINDS } from './validator.js';
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
  [WHERE_TO_START_KEY, 'ai'],
]);

/** The unavailable reason an error from the provider maps to (a plain error is provider_error). */
function reasonOf(error) {
  return error instanceof ProviderUnavailableError ? error.reason : 'provider_error';
}

/** A provider error as { reason, message }. */
function unavailableOf(error) {
  const e = error instanceof ProviderUnavailableError
    ? error
    : new ProviderUnavailableError('provider_error', String(error?.message ?? error));
  return { reason: e.reason, message: e.message };
}

const UNPARSEABLE_DETAIL = 'The response was cut off or was not valid JSON.';

const UNPARSEABLE = {
  section: null,
  sentence: null,
  rule: 'shape',
  detail: UNPARSEABLE_DETAIL,
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

/**
 * The facts a part cited (existing IDs, in fact order); all given facts if it
 * cited none, or only context and scale facts (a headline that failed check
 * 12 could not otherwise cite a finding in its repair).
 */
function factsOfPart(part, facts) {
  const cited = new Set(Array.isArray(part?.factIds) ? part.factIds : []);
  const own = facts.filter(f => cited.has(f.id));
  return own.some(f => !CONTEXT_KINDS.has(f.kind)) ? own : facts;
}

/**
 * A rejected sentence is model text, so errors leave generateNarrative with
 * sentence null; detail (validator text) stays. The retry messages still
 * quote the sentences to the model. keepSentences is for the manual-check
 * script only.
 */
function withoutSentences(errors) {
  return errors.map(e => ({ ...e, sentence: null }));
}

function counts(response) {
  return {
    promptEvalCount: response?.promptEvalCount ?? null,
    evalCount: response?.evalCount ?? null,
    doneReason: response?.doneReason ?? null,
    durationMs: response?.durationMs ?? null,
  };
}

function record(attempt, section, errors, response) {
  return { attempt, section, errors, ...counts(response) };
}

/**
 * The headline and overview (Step 4) → { status, reason?, message?, narrative, errors }.
 * `run` holds what both stages share: the provider call, progress, attempts.
 */
async function draftSummary(run, { facts, modelFacts, generated }) {
  const schema = buildOutputSchema(modelFacts.map(f => f.id));
  const baseMessage = buildUserMessage(modelFacts);
  let draft = null;   // the model's current { headline, overview }, once one is usable
  let errors = [];

  const unavailable = error => ({ status: 'unavailable', ...unavailableOf(error), narrative: null, errors: [] });

  for (let attempt = 1; attempt <= run.maxAttempts; attempt++) {
    run.progress(attempt, 'summary');
    const call = (user, callSchema) => run.call(SYSTEM_PROMPT, attempt, user, callSchema);

    const failing = draft === null ? [] : MODEL_PARTS.filter(key => errors.some(e => e.section === key));

    if (failing.length === 0) {
      // Both parts: attempt 1, or no usable draft yet.
      const user = attempt === 1 ? baseMessage : buildRetryMessage(baseMessage, errors);
      let response;
      try {
        response = await call(user, schema);
      } catch (error) {
        // The very first call is repeated once on provider_error: Ollama's
        // llama-server crashed while loading the model in two manual-check
        // run sets, and the next request loads it again.
        if (attempt !== 1 || reasonOf(error) !== 'provider_error') return unavailable(error);
        try {
          response = await call(user, schema);
        } catch (repeated) {
          return unavailable(repeated);
        }
      }
      draft = parseObject(response);
      errors = draft === null ? [UNPARSEABLE] : validateDraft(draft, facts);
      run.attempts.push(record(attempt, null, run.returned(errors), response));
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
        run.attempts.push(record(attempt, key, run.returned(errors.filter(e => e.section === key)), response));
      }
    }

    if (errors.length === 0) {
      const narrative = { headline: draft.headline, sections: { overview: draft.overview, ...generated } };
      return { status: 'ok', narrative, errors: [] };
    }
  }

  return { status: 'failed', narrative: null, errors: run.returned(errors) };
}

// ---------------------------------------------------------------------------
// Where to start (Step 9)
// ---------------------------------------------------------------------------

const titleOf = id => ACTION_CATALOGUE.find(entry => entry.id === id)?.title ?? id;

const unparseablePick = pick => ({ section: WHERE_TO_START_KEY, pick, sentence: null, rule: 'shape', detail: UNPARSEABLE_DETAIL });

/** Whole retry of the picks: the unchanged message plus the latest errors (never the draft). */
function buildPicksRetryMessage(baseMessage, errors) {
  return [
    baseMessage,
    '',
    'Your previous picks broke these rules:',
    ...errorLines(errors, e => `- ${e.pick ?? 'picks'}${e.sentence ? `, "${e.sentence}"` : ''}: ${e.detail}`),
    'Pick again and write every reason again from the facts above, following every rule.',
  ].join('\n');
}

/** One reason's repair: that action's trigger facts and line, and its errors. */
function buildReasonMessage(facts, action, errors) {
  return [
    buildPickMessage(facts, action),
    '',
    'Write only the reason for this action: one sentence stating the finding in its facts that the action addresses.',
    'Your previous reason broke these rules:',
    ...errorLines(errors, e => (e.sentence ? `- "${e.sentence}": ${e.detail}` : `- ${e.detail}`)),
    'Write the reason again from the facts above, following every rule.',
  ].join('\n');
}

/**
 * Where to start → { status: 'ok' | 'failed' | 'unavailable' | 'none', reason?, message?, picks, part, errors }.
 * picks (ok only): [{ actionId, title, reason, factIds }] in catalogue order.
 */
async function draftWhereToStart(run, { facts, actions }) {
  const empty = { picks: null, part: null, errors: [] };
  if (actions.length === 0) return { status: 'none', ...empty };

  const baseMessage = buildWhereToStartMessage(facts, actions);
  const schema = buildPicksSchema(actions.map(a => a.id));
  // Per-pick errors name the action's catalogue title for the panel's error list.
  const returned = errs => run.returned(errs).map(e => (e.pick ? { ...e, title: titleOf(e.pick) } : e));
  const record = (attempt, pick, errs, response) =>
    ({ attempt, section: WHERE_TO_START_KEY, pick, errors: returned(errs), ...counts(response) });
  let draft = null;   // the model's current { picks }, once one is usable
  let errors = [];

  for (let attempt = 1; attempt <= run.maxAttempts; attempt++) {
    run.progress(attempt, WHERE_TO_START_KEY);
    const call = (user, callSchema) => run.call(WHERE_TO_START_PROMPT, attempt, user, callSchema);
    // A broken set (or no usable draft) is asked for again whole; otherwise
    // only the failing reasons are repaired.
    const whole = draft === null || errors.some(e => e.pick === null);

    try {
      if (whole) {
        const response = await call(attempt === 1 ? baseMessage : buildPicksRetryMessage(baseMessage, errors), schema);
        draft = parseObject(response);
        errors = draft === null ? [unparseablePick(null)] : validatePicks(draft, facts, actions).errors;
        run.attempts.push(record(attempt, null, errors, response));
      } else {
        const failing = actions.filter(a => errors.some(e => e.pick === a.id));
        const calls = [];
        const unusable = new Set();
        for (const action of failing) {
          const response = await call(
            buildReasonMessage(facts, action, errors.filter(e => e.pick === action.id)), buildReasonSchema());
          const reply = parseObject(response);
          if (reply === null) unusable.add(action.id);
          else draft = { picks: draft.picks.map(p => (p.actionId === action.id ? { ...p, reason: reply.reason } : p)) };
          calls.push({ action, response });
        }
        const validated = validatePicks(draft, facts, actions).errors;
        errors = [
          ...validated.filter(e => e.pick === null),
          ...actions.flatMap(a => [
            ...(unusable.has(a.id) ? [unparseablePick(a.id)] : []),
            ...validated.filter(e => e.pick === a.id),
          ]),
        ];
        for (const { action, response } of calls) {
          run.attempts.push(record(attempt, action.id, errors.filter(e => e.pick === action.id), response));
        }
      }
    } catch (error) {
      return { status: 'unavailable', ...unavailableOf(error), ...empty };
    }

    if (errors.length === 0) {
      const picks = actions
        .map(a => [a, draft.picks.find(p => p.actionId === a.id)])
        .filter(([, pick]) => pick)
        .map(([a, pick]) => ({
          actionId: a.id, title: titleOf(a.id), reason: pick.reason, factIds: triggerFacts(facts, a.triggers).map(f => f.id),
        }));
      return { status: 'ok', picks, part: buildWhereToStartPart(picks, facts), errors: [] };
    }
  }

  return { status: 'failed', ...empty, errors: returned(errors) };
}

/**
 * generateNarrative(assessment, options) →
 *   { status: 'ok' | 'failed' | 'unavailable', reason?, message?, narrative, generated, origin,
 *     errors, facts, actions, attempts, model, whereToStart }
 *
 * actions: the matched catalogue entries, [{ id, triggers }] (Step 8).
 * whereToStart: its own status, picks and part (Step 9); `unavailable` with
 * the same reason, without a call, when the headline/overview were.
 *
 * narrative (ok only): { headline, sections: { overview, ...generated } }.
 * origin: 'ai' | 'generated' per part. No error carries a sentence unless
 * keepSentences is set. onAttempt({ attempt, maxAttempts, part }), part
 * 'summary' or 'whereToStart'.
 */
export async function generateNarrative(assessment, {
  model = DEFAULT_MODEL,
  provider = callOllama,
  maxAttempts = 3,
  timeoutMs,
  signal,
  onAttempt,
  keepSentences = false,
} = {}) {
  const facts = buildAssessmentFacts(assessment);
  const modelFacts = selectModelFacts(facts);
  const actions = matchAssessmentActions(assessment);
  const generated = buildGeneratedSections(facts, actions);
  const attempts = [];
  const run = {
    maxAttempts,
    attempts,
    returned: errs => (keepSentences ? errs : withoutSentences(errs)),
    progress: (attempt, part) => {
      try {
        onAttempt?.({ attempt, maxAttempts, part });
      } catch (error) {
        console.warn(`onAttempt callback threw; continuing generation: ${error?.message ?? error}`);
      }
    },
    call: (system, attempt, user, schema) => provider({
      model, system, user, schema,
      temperature: attempt === 1 ? OLLAMA_OPTIONS.temperature : RETRY_TEMPERATURE,
      timeoutMs, signal,
    }),
  };

  const summary = await draftSummary(run, { facts, modelFacts, generated });
  const whereToStart = summary.status === 'unavailable'
    ? { status: 'unavailable', reason: summary.reason, message: summary.message, picks: null, part: null, errors: [] }
    : await draftWhereToStart(run, { facts, actions });

  return { ...summary, generated, origin: ORIGIN, facts, actions, attempts, model, whereToStart };
}
