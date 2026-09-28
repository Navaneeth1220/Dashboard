/**
 * Fact builder for AI-drafted narrative reports (docs/ai-report-spec.md, Step 1).
 *
 * Pure: runs the existing engines once and turns their output into a list of
 * pre-worded, pre-rounded facts. It recomputes no score, state, or advisory —
 * every judgement here is read from engine output; this module only words it.
 *
 * Fact: { id: 'C1' | 'F1' | …, kind, text, refs }
 *   refs — internal IDs the fact is about (validator use only; never sent to
 *          the model). Dimension facts use the pseudo-IDs IH, BC, OVERALL.
 *
 * Order (stable): context, dimensions, indicators (canonical), Layer 0
 * (l0_ok, l0_flag, process, l0_unset), advisories (engine order), priority.
 */

import { computeAssessment } from '../engine/scoring.js';
import { computeLayer0 } from '../engine/layer0.js';
import { computeCrossIndicator } from '../engine/crossIndicator.js';
import { computePriorityView } from '../engine/priorityView.js';
import {
  INDICATORS,
  IH_INDICATOR_IDS,
  BC_INDICATOR_IDS,
  ALL_INDICATOR_IDS,
  STATE,
  STATE_PRIORITY_LABELS,
  SCORE_LEVEL_LABELS,
} from '../data/indicatorDefinitions.js';
import {
  LAYER0_ITEMS,
  LAYER0_ALL_IDS,
  L0_STATE,
  L0_STATE_LABELS,
  L0_SEVERITY_LABELS,
} from '../data/layer0Definitions.js';
import { displayName, formatScore, DIMENSION_NAMES } from '../data/displayNames.js';

export const FACT_KINDS = [
  'context', 'dim_complete', 'dim_incomplete', 'scored', 'gap_zero', 'no_score',
  'l0_ok', 'l0_flag', 'process', 'l0_unset', 'advisory', 'priority',
];

/** Priority lists results scored below this: 3 is 'Good' in SCORE_LEVEL_LABELS. */
const PRIORITY_BELOW = 3;

const ASSESSOR_NOTE_PREFIX = 'Assessor note: "';

// ---------------------------------------------------------------------------
// Wording helpers
// ---------------------------------------------------------------------------

function fact(kind, text, refs) {
  return { kind, text, refs };
}

/** At most two decimals, trailing zeros dropped: 18, 12.5, 33.33. */
function formatValue(n) {
  return String(Math.round(n * 100) / 100);
}

function withUnit(n, unit) {
  return unit === '%' ? `${formatValue(n)}%` : `${formatValue(n)} ${unit}`;
}

/** "A", "A and B", "A, B and C". */
function joinNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function lowerFirst(s) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function severityPrefix(severity) {
  return `${L0_SEVERITY_LABELS[severity].toUpperCase()}.`;
}

// Exact internal IDs, longest first; the lookarounds stop partial matches.
const ID_PATTERN = new RegExp(
  `(?<![\\w-])(${[...ALL_INDICATOR_IDS, ...LAYER0_ALL_IDS]
    .sort((a, b) => b.length - a.length)
    .join('|')})(?![\\w-])`,
  'g'
);
// A bare dimension code followed by a number, e.g. "(BC 1.80 < 2)".
const DIMENSION_CODE_BEFORE_NUMBER = /\b(IH|BC)(?=\s+\d)/g;

/** Engine message verbatim, except internal IDs become descriptive names. */
function withDisplayNames(message) {
  return message
    .replace(ID_PATTERN, id => displayName(id))
    .replace(DIMENSION_CODE_BEFORE_NUMBER, code => `${DIMENSION_NAMES[code]} score`);
}

