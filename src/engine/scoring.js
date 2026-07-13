/**
 * Pure scoring engine — no React imports, no side effects.
 * Takes an assessment record object; returns a results object.
 * Both input and output shapes are stable across all stages so that
 * Stage 5 comparison can run computeAssessment() on any saved record.
 */

import {
  INDICATORS,
  IH_INDICATOR_IDS,
  BC_INDICATOR_IDS,
  SCORE_ZERO_STATES,
  NO_SCORE_STATES,
  STATE,
} from '../data/indicatorDefinitions.js';

// ---------------------------------------------------------------------------
// Band lookup
// ---------------------------------------------------------------------------

/**
 * Match a numeric value against explicit contiguous band intervals.
 *
 * lower_is_better bands use { gt, lte }:
 *   Matches when: (band.gt === null || value > band.gt) && value <= band.lte
 *   gt: null = no lower bound.  Values above every lte → score 0.
 *
 * higher_is_better bands use { gte, lt }:
 *   Matches when: value >= band.gte && (band.lt === null || value < band.lt)
 *   lt: null = no upper bound.  Values below every gte → score 0.
 *
 * Bands are contiguous with no gaps — every valid measured value matches
 * exactly one band without relying on traversal order. The find() is used
 * (not a sequential walk) to make this independence explicit.
 */
function scoreByBands(value, indicatorDef) {
  if (!isFinite(value)) return null;

  const { direction, bands } = indicatorDef;

  if (direction === 'lower_is_better') {
    const band = bands.find(b =>
      (b.gt === null || value > b.gt) && value <= b.lte
    );
    return band ? band.score : 0;
  }

  // higher_is_better
  const band = bands.find(b =>
    value >= b.gte && (b.lt === null || value < b.lt)
  );
  return band ? band.score : 0;
}

// ---------------------------------------------------------------------------
// Per-indicator value extraction
// ---------------------------------------------------------------------------

/**
 * Extracts the numeric value to score from an indicator input record.
 * For ratio inputs, computes the percentage. Returns null on invalid input.
 *
 * Validation rules (all return null, surfaced as invalidInput in scoreIndicator):
 *   - Non-finite values (NaN, Infinity, empty string)
 *   - Negative values (negative time or negative counts are physically impossible)
 *   - numerator > denominator (achievement/operability cannot exceed 100 %)
 *   - denominator = 0 (div-by-zero; zero qualifying events → use no_qualifying_event state)
 */
function extractValue(indicatorDef, input) {
  if (indicatorDef.inputType === 'ratio') {
    const num = parseFloat(input.numerator);
    const den = parseFloat(input.denominator);
    if (!isFinite(num) || !isFinite(den)) return null;
    if (num < 0 || den < 0) return null;       // negative counts invalid
    if (den === 0) return null;                 // use no_qualifying_event instead
    if (num > den) return null;                 // >100 % is physically impossible
    return (num / den) * 100;
  }
  // single_value (time in hours)
  const v = parseFloat(input.value);
  if (!isFinite(v)) return null;
  if (v < 0) return null;                       // negative time is impossible
  return v;
}

// ---------------------------------------------------------------------------
// Single-indicator scoring
// ---------------------------------------------------------------------------

/**
 * scoreIndicator(indicatorId, input) → { score: number|null, derivedPct: number|null }
 *
 * score:
 *   0          — SCORE_ZERO_STATES (programme gap) OR band-0 measured result
 *   1–4        — band-lookup result on a measured value
 *   null       — NO_SCORE_STATES (no qualifying event / disruption / not measurable)
 *
 * derivedPct:
 *   The computed percentage for ratio-input indicators (for UI display).
 *   null for single-value indicators or when state is not measured.
 */
export function scoreIndicator(indicatorId, input) {
  const def = INDICATORS[indicatorId];
  if (!def) throw new Error(`Unknown indicator: ${indicatorId}`);

  const state = input?.state;

  // Validate state against this indicator's declared allowed-state list.
  // A state that is globally recognised (e.g. capability_absent) but not
  // listed for this indicator is still invalid — each indicator has its own
  // programme-gap vocabulary (spec §3.2 and correction 3).
  if (state !== null && state !== undefined) {
    if (!def.allowedStates.includes(state)) {
      return { score: null, derivedPct: null, invalidState: true };
    }
  }

  // Programme-gap states → explicit score 0, not a band-lookup result.
  // programmeGap: true is the machine-readable marker that Stage 2/3
  // action-flag logic uses to distinguish this from a band-fallthrough 0
  // (e.g. BC-04 no_thresholds_defined vs BC-04 measured >50 % violations).
  if (SCORE_ZERO_STATES.has(state)) {
    return { score: 0, derivedPct: null, programmeGap: true };
  }

  // Evidence-gap states → no score; must NOT be treated as 0
  if (NO_SCORE_STATES.has(state)) {
    return { score: null, derivedPct: null };
  }

  // Measured — compute from value/ratio
  if (state === STATE.MEASURED) {
    const numericValue = extractValue(def, input);
    const derivedPct = def.inputType === 'ratio' ? numericValue : null;
    // extractValue returns null for invalid input (negative, NaN, num>den, den=0).
    // Propagate as a no-score result rather than silently scoring 0 or NaN.
    if (numericValue === null) {
      return { score: null, derivedPct: null, invalidInput: true };
    }
    const score = scoreByBands(numericValue, def);
    return { score, derivedPct };
  }

  // Unknown / unset state (null or undefined)
  return { score: null, derivedPct: null };
}

