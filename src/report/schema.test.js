/**
 * Output schema tests — docs/ai-report-spec.md, Step 2. The model writes only
 * the headline and the overview, from the reduced fact set.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import baselineJson from '../../scenarios/Westmaas_2026-01-01_assessment.json?raw';
import {
  buildOutputSchema, buildSectionSchema, SECTION_KEYS, MODEL_PARTS, GENERATED_KEYS, ACTIONS_KEY, CATALOGUE_KEYS, FACT_SECTION_KEYS,
  WHERE_TO_START_KEY, MAX_PICKS, pickCount, buildPicksSchema, buildReasonSchema,
} from './schema.js';
import { buildAssessmentFacts } from './facts.js';
import { selectModelFacts } from './prompt.js';
import { loadScenario, assessmentArb } from './testSupport.js';

const partsOf = schema => MODEL_PARTS.map(key => [key, schema.properties[key]]);

describe('keys', () => {
  it('model parts, generated sections, and all report sections', () => {
    expect(MODEL_PARTS).toEqual(['headline', 'overview']);
    expect(GENERATED_KEYS).toEqual([
      'measuredPerformance', 'gapsAndMissingEvidence', 'foundationsAndFlags', 'priorities', 'targets', 'recommendedActions',
    ]);
    expect(SECTION_KEYS).toEqual(['overview', ...GENERATED_KEYS]);
  });

  it('Recommended actions is the one catalogue section; the others are written from the facts', () => {
    expect(ACTIONS_KEY).toBe('recommendedActions');
    expect(CATALOGUE_KEYS).toEqual([ACTIONS_KEY]);
    expect(FACT_SECTION_KEYS).toEqual(['measuredPerformance', 'gapsAndMissingEvidence', 'foundationsAndFlags', 'priorities', 'targets']);
  });
});

describe('buildOutputSchema', () => {
  const factIds = selectModelFacts(buildAssessmentFacts(loadScenario(baselineJson))).map(f => f.id);
  const schema = buildOutputSchema(factIds);

  it('top level: headline and overview, both required, nothing else', () => {
    expect(schema.type).toBe('object');
    expect(Object.keys(schema.properties)).toEqual(MODEL_PARTS);
    expect(schema.required).toEqual(MODEL_PARTS);
    expect(schema.additionalProperties).toBe(false);
  });

  it('each part: factIds before text, in properties and in required', () => {
    for (const [name, part] of partsOf(schema)) {
      expect(Object.keys(part.properties), name).toEqual(['factIds', 'text']);
      expect(part.required, name).toEqual(['factIds', 'text']);
    }
  });

  it('each part: factIds enum equals the model fact IDs, minItems 1; text minLength 1; nothing else', () => {
    expect(factIds).toEqual(['C1', 'C2', 'C3', 'F1', 'F2', 'F3', 'F13', 'F14', 'F15', 'F20']);
    for (const [name, part] of partsOf(schema)) {
      expect(part).toEqual(buildSectionSchema(factIds));
      expect(part.properties.factIds, name).toEqual({ type: 'array', items: { type: 'string', enum: factIds }, minItems: 1 });
      expect(part.properties.text, name).toEqual({ type: 'string', minLength: 1 });
      expect(part.additionalProperties, name).toBe(false);
    }
  });

  it('does not alias its input', () => {
    const ids = ['C1', 'F1'];
    const built = buildOutputSchema(ids);
    ids.push('F2');
    for (const [, part] of partsOf(built)) {
      expect(part.properties.factIds.items.enum).toEqual(['C1', 'F1']);
    }
  });

  it('survives a JSON round trip unchanged (what Ollama receives)', () => {
    const roundTrip = JSON.parse(JSON.stringify(schema));
    expect(roundTrip).toEqual(schema);
    expect(Object.keys(roundTrip.properties.headline.properties)).toEqual(['factIds', 'text']);
  });

  it('buildSectionSchema: one { factIds, text } part, enum of the given facts only (part repair)', () => {
    const ids = ['C2', 'F1'];
    const part = buildSectionSchema(ids);
    ids.push('F2');
    expect(part).toEqual({
      type: 'object',
      properties: {
        factIds: { type: 'array', items: { type: 'string', enum: ['C2', 'F1'] }, minItems: 1 },
        text: { type: 'string', minLength: 1 },
      },
      required: ['factIds', 'text'],
      additionalProperties: false,
    });
  });

  it('property: the enum equals the model fact IDs for random assessments', () => {
    fc.assert(fc.property(assessmentArb, rec => {
      const ids = selectModelFacts(buildAssessmentFacts(rec)).map(f => f.id);
      for (const [, part] of partsOf(buildOutputSchema(ids))) {
        expect(part.properties.factIds.items.enum).toEqual(ids);
      }
    }), { numRuns: 100 });
  });
});

// ─── Step 9: Where to start ───────────────────────────────────────────────────

describe('Where to start schema (Step 9)', () => {
  const IDS = ['ACT-IH-04', 'ACT-BC-08', 'ACT-L0-05', 'ACT-L0-08'];

  it('its key is outside the headline/overview keys', () => {
    expect(WHERE_TO_START_KEY).toBe('whereToStart');
    expect(MODEL_PARTS).not.toContain(WHERE_TO_START_KEY);
    expect(SECTION_KEYS).not.toContain(WHERE_TO_START_KEY);
    expect(MAX_PICKS).toBe(3);
  });

  it('pickCount: min(3, n)', () => {
    expect([0, 1, 2, 3, 4, 10].map(pickCount)).toEqual([0, 1, 2, 3, 3, 3]);
  });

  it('picks: exactly min(3, n), each an enum action ID before the reason', () => {
    expect(buildPicksSchema(IDS)).toEqual({
      type: 'object',
      properties: {
        picks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              actionId: { type: 'string', enum: IDS },
              reason: { type: 'string', minLength: 1 },
            },
            required: ['actionId', 'reason'],
            additionalProperties: false,
          },
          minItems: 3,
          maxItems: 3,
        },
      },
      required: ['picks'],
      additionalProperties: false,
    });
    const item = buildPicksSchema(IDS).properties.picks.items;
    expect(Object.keys(item.properties)).toEqual(['actionId', 'reason']);
    expect(item.required).toEqual(['actionId', 'reason']);
    expect(buildPicksSchema(IDS.slice(0, 2)).properties.picks).toMatchObject({ minItems: 2, maxItems: 2 });
    expect(buildPicksSchema(IDS.slice(0, 1)).properties.picks).toMatchObject({ minItems: 1, maxItems: 1 });
  });

  it('does not alias its input', () => {
    const ids = [...IDS];
    const schema = buildPicksSchema(ids);
    ids.push('ACT-RM-02');
    expect(schema.properties.picks.items.properties.actionId.enum).toEqual(IDS);
  });

  it('the repair schema is one reason', () => {
    expect(buildReasonSchema()).toEqual({
      type: 'object',
      properties: { reason: { type: 'string', minLength: 1 } },
      required: ['reason'],
      additionalProperties: false,
    });
  });
});