/** Free text on one line (every fact is one line of the user message). */
function oneLine(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

/** Assessor free text, verbatim apart from collapsed whitespace. Always last in a fact. */
function assessorNote(text) {
  return `${ASSESSOR_NOTE_PREFIX}${oneLine(text)}"`;
}

/**
 * Remove the trailing assessor note, if any. The note is free text typed by
 * the assessor, so it is exempt from the ID / enum / decimal text checks.
 */
export function stripAssessorNote(text) {
  const i = text.indexOf(ASSESSOR_NOTE_PREFIX);
  return i === -1 ? text : text.slice(0, i);
}

/** The value the engine scored: derived percentage for ratios, else the entered value. */
function measuredValue(def, input, result) {
  return def.inputType === 'ratio' ? result.derivedPct : parseFloat(input.value);
}

// ---------------------------------------------------------------------------
// Fact groups
// ---------------------------------------------------------------------------

function contextFacts(meta) {
  const clientId = oneLine(meta?.clientId);
  const assessmentDate = oneLine(meta?.assessmentDate);
  const client = clientId ? `"${clientId}"` : 'an unnamed client';
  const date = assessmentDate ? `dated ${assessmentDate}` : 'undated';
  return [
    fact('context', `Assessment of ${client}, ${date}.`, []),
    fact('context',
      `The ${ALL_INDICATOR_IDS.length} effectiveness indicators are each scored 0–4, where 4 is best. ` +
      'A dimension score is the mean of its indicators. If any indicator in a dimension has no score, ' +
      'the dimension is incomplete and has no score.',
      []),
  ];
}

function dimensionFacts(results) {
  const facts = [];

  for (const [dim, ids] of [['IH', IH_INDICATOR_IDS], ['BC', BC_INDICATOR_IDS]]) {
    const agg = results[dim.toLowerCase()];
    const name = DIMENSION_NAMES[dim];

    if (agg.incomplete) {
      const missing = ids.filter(id => results.indicators[id].score === null);
      const verb = missing.length === 1 ? 'has' : 'have';
      facts.push(fact('dim_incomplete',
        `${name}: incomplete. ${joinNames(missing.map(displayName))} ${verb} no score, ` +
        `so no ${name} score is available.`,
        [dim, ...missing]));
    } else {
      const gaps = ids.filter(id => results.indicators[id].programmeGap === true);
      let text = `${name}: complete, score ${formatScore(agg.score)} out of 4 (${ids.length} indicators).`;
      if (gaps.length > 0) {
        text += ` This includes the programme-gap 0${gaps.length > 1 ? 's' : ''} for ${joinNames(gaps.map(displayName))}.`;
      }
      facts.push(fact('dim_complete', text, [dim, ...gaps]));
    }
  }

  const overall = DIMENSION_NAMES.OVERALL;
  if (results.overall.incomplete) {
    const incomplete = ['IH', 'BC'].filter(dim => results[dim.toLowerCase()].incomplete);
    facts.push(fact('dim_incomplete',
      `${overall}: not available, because ${joinNames(incomplete.map(dim => DIMENSION_NAMES[dim]))} ` +
      `${incomplete.length === 1 ? 'is' : 'are'} incomplete.`,
      ['OVERALL', ...incomplete]));
  } else {
    facts.push(fact('dim_complete',
      `${overall}: ${formatScore(results.overall.score)} out of 4, the mean of ${DIMENSION_NAMES.IH} and ` +
      `${DIMENSION_NAMES.BC}. It is a secondary summary; the two dimension scores are the primary results.`,
      ['OVERALL', 'IH', 'BC']));
  }

  return facts;
}

function reasonText(group, input) {
  const note = input?.reason?.text?.trim() ? ` ${assessorNote(input.reason.text)}` : '';
  switch (group.kind) {
    case 'layer0_link':
      return `Recorded root cause: ${displayName(group.linkedLayer0ItemId)}.${note}`;
    case 'self_created':
      return note.trim();
    default:
      return 'No reason was recorded.';
  }
}

function noScoreText(id, input, priority) {
  const name = displayName(id);
  const tail = `No score. This says nothing about how ${name} performs.`;

  const group = priority.lane2.groups.find(g => g.affectedIndicators.includes(id));
  if (group) {
    const { chip, detail } = STATE_PRIORITY_LABELS[STATE.NOT_MEASURABLE];
    return `${name}: ${lowerFirst(chip)}. ${detail}. ${tail} ${reasonText(group, input)}`;
  }

  const nonEvent = priority.lane3.entries.find(e => e.indicatorId === id);
  if (nonEvent) {
    const { chip, detail } = STATE_PRIORITY_LABELS[nonEvent.state];
    return `${name}: ${lowerFirst(chip)}. ${detail}. ${tail}`;
  }

  const unassigned = priority.unassigned.find(u => u.indicatorId === id);
  if (unassigned?.reason === 'invalid_input') {
    return `${name}: invalid value entered. The value could not be scored. ${tail}`;
  }
  return `${name}: not yet assessed. No state was recorded. ${tail}`;
}

function indicatorFacts(assessment, results, priority) {
  return ALL_INDICATOR_IDS.map(id => {
    const def = INDICATORS[id];
    const name = displayName(id);
    const input = assessment?.indicators?.[id] ?? {};
    const result = results.indicators[id];

    if (result.score !== null && result.programmeGap) {
      const { detail } = STATE_PRIORITY_LABELS[input.state];
      return fact('gap_zero',
        `${name}: ${lowerFirst(detail)}. Scored 0 as a programme gap: the objective or capability ` +
        'does not exist yet. Not a measured failure.',
        [id]);
    }

    if (result.score !== null) {
      const direction = def.direction === 'lower_is_better' ? ' (lower is better)' : '';
      let text = `${name}: measured at ${withUnit(measuredValue(def, input, result), def.unit)}${direction}; score ${result.score}.`;
      if (result.score === 0) {
        text += ` ${STATE_PRIORITY_LABELS.measured_zero.chip}: a measured result, not a programme gap.`;
      }
      return fact('scored', text, [id]);
    }

    return fact('no_score', noScoreText(id, input, priority), [id]);
  });
}

function layer0Facts(assessment, layer0) {
  const isAssessed = id => LAYER0_ITEMS[id].allowedStates.includes(layer0.items[id].state);
  const isProcess = id => LAYER0_ITEMS[id].inputType !== 'qualitative';
  const facts = [];

  const ok = LAYER0_ALL_IDS.filter(id => !isProcess(id) && isAssessed(id) && layer0.items[id].severity === null);
  if (ok.length > 0) {
    facts.push(fact('l0_ok', `In place: ${ok.map(displayName).join('; ')}.`, ok));
  }

  // Engine order (severity, display group, catalogue). The contextual note is
  // deliberately not included (layer jargon and ordering advice).
  for (const flag of layer0.actionFlags) {
    if (isProcess(flag.itemId)) continue;
    facts.push(fact('l0_flag', `${severityPrefix(flag.severity)} ${withDisplayNames(flag.message)}`, [flag.itemId]));
  }

  for (const id of LAYER0_ALL_IDS.filter(id => isProcess(id) && isAssessed(id))) {
    const def = LAYER0_ITEMS[id];
    const result = layer0.items[id];
    const flag = layer0.actionFlags.find(f => f.itemId === id);
    const parts = [];

    if (flag) parts.push(severityPrefix(flag.severity));
    if (result.state === L0_STATE.MEASURED) {
      parts.push(result.invalidInput
        ? `${displayName(id)}: invalid value entered.`
        : `${displayName(id)}: ${withUnit(measuredValue(def, assessment?.layer0?.[id] ?? {}, result), def.valueUnit)}.`);
    } else {
      parts.push(`${displayName(id)}: ${lowerFirst(L0_STATE_LABELS[result.state])}.`);
    }
    if (result.message) parts.push(withDisplayNames(result.message));
    parts.push('Process evidence, not scored.');

    facts.push(fact('process', parts.join(' '), [id]));
  }

  const unset = LAYER0_ALL_IDS.filter(id => !isAssessed(id));
  if (unset.length > 0) {
    facts.push(fact('l0_unset',
      `Not yet assessed (no state recorded): ${unset.map(displayName).join('; ')}. ` +
      'This says nothing about whether they are in place.',
      unset));
  }

  return facts;
}

/** Rules A, B (auto-sentence only) and C, in engine order. Rule D hints are data-entry guidance. */
function advisoryFacts(cross) {
  const facts = [];
  for (const note of cross.ihDependencyNotes) {
    facts.push(fact('advisory', withDisplayNames(note.message), [note.source, note.target]));
  }
  for (const pair of cross.interpretivePairs) {
    if (pair.autoSentence) facts.push(fact('advisory', withDisplayNames(pair.autoSentence.message), [...pair.pair]));
  }
  for (const arch of cross.architectureAdvisories) {
    if (arch.advisory) facts.push(fact('advisory', withDisplayNames(arch.advisory.message), [arch.archItemId, arch.relatedId]));
  }
  return facts;
}

function zeroKind(entry) {
  return entry.programmeGap ? 'programme gap' : lowerFirst(STATE_PRIORITY_LABELS.measured_zero.chip);
}

function tierText(tier) {
  const score = tier[0].score;
  if (tier.length === 1) {
    const label = score === 0 ? `${zeroKind(tier[0])}, 0` : `score ${score}`;
    return `${displayName(tier[0].indicatorId)} (${label})`;
  }
  const names = tier.map(e => (score === 0 ? `${displayName(e.indicatorId)} (${zeroKind(e)})` : displayName(e.indicatorId)));
  return `at score ${score} and of equal priority, listed in catalogue order: ${names.join(', ')}`;
}

/** Always exactly one fact, so the priorities section always has something to cite. */
function priorityFact(priority) {
  const entries = priority.lane1.entries;   // engine order: score ascending, catalogue tie-break
  if (entries.length === 0) {
    return fact('priority', 'No effectiveness indicator has a score, so there is no ranking of results.', []);
  }

  const low = entries.filter(e => e.score < PRIORITY_BELOW);
  if (low.length === 0) {
    return fact('priority',
      `No scored effectiveness indicator is below ${PRIORITY_BELOW} (${SCORE_LEVEL_LABELS[PRIORITY_BELOW]}).`,
      entries.map(e => e.indicatorId));
  }

  const tiers = [];
  for (const entry of low) {
    const last = tiers[tiers.length - 1];
    if (last && last[0].score === entry.score) last.push(entry);
    else tiers.push([entry]);
  }
  return fact('priority',
    `Lowest effectiveness results: ${tiers.map(tierText).join('; then, ')}.`,
    low.map(e => e.indicatorId));
}

function assignIds(facts) {
  let c = 0;
  let f = 0;
  return facts.map(x => ({ id: x.kind === 'context' ? `C${++c}` : `F${++f}`, ...x }));
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * buildAssessmentFacts(assessment) → Fact[]
 *
 * assessment: { meta: { clientId, assessmentDate }, indicators, layer0 }
 * (targets are ignored: gap projection is out of scope for narratives).
 */
export function buildAssessmentFacts(assessment) {
  const results = computeAssessment(assessment);
  const layer0 = computeLayer0(assessment);
  const cross = computeCrossIndicator(assessment, results, layer0);
  const priority = computePriorityView(assessment, results, layer0);

  return assignIds([
    ...contextFacts(assessment?.meta),
    ...dimensionFacts(results),
    ...indicatorFacts(assessment, results, priority),
    ...layer0Facts(assessment, layer0),
    ...advisoryFacts(cross),
    priorityFact(priority),
  ]);
}
