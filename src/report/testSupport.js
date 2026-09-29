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
import { SECTION_KEYS, TARGETS_KEY } from './schema.js';
import { splitSentences, CONTEXT_KINDS } from './validator.js';
import { buildAssessmentFacts, stripTargetSentence } from './facts.js';
import { selectModelFacts } from './prompt.js';
import { generateNarrative } from './generate.js';
import { ProviderUnavailableError } from './providers/ollama.js';

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
 * A narrative made of the facts' own text, shared round-robin across the five
 * sections; the headline is the first sentence of the first finding fact (one
 * sentence, citing a finding: checks 12 and 18). Always valid (validator
 * property test), so it doubles as a known-good model reply. Outside the
 * Targets section a fact's text is used without its target sentence, as the
 * validator reads it there (Step 7).
 */
export function echoNarrative(facts) {
  const cited = Object.fromEntries(SECTION_KEYS.map(k => [k, []]));
  facts.forEach((f, i) => cited[SECTION_KEYS[i % SECTION_KEYS.length]].push(f));
  const asSentence = t => (/[.!?]$/.test(t) ? t : `${t}.`);
  const part = (fs, key) => ({
    factIds: fs.map(f => f.id),
    text: fs.map(f => asSentence(key === TARGETS_KEY ? f.text : stripTargetSentence(f.text))).join(' '),
  });
  const finding = facts.find(f => !CONTEXT_KINDS.has(f.kind)) ?? facts[0];
  return {
    headline: { factIds: [finding.id], text: asSentence(splitSentences(finding.text)[0]) },
    sections: Object.fromEntries(SECTION_KEYS.map(k => [k, part(cited[k], k)])),
  };
}

/**
 * Scripted generateNarrative results for one assessment (PDF export tests,
 * docs/ai-report-spec.md, Step 6). The same drafts as the panel test: VALID
 * passes the validator; INVALID adds a judgement on a missing score (POOR)
 * and a MARKER sentence that must never leave generateNarrative.
 */
export function scriptedResults(assessment) {
  const modelFacts = selectModelFacts(buildAssessmentFacts(assessment));
  const asSentence = t => (/[.!?]$/.test(t) ? t : `${t}.`);
  const partOf = fs => ({ factIds: fs.map(f => f.id), text: fs.map(f => asSentence(f.text)).join(' ') });
  const headlineFacts = modelFacts.filter(f => f.id === 'F2');
  const VALID = {
    headline: { factIds: ['F2'], text: headlineFacts[0].text.split('. ')[0] + '.' },
    overview: partOf(modelFacts.filter(f => !headlineFacts.includes(f))),
  };
  const POOR = 'Mean Time to Contain is poor.';
  const MARKER = 'This sentence only exists in the rejected draft.';
  const INVALID = { ...VALID, overview: { ...VALID.overview, text: `${VALID.overview.text} ${POOR} ${MARKER}` } };
  const reply = value => ({
    content: JSON.stringify(value), promptEvalCount: 800, evalCount: 180, doneReason: 'stop', durationMs: 1000,
  });
  const run = provider => generateNarrative(assessment, { provider });
  return {
    VALID, INVALID, POOR, MARKER,
    ok: () => run(async () => reply(VALID)),
    failed: () => run(async ({ user }) => (user.includes('Write only') ? reply(INVALID.overview) : reply(INVALID))),
    unavailable: (reason, message) => run(async () => { throw new ProviderUnavailableError(reason, message); }),
  };
}
