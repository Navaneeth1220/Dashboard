/**
 * Gap Analysis + Projection test suite — Stage 4-i (§8).
 */

import { describe, it, expect } from 'vitest';
import { computeGapAnalysis, computeProjection } from './projection.js';
import { computeAssessment, createBlankAssessment } from './scoring.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function record(indicatorOverrides = {}) {
  const blank = createBlankAssessment();
  return { ...blank, indicators: { ...blank.indicators, ...indicatorOverrides } };
}

function gapOf(rec) {
  return computeGapAnalysis(rec, computeAssessment(rec));
}
function projOf(rec, targets = {}) {
  return computeProjection(rec, computeAssessment(rec), { targets });
}
const gapFor = (gaps, id) => gaps.find(g => g.indicatorId === id);

// ===========================================================================
// Part A — Gap analysis
// ===========================================================================

describe('gap analysis — direction-aware thresholds', () => {
  it('higher-is-better (BC-01) score 2 → increase to next band (70%) and to four (90%)', () => {
    const rec = record({ 'BC-01': { state: 'measured', value: '50' } });  // 50% → score 2
    const g = gapFor(gapOf(rec).gaps, 'BC-01');
    expect(g.direction).toBe('higher_is_better');
    expect(g.action).toBe('increase');
    expect(g.currentScore).toBe(2);
    expect(g.nextBand).toEqual({ targetScore: 3, thresholdValue: 70 });
    expect(g.toFour).toEqual({ thresholdValue: 90 });
  });

  it('lower-is-better (IH-06) score 2 → reduce to next band (24h) and to four (6h)', () => {
    const rec = record({ 'IH-06': { state: 'measured', value: '96' } });  // 96h → score 2
    const g = gapFor(gapOf(rec).gaps, 'IH-06');
    expect(g.direction).toBe('lower_is_better');
    expect(g.action).toBe('reduce');
    expect(g.currentScore).toBe(2);
    expect(g.nextBand).toEqual({ targetScore: 3, thresholdValue: 24 });
    expect(g.toFour).toEqual({ thresholdValue: 6 });
  });

  it('BC-04 (lower-is-better) score 2 → reduce to 5% next, 0% to four', () => {
    const rec = record({ 'BC-04': { state: 'measured', numerator: '10', denominator: '100' } });  // 10% → score 2
    const g = gapFor(gapOf(rec).gaps, 'BC-04');
    expect(g.action).toBe('reduce');
    expect(g.nextBand).toEqual({ targetScore: 3, thresholdValue: 5 });
    expect(g.toFour).toEqual({ thresholdValue: 0 });
  });

  it('BC-08 (higher-is-better) score 2 → increase to 75% next, 90% to four', () => {
    const rec = record({ 'BC-08': { state: 'measured', numerator: '60', denominator: '100' } });  // 60% → score 2
    const g = gapFor(gapOf(rec).gaps, 'BC-08');
    expect(g.nextBand).toEqual({ targetScore: 3, thresholdValue: 75 });
    expect(g.toFour).toEqual({ thresholdValue: 90 });
  });

  it('score 4 → atMaximum, no thresholds', () => {
    const rec = record({ 'IH-06': { state: 'measured', value: '4' } });  // score 4
    const g = gapFor(gapOf(rec).gaps, 'IH-06');
    expect(g.atMaximum).toBe(true);
    expect(g.nextBand).toBeNull();
    expect(g.toFour).toBeNull();
  });

  it('score 0 (measured) → next band is the score-1 boundary', () => {
    const recH = record({ 'BC-01': { state: 'measured', value: '0' } });   // 0% → score 0
    expect(gapFor(gapOf(recH).gaps, 'BC-01').nextBand).toEqual({ targetScore: 1, thresholdValue: 1 });

    const recL = record({ 'IH-06': { state: 'measured', value: '1000' } }); // >720h → score 0
    expect(gapFor(gapOf(recL).gaps, 'IH-06').nextBand).toEqual({ targetScore: 1, thresholdValue: 720 });
  });

  it('capability-absent (score 0) gets a gap, flagged assumesCapabilityEstablished', () => {
    const rec = record({ 'IH-06': { state: 'capability_absent' } });
    const g = gapFor(gapOf(rec).gaps, 'IH-06');
    expect(g.currentScore).toBe(0);
    expect(g.assumesCapabilityEstablished).toBe(true);
    expect(g.nextBand).toEqual({ targetScore: 1, thresholdValue: 720 });
  });

  it('programme-gap zero (no_rto_defined) gets a gap, flagged assumesCapabilityEstablished', () => {
    const rec = record({ 'BC-08': { state: 'no_rto_defined' } });
    const g = gapFor(gapOf(rec).gaps, 'BC-08');
    expect(g.assumesCapabilityEstablished).toBe(true);
    expect(g.nextBand).toEqual({ targetScore: 1, thresholdValue: 1 });
  });

  it('measured indicator does NOT carry assumesCapabilityEstablished', () => {
    const rec = record({ 'BC-01': { state: 'measured', value: '50' } });
    expect(gapFor(gapOf(rec).gaps, 'BC-01').assumesCapabilityEstablished).toBe(false);
  });

  it('not-measurable / no-event → excluded, no gap entry', () => {
    const rec = record({
      'BC-01': { state: 'not_measurable' },
      'IH-06': { state: 'no_qualifying_event' },
      'BC-02': { state: 'no_qualifying_disruption' },
    });
    const { gaps, excluded } = gapOf(rec);
    expect(gapFor(gaps, 'BC-01')).toBeUndefined();
    expect(gapFor(gaps, 'IH-06')).toBeUndefined();
    expect(excluded.find(e => e.indicatorId === 'BC-01').reason).toBe('not_measurable');
    expect(excluded.find(e => e.indicatorId === 'IH-06').reason).toBe('no_qualifying_event');
    expect(excluded.find(e => e.indicatorId === 'BC-02').reason).toBe('no_qualifying_disruption');
  });

  it('unset and invalid-input → excluded with distinct reasons', () => {
    const rec = record({ 'BC-08': { state: 'measured', numerator: '11', denominator: '10' } });  // invalid
    const { excluded } = gapOf(rec);
    expect(excluded.find(e => e.indicatorId === 'BC-08').reason).toBe('invalid_input');
    expect(excluded.find(e => e.indicatorId === 'IH-06').reason).toBe('unset');
  });
});

