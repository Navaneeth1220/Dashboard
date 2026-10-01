/**
 * Output schema for AI-drafted narrative reports (docs/ai-report-spec.md, Step 2).
 *
 * The report is a hybrid: the model writes MODEL_PARTS (headline, overview);
 * the GENERATED_KEYS sections are built from the facts by templates.js.
 *
 * Passed to Ollama's `format` field, which turns it into a grammar. Property
 * order matters: the model generates fields in order, so it picks factIds
 * before it writes text. factIds is an enum of the model's fact IDs, so an
 * invented ID cannot be generated. uniqueItems is deliberately absent —
 * llama.cpp grammars do not enforce it; the validator rejects duplicates.
 */

/** The parts the model writes. */
export const MODEL_PARTS = ['headline', 'overview'];

/** The sections generated deterministically from the facts. */
export const GENERATED_KEYS = [
  'measuredPerformance',
  'gapsAndMissingEvidence',
  'foundationsAndFlags',
  'priorities',
  'targets',
  'recommendedActions',
];

/** The Targets section (Step 7): the only part whose check 8 reads the target sentences. */
export const TARGETS_KEY = 'targets';

/** The Recommended actions section (Step 8): catalogue text matched to the assessment. */
export const ACTIONS_KEY = 'recommendedActions';

/**
 * Generated sections of fixed, reviewed catalogue text (Step 8). They state
 * nothing about the assessment, so the validator never checks them; the
 * catalogue and the matching have their own tests.
 */
export const CATALOGUE_KEYS = [ACTIONS_KEY];

/** The generated sections written from the facts: the ones the validator checks. */
export const FACT_SECTION_KEYS = GENERATED_KEYS.filter(key => !CATALOGUE_KEYS.includes(key));

/** Every section of the assembled report, in reading order. */
export const SECTION_KEYS = ['overview', ...GENERATED_KEYS];

/** One `{ factIds, text }` part; also the schema of a single-part repair call. */
export function buildSectionSchema(factIds) {
  return {
    type: 'object',
    properties: {
      factIds: { type: 'array', items: { type: 'string', enum: [...factIds] }, minItems: 1 },
      text: { type: 'string', minLength: 1 },
    },
    required: ['factIds', 'text'],
    additionalProperties: false,
  };
}

/** buildOutputSchema(factIds) → JSON Schema for { headline, overview } (a fresh object; factIds is copied). */
export function buildOutputSchema(factIds) {
  return {
    type: 'object',
    properties: Object.fromEntries(MODEL_PARTS.map(key => [key, buildSectionSchema(factIds)])),
    required: [...MODEL_PARTS],
    additionalProperties: false,
  };
}

// ---------------------------------------------------------------------------
// Where to start (Step 9): its own call, schema and validation
// ---------------------------------------------------------------------------

/** The Where to start part. Not in MODEL_PARTS or SECTION_KEYS: it has its own call and validator. */
export const WHERE_TO_START_KEY = 'whereToStart';

/** At most this many actions are picked. */
export const MAX_PICKS = 3;

/** The number of picks for n matched actions: all of them when n ≤ MAX_PICKS. */
export function pickCount(n) {
  return Math.min(MAX_PICKS, n);
}

/**
 * buildPicksSchema(actionIds) → JSON Schema for { picks: [{ actionId, reason }] },
 * exactly pickCount(n) picks; actionId (an enum of the matched action IDs)
 * comes before reason, so the model picks first and then writes. A pick's
 * facts are its trigger facts, decided by the engine, so the model sends none.
 */
export function buildPicksSchema(actionIds) {
  const count = pickCount(actionIds.length);
  return {
    type: 'object',
    properties: {
      picks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            actionId: { type: 'string', enum: [...actionIds] },
            reason: { type: 'string', minLength: 1 },
          },
          required: ['actionId', 'reason'],
          additionalProperties: false,
        },
        minItems: count,
        maxItems: count,
      },
    },
    required: ['picks'],
    additionalProperties: false,
  };
}

/** The schema of a single-pick repair call: one reason. */
export function buildReasonSchema() {
  return {
    type: 'object',
    properties: { reason: { type: 'string', minLength: 1 } },
    required: ['reason'],
    additionalProperties: false,
  };
}
