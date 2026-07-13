/**
 * Gap Analysis + Projection — Stage 4-i (design-logic §8). Pure engine, no UI.
 *
 * Reads the outputs of computeAssessment (+ the assessment record for states)
 * and a projection-input object. Mutates nothing; alters no current score.
 * Both functions are pure (selections in → results out) so Stage 5 comparison
 * can reuse them.
 *
 * ─── STRUCTURAL GUARANTEE (mirrors the §3.4 incomplete-dimension rule) ───────
 *   A complete projected dimension exposes a `score` field (full-denominator
 *   mean). A partial projected dimension has NO `score` field — it exposes a
 *   `subsetScore` (mean of the projectable subset) plus `coverage` and
 *   `exclusions`, marked `isPlanningScenario: true`. A fully unscoreable
 *   dimension exposes neither `score` nor `subsetScore`, only `blockers`.
 *   Because the field NAMES differ, 4-ii cannot render a partial subset mean in
 *   the slot reserved for an official projected dimension score — the same
 *   discipline that keeps the current BC score "incomplete, no number" rather
 *   than a silently reweighted subset average.
 */

import {
  INDICATORS,
  STATE,
  SCORE_ZERO_STATES,
  ALL_INDICATOR_IDS,
  IH_INDICATOR_IDS,
  BC_INDICATOR_IDS,
} from '../data/indicatorDefinitions.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function mean(nums) {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Why an indicator has no score (drives exclusion / rejection messaging). */
function excludedReasonFromState(state) {
  switch (state) {
    case STATE.NOT_MEASURABLE:           return 'not_measurable';
    case STATE.NO_QUALIFYING_EVENT:      return 'no_qualifying_event';
    case STATE.NO_QUALIFYING_DISRUPTION: return 'no_qualifying_disruption';
    case STATE.MEASURED:                 return 'invalid_input';   // measured but unscoreable value
    case null:
    case undefined:                      return 'unset';
    default:                             return 'unset';
  }
}

/**
 * Direction-aware band threshold for a target score, read from the contiguous
 * band intervals: higher-is-better → the inclusive lower bound (gte) of the
 * target band ("increase to X"); lower-is-better → the inclusive upper bound
 * (lte) of the target band ("reduce to X").
 */
function bandThreshold(def, targetScore) {
  const band = def.bands.find(b => b.score === targetScore);
  if (!band) return null;
  return def.direction === 'higher_is_better' ? band.gte : band.lte;
}

// ===========================================================================
// Part A — Gap analysis (Layer 1 only)
// ===========================================================================

/**
 * computeGapAnalysis(assessment, layer1Results) → { gaps, excluded }
 *
 * Includes every indicator with a score (Measured + all score-0 states).
 * Excludes no-score indicators (not_measurable / no-event / unset / invalid).
 * There is NO Layer 0 gap analysis (the Layer 0 action-flags panel is that view).
 */
export function computeGapAnalysis(assessment, layer1Results) {
  const inputs = assessment?.indicators ?? {};
  const results = layer1Results?.indicators ?? {};
  const gaps = [];
  const excluded = [];

  for (const id of ALL_INDICATOR_IDS) {
    const def = INDICATORS[id];
    const state = inputs[id]?.state ?? null;
    const score = results[id]?.score ?? null;

    if (score === null) {
      excluded.push({ indicatorId: id, reason: excludedReasonFromState(state) });
      continue;
    }

    const direction = def.direction;
    const action = direction === 'higher_is_better' ? 'increase' : 'reduce';
    // capability-absent / programme-gap zeros: a band target assumes the
    // capability/objective is first established.
    const assumesCapabilityEstablished = SCORE_ZERO_STATES.has(state);

    if (score === 4) {
      gaps.push({
        indicatorId: id, measure: def.measure, direction, unit: def.unit,
        currentScore: 4, atMaximum: true, action,
        nextBand: null, toFour: null, assumesCapabilityEstablished,
      });
    } else {
      gaps.push({
        indicatorId: id, measure: def.measure, direction, unit: def.unit,
        currentScore: score, atMaximum: false, action,
        nextBand: { targetScore: score + 1, thresholdValue: bandThreshold(def, score + 1) },
        toFour: { thresholdValue: bandThreshold(def, 4) },
        assumesCapabilityEstablished,
      });
    }
  }

  return { gaps, excluded };
}

// ===========================================================================
// Part B — Projection
// ===========================================================================

/** Map an exclusion reason to the rejected-target surfacing reason. */
function rejectReason(excludedReason) {
  switch (excludedReason) {
    case 'not_measurable':
    case 'no_qualifying_event':
    case 'no_qualifying_disruption':
      return 'resolve_evidence_state_first';
    case 'invalid_input':
      return 'invalid_input';
    case 'unset':
    default:
      return 'not_assessed';
  }
}

function isValidTarget(t) {
  return Number.isInteger(t) && t >= 0 && t <= 4;
}

/**
 * Project a single dimension from the per-indicator projected scores.
 * Completeness MIRRORS the current dimension (an indicator with no current
 * score is excluded — not projectable — exactly as it is unscoreable now).
 *
 * complete       → { score, complete:true, isPlanningScenario:false, exclusions:[], assumesCapabilityIndicators }
 * partial        → { subsetScore, complete:false, isPlanningScenario:true, coverage, exclusions, assumesCapabilityIndicators }   (NO score)
 * unscoreable    → { complete:false, isPlanningScenario:false, exclusions, blockers, assumesCapabilityIndicators }               (NO score / subsetScore)
 */