// ===========================================================================
// Part B — Projectability
// ===========================================================================

describe('projection — projectability', () => {
  it('Measured is projectable; a valid target is applied', () => {
    const rec = record({ 'BC-01': { state: 'measured', value: '50' } });  // score 2
    const p = projOf(rec, { 'BC-01': 4 });
    expect(p.indicators['BC-01'].projectable).toBe(true);
    expect(p.indicators['BC-01'].targetApplied).toBe(true);
    expect(p.indicators['BC-01'].projectedScore).toBe(4);
  });

  it('capability-absent is projectable', () => {
    const rec = record({ 'IH-06': { state: 'capability_absent' } });
    const p = projOf(rec, { 'IH-06': 3 });
    expect(p.indicators['IH-06'].projectable).toBe(true);
    expect(p.indicators['IH-06'].projectedScore).toBe(3);
  });

  it('programme-gap zeros (no_rto/no_thresholds/no_rpo) are projectable', () => {
    const rec = record({
      'BC-08': { state: 'no_rto_defined' },
      'BC-04': { state: 'no_thresholds_defined' },
      'BC-09': { state: 'no_rpo_defined' },
    });
    const p = projOf(rec, { 'BC-08': 4, 'BC-04': 3, 'BC-09': 2 });
    expect(p.indicators['BC-08'].projectedScore).toBe(4);
    expect(p.indicators['BC-04'].projectedScore).toBe(3);
    expect(p.indicators['BC-09'].projectedScore).toBe(2);
  });

  it('not-measurable is NOT projectable; a target is rejected and surfaced, not applied', () => {
    const rec = record({ 'BC-01': { state: 'not_measurable' } });
    const p = projOf(rec, { 'BC-01': 4 });
    expect(p.indicators['BC-01'].projectable).toBe(false);
    expect(p.indicators['BC-01'].targetApplied).toBe(false);
    expect(p.indicators['BC-01'].projectedScore).toBeNull();
    const rej = p.rejectedTargets.find(r => r.indicatorId === 'BC-01');
    expect(rej.reason).toBe('resolve_evidence_state_first');
  });

  it('no-qualifying-event target rejected with resolve_evidence_state_first', () => {
    const rec = record({ 'IH-06': { state: 'no_qualifying_event' } });
    const p = projOf(rec, { 'IH-06': 3 });
    expect(p.rejectedTargets.find(r => r.indicatorId === 'IH-06').reason).toBe('resolve_evidence_state_first');
  });

  it('out-of-range target rejected as invalid_target', () => {
    const rec = record({ 'BC-01': { state: 'measured', value: '50' } });
    const p = projOf(rec, { 'BC-01': 7 });
    expect(p.rejectedTargets.find(r => r.indicatorId === 'BC-01').reason).toBe('invalid_target');
    expect(p.indicators['BC-01'].targetApplied).toBe(false);
  });

  it('projectable indicator with no target → projected = current', () => {
    const rec = record({ 'BC-01': { state: 'measured', value: '50' } });  // score 2
    const p = projOf(rec, {});
    expect(p.indicators['BC-01'].projectedScore).toBe(2);
    expect(p.indicators['BC-01'].targetApplied).toBe(false);
  });
});

