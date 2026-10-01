/**
 * Fact builder for AI-drafted narrative reports (docs/ai-report-spec.md, Step 1).
 *
 * Pure: runs the existing engines once and turns their output into a list of
 * pre-worded, pre-rounded facts. It recomputes no score, state, or advisory —
 * every judgement here is read from engine output; this module only words it.
 *
 * Fact: { id: 'C1' | 'F1' | …, kind, text, refs, data }
 *   refs — internal IDs the fact is about (validator use only; never sent to
 *          the model). Dimension facts use the pseudo-IDs IH, BC, OVERALL.
 *   data — the same content as structured values with descriptive names, for
 *          the generated report sections (templates.js). Never sent to the
 *          model; text and data are built from the same engine output.
 *
 * Order (stable): context, dimensions, indicators (canonical), Layer 0
 * (l0_ok, l0_flag, process, l0_unset), advisories (engine order), priority.
 */

import { computeAssessment } from '../engine/scoring.js';
import { computeLayer0 } from '../engine/layer0.js';
import { computeCrossIndicator, BC_LOW_THRESHOLD } from '../engine/crossIndicator.js';
import { computePriorityView } from '../engine/priorityView.js';
import { computeGapAnalysis } from '../engine/projection.js';
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
import { CAPABILITY_BY_INDICATOR, TARGET_WORDING, NO_SCORE_GROUP } from '../data/reportWording.js';

export const FACT_KINDS = [
  'context', 'scale', 'dim_complete', 'dim_incomplete', 'scored', 'gap_zero', 'no_score',
  'l0_ok', 'l0_flag', 'process', 'l0_unset', 'advisory', 'priority',
];

/** Priority lists results scored below this: 3 is 'Good' in SCORE_LEVEL_LABELS. */
const PRIORITY_BELOW = 3;

const ASSESSOR_NOTE_PREFIX = 'Assessor note: "';

// ---------------------------------------------------------------------------
// Wording helpers
// ---------------------------------------------------------------------------

