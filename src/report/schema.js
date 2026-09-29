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