// ===========================================================================
// Capability-assumption tag
// ===========================================================================

describe('projection — capability-assumption tag', () => {
  it('capability-absent moved to positive carries the tag', () => {
    const rec = record({ 'IH-06': { state: 'capability_absent' } });
    expect(projOf(rec, { 'IH-06': 3 }).indicators['IH-06'].assumesCapabilityEstablished).toBe(true);
  });

  it('programme-gap zero moved to positive carries the tag', () => {
    const rec = record({ 'BC-08': { state: 'no_rto_defined' } });
    expect(projOf(rec, { 'BC-08': 4 }).indicators['BC-08'].assumesCapabilityEstablished).toBe(true);
  });

  it('Measured (working capability) does NOT carry the tag', () => {
    const rec = record({ 'BC-01': { state: 'measured', value: '50' } });
    expect(projOf(rec, { 'BC-01': 4 }).indicators['BC-01'].assumesCapabilityEstablished).toBe(false);
  });

  it('measured performance-zero moved up does NOT carry the tag (real capability, not assumed)', () => {
    const rec = record({ 'BC-01': { state: 'measured', value: '0' } });  // score 0 measured
    expect(projOf(rec, { 'BC-01': 3 }).indicators['BC-01'].assumesCapabilityEstablished).toBe(false);
  });

  it('capability-absent left at 0 (no positive target) does NOT carry the tag', () => {
    const rec = record({ 'IH-06': { state: 'capability_absent' } });
    expect(projOf(rec, {}).indicators['IH-06'].assumesCapabilityEstablished).toBe(false);
  });

  it('dimension rolls up assumesCapabilityIndicators', () => {
    const rec = record({
      'IH-06': { state: 'capability_absent' },
      'IH-07': { state: 'measured', value: '2' },
      'IH-08': { state: 'measured', value: '5' },
    });
    const p = projOf(rec, { 'IH-06': 3 });
    expect(p.ih.assumesCapabilityIndicators).toContain('IH-06');
    expect(p.ih.assumesCapabilityIndicators).not.toContain('IH-07');
  });
});

// ===========================================================================
// Completeness inheritance + the structural field-shape guarantee
// ===========================================================================

