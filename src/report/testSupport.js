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
import { SECTION_KEYS, TARGETS_KEY, pickCount } from './schema.js';
import { splitSentences, CONTEXT_KINDS } from './validator.js';
import { buildAssessmentFacts, stripTargetSentence, triggerFacts } from './facts.js';
import { selectModelFacts, WHERE_TO_START_PROMPT } from './prompt.js';
import { matchAssessmentActions } from '../engine/actions.js';
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
 *
 * Where to start (Step 9): PICKS (echoPicks) pass; BAD_PICKS add the MARKER
 * as a second sentence to every reason. `failed` and `unavailable` fail both
 * parts; `failedWithPicks`, `picksFailed` and `picksUnavailable` fail one.
 */
export function scriptedResults(assessment) {
  const facts = buildAssessmentFacts(assessment);
  const modelFacts = selectModelFacts(facts);
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
  const PICKS = echoPicks(facts, matchAssessmentActions(assessment));
  const BAD_PICKS = PICKS && { picks: PICKS.picks.map(p => ({ ...p, reason: `${p.reason} ${MARKER}` })) };
  const summaryOk = async () => reply(VALID);
  const summaryFailed = async ({ user }) => (user.includes('Write only') ? reply(INVALID.overview) : reply(INVALID));
  const picksOk = async () => reply(PICKS);
  const picksFailed = async ({ user }) => (user.includes('Write only the reason') ? reply({ reason: `${PICKS.picks[0].reason} ${MARKER}` }) : reply(BAD_PICKS));
  const run = (summary, picks) => generateNarrative(assessment, {
    provider: async args => (args.system === WHERE_TO_START_PROMPT ? picks(args) : summary(args)),
  });
  const unavailable = (reason, message) => async () => { throw new ProviderUnavailableError(reason, message); };
  return {
    VALID, INVALID, POOR, MARKER, PICKS, BAD_PICKS,
    ok: () => run(summaryOk, picksOk),
    failed: () => run(summaryFailed, picksFailed),
    unavailable: (reason, message) => run(unavailable(reason, message), unavailable(reason, message)),
    failedWithPicks: () => run(summaryFailed, picksOk),
    picksFailed: () => run(summaryOk, picksFailed),
    picksUnavailable: (reason, message) => run(summaryOk, unavailable(reason, message)),
  };
}

/** The names an item may be written as (as the validator's name index has them). */
function namesOf(id) {
  const def = INDICATORS[id] ?? LAYER0_ITEMS[id];
  return [def.name, def.shortName, ...(def.aliases ?? [])].filter(Boolean).map(n => n.toLowerCase());
}

/**
 * Known-good "Where to start" picks made of the trigger facts' own text
 * (Step 9): the CRITICAL actions first, then catalogue order, min(3, n) of
 * them; each reason is the first sentence of the action's trigger facts
 * (without target sentences) that names one of its triggering items. null
 * when nothing matched.
 */
export function echoPicks(facts, actions) {
  if (actions.length === 0) return null;
  const isCritical = a => triggerFacts(facts, a.triggers).some(f => /^CRITICAL\./.test(f.text));
  const chosen = [...actions.filter(isCritical), ...actions.filter(a => !isCritical(a))].slice(0, pickCount(actions.length));
  const reasonOf = action => {
    const names = action.triggers.flatMap(namesOf);
    const sentences = triggerFacts(facts, action.triggers).flatMap(f => splitSentences(stripTargetSentence(f.text)));
    return sentences.find(s => names.some(n => s.toLowerCase().includes(n))) ?? sentences[0];
  };
  return { picks: chosen.map(a => ({ actionId: a.id, reason: reasonOf(a) })) };
}

/**
 * The hand-written Westmaas baseline picks (Step 9), in the model's order
 * (not catalogue order): the CRITICAL flag, the programme gap, a HIGH flag.
 */
export const WESTMAAS_PICKS = {
  picks: [
    { actionId: 'ACT-L0-05', reason: 'Uncontrolled inter-zone multi-homed devices were identified, which is a CRITICAL flag.' },
    { actionId: 'ACT-BC-08', reason: 'RPO Achievement Rate scores 0 as a programme gap because no recovery point objective has been established; this is not a measured failure.' },
    { actionId: 'ACT-L0-08', reason: 'No BC plan test was performed during the assessment period, which is a HIGH flag.' },
  ],
};
