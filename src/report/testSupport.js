/**
 * Shared test support for src/report/*.test.js (not a test file itself).
 * loadScenario() goes through the real import path; assessmentArb generates
 * random valid assessments, including unset states, invalid values, and
 * assessor notes containing internal IDs and long decimals.
 */

import * as fc from 'fast-check';
import { parseAndValidateImport } from '../engine/persistence.js';
import { INDICATORS, ALL_INDICATOR_IDS, STATE } from '../data/indicatorDefinitions.js';
import { LAYER0_ITEMS, LAYER0_ALL_IDS } from '../data/layer0Definitions.js';
import { SECTION_KEYS } from './schema.js';

export function loadScenario(json) {
  const res = parseAndValidateImport(json);
  if (!res.ok) throw new Error(res.error);
  const { clientId, assessmentDate, indicators, layer0 } = res.data;
  return { meta: { clientId, assessmentDate }, indicators, layer0 };
}

const singleValueArb = fc.oneof(
  { weight: 8, arbitrary: fc.double({ min: 0, max: 2000, noNaN: true }).map(String) },
  { weight: 1, arbitrary: fc.constantFrom('', '-5', 'abc') },
);
const ratioArb = fc.tuple(fc.nat(40), fc.nat(40))
  .map(([a, b]) => ({ numerator: String(Math.min(a, b)), denominator: String(Math.max(a, b)) }));

const reasonArb = fc.option(fc.oneof(
  fc.record({ layer0ItemId: fc.constantFrom(...LAYER0_ALL_IDS), text: fc.constantFrom('', 'CMDB stale') }),
  fc.record({ text: fc.constantFrom('', 'SIEM retention too short', 'see BC-08, ticket_7, 3.14159 h') }),
), { nil: null });

function inputArb(def) {
  return fc.constantFrom(null, ...def.allowedStates).chain(state => {
    if (state === STATE.MEASURED) {
      return def.inputType === 'ratio'
        ? ratioArb.map(r => ({ state, ...r }))
        : singleValueArb.map(value => ({ state, value }));
    }
    if (state === STATE.NOT_MEASURABLE) return reasonArb.map(reason => ({ state, reason }));
    return fc.constant({ state });
  });
}

export const assessmentArb = fc.record({
  meta: fc.constant({ clientId: 'Acme', assessmentDate: '2026-03-01' }),
  indicators: fc.record(Object.fromEntries(ALL_INDICATOR_IDS.map(id => [id, inputArb(INDICATORS[id])]))),
  layer0: fc.record(Object.fromEntries(LAYER0_ALL_IDS.map(id => [id, inputArb(LAYER0_ITEMS[id])]))),
});

/**
 * A narrative made of the facts' own text, shared round-robin across the six
 * parts. Always valid (validator property test), so it doubles as a known-good
 * model reply.
 */
export function echoNarrative(facts) {
  const keys = ['headline', ...SECTION_KEYS];
  const cited = Object.fromEntries(keys.map(k => [k, []]));
  facts.forEach((f, i) => cited[keys[i % keys.length]].push(f));
  const asSentence = t => (/[.!?]$/.test(t) ? t : `${t}.`);
  const part = fs => ({ factIds: fs.map(f => f.id), text: fs.map(f => asSentence(f.text)).join(' ') });
  return {
    headline: part(cited.headline),
    sections: Object.fromEntries(SECTION_KEYS.map(k => [k, part(cited[k])])),
  };
}