function projectDimension(memberIds, indicatorsOut) {
  const scored = memberIds.filter(id => indicatorsOut[id].projectable);
  const excluded = memberIds.filter(id => !indicatorsOut[id].projectable);
  const assumesCapabilityIndicators = scored.filter(id => indicatorsOut[id].assumesCapabilityEstablished);

  if (excluded.length === 0) {
    // Complete — full-denominator mean is the official projected dimension score
    return {
      score: mean(scored.map(id => indicatorsOut[id].projectedScore)),
      complete: true,
      isPlanningScenario: false,
      exclusions: [],
      assumesCapabilityIndicators,
    };
  }

  if (excluded.length === memberIds.length) {
    // Fully unscoreable — no number at all, only blockers
    return {
      complete: false,
      isPlanningScenario: false,
      exclusions: excluded,
      blockers: excluded,
      assumesCapabilityIndicators,
    };
  }

  // Partial — subset statistic ONLY (no `score` field by construction)
  return {
    subsetScore: mean(scored.map(id => indicatorsOut[id].projectedScore)),
    complete: false,
    isPlanningScenario: true,
    coverage: { scored: scored.length, total: memberIds.length },
    exclusions: excluded,
    assumesCapabilityIndicators,
  };
}

/** Pull a dimension's available number (score if complete, else subsetScore, else null). */
function dimensionNumber(dim) {
  if (dim.score !== undefined) return dim.score;
  if (dim.subsetScore !== undefined) return dim.subsetScore;
  return null;
}

/**
 * computeProjection(assessment, layer1Results, projectionInput) → {
 *   indicators, rejectedTargets, ih, bc, overall
 * }
 *
 * projectionInput: { targets: { [indicatorId]: targetScore(0–4) } }
 *
 * Projectable = any indicator with a current score (Measured + capability-absent
 * + programme-gap zeros). Targets on excluded indicators are rejected and
 * surfaced in rejectedTargets, never silently applied. No BC cap.
 */
export function computeProjection(assessment, layer1Results, projectionInput) {
  const inputs = assessment?.indicators ?? {};
  const results = layer1Results?.indicators ?? {};
  const targets = projectionInput?.targets ?? {};

  const indicatorsOut = {};
  const rejectedTargets = [];

  for (const id of ALL_INDICATOR_IDS) {
    const state = inputs[id]?.state ?? null;
    const currentScore = results[id]?.score ?? null;
    const projectable = currentScore !== null;
    const excludedReason = projectable ? null : excludedReasonFromState(state);

    let projectedScore = projectable ? currentScore : null;
    let targetApplied = false;

    if (Object.prototype.hasOwnProperty.call(targets, id)) {
      const t = targets[id];
      if (!isValidTarget(t)) {
        rejectedTargets.push({ indicatorId: id, targetScore: t, reason: 'invalid_target' });
      } else if (!projectable) {
        // Cannot project an excluded indicator — surface, never apply
        rejectedTargets.push({ indicatorId: id, targetScore: t, reason: rejectReason(excludedReason) });
      } else {
        projectedScore = t;
        targetApplied = true;
      }
    }

    // Tag projections that build a capability/objective from a score-0 absence
    const assumesCapabilityEstablished =
      SCORE_ZERO_STATES.has(state) && projectedScore !== null && projectedScore > 0;

    indicatorsOut[id] = {
      currentScore,
      projectable,
      projectedScore,
      targetApplied,
      assumesCapabilityEstablished,
      excludedReason,
    };
  }

  const ih = projectDimension(IH_INDICATOR_IDS, indicatorsOut);
  const bc = projectDimension(BC_INDICATOR_IDS, indicatorsOut);

  // Overall — mirrors dimension completeness; caveat travels with the number
  const ihNum = dimensionNumber(ih);
  const bcNum = dimensionNumber(bc);

  let overall;
  if (ihNum === null || bcNum === null) {
    // A whole dimension is unscoreable → no projected Overall number
    overall = {
      complete: false,
      isPlanningScenario: false,
      blockers: [...(ih.blockers ?? []), ...(bc.blockers ?? [])],
    };
  } else {
    const overallNumber = mean([ihNum, bcNum]);   // no BC cap; plain mean of the two
    const assumesCapabilityIndicators = [...ih.assumesCapabilityIndicators, ...bc.assumesCapabilityIndicators];
    if (ih.complete && bc.complete) {
      overall = { score: overallNumber, complete: true, isPlanningScenario: false, assumesCapabilityIndicators };
    } else {
      const partialDimensions = [];
      if (!ih.complete) partialDimensions.push('IH');
      if (!bc.complete) partialDimensions.push('BC');
      overall = {
        subsetScore: overallNumber,   // NO `score` field for a partial Overall
        complete: false,
        isPlanningScenario: true,
        partialDimensions,
        assumesCapabilityIndicators,
      };
    }
  }

  return { indicators: indicatorsOut, rejectedTargets, ih, bc, overall };
}
