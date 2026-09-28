/**
 * Output schema tests — docs/ai-report-spec.md, Step 2.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import baselineJson from '../../scenarios/Westmaas_2026-01-01_assessment.json?raw';
import { buildOutputSchema, buildSectionSchema, SECTION_KEYS } from './schema.js';
import { buildAssessmentFacts } from './facts.js';
import { loadScenario, assessmentArb } from './testSupport.js';

/** [name, sectionSchema] for the headline and each of the five sections. */
function allSections(schema) {
  return [
    ['headline', schema.properties.headline],
    ...SECTION_KEYS.map(key => [key, schema.properties.sections.properties[key]]),
  ];
}

describe('buildOutputSchema', () => {
  const factIds = buildAssessmentFacts(loadScenario(baselineJson)).map(f => f.id);
  const schema = buildOutputSchema(factIds);

  it('has the agreed section keys', () => {
    expect(SECTION_KEYS).toEqual(['overview', 'measuredPerformance', 'gapsAndMissingEvidence', 'foundationsAndFlags', 'priorities']);
  });

  it('top level: headline and sections, both required, nothing else', () => {
    expect(schema.type).toBe('object');
    expect(Object.keys(schema.properties)).toEqual(['headline', 'sections']);
    expect(schema.required).toEqual(['headline', 'sections']);
    expect(schema.additionalProperties).toBe(false);
  });

  it('sections: the five keys in order, all required, nothing else', () => {
    const sections = schema.properties.sections;
    expect(Object.keys(sections.properties)).toEqual(SECTION_KEYS);
    expect(sections.required).toEqual(SECTION_KEYS);
    expect(sections.additionalProperties).toBe(false);
  });

  it('every section: factIds before text, in properties and in required', () => {
    for (const [name, section] of allSections(schema)) {
      expect(Object.keys(section.properties), name).toEqual(['factIds', 'text']);
      expect(section.required, name).toEqual(['factIds', 'text']);
    }
  });

  it('every section: factIds enum equals the fact IDs, minItems 1; text minLength 1; nothing else', () => {
    expect(factIds).toHaveLength(23);
    for (const [name, section] of allSections(schema)) {
      expect(section.properties.factIds, name).toEqual({
        type: 'array', items: { type: 'string', enum: factIds }, minItems: 1,
      });
      expect(section.properties.text, name).toEqual({ type: 'string', minLength: 1 });
      expect(section.additionalProperties, name).toBe(false);
    }
  });

  it('does not alias its input', () => {
    const ids = ['C1', 'F1'];
    const built = buildOutputSchema(ids);
    ids.push('F2');
    for (const [, section] of allSections(built)) {
      expect(section.properties.factIds.items.enum).toEqual(['C1', 'F1']);
    }
  });

  it('survives a JSON round trip unchanged (what Ollama receives)', () => {
    const roundTrip = JSON.parse(JSON.stringify(schema));
    expect(roundTrip).toEqual(schema);
    expect(Object.keys(roundTrip.properties.headline.properties)).toEqual(['factIds', 'text']);
  });

  it('buildSectionSchema: one { factIds, text } part, enum of the given facts only (section repair)', () => {
    const ids = ['C2', 'F5'];
    const section = buildSectionSchema(ids);
    ids.push('F6');
    expect(section).toEqual({
      type: 'object',
      properties: {
        factIds: { type: 'array', items: { type: 'string', enum: ['C2', 'F5'] }, minItems: 1 },
        text: { type: 'string', minLength: 1 },
      },
      required: ['factIds', 'text'],
      additionalProperties: false,
    });
    // Same shape as each part of the full schema
    expect(buildSectionSchema(factIds)).toEqual(schema.properties.headline);
  });

  it('property: the enum equals the fact IDs for random assessments', () => {
    fc.assert(fc.property(assessmentArb, rec => {
      const ids = buildAssessmentFacts(rec).map(f => f.id);
      for (const [, section] of allSections(buildOutputSchema(ids))) {
        expect(section.properties.factIds.items.enum).toEqual(ids);
      }
    }), { numRuns: 100 });
  });
});
