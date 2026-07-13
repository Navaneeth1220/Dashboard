/**
 * Before/after comparison engine — Stage 5-ii-engine. Pure, pairwise (A vs B).
 *
 * Runs BOTH validated records through the existing engines (computeAssessment,
 * computeLayer0) — never reimplements scoring — and diffs the results.
 *
 * THE CORE DISCIPLINE: a change in STATE is not a change in SCORE. A signed
 * numeric delta is emitted ONLY for the three genuine-score-to-score
 * transitions (performance_change, capability_established, capability_lost).
 * Every other transition omits the `delta` field entirely (field-presence
 * discipline, mirroring Stage 4's score/subsetScore), so the UI cannot render
 * a performance number where none is valid.
 */

import {
  INDICATORS, STATE, SCORE_ZERO_STATES, ALL_INDICATOR_IDS,
} from '../data/indicatorDefinitions.js';
import { LAYER0_ITEMS, LAYER0_ALL_IDS } from '../data/layer0Definitions.js';
import { computeAssessment } from './scoring.js';
import { computeLayer0 } from './layer0.js';

// ---------------------------------------------------------------------------
// Score-class — the abstraction the transition matrix keys on
// ---------------------------------------------------------------------------

/**
 * SCORED   — measured with a real score (incl. measured-0; programmeGap false)
 * GAP_ZERO — programme-gap zero (capability_absent / no_*_defined); score 0
 * NO_SCORE — not_measurable / no-event / unset / invalid-input measured (no score)
 */
function classOf(state, score) {
  if (state === STATE.MEASURED && score !== null) return 'SCORED';
  if (SCORE_ZERO_STATES.has(state)) return 'GAP_ZERO';
  return 'NO_SCORE';
}

// 3×3 → 8 transition types (exhaustive)
const TRANSITION_MATRIX = {
  SCORED:   { SCORED: 'performance_change',     GAP_ZERO: 'capability_lost',        NO_SCORE: 'became_unmeasurable' },
  GAP_ZERO: { SCORED: 'capability_established', GAP_ZERO: 'programme_gap_change',   NO_SCORE: 'became_unmeasurable' },
  NO_SCORE: { SCORED: 'became_measurable',      GAP_ZERO: 'gap_identified',         NO_SCORE: 'both_unscored' },
};

// Only these carry a signed delta
const DELTA_TYPES = new Set(['performance_change', 'capability_established', 'capability_lost']);

function directionOf(delta) {
  if (delta > 0) return 'improved';
  if (delta < 0) return 'regressed';
  return 'unchanged';
}

// ---------------------------------------------------------------------------
// Raw-value comparison (additive; never touches score/band/aggregate)
// ---------------------------------------------------------------------------

/**
 * RAW-VALUE direction — the natural direction of the measured metric, which is
 * SEPARATE from band orientation. Bands are always higher-score-is-better, but
 * for lower-is-better metrics a FALLING raw value is an improvement. Operational
 * Threshold Violation Rate is the trap: its band table is direction-inverted
 * (lower rate → higher score), yet its raw value is lower-is-better — a falling
 * violation rate is an improvement. This lookup follows the raw metric, not the band.
 */
const RAW_VALUE_LOWER_IS_BETTER = new Set([
  'IH-06', 'IH-07', 'IH-08',   // times (hours)
  'BC-04',                     // Operational Threshold Violation Rate (%)
]);

function rawDirectionOf(id, a, b) {
  if (a === b) return 'unchanged';
  const decreased = b < a;
  const improved = RAW_VALUE_LOWER_IS_BETTER.has(id) ? decreased : !decreased;
  return improved ? 'improved' : 'regressed';
}

/**
 * The raw measured value for an indicator on one side. For numerator/denominator
 * indicators, the derived PERCENTAGE (as scored). For single-value indicators,
 * the entered value (hours or %). Returns null when there is no valid measurement.
 */
function rawValue(id, record, results) {
  const def = INDICATORS[id];
  if (def.inputType === 'ratio') {
    return results.indicators[id]?.derivedPct ?? null;
  }
  const v = parseFloat(record?.indicators?.[id]?.value);
  return isFinite(v) ? v : null;
}

// ---------------------------------------------------------------------------
// Per-indicator transition
// ---------------------------------------------------------------------------

function compareIndicator(id, stateA, scoreA, stateB, scoreB, rawA, rawB) {
  const fromClass = classOf(stateA, scoreA);
  const toClass = classOf(stateB, scoreB);
  const transitionType = TRANSITION_MATRIX[fromClass][toClass];

  const res = {
    indicatorId: id,
    measure: INDICATORS[id].measure,
    fromState: stateA,
    toState: stateB,
    fromClass,                    // origin score-class — recoverable for UI wording
    toClass,
    scoreA,
    scoreB,
    transitionType,
    sameState: stateA === stateB,
  };

  if (DELTA_TYPES.has(transitionType)) {
    const delta = scoreB - scoreA;   // both are real numbers here
    res.delta = delta;
    res.direction = directionOf(delta);
    if (transitionType === 'capability_established') res.capabilityTag = 'established';
    if (transitionType === 'capability_lost') res.capabilityTag = 'lost';
  }
  // All other types: no `delta` key at all (structural absence).

  // ── Raw-value change (ADDITIVE only; does not affect score/band/aggregate) ──
  // Field-presence discipline: raw fields exist ONLY where the raw values
  // genuinely exist.
  if (transitionType === 'performance_change' && rawA !== null && rawB !== null) {
    res.rawValueA = rawA;
    res.rawValueB = rawB;
    res.rawDelta = Math.abs(rawB - rawA);
    res.rawDirection = rawDirectionOf(id, rawA, rawB);   // raw-value direction, NOT band orientation
  } else if (transitionType === 'capability_established' && rawB !== null) {
    // No prior measurement to subtract from → show only the new establishing value.
    res.rawValueB = rawB;
  }

  return res;
}