function fact(kind, text, refs, data) {
  return { kind, text, refs, data };
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

/**
 * A scored fact's text without its "Next level: …" target sentence (always
 * last), found by the same prefix the builder writes it with. Check 8 reads
 * own facts this way outside the Targets section: a target score is not the
 * current score (Step 7).
 */
export function stripTargetSentence(text) {
  const i = text.indexOf(` ${TARGET_WORDING.nextLevelPrefix}`);
  return i === -1 ? text : text.slice(0, i);
}

/** The kinds of an item's own fact: the facts that can explain why an action matched. */
export const TRIGGER_FACT_KINDS = new Set(['scored', 'gap_zero', 'no_score', 'l0_flag', 'process']);

/**
 * triggerFacts(facts, triggers) → the own facts of the triggering indicators
 * and items, in fact order (Step 9). Recommended actions cites these for all
 * matched triggers; Where to start, per action.
 */
export function triggerFacts(facts, triggers) {
  const ids = new Set(triggers);
  return facts.filter(f => TRIGGER_FACT_KINDS.has(f.kind) && f.refs.some(id => ids.has(id)));
}

const CLIENT_PATTERN = /^Assessment of "(.*)", (?:dated .*|undated)\.$/;

/**
 * User-entered text quoted verbatim in a fact: the client name (C1) and an
 * assessor note. The validator exempts quotes of this text from its checks.
 */
export function quotedUserText(fact) {
  const quoted = [];
  const i = fact.text.indexOf(ASSESSOR_NOTE_PREFIX);
  if (i !== -1) quoted.push(fact.text.slice(i + ASSESSOR_NOTE_PREFIX.length, -1));
  const client = fact.kind === 'context' ? fact.text.match(CLIENT_PATTERN) : null;
  if (client) quoted.push(client[1]);
  return quoted;
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
  const dimensions = [['IH', IH_INDICATOR_IDS], ['BC', BC_INDICATOR_IDS]];
  return [
    fact('context', `Assessment of ${client}, ${date}.`, [],
      { clientId: clientId || null, assessmentDate: assessmentDate || null }),
    // Counts only: the validator counts `context` facts as cited for every section.
    fact('context',
      `${ALL_INDICATOR_IDS.length} effectiveness indicators in ${dimensions.length} dimensions: ` +
      `${joinNames(dimensions.map(([dim, ids]) => `${DIMENSION_NAMES[dim]} (${ids.length} indicators)`))}.`,
      [],
      {
        indicatorCount: ALL_INDICATOR_IDS.length,
        dimensions: dimensions.map(([dim, ids]) => ({ dimension: dim, name: DIMENSION_NAMES[dim], indicatorCount: ids.length })),
      }),
    fact('scale',
      'Each indicator is scored 0–4, where 4 is best. A dimension score is the mean of its indicators. ' +
      'If any indicator in a dimension has no score, the dimension is incomplete and has no score.',
      [],
      { min: 0, max: 4 }),
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
        [dim, ...missing],
        { dimension: dim, name, complete: false, missing: missing.map(displayName) }));
    } else {
      const gaps = ids.filter(id => results.indicators[id].programmeGap === true);
      let text = `${name}: complete, score ${formatScore(agg.score)} out of 4 (${ids.length} indicators).`;
      if (gaps.length > 0) {
        text += ` This includes the programme-gap 0${gaps.length > 1 ? 's' : ''} for ${joinNames(gaps.map(displayName))}.`;
      }
      facts.push(fact('dim_complete', text, [dim, ...gaps],
        { dimension: dim, name, complete: true, score: formatScore(agg.score), programmeGaps: gaps.map(displayName) }));
    }
  }

  const overall = DIMENSION_NAMES.OVERALL;
  if (results.overall.incomplete) {
    const incomplete = ['IH', 'BC'].filter(dim => results[dim.toLowerCase()].incomplete);
    facts.push(fact('dim_incomplete',
      `${overall}: not available, because ${joinNames(incomplete.map(dim => DIMENSION_NAMES[dim]))} ` +
      `${incomplete.length === 1 ? 'is' : 'are'} incomplete.`,
      ['OVERALL', ...incomplete],
      { dimension: 'OVERALL', name: overall, complete: false, incomplete: incomplete.map(dim => DIMENSION_NAMES[dim]) }));
  } else {
    facts.push(fact('dim_complete',
      `${overall}: ${formatScore(results.overall.score)} out of 4, the mean of ${DIMENSION_NAMES.IH} and ` +
      `${DIMENSION_NAMES.BC}. It is a secondary summary; the two dimension scores are the primary results.`,
      ['OVERALL', 'IH', 'BC'],
      { dimension: 'OVERALL', name: overall, complete: true, score: formatScore(results.overall.score) }));
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

const noScoreTail = name => `No score. This says nothing about how ${name} performs.`;

function noScoreFact(id, input, priority) {
  const name = displayName(id);
  const tail = noScoreTail(name);
  const noScore = (text, status, rootCause = null, note = null) =>
    fact('no_score', text, [id], { name, dimension: INDICATORS[id].measure, status, rootCause, note });

  const group = priority.lane2.groups.find(g => g.affectedIndicators.includes(id));
  if (group) {
    const { chip, detail } = STATE_PRIORITY_LABELS[STATE.NOT_MEASURABLE];
    const rootCause = group.kind === 'layer0_link' ? displayName(group.linkedLayer0ItemId) : null;
    const note = group.kind !== 'ungrouped_no_reason' && input?.reason?.text?.trim() ? oneLine(input.reason.text) : null;
    return noScore(`${name}: ${lowerFirst(chip)}. ${detail}. ${tail} ${reasonText(group, input)}`,
      STATE.NOT_MEASURABLE, rootCause, note);
  }

  const nonEvent = priority.lane3.entries.find(e => e.indicatorId === id);
  if (nonEvent) {
    const { chip, detail } = STATE_PRIORITY_LABELS[nonEvent.state];
    return noScore(`${name}: ${lowerFirst(chip)}. ${detail}. ${tail}`, nonEvent.state);
  }

  const unassigned = priority.unassigned.find(u => u.indicatorId === id);
  if (unassigned?.reason === 'invalid_input') {
    return noScore(`${name}: invalid value entered. The value could not be scored. ${tail}`, 'invalid');
  }
  return noScore(`${name}: not yet assessed. No state was recorded. ${tail}`, 'unset');
}

/**
 * The next score level's target from the engine's gap analysis (Step 7), or
 * null at score 4. The engine reads the next band's inclusive bound in the
 * indicator's own direction; a lower-is-better bound is a maximum ("or
 * less"), a maximum of 0 is exact. Operational Threshold Violation Rate's
 * bands already map to 4 = best: no second reversal here.
 */
function targetOf(def, gap) {
  if (gap.atMaximum) return null;
  const { targetScore, thresholdValue } = gap.nextBand;
  const bound = def.direction === 'lower_is_better' ? (thresholdValue === 0 ? 'exact' : 'max') : 'min';
  return { score: targetScore, level: SCORE_LEVEL_LABELS[targetScore], value: withUnit(thresholdValue, def.unit), bound };
}

/**
 * Several no-score indicators in the same state: each fact states the group
 * size after its "This says nothing about …" sentence, before any reason
 * (an assessor note stays last). The Gaps section counts the group with it,
 * and check 8 finds the number in each named item's own fact.
 */
function withGroupCounts(facts) {
  const sizes = new Map();
  for (const f of facts.filter(f => f.kind === 'no_score')) sizes.set(f.data.status, (sizes.get(f.data.status) ?? 0) + 1);
  return facts.map(f => {
    if (f.kind !== 'no_score') return f;
    const size = sizes.get(f.data.status);
    if (size < 2) return { ...f, data: { ...f.data, groupCount: null } };
    const tail = noScoreTail(f.data.name);
    const text = f.text.replace(tail, `${tail} ${NO_SCORE_GROUP.fact(size, f.data.status)}`);
    return { ...f, text, data: { ...f.data, groupCount: size } };
  });
}

function indicatorFacts(assessment, results, priority, gaps) {
  return withGroupCounts(ALL_INDICATOR_IDS.map(id => {
    const def = INDICATORS[id];
    const name = displayName(id);
    const input = assessment?.indicators?.[id] ?? {};
    const result = results.indicators[id];

    if (result.score !== null && result.programmeGap) {
      const { detail } = STATE_PRIORITY_LABELS[input.state];
      const capability = input.state === STATE.CAPABILITY_ABSENT ? { capability: CAPABILITY_BY_INDICATOR[id] } : {};
      return fact('gap_zero',
        `${name}: ${lowerFirst(detail)}. Scored 0 as a programme gap: the objective or capability ` +
        'does not exist yet. Not a measured failure.',
        [id],
        { name, dimension: def.measure, state: input.state, ...capability });
    }

    if (result.score !== null) {
      const lowerIsBetter = def.direction === 'lower_is_better';
      const value = withUnit(measuredValue(def, input, result), def.unit);
      const target = targetOf(def, gaps.find(g => g.indicatorId === id));
      let text = `${name}: measured at ${value}${lowerIsBetter ? ' (lower is better)' : ''}; score ${result.score}.`;
      if (result.score === 0) {
        text += ` ${STATE_PRIORITY_LABELS.measured_zero.chip}: a measured result, not a programme gap.`;
      }
      if (target) text += ` ${TARGET_WORDING.nextLevel(target)}`;
      return fact('scored', text, [id],
        { name, dimension: def.measure, value, score: result.score, level: SCORE_LEVEL_LABELS[result.score], lowerIsBetter, target });
    }

    return noScoreFact(id, input, priority);
  }));
}

function layer0Facts(assessment, layer0) {
  const isAssessed = id => LAYER0_ITEMS[id].allowedStates.includes(layer0.items[id].state);
  const isProcess = id => LAYER0_ITEMS[id].inputType !== 'qualitative';
  const facts = [];

  const ok = LAYER0_ALL_IDS.filter(id => !isProcess(id) && isAssessed(id) && layer0.items[id].severity === null);
  if (ok.length > 0) {
    facts.push(fact('l0_ok', `In place: ${ok.map(displayName).join('; ')}.`, ok, { names: ok.map(displayName) }));
  }

  // Engine order (severity, display group, catalogue). The contextual note is
  // deliberately not included (layer jargon and ordering advice).
  for (const flag of layer0.actionFlags) {
    if (isProcess(flag.itemId)) continue;
    const message = withDisplayNames(flag.message);
    facts.push(fact('l0_flag', `${severityPrefix(flag.severity)} ${message}`, [flag.itemId],
      { name: displayName(flag.itemId), severity: flag.severity, message }));
  }

  for (const id of LAYER0_ALL_IDS.filter(id => isProcess(id) && isAssessed(id))) {
    const def = LAYER0_ITEMS[id];
    const result = layer0.items[id];
    const flag = layer0.actionFlags.find(f => f.itemId === id);
    const valid = result.state === L0_STATE.MEASURED && !result.invalidInput;
    const value = valid ? withUnit(measuredValue(def, assessment?.layer0?.[id] ?? {}, result), def.valueUnit) : null;
    const message = result.message ? withDisplayNames(result.message) : null;
    const parts = [];

    if (flag) parts.push(severityPrefix(flag.severity));
    if (result.state === L0_STATE.MEASURED) {
      parts.push(valid ? `${displayName(id)}: ${value}.` : `${displayName(id)}: invalid value entered.`);
    } else {
      parts.push(`${displayName(id)}: ${lowerFirst(L0_STATE_LABELS[result.state])}.`);
    }
    if (message) parts.push(message);
    parts.push('Process evidence, not scored.');

    facts.push(fact('process', parts.join(' '), [id], {
      name: displayName(id),
      state: result.state,
      value,
      severity: flag?.severity ?? null,
      band: valid ? (def.processBands[result.processScore] ?? null) : null,
      message,
    }));
  }

  const unset = LAYER0_ALL_IDS.filter(id => !isAssessed(id));
  if (unset.length > 0) {
    facts.push(fact('l0_unset',
      `Not yet assessed (no state recorded): ${unset.map(displayName).join('; ')}. ` +
      'This says nothing about whether they are in place.',
      unset,
      { names: unset.map(displayName) }));
  }

  return facts;
}

/** Rules A, B (auto-sentence only) and C, in engine order. Rule D hints are data-entry guidance. */
function advisoryFacts(cross, results) {
  const indicator = id => results.indicators[id];
  const facts = [];
  for (const note of cross.ihDependencyNotes) {
    facts.push(fact('advisory', withDisplayNames(note.message), [note.source, note.target], {
      rule: 'A',
      kind: note.severity,
      sourceName: displayName(note.source),
      sourceScore: indicator(note.source).score,
      sourceProgrammeGap: indicator(note.source).programmeGap === true,
      targetName: displayName(note.target),
    }));
  }
  for (const pair of cross.interpretivePairs) {
    if (!pair.autoSentence) continue;
    const [containment] = pair.pair;
    facts.push(fact('advisory', withDisplayNames(pair.autoSentence.message), [...pair.pair], {
      rule: 'B',
      containmentName: displayName(containment),
      containmentScore: indicator(containment).score,
      bcScore: formatScore(results.bc.score),
      bcThreshold: BC_LOW_THRESHOLD,
    }));
  }
  for (const arch of cross.architectureAdvisories) {
    if (!arch.advisory) continue;
    facts.push(fact('advisory', withDisplayNames(arch.advisory.message), [arch.archItemId, arch.relatedId], {
      rule: 'C',
      variant: arch.advisory.variant,
      archItemId: arch.archItemId,
      archState: arch.archState,
      relatedId: arch.relatedId,
      relatedName: displayName(arch.relatedId),
      relatedScore: arch.relatedScore,
      relatedProgrammeGap: indicator(arch.relatedId).programmeGap === true,
    }));
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

/**
 * How many effectiveness indicators have a score, from the priority view's
 * scored entries ("Only 2 of 8 effectiveness indicators have a score"). The
 * sparse-scenario manual check turned "no scored indicator is below 3" into
 * "all scored indicators are performing well" when 6 of 8 were unassessed.
 */
function coverageText(scoredCount, indicatorCount) {
  if (scoredCount === indicatorCount) return `All ${indicatorCount} effectiveness indicators have a score`;
  const verb = scoredCount === 1 ? 'has' : 'have';
  return `Only ${scoredCount} of ${indicatorCount} effectiveness indicators ${verb} a score`;
}

function noneBelowText(scoredCount) {
  const threshold = `${PRIORITY_BELOW} (${SCORE_LEVEL_LABELS[PRIORITY_BELOW]})`;
  if (scoredCount === 1) return `it is not below ${threshold}`;
  return `${scoredCount === 2 ? 'neither' : 'none'} is below ${threshold}`;
}

/** Always exactly one fact, so the priorities section always has something to cite. */
function priorityFact(priority) {
  const entries = priority.lane1.entries;   // engine order: score ascending, catalogue tie-break
  const counts = { scoredCount: entries.length, indicatorCount: ALL_INDICATOR_IDS.length };
  if (entries.length === 0) {
    return fact('priority', 'No effectiveness indicator has a score, so there is no ranking of results.', [],
      { fallback: 'none_scored', tiers: [], ...counts });
  }
  const coverage = coverageText(counts.scoredCount, counts.indicatorCount);

  const low = entries.filter(e => e.score < PRIORITY_BELOW);
  if (low.length === 0) {
    return fact('priority',
      `${coverage}; ${noneBelowText(counts.scoredCount)}.`,
      entries.map(e => e.indicatorId),
      { fallback: 'none_below', threshold: PRIORITY_BELOW, thresholdLevel: SCORE_LEVEL_LABELS[PRIORITY_BELOW], tiers: [], ...counts });
  }

  const tiers = [];
  for (const entry of low) {
    const last = tiers[tiers.length - 1];
    if (last && last[0].score === entry.score) last.push(entry);
    else tiers.push([entry]);
  }
  return fact('priority',
    `${coverage}. Lowest effectiveness results: ${tiers.map(tierText).join('; then, ')}.`,
    low.map(e => e.indicatorId),
    {
      fallback: null,
      ...counts,
      tiers: tiers.map(tier => ({
        score: tier[0].score,
        level: SCORE_LEVEL_LABELS[tier[0].score],
        items: tier.map(e => ({ name: displayName(e.indicatorId), programmeGap: e.programmeGap === true })),
      })),
    });
}

function assignIds(facts) {
  let c = 0;
  let f = 0;
  return facts.map(x => ({ id: x.kind === 'context' || x.kind === 'scale' ? `C${++c}` : `F${++f}`, ...x }));
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
    ...indicatorFacts(assessment, results, priority, computeGapAnalysis(assessment, results).gaps),
    ...layer0Facts(assessment, layer0),
    ...advisoryFacts(cross, results),
    priorityFact(priority),
  ]);
}
