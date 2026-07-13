/**
 * Sequential timeline comparison — orchestration ONLY. Strictly pairwise engine
 * underneath: computeComparison stays untouched and is called N−1 times on
 * consecutive chronological pairs. This module orders the assessments, assembles
 * the N−1 comparison blocks, and lays out the per-indicator trajectory.
 *
 * Pure; mutates nothing; reuses computeAssessment / computeComparison.
 */

import {
  ALL_INDICATOR_IDS, INDICATORS, STATE, SCORE_ZERO_STATES,
} from '../data/indicatorDefinitions.js';
import { computeAssessment } from './scoring.js';
import { computeComparison } from './comparison.js';

// Raw measured value for one indicator on one record (derived % for ratio
// indicators, entered value for single-value ones). Local to keep comparison.js
// literally unchanged. Returns null when there is no valid measurement.
function rawValue(id, record, results) {
  const def = INDICATORS[id];
  if (def.inputType === 'ratio') {
    return results.indicators[id]?.derivedPct ?? null;
  }
  const v = parseFloat(record?.indicators?.[id]?.value);
  return isFinite(v) ? v : null;
}

/**
 * A single trajectory point for one indicator at one step. Honours the
 * missing-evidence discipline: a no-score point carries NO number and NO score.
 *   kind 'measured'  → { value, score }
 *   kind 'gap_zero'  → { state, score: 0 }        (score 0 is a real value)
 *   kind 'no_score'  → { state }                  (no number, no score)
 */
function pointState(id, record, results) {
  const def = INDICATORS[id];
  const state = record?.indicators?.[id]?.state ?? null;
  const score = results.indicators[id]?.score ?? null;

  if (state === STATE.MEASURED && score !== null) {
    const raw = rawValue(id, record, results);
    return { kind: 'measured', state, score, value: raw };
  }
  if (SCORE_ZERO_STATES.has(state)) {
    return { kind: 'gap_zero', state, score: 0 };
  }
  // not_measurable / no-event / unset / invalid-input measured → no number
  return { kind: 'no_score', state };
}

/**
 * computeTimeline(records) → { steps, blocks, trajectory, clientMismatch }
 *
 * records: array of validated assessment records (2..N). Ordered chronologically
 * by assessmentDate; missing/tied dates fall back to load order (stable).
 */
export function computeTimeline(records) {
  // Chronological order, stable fallback to load order.
  const indexed = records.map((r, i) => ({ r, i }));
  indexed.sort((a, b) => {
    const ta = Date.parse(a.r?.assessmentDate);
    const tb = Date.parse(b.r?.assessmentDate);
    if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return ta - tb;
    return a.i - b.i;   // missing date or tie → load order
  });
  const ordered = indexed.map(x => x.r);

  const steps = ordered.map((r) => ({
    clientId: r?.clientId ?? '',
    assessmentDate: r?.assessmentDate ?? '',
    label: `${r?.assessmentDate || 'undated'}${r?.clientId ? ` · ${r.clientId}` : ''}`,
  }));

  // Per-record scores (also used by the trajectory)
  const results = ordered.map(r => computeAssessment(r));

  // Part 1 — N−1 consecutive-pair comparison blocks (each an untouched 2-way comparison)
  const blocks = [];
  for (let k = 0; k < ordered.length - 1; k++) {
    blocks.push({
      fromIndex: k,
      toIndex: k + 1,
      fromLabel: steps[k].label,
      toLabel: steps[k + 1].label,
      comparison: computeComparison(ordered[k], ordered[k + 1]),
    });
  }

  // Part 2 — per-indicator trajectory across all N points, in order
  const trajectory = {};
  for (const id of ALL_INDICATOR_IDS) {
    trajectory[id] = ordered.map((r, idx) => pointState(id, r, results[idx]));
  }

  const clientMismatch = new Set(ordered.map(r => r?.clientId).filter(Boolean)).size > 1;

  return { steps, blocks, trajectory, clientMismatch };
}