// ---------------------------------------------------------------------------
// Dimension / Overall comparison — gated on both-complete
// ---------------------------------------------------------------------------

function compareDimension(dimA, dimB) {
  const scoreA = dimA.score;   // null when incomplete
  const scoreB = dimB.score;
  const completeA = !dimA.incomplete;
  const completeB = !dimB.incomplete;
  const comparable = scoreA !== null && scoreB !== null;

  const out = { scoreA, scoreB, completeA, completeB, comparable };
  if (comparable) {
    out.delta = scoreB - scoreA;            // present ONLY when both complete
    out.direction = directionOf(out.delta);
  } else {
    out.incompleteIn = (scoreA === null && scoreB === null) ? 'both' : (scoreA === null ? 'A' : 'B');
  }
  return out;
}

/**
 * Overall movement classification — derived ONLY from the existing IH and BC
 * dimension deltas. Reinforces "Overall is a secondary summary": a net Overall
 * delta can mask divergent dimension movement.
 *   mixed           — IH and BC moved in OPPOSITE directions (one up, one down)
 *   aligned         — both moved the same direction, or both unchanged
 *   partial_move    — exactly one dimension moved, the other unchanged (delta 0)
 *   not_determinable— a dimension delta doesn't exist (incomplete in one side)
 * Requires BOTH dimension deltas to exist; either absent → not_determinable.
 * Does not touch the Overall delta number, dimension deltas, or scores.
 */
function classifyOverallMovement(ih, bc) {
  if (!ih.comparable || !bc.comparable) return 'not_determinable';
  const ihMoved = ih.direction !== 'unchanged';
  const bcMoved = bc.direction !== 'unchanged';
  if (!ihMoved && !bcMoved) return 'aligned';
  if (ihMoved && bcMoved) return ih.direction === bc.direction ? 'aligned' : 'mixed';
  return 'partial_move';   // exactly one moved
}

// ---------------------------------------------------------------------------
// Layer 0 state-transition (qualitative — no deltas)
// ---------------------------------------------------------------------------

function severityRank(sev) {
  if (sev == null) return 0;          // healthy
  return { monitor: 1, medium_note: 2, high: 3, critical: 4 }[sev] ?? 0;
}

function compareLayer0Item(itemId, a, b) {
  const ra = severityRank(a.severity);
  const rb = severityRank(b.severity);
  let transition;
  if (rb < ra) transition = 'improved';
  else if (rb > ra) transition = 'regressed';
  else transition = ra === 0 ? 'unchanged' : 'still_flagged';

  return {
    itemId,
    subclass: LAYER0_ITEMS[itemId].subclass,
    fromState: a.state,
    toState: b.state,
    fromSeverity: a.severity,
    toSeverity: b.severity,
    transition,
  };
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

function metaOf(record) {
  return {
    clientId: record?.clientId ?? record?.meta?.clientId ?? '',
    assessmentDate: record?.assessmentDate ?? record?.meta?.assessmentDate ?? '',
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * computeComparison(recordA, recordB) → {
 *   meta: { a, b, clientMismatch },
 *   indicators: { [id]: PerIndicatorTransition },
 *   dimensions: { ih, bc, overall },
 *   layer0: { [itemId]: Layer0Transition },
 * }
 *
 * recordA/recordB are validated assessment records ({ clientId, assessmentDate,
 * indicators, layer0, ... }). Pure; mutates nothing.
 */
export function computeComparison(recordA, recordB) {
  const resultsA = computeAssessment(recordA);
  const resultsB = computeAssessment(recordB);
  const l0A = computeLayer0(recordA);
  const l0B = computeLayer0(recordB);

  // Per-indicator transitions
  const indicators = {};
  for (const id of ALL_INDICATOR_IDS) {
    const stateA = recordA?.indicators?.[id]?.state ?? null;
    const stateB = recordB?.indicators?.[id]?.state ?? null;
    const scoreA = resultsA.indicators[id]?.score ?? null;
    const scoreB = resultsB.indicators[id]?.score ?? null;
    const rawA = rawValue(id, recordA, resultsA);
    const rawB = rawValue(id, recordB, resultsB);
    indicators[id] = compareIndicator(id, stateA, scoreA, stateB, scoreB, rawA, rawB);
  }

  // Dimension / Overall
  const dimensions = {
    ih: compareDimension(resultsA.ih, resultsB.ih),
    bc: compareDimension(resultsA.bc, resultsB.bc),
    overall: compareDimension(resultsA.overall, resultsB.overall),
  };
  // Additive classification field — derived from IH/BC deltas; changes no number.
  dimensions.overall.movement = classifyOverallMovement(dimensions.ih, dimensions.bc);

  // Layer 0
  const layer0 = {};
  for (const itemId of LAYER0_ALL_IDS) {
    layer0[itemId] = compareLayer0Item(itemId, l0A.items[itemId], l0B.items[itemId]);
  }

  // Meta + client mismatch warning (flag, not block)
  const a = metaOf(recordA);
  const b = metaOf(recordB);
  const clientMismatch = !!a.clientId && !!b.clientId && a.clientId !== b.clientId;

  return { meta: { a, b, clientMismatch }, indicators, dimensions, layer0 };
}
