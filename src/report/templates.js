/**
 * Generated report sections (docs/ai-report-spec.md, Step 3b).
 *
 * buildGeneratedSections(facts) → { measuredPerformance, gapsAndMissingEvidence,
 *   foundationsAndFlags, priorities }, each { factIds, text }
 *
 * Pure and deterministic, no model: every sentence is rendered from the
 * facts' structured data with the dashboard's own labels (score levels,
 * state labels, severity labels) and the shared wording in
 * src/data/reportWording.js. It decides nothing; it only words what the
 * engines decided. Paragraphs are separated by a blank line. factIds lists
 * the facts a section was written from, in fact order. The sections always
 * pass the validator (a property test enforces it).
 */

import { SCORE_LEVEL_LABELS, STATE, STATE_PRIORITY_LABELS } from '../data/indicatorDefinitions.js';
import { L0_STATE, L0_SEVERITY_LABELS } from '../data/layer0Definitions.js';
import { DIMENSION_NAMES } from '../data/displayNames.js';
import {
  NOTHING_TO_ASSESS,
  NOT_YET_ASSESSED,
  PROGRAMME_GAP_WORDING,
  ARCHITECTURE_WORDING,
  OUTCOME_WORDING,
  LEAD_IN,
} from '../data/reportWording.js';

const PROGRAMME_GAP = 'programme gap';
const MEASURED_FAILURE = STATE_PRIORITY_LABELS.measured_zero.chip.toLowerCase();

// ---------------------------------------------------------------------------
// Wording helpers
// ---------------------------------------------------------------------------

/** "A", "A and B", "A, B and C". */
function joinNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Messages that may contain commas: "a", "a, and b", "a; b; and c". */
function joinClauses(clauses) {
  if (clauses.length <= 1) return clauses.join('');
  if (clauses.length === 2) return `${clauses[0]}, and ${clauses[1]}`;
  return `${clauses.slice(0, -1).join('; ')}; and ${clauses[clauses.length - 1]}`;
}

