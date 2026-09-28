/**
 * Output schema for AI-drafted narrative reports (docs/ai-report-spec.md, Step 2).
 *
 * Passed to Ollama's `format` field, which turns it into a grammar. Property
 * order matters: the model generates fields in order, so it picks factIds
 * before it writes text. factIds is an enum of this assessment's fact IDs, so
 * an invented ID cannot be generated. uniqueItems is deliberately absent —
 * llama.cpp grammars do not enforce it; the validator rejects duplicates.
 */

export const SECTION_KEYS = [
  'overview',
  'measuredPerformance',
  'gapsAndMissingEvidence',
  'foundationsAndFlags',
  'priorities',
];

function sectionSchema(factIds) {
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

/** buildOutputSchema(factIds) → JSON Schema (a fresh object; factIds is copied). */
export function buildOutputSchema(factIds) {
  return {
    type: 'object',
    properties: {
      headline: sectionSchema(factIds),
      sections: {
        type: 'object',
        properties: Object.fromEntries(SECTION_KEYS.map(key => [key, sectionSchema(factIds)])),
        required: [...SECTION_KEYS],
        additionalProperties: false,
      },
    },
    required: ['headline', 'sections'],
    additionalProperties: false,
  };
}