describe('projection — completeness inheritance and field shape', () => {
  function completeIH() {
    return {
      'IH-06': { state: 'measured', value: '4' },   // 4
      'IH-07': { state: 'measured', value: '2' },   // 4
      'IH-08': { state: 'measured', value: '96' },  // 2
    };
  }
  function completeBC() {
    return {
      'BC-01': { state: 'measured', value: '85' },                 // 3
      'BC-02': { state: 'measured', value: '90' },  // 4
      'BC-04': { state: 'measured', numerator: '0', denominator: '5' },   // 4
      'BC-08': { state: 'measured', numerator: '9', denominator: '10' },  // 4
      'BC-09': { state: 'measured', numerator: '9', denominator: '10' },  // 4
    };
  }

  it('complete dimension HAS `score`, has NO `subsetScore`', () => {
    const rec = record({ ...completeIH(), ...completeBC() });
    const p = projOf(rec, {});
    expect(p.ih).toHaveProperty('score');
    expect(p.ih).not.toHaveProperty('subsetScore');
    expect(p.ih.complete).toBe(true);
    expect(p.ih.score).toBeCloseTo((4 + 4 + 2) / 3, 10);
  });

  it('partial dimension has NO `score`, HAS `subsetScore` + coverage + exclusions', () => {
    const rec = record({
      'IH-06': { state: 'measured', value: '4' },   // 4
      'IH-07': { state: 'measured', value: '2' },   // 4
      'IH-08': { state: 'not_measurable' },          // excluded
    });
    const p = projOf(rec, {});
    expect(p.ih).not.toHaveProperty('score');               // structural guarantee
    expect(p.ih).toHaveProperty('subsetScore');
    expect(p.ih.isPlanningScenario).toBe(true);
    expect(p.ih.coverage).toEqual({ scored: 2, total: 3 });
    expect(p.ih.exclusions).toEqual(['IH-08']);
    expect(p.ih.subsetScore).toBeCloseTo((4 + 4) / 2, 10);   // subset mean, labelled
  });

  it('fully unscoreable dimension has NO `score` and NO `subsetScore`, only blockers', () => {
    const rec = record({
      'IH-06': { state: 'not_measurable' },
      'IH-07': { state: 'not_measurable' },
      'IH-08': { state: 'no_qualifying_event' },
    });
    const p = projOf(rec, {});
    expect(p.ih).not.toHaveProperty('score');
    expect(p.ih).not.toHaveProperty('subsetScore');
    expect(p.ih.blockers).toEqual(['IH-06', 'IH-07', 'IH-08']);
  });

  it('Overall complete (both dims complete) HAS `score`, no `subsetScore`', () => {
    const rec = record({ ...completeIH(), ...completeBC() });
    const p = projOf(rec, {});
    expect(p.overall).toHaveProperty('score');
    expect(p.overall).not.toHaveProperty('subsetScore');
    expect(p.overall.complete).toBe(true);
  });

  it('Overall partial (one dim partial) has NO `score`, HAS `subsetScore`', () => {
    const rec = record({
      ...completeBC(),                                  // BC complete
      'IH-06': { state: 'measured', value: '4' },
      'IH-07': { state: 'measured', value: '2' },
      'IH-08': { state: 'not_measurable' },             // IH partial
    });
    const p = projOf(rec, {});
    expect(p.overall).not.toHaveProperty('score');       // structural guarantee
    expect(p.overall).toHaveProperty('subsetScore');
    expect(p.overall.isPlanningScenario).toBe(true);
    expect(p.overall.partialDimensions).toContain('IH');
  });

  it('Overall has NO number when a whole dimension is unscoreable', () => {
    const rec = record({
      ...completeBC(),
      'IH-06': { state: 'not_measurable' },
      'IH-07': { state: 'not_measurable' },
      'IH-08': { state: 'not_measurable' },             // IH fully unscoreable
    });
    const p = projOf(rec, {});
    expect(p.overall).not.toHaveProperty('score');
    expect(p.overall).not.toHaveProperty('subsetScore');
    expect(p.overall.blockers).toEqual(['IH-06', 'IH-07', 'IH-08']);
  });

  it('targets applied flow into the complete projected score', () => {
    const rec = record({ ...completeIH(), ...completeBC() });
    // bump IH-08 from 2 → 4
    const p = projOf(rec, { 'IH-08': 4 });
    expect(p.ih.score).toBeCloseTo((4 + 4 + 4) / 3, 10);
  });
});

// ===========================================================================
// No BC cap + purity
// ===========================================================================

describe('projection — no BC cap, purity, determinism', () => {
  it('projected BC is the plain mean of projected BC indicators (no cap)', () => {
    const rec = record({
      'BC-01': { state: 'measured', value: '95' },                 // 4
      'BC-02': { state: 'measured', value: '100' }, // 4
      'BC-04': { state: 'measured', numerator: '0', denominator: '5' },   // 4
      'BC-08': { state: 'measured', numerator: '10', denominator: '10' }, // 4
      'BC-09': { state: 'measured', numerator: '1', denominator: '10' },  // 1
    });
    const p = projOf(rec, {});
    expect(p.bc.score).toBeCloseTo((4 + 4 + 4 + 4 + 1) / 5, 10);  // 3.4, plain mean
  });

  it('does not mutate inputs', () => {
    const rec = record({ 'BC-01': { state: 'measured', value: '50' } });
    const l1 = computeAssessment(rec);
    const snap = JSON.stringify({ rec, l1 });
    computeProjection(rec, l1, { targets: { 'BC-01': 4 } });
    computeGapAnalysis(rec, l1);
    expect(JSON.stringify({ rec, l1 })).toBe(snap);
  });

  it('same inputs → deep-equal output (both functions)', () => {
    const rec = record({ 'BC-01': { state: 'measured', value: '50' }, 'IH-06': { state: 'capability_absent' } });
    const l1 = computeAssessment(rec);
    expect(computeGapAnalysis(rec, l1)).toEqual(computeGapAnalysis(rec, l1));
    expect(computeProjection(rec, l1, { targets: { 'BC-01': 4 } }))
      .toEqual(computeProjection(rec, l1, { targets: { 'BC-01': 4 } }));
  });

  it('projection never alters the current score (re-run computeAssessment unchanged)', () => {
    const rec = record({ 'BC-01': { state: 'measured', value: '50' } });
    const before = computeAssessment(rec);
    computeProjection(rec, before, { targets: { 'BC-01': 4 } });
    expect(computeAssessment(rec)).toEqual(before);
  });
});