/** Lower-case the first letter of an ordinary word only: "BC plan …" and "IT/OT …" keep their capitals. */
function lowerFirst(s) {
  return /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function withoutPeriod(s) {
  return s.replace(/\.$/, '');
}

/** The level after a score: "Good"; a 0 says which kind of zero it is. */
function levelOf(score, programmeGap) {
  if (score === 0) return programmeGap ? PROGRAMME_GAP : MEASURED_FAILURE;
  return SCORE_LEVEL_LABELS[score];
}

/** "score 2, Developing", "score 0, programme gap". */
function scoreText(score, programmeGap) {
  return `score ${score}, ${levelOf(score, programmeGap)}`;
}

function ofKind(facts, kind) {
  return facts.filter(f => f.kind === kind);
}

/** { factIds, text } with the cited facts in fact order. */
function section(facts, cited, paragraphs) {
  const citedSet = new Set(cited);
  return {
    factIds: facts.filter(f => citedSet.has(f)).map(f => f.id),
    text: paragraphs.filter(Boolean).join('\n\n'),
  };
}

// ---------------------------------------------------------------------------
// Measured performance
// ---------------------------------------------------------------------------

function measuredPerformance(facts) {
  const counts = ofKind(facts, 'context').find(f => f.data.dimensions);
  const scale = ofKind(facts, 'scale')[0];
  const scored = ofKind(facts, 'scored');

  if (scored.length === 0) {
    return section(facts, [counts], ['No effectiveness indicator was measured and scored in this assessment.']);
  }

  const result = ({ data: d }) => `${d.name} was ${d.value} (${scoreText(d.score, false)})`;
  const sentences = [`Each effectiveness indicator is scored from ${scale.data.min} to ${scale.data.max}, where ${scale.data.max} is best.`];
  for (const { dimension, name } of counts.data.dimensions) {
    const inDimension = scored.filter(f => f.data.dimension === dimension);
    if (inDimension.length > 0) sentences.push(`In ${name}, ${joinNames(inDimension.map(result))}.`);
  }
  const lowerIsBetter = scored.filter(f => f.data.lowerIsBetter).map(f => f.data.name);
  if (lowerIsBetter.length > 0) sentences.push(`For ${joinNames(lowerIsBetter)}, lower values are better.`);

  return section(facts, [scale, ...scored], [sentences.join(' ')]);
}

// ---------------------------------------------------------------------------
// Gaps and missing evidence
// ---------------------------------------------------------------------------

function notMeasurableReason({ rootCause, note }) {
  if (rootCause && note) return `; the recorded root cause is ${rootCause}, and the assessor noted "${note}"`;
  if (rootCause) return `; the recorded root cause is ${rootCause}`;
  if (note) return `; the assessor noted "${note}"`;
  return ', and no reason was recorded';
}

function noScoreSentence({ data: d }) {
  switch (d.status) {
    case STATE.NOT_MEASURABLE: {
      const { chip, detail } = STATE_PRIORITY_LABELS[STATE.NOT_MEASURABLE];
      return `${d.name} is ${chip.toLowerCase()}: ${lowerFirst(detail)}${notMeasurableReason(d)}.`;
    }
    case STATE.NO_QUALIFYING_EVENT:
    case STATE.NO_QUALIFYING_DISRUPTION:
      return `For ${d.name}, ${lowerFirst(STATE_PRIORITY_LABELS[d.status].detail)}. ${NOTHING_TO_ASSESS}`;
    case 'invalid':
      return `An invalid value was entered for ${d.name}, so it could not be scored.`;
    default:
      return `${d.name} is ${NOT_YET_ASSESSED}.`;
  }
}

/** "This says nothing about how X performs, but without it Incident Handling has no score, …" */
function consequenceSentence(noScore, incomplete) {
  const names = noScore.map(f => f.data.name);
  const one = names.length === 1;
  const lead = `This says nothing about how ${joinNames(names)} ${one ? 'performs' : 'perform'}`;
  const dimensions = incomplete.filter(f => f.data.dimension !== 'OVERALL').map(f => f.data.name);
  if (dimensions.length === 0) return `${lead}.`;
  const overall = incomplete.some(f => f.data.dimension === 'OVERALL') ? ', so there is no overall score either' : '';
  return `${lead}, but without ${one ? 'it' : 'them'} ${joinNames(dimensions)} ` +
    `${dimensions.length === 1 ? 'has' : 'have'} no score${overall}.`;
}

function gapsAndMissingEvidence(facts) {
  const incomplete = ofKind(facts, 'dim_incomplete');
  const noScore = ofKind(facts, 'no_score');
  const gaps = ofKind(facts, 'gap_zero');

  if (noScore.length === 0 && gaps.length === 0) {
    return section(facts, ofKind(facts, 'dim_complete'),
      ['No evidence is missing and no programme gaps were found: every effectiveness indicator has a score.']);
  }

  const missing = noScore.length > 0
    ? [...noScore.map(noScoreSentence), consequenceSentence(noScore, incomplete)].join(' ')
    : null;
  const programmeGaps = gaps.map(({ data: d }) =>
    `${PROGRAMME_GAP_WORDING[d.state](d.name)}, so it scores 0 as a programme gap; this is not a measured failure.`).join(' ');

  return section(facts, [...incomplete, ...noScore, ...gaps], [missing, programmeGaps]);
}

// ---------------------------------------------------------------------------
// Foundations and flags
// ---------------------------------------------------------------------------

function flagsParagraph(flags) {
  if (flags.length === 0) return null;
  const bySeverity = new Map();   // engine order: severity first
  for (const { data: d } of flags) {
    if (!bySeverity.has(d.severity)) bySeverity.set(d.severity, []);
    bySeverity.get(d.severity).push(lowerFirst(withoutPeriod(d.message)));
  }
  const groups = [...bySeverity].map(([severity, messages]) => `${L0_SEVERITY_LABELS[severity]}: ${joinClauses(messages)}.`);
  return `${LEAD_IN.flags} ${groups.join(' ')}`;
}

function processSentence({ data: d }) {
  const severity = d.severity ? ` (${L0_SEVERITY_LABELS[d.severity].toLowerCase()})` : '';
  if (d.state === L0_STATE.MEASURED) {
    if (d.value === null) return `An invalid value was entered for ${d.name}.`;
    if (!d.band) return `${d.name} is ${d.value}${severity}.`;
    const advice = d.band.advice ? ` — ${d.band.advice}` : '';
    return d.band.band
      ? `${d.name} is ${d.value}, in the ${d.band.band} band, which is ${d.band.verdict}${advice}${severity}.`
      : `${d.name} is ${d.value}: ${d.band.verdict}${advice}${severity}.`;
  }
  return `For ${d.name}, ${lowerFirst(withoutPeriod(d.message))}${severity}.`;
}

function relatedSentence(d) {
  const wording = ARCHITECTURE_WORDING[d.archItemId];
  return `${capitalize(wording.weakness[d.archState])} and ${d.relatedName} (${scoreText(d.relatedScore, d.relatedProgrammeGap)}) ` +
    `may be related, because ${wording.mechanism(OUTCOME_WORDING[d.relatedId])}; review them together.`;
}

function readinessSentence(d) {
  return `${ARCHITECTURE_WORDING[d.archItemId].readinessAction[d.archState]} and establishing the evidence to measure ` +
    `${d.relatedName} are both measurement-readiness actions; address them together.`;
}

function dependencySentence(d) {
  const source = `With ${d.sourceName} at score ${d.sourceScore} (${levelOf(d.sourceScore, d.sourceProgrammeGap)})`;
  return d.kind === 'hard'
    ? `${source}, improving ${d.targetName} has limited value while detection remains slow.`
    : `${source}, check that ${d.targetName} is read correctly given the slow response.`;
}

function containmentSentence(d) {
  return `${d.containmentName} was fast (${scoreText(d.containmentScore, false)}) while ${DIMENSION_NAMES.BC} is low ` +
    `(${d.bcScore}); in OT, rapid containment can itself disrupt operations, and the containment action appears ` +
    'to have been operationally costly.';
}

/**
 * Architecture advisories that may be related first, then measurement
 * readiness, then the Incident Handling dependency notes, then fast
 * containment. `lower`: the sentence may start lower-case after the lead-in
 * (false when it starts with an item name).
 */
function advisoriesParagraph(advisories) {
  const byRule = rule => advisories.map(f => f.data).filter(d => d.rule === rule);
  const sentences = [
    ...byRule('C').filter(d => d.variant !== 'readiness').map(d => ({ text: relatedSentence(d), lower: true })),
    ...byRule('C').filter(d => d.variant === 'readiness').map(d => ({ text: readinessSentence(d), lower: true })),
    ...byRule('A').map(d => ({ text: dependencySentence(d), lower: true })),
    ...byRule('B').map(d => ({ text: containmentSentence(d), lower: false })),
  ];
  if (sentences.length === 0) return null;
  const [first, ...rest] = sentences;
  return `${LEAD_IN.advisories}${first.lower ? lowerFirst(first.text) : first.text}` +
    rest.map(s => ` ${s.text}`).join('');
}

function foundationsAndFlags(facts) {
  const ok = ofKind(facts, 'l0_ok');
  const unset = ofKind(facts, 'l0_unset');
  const flags = ofKind(facts, 'l0_flag');
  const process = ofKind(facts, 'process');
  const advisories = ofKind(facts, 'advisory');

  const foundations = [
    ...ok.map(({ data: d }) => `${LEAD_IN.inPlace}${joinNames(d.names)}.`),
    ...unset.map(({ data: d }) => `${capitalize(NOT_YET_ASSESSED)}: ${joinNames(d.names)}. ` +
      `This says nothing about whether ${d.names.length === 1 ? 'it is' : 'they are'} in place.`),
  ].join(' ');
  const processEvidence = process.length > 0 ? `${LEAD_IN.process} ${process.map(processSentence).join(' ')}` : null;

  return section(facts, [...ok, ...unset, ...flags, ...process, ...advisories],
    [foundations, flagsParagraph(flags), processEvidence, advisoriesParagraph(advisories)]);
}

// ---------------------------------------------------------------------------
// Priorities
// ---------------------------------------------------------------------------

function tierItem(item, score) {
  return score === 0 ? `${item.name} (${levelOf(0, item.programmeGap)})` : item.name;
}

function firstTier({ score, level, items }) {
  if (items.length === 1) {
    const [item] = items;
    return score === 0
      ? `the lowest effectiveness result is ${item.name}, a ${levelOf(0, item.programmeGap)} at score 0.`
      : `the lowest effectiveness result is ${item.name} at score ${score} (${level}).`;
  }
  return `the lowest effectiveness results, at score ${score} and of equal priority, are ` +
    `${joinNames(items.map(item => tierItem(item, score)))}, listed in catalogue order.`;
}

function nextTier({ score, level, items }) {
  if (items.length === 1) return `Next is ${items[0].name} at score ${score} (${level}).`;
  return `Next, at score ${score} and of equal priority, are ` +
    `${joinNames(items.map(item => tierItem(item, score)))}, listed in catalogue order.`;
}

function priorities(facts) {
  const priority = ofKind(facts, 'priority')[0];
  const noScore = ofKind(facts, 'no_score');
  const d = priority.data;

  const sentences = [];
  if (d.fallback === 'none_scored') {
    sentences.push('No effectiveness indicator has a score, so there is no ranking of results.');
  } else if (d.fallback === 'none_below') {
    sentences.push(`No scored effectiveness indicator is below ${d.threshold} (${d.thresholdLevel}).`);
  } else {
    const [first, ...rest] = d.tiers;
    sentences.push(`${LEAD_IN.priorities}${firstTier(first)}`, ...rest.map(nextTier));
  }
  if (noScore.length > 0) {
    const one = noScore.length === 1;
    sentences.push(`${joinNames(noScore.map(f => f.data.name))} ${one ? 'is' : 'are'} not ranked because ` +
      `${one ? 'it has' : 'they have'} no score.`);
  }

  return section(facts, [...noScore, priority], [sentences.join(' ')]);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function buildGeneratedSections(facts) {
  return {
    measuredPerformance: measuredPerformance(facts),
    gapsAndMissingEvidence: gapsAndMissingEvidence(facts),
    foundationsAndFlags: foundationsAndFlags(facts),
    priorities: priorities(facts),
  };
}