// ---------------------------------------------------------------------------
// Dimension aggregation
// ---------------------------------------------------------------------------

/**
 * Aggregates a list of indicator scores for one dimension (IH or BC).
 *
 * Incomplete-dimension rule (spec §3.4):
 *   If ANY indicator in the dimension has score === null (no-score state),
 *   the dimension score is null (incomplete). The denominator is NOT reduced —
 *   we do not silently promote a no-score indicator to absent and average
 *   around it. The null result must be surfaced to the user.
 *
 * Returns { score: number|null, incomplete: boolean, indicatorScores: [...] }
 */
function aggregateDimension(indicatorIds, scoredIndicators) {
  const scores = indicatorIds.map(id => scoredIndicators[id].score);
  const hasNoScore = scores.some(s => s === null);

  if (hasNoScore) {
    return { score: null, incomplete: true, indicatorScores: scores };
  }

  const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  return { score: mean, incomplete: false, indicatorScores: scores };
}

// ---------------------------------------------------------------------------
// Full assessment computation
// ---------------------------------------------------------------------------

/**
 * computeAssessment(assessmentRecord) → results
 *
 * assessmentRecord shape:
 * {
 *   meta: { clientId, assessmentDate },
 *   indicators: {
 *     'IH-06': { state, value },
 *     'IH-07': { state, value },
 *     'IH-08': { state, value },
 *     'BC-01': { state, value },
 *     'BC-02': { state, value },
 *     'BC-04': { state, numerator, denominator },
 *     'BC-08': { state, numerator, denominator },
 *     'BC-09': { state, numerator, denominator },
 *   }
 * }
 *
 * Results shape:
 * {
 *   indicators: {
 *     'IH-06': { score: number|null, derivedPct: number|null },
 *     ...
 *   },
 *   ih:      { score: number|null, incomplete: boolean, indicatorScores: [] },
 *   bc:      { score: number|null, incomplete: boolean, indicatorScores: [] },
 *   overall: { score: number|null, incomplete: boolean },
 * }
 *
 * BC-04 aggregation note:
 *   BC-04's band table maps lower violation rate → higher score, so its
 *   score is already on the same "4 = best" scale as the other BC indicators.
 *   It is used directly in the BC mean. No additional reversal is applied here.
 *   See indicatorDefinitions.js for the authoritative comment on this.
 */
export function computeAssessment(assessmentRecord) {
  const inputs = assessmentRecord?.indicators ?? {};

  // Score each indicator
  const scoredIndicators = {};
  for (const id of [...IH_INDICATOR_IDS, ...BC_INDICATOR_IDS]) {
    scoredIndicators[id] = scoreIndicator(id, inputs[id] ?? { state: null });
  }

  // Aggregate dimensions
  const ih = aggregateDimension(IH_INDICATOR_IDS, scoredIndicators);
  const bc = aggregateDimension(BC_INDICATOR_IDS, scoredIndicators);

  // Overall: mean(ih, bc) — only when both dimensions are complete
  let overall;
  if (ih.score !== null && bc.score !== null) {
    overall = { score: (ih.score + bc.score) / 2, incomplete: false };
  } else {
    overall = { score: null, incomplete: true };
  }

  return { indicators: scoredIndicators, ih, bc, overall };
}

// ---------------------------------------------------------------------------
// Default blank assessment record (used to initialise UI state)
// ---------------------------------------------------------------------------

export function createBlankAssessment() {
  const indicators = {};
  for (const id of [...IH_INDICATOR_IDS, ...BC_INDICATOR_IDS]) {
    const def = INDICATORS[id];
    if (def.inputType === 'ratio') {
      indicators[id] = { state: null, numerator: '', denominator: '' };
    } else {
      indicators[id] = { state: null, value: '' };
    }
  }
  return {
    meta: { clientId: '', assessmentDate: '' },
    indicators,
  };
}
