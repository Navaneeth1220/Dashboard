/**
 * Before/after comparison test suite — Stage 5-ii-engine.
 */

import { describe, it, expect } from 'vitest';
import { computeComparison } from './comparison.js';
import { createBlankAssessment } from './scoring.js';
import { createBlankLayer0 } from './layer0.js';
import { serializeAssessment, parseAndValidateImport } from './persistence.js';

// ---------------------------------------------------------------------------
// Helpers — build a validated-record-shaped object
// ---------------------------------------------------------------------------

function rec(indicatorOverrides = {}, { clientId = 'C', assessmentDate = '2026-01-01', layer0Overrides = {} } = {}) {
  return {
    clientId,
    assessmentDate,
    indicators: { ...createBlankAssessment().indicators, ...indicatorOverrides },
    layer0: { ...createBlankLayer0(), ...layer0Overrides },
    targets: {},
  };
}

// Single-indicator transition: set IH-06 (or given id) in A and B, read its result
function transitionOf(aEntry, bEntry, id = 'IH-06') {
  const A = rec({ [id]: aEntry });
  const B = rec({ [id]: bEntry });
  return computeComparison(A, B).indicators[id];
}

// state shorthands
const meas = (value) => ({ state: 'measured', value: String(value) });           // IH hours
const measPct = (n, d) => ({ state: 'measured', numerator: String(n), denominator: String(d) });
const NM = { state: 'not_measurable' };
const NQE = { state: 'no_qualifying_event' };
const CAP = { state: 'capability_absent' };

const NO_DELTA_TYPES = ['became_measurable', 'became_unmeasurable', 'both_unscored', 'programme_gap_change', 'gap_identified'];

// ===========================================================================
// The 3×3 score-class matrix → 8 transition types
// ===========================================================================

describe('transition-type matrix (3×3 → 8 types)', () => {
  it('SCORED → SCORED = performance_change (with delta)', () => {
    const t = transitionOf(meas(96), meas(4));   // IH-06: 96h→score2, 4h→score4
    expect(t.fromClass).toBe('SCORED');
    expect(t.toClass).toBe('SCORED');
    expect(t.transitionType).toBe('performance_change');
    expect(t.delta).toBe(2);
    expect(t.direction).toBe('improved');
  });

  it('SCORED → GAP_ZERO = capability_lost (with delta + tag)', () => {
    const t = transitionOf(meas(4), CAP);        // score4 → capability_absent(0)
    expect(t.transitionType).toBe('capability_lost');
    expect(t.delta).toBe(-4);
    expect(t.direction).toBe('regressed');
    expect(t.capabilityTag).toBe('lost');
  });

  it('SCORED → NO_SCORE = became_unmeasurable (no delta)', () => {
    const t = transitionOf(meas(4), NM);
    expect(t.transitionType).toBe('became_unmeasurable');
    expect(t).not.toHaveProperty('delta');
  });

  it('GAP_ZERO → SCORED = capability_established (with delta + tag)', () => {
    const t = transitionOf(CAP, meas(12));       // capability_absent(0) → 12h score3
    expect(t.transitionType).toBe('capability_established');
    expect(t.delta).toBe(3);
    expect(t.direction).toBe('improved');
    expect(t.capabilityTag).toBe('established');
  });

  it('GAP_ZERO → GAP_ZERO = programme_gap_change (no delta)', () => {
    const t = transitionOf(CAP, CAP);
    expect(t.transitionType).toBe('programme_gap_change');
    expect(t).not.toHaveProperty('delta');
  });

  it('GAP_ZERO → NO_SCORE = became_unmeasurable (no delta, GAP_ZERO origin preserved)', () => {
    const t = transitionOf(CAP, NM);
    expect(t.transitionType).toBe('became_unmeasurable');
    expect(t.fromClass).toBe('GAP_ZERO');        // origin recoverable for UI wording
    expect(t).not.toHaveProperty('delta');
  });

  it('NO_SCORE → SCORED = became_measurable (NO delta — measurability change, not performance gain)', () => {
    const t = transitionOf(NM, meas(4));
    expect(t.transitionType).toBe('became_measurable');
    expect(t).not.toHaveProperty('delta');
  });

  it('NO_SCORE → GAP_ZERO = gap_identified (no delta)', () => {
    const t = transitionOf(NM, CAP);
    expect(t.transitionType).toBe('gap_identified');
    expect(t).not.toHaveProperty('delta');
  });

  it('NO_SCORE → NO_SCORE = both_unscored (no delta)', () => {
    const t = transitionOf(NM, NQE);
    expect(t.transitionType).toBe('both_unscored');
    expect(t).not.toHaveProperty('delta');
  });
});

// ===========================================================================
// Corner refinements
// ===========================================================================

describe('corner-cell refinements', () => {
  it('gap_identified is distinguishable from became_measurable', () => {
    const gapId = transitionOf(NM, { state: 'no_rto_defined' }, 'BC-08');
    const becameMeas = transitionOf(NM, measPct(9, 10), 'BC-08');
    expect(gapId.transitionType).toBe('gap_identified');
    expect(becameMeas.transitionType).toBe('became_measurable');
    expect(gapId.transitionType).not.toBe(becameMeas.transitionType);
    expect(gapId).not.toHaveProperty('delta');
    expect(becameMeas).not.toHaveProperty('delta');
  });

  it('became_unmeasurable origins: SCORED-origin vs GAP_ZERO-origin are recoverable', () => {
    const fromScored = transitionOf(meas(4), NM);
    const fromGap = transitionOf(CAP, NM);
    expect(fromScored.transitionType).toBe('became_unmeasurable');
    expect(fromGap.transitionType).toBe('became_unmeasurable');
    // same type, different from-side score-class → UI can word them distinctly
    expect(fromScored.fromClass).toBe('SCORED');
    expect(fromGap.fromClass).toBe('GAP_ZERO');
  });

  it('programme-gap-zero → measured = capability_established; measured-0 → measured = performance_change', () => {
    const established = transitionOf({ state: 'no_rto_defined' }, measPct(9, 10), 'BC-08');   // 0 → 90% score4
    const performance = transitionOf(measPct(0, 10), measPct(9, 10), 'BC-08');                // measured 0 → 90% score4
    expect(established.transitionType).toBe('capability_established');
    expect(established.capabilityTag).toBe('established');
    expect(performance.transitionType).toBe('performance_change');
    expect(performance).not.toHaveProperty('capabilityTag');
  });
});

// ===========================================================================
// Structural delta-absence — every no-delta type omits the field
// ===========================================================================

describe('structural delta absence', () => {
  it('every no-delta transition type omits the delta field entirely', () => {
    const cases = {
      became_measurable:    transitionOf(NM, meas(4)),
      became_unmeasurable:  transitionOf(meas(4), NM),
      both_unscored:        transitionOf(NM, NQE),
      programme_gap_change: transitionOf(CAP, CAP),
      gap_identified:       transitionOf(NM, CAP),
    };
    for (const [type, result] of Object.entries(cases)) {
      expect(result.transitionType).toBe(type);
      expect(result).not.toHaveProperty('delta');
      expect(result).not.toHaveProperty('direction');
    }
    expect(NO_DELTA_TYPES.sort()).toEqual(Object.keys(cases).sort());
  });

  it('performance_change unchanged → delta 0, direction unchanged', () => {
    const t = transitionOf(meas(12), meas(12));   // 3 → 3
    expect(t.delta).toBe(0);
    expect(t.direction).toBe('unchanged');
  });

  it('performance_change regression → negative delta', () => {
    const t = transitionOf(meas(4), meas(400));   // 4 → 1
    expect(t.delta).toBe(-3);
    expect(t.direction).toBe('regressed');
  });
});

// ===========================================================================
// Dimension / Overall deltas — gated on both-complete
// ===========================================================================

describe('dimension and Overall deltas', () => {
  const completeIH = (vals) => ({ 'IH-06': meas(vals[0]), 'IH-07': meas(vals[1]), 'IH-08': meas(vals[2]) });

  it('both complete → signed dimension delta', () => {
    const A = rec(completeIH(['96', '48', '96']));   // IH = (2+2+2)/3 = 2
    const B = rec(completeIH(['4', '2', '5']));       // IH = (4+4+4)/3 = 4
    const c = computeComparison(A, B);
    expect(c.dimensions.ih.comparable).toBe(true);
    expect(c.dimensions.ih.delta).toBeCloseTo(2, 10);
    expect(c.dimensions.ih.direction).toBe('improved');
  });

  it('incomplete in B → no dimension delta, incompleteIn names the side', () => {
    const A = rec(completeIH(['4', '2', '5']));                          // IH complete
    const B = rec({ 'IH-06': meas(4), 'IH-07': meas(2), 'IH-08': NM });  // IH incomplete (NM)
    const c = computeComparison(A, B);
    expect(c.dimensions.ih.comparable).toBe(false);
    expect(c.dimensions.ih).not.toHaveProperty('delta');
    expect(c.dimensions.ih.incompleteIn).toBe('B');
  });

  it('incomplete in both → incompleteIn "both"', () => {
    const A = rec({ 'IH-06': NM });
    const B = rec({ 'IH-08': NM });
    const c = computeComparison(A, B);
    expect(c.dimensions.ih.incompleteIn).toBe('both');
    expect(c.dimensions.ih).not.toHaveProperty('delta');
  });

  it('Overall delta only when both Overall complete; otherwise no number', () => {
    // A fully complete, B has an incomplete BC → Overall not comparable
    const full = {
      'IH-06': meas(4), 'IH-07': meas(2), 'IH-08': meas(5),
      'BC-01': meas(85), 'BC-02': meas(90), 'BC-04': measPct(0, 5),
      'BC-08': measPct(9, 10), 'BC-09': measPct(9, 10),
    };
    const A = rec(full);
    const B = rec({ ...full, 'BC-01': NM });   // BC incomplete → Overall incomplete
    const c = computeComparison(A, B);
    expect(c.dimensions.overall.comparable).toBe(false);
    expect(c.dimensions.overall).not.toHaveProperty('delta');
    expect(c.dimensions.overall.incompleteIn).toBe('B');
    // per-indicator breakdown still works
    expect(c.indicators['BC-01'].transitionType).toBe('became_unmeasurable');
  });
});

// ===========================================================================
// Layer 0 transitions
// ===========================================================================

describe('Layer 0 state transitions', () => {
  it('Missing → Present = improved', () => {
    const A = rec({}, { layer0Overrides: { 'L0-asset-inventory': { state: 'missing' } } });
    const B = rec({}, { layer0Overrides: { 'L0-asset-inventory': { state: 'present' } } });
    expect(computeComparison(A, B).layer0['L0-asset-inventory'].transition).toBe('improved');
  });

  it('Present → Incomplete = regressed', () => {
    const A = rec({}, { layer0Overrides: { 'L0-risk-assessment': { state: 'present' } } });
    const B = rec({}, { layer0Overrides: { 'L0-risk-assessment': { state: 'incomplete_outdated' } } });
    expect(computeComparison(A, B).layer0['L0-risk-assessment'].transition).toBe('regressed');
  });

  it('Missing → Missing = still_flagged', () => {
    const A = rec({}, { layer0Overrides: { 'L0-asset-inventory': { state: 'missing' } } });
    const B = rec({}, { layer0Overrides: { 'L0-asset-inventory': { state: 'missing' } } });
    expect(computeComparison(A, B).layer0['L0-asset-inventory'].transition).toBe('still_flagged');
  });

  it('Present → Present = unchanged (healthy)', () => {
    const A = rec({}, { layer0Overrides: { 'L0-bc-plan-doc': { state: 'present' } } });
    const B = rec({}, { layer0Overrides: { 'L0-bc-plan-doc': { state: 'present' } } });
    expect(computeComparison(A, B).layer0['L0-bc-plan-doc'].transition).toBe('unchanged');
  });

  it('carries fromState/toState/severities for wording', () => {
    const A = rec({}, { layer0Overrides: { 'L0-asset-inventory': { state: 'missing' } } });
    const B = rec({}, { layer0Overrides: { 'L0-asset-inventory': { state: 'present' } } });
    const t = computeComparison(A, B).layer0['L0-asset-inventory'];
    expect(t.fromState).toBe('missing');
    expect(t.toState).toBe('present');
    expect(t.fromSeverity).toBe('critical');
    expect(t.toSeverity).toBeNull();
    expect(t.subclass).toBe('0A');
  });
});

// ===========================================================================
// Metadata + A==B + purity
// ===========================================================================

describe('metadata, A==B, purity', () => {
  it('surfaces A and B meta; flags clientMismatch when clientIds differ', () => {
    const A = rec({}, { clientId: 'Client A' });
    const B = rec({}, { clientId: 'Client B' });
    const c = computeComparison(A, B);
    expect(c.meta.a.clientId).toBe('Client A');
    expect(c.meta.b.clientId).toBe('Client B');
    expect(c.meta.clientMismatch).toBe(true);
  });

  it('no mismatch flag when clientIds equal or blank', () => {
    expect(computeComparison(rec({}, { clientId: 'X' }), rec({}, { clientId: 'X' })).meta.clientMismatch).toBe(false);
    expect(computeComparison(rec({}, { clientId: '' }), rec({}, { clientId: 'Y' })).meta.clientMismatch).toBe(false);
  });

  it('A == B (same record) → every indicator sameState, performance deltas 0, dimension deltas 0', () => {
    const same = rec({
      'IH-06': meas(4), 'IH-07': meas(2), 'IH-08': meas(5),
      'BC-01': meas(85), 'BC-02': meas(90), 'BC-04': measPct(0, 5),
      'BC-08': measPct(9, 10), 'BC-09': measPct(9, 10),
    });
    const c = computeComparison(same, same);
    for (const t of Object.values(c.indicators)) {
      expect(t.sameState).toBe(true);
      if (t.transitionType === 'performance_change') expect(t.delta).toBe(0);
    }
    expect(c.dimensions.ih.delta).toBe(0);
    expect(c.dimensions.bc.delta).toBe(0);
    expect(c.dimensions.overall.delta).toBe(0);
  });

  it('does not mutate its inputs', () => {
    const A = rec({ 'IH-06': meas(4) });
    const B = rec({ 'IH-06': meas(96) });
    const snap = JSON.stringify({ A, B });
    computeComparison(A, B);
    expect(JSON.stringify({ A, B })).toBe(snap);
  });

  it('deterministic — same inputs give deep-equal output', () => {
    const A = rec({ 'IH-06': CAP });
    const B = rec({ 'IH-06': meas(12) });
    expect(computeComparison(A, B)).toEqual(computeComparison(A, B));
  });

  it('produces 8 indicator transitions and 9 Layer 0 transitions', () => {
    const c = computeComparison(rec(), rec());
    expect(Object.keys(c.indicators)).toHaveLength(8);
    expect(Object.keys(c.layer0)).toHaveLength(9);
  });
});

// ===========================================================================
// Overall movement classification (Change 2) — derived from IH/BC deltas
// ===========================================================================

describe('overall.movement classification', () => {
  // Build a full record so IH and BC are both complete; then vary to move dims.
  const full = (ih, bc) => rec({
    'IH-06': meas(ih[0]), 'IH-07': meas(ih[1]), 'IH-08': meas(ih[2]),
    'BC-01': meas(bc[0]), 'BC-02': meas(bc[1]),
    'BC-04': measPct(bc[2], 100), 'BC-08': measPct(bc[3], 100), 'BC-09': measPct(bc[4], 100),
  });
  // helper hour values → known IH scores; % values → known BC scores
  const move = (A, B) => computeComparison(A, B).dimensions;

  it('IH improved + BC regressed → mixed', () => {
    // A: IH low (score 1s), BC high (4s). B: IH high (4s), BC low (1s).
    const A = full(['400', '100', '400'], ['95', '95', 0, 95, 95]);   // IH≈1, BC≈4
    const B = full(['4', '2', '5'], ['15', '15', 60, 15, 15]);         // IH≈4, BC≈1
    const d = move(A, B);
    expect(d.ih.direction).toBe('improved');
    expect(d.bc.direction).toBe('regressed');
    expect(d.overall.movement).toBe('mixed');
  });

  it('reverse (IH regressed + BC improved) → mixed', () => {
    const A = full(['4', '2', '5'], ['15', '15', 60, 15, 15]);
    const B = full(['400', '100', '400'], ['95', '95', 0, 95, 95]);
    expect(move(A, B).overall.movement).toBe('mixed');
  });

  it('both improved → aligned', () => {
    const A = full(['400', '100', '400'], ['15', '15', 60, 15, 15]);   // both low
    const B = full(['4', '2', '5'], ['95', '95', 0, 95, 95]);           // both high
    expect(move(A, B).overall.movement).toBe('aligned');
  });

  it('both regressed → aligned', () => {
    const A = full(['4', '2', '5'], ['95', '95', 0, 95, 95]);
    const B = full(['400', '100', '400'], ['15', '15', 60, 15, 15]);
    expect(move(A, B).overall.movement).toBe('aligned');
  });

  it('IH moved + BC unchanged → partial_move (NOT mixed)', () => {
    const A = full(['400', '100', '400'], ['85', '85', 3, 85, 85]);
    const B = full(['4', '2', '5'], ['85', '85', 3, 85, 85]);   // BC identical
    const d = move(A, B);
    expect(d.bc.delta).toBe(0);
    expect(d.overall.movement).toBe('partial_move');
  });

  it('tiny opposite move still mixed — no magnitude threshold', () => {
    // IH nudges up one indicator by a band (small), BC drops a band (larger) → opposite
    const A = full(['20', '2', '5'], ['95', '95', 0, 95, 95]);   // IH-06 score 3
    const B = full(['4', '2', '5'], ['15', '15', 60, 15, 15]);    // IH-06 → 4 (IH up small), BC down big
    const d = move(A, B);
    expect(d.ih.direction).toBe('improved');
    expect(d.bc.direction).toBe('regressed');
    expect(d.overall.movement).toBe('mixed');
    // both deltas still present (magnitude conveyed by the numbers)
    expect(typeof d.ih.delta).toBe('number');
    expect(typeof d.bc.delta).toBe('number');
  });

  it('one dimension incomplete → not_determinable (never a false mixed)', () => {
    const A = full(['400', '100', '400'], ['95', '95', 0, 95, 95]);
    const B = rec({ 'IH-06': meas(4), 'IH-07': NM, 'IH-08': meas(5),   // IH incomplete
      'BC-01': meas(15), 'BC-02': meas(15), 'BC-04': measPct(60, 100), 'BC-08': measPct(15, 100), 'BC-09': measPct(15, 100) });
    const d = move(A, B);
    expect(d.ih.comparable).toBe(false);
    expect(d.overall.movement).toBe('not_determinable');
  });

  it('mixed classification does NOT change the Overall delta or dimension deltas', () => {
    const A = full(['400', '100', '400'], ['95', '95', 0, 95, 95]);
    const B = full(['4', '2', '5'], ['15', '15', 60, 15, 15]);
    const d = move(A, B);
    // Overall delta is still the plain mean(IH,BC) difference
    const expectedOverallDelta = (d.ih.scoreB + d.bc.scoreB) / 2 - (d.ih.scoreA + d.bc.scoreA) / 2;
    expect(d.overall.delta).toBeCloseTo(expectedOverallDelta, 10);
  });
});

// ===========================================================================
// Raw-value change (additive) — performance_change + capability_established
// ===========================================================================

describe('raw-value change', () => {
  it('within-band improvement: MTTD 20h → 18h (both band 3) → improved, rawDelta 2, score delta still 0', () => {
    const t = transitionOf(meas(20), meas(18), 'IH-06');
    expect(t.transitionType).toBe('performance_change');
    expect(t.scoreA).toBe(3);
    expect(t.scoreB).toBe(3);
    expect(t.delta).toBe(0);            // band/score unchanged — existing behaviour
    // but the raw value moved:
    expect(t.rawValueA).toBe(20);
    expect(t.rawValueB).toBe(18);
    expect(t.rawDelta).toBe(2);
    expect(t.rawDirection).toBe('improved');   // lower hours = improved
  });

  it('MTTD 18h → 22h (same band) → regressed', () => {
    const t = transitionOf(meas(18), meas(22), 'IH-06');
    expect(t.rawDirection).toBe('regressed');
    expect(t.rawDelta).toBe(4);
  });

  it('THE TRAP — Threshold Violation Rate 20% → 12% → improved (falling rate), NOT regressed', () => {
    const t = transitionOf(measPct(20, 100), measPct(12, 100), 'BC-04');
    expect(t.transitionType).toBe('performance_change');
    expect(t.rawValueA).toBe(20);
    expect(t.rawValueB).toBe(12);
    expect(t.rawDelta).toBe(8);
    expect(t.rawDirection).toBe('improved');   // raw-value direction, NOT band orientation
  });

  it('RTO Achievement 78% → 82% → improved (higher % better)', () => {
    const t = transitionOf(measPct(78, 100), measPct(82, 100), 'BC-08');
    expect(t.rawDirection).toBe('improved');
    expect(t.rawDelta).toBeCloseTo(4, 10);
  });

  it('num/den indicator shows the derived percentage: 4/5 → 9/10 = 80% → 90%, +10pp', () => {
    const t = transitionOf(measPct(4, 5), measPct(9, 10), 'BC-08');
    expect(t.rawValueA).toBe(80);
    expect(t.rawValueB).toBe(90);
    expect(t.rawDelta).toBeCloseTo(10, 10);
    expect(t.rawDirection).toBe('improved');
  });

  it('identical value + band → no raw movement (rawDirection unchanged, rawDelta 0)', () => {
    const t = transitionOf(meas(18), meas(18), 'IH-06');
    expect(t.rawDirection).toBe('unchanged');
    expect(t.rawDelta).toBe(0);
  });

  it('capability_established → rawValueB only (no rawValueA, no rawDelta)', () => {
    const t = transitionOf(CAP, meas(18), 'IH-06');
    expect(t.transitionType).toBe('capability_established');
    expect(t.rawValueB).toBe(18);
    expect(t).not.toHaveProperty('rawValueA');
    expect(t).not.toHaveProperty('rawDelta');
    expect(t).not.toHaveProperty('rawDirection');
  });

  it('all other transition types carry NO raw fields', () => {
    const cases = {
      became_measurable:    transitionOf(NM, meas(18)),
      became_unmeasurable:  transitionOf(meas(18), NM),
      capability_lost:      transitionOf(meas(18), CAP),
      both_unscored:        transitionOf(NM, NQE),
      programme_gap_change: transitionOf(CAP, CAP),
      gap_identified:       transitionOf(NM, { state: 'no_rto_defined' }, 'BC-08'),
    };
    for (const [type, t] of Object.entries(cases)) {
      expect(t.transitionType).toBe(type);
      expect(t).not.toHaveProperty('rawValueA');
      expect(t).not.toHaveProperty('rawValueB');
      expect(t).not.toHaveProperty('rawDelta');
      expect(t).not.toHaveProperty('rawDirection');
    }
  });

  it('reads raw values correctly from two SAVED (exported → imported) records', () => {
    const roundTrip = (r) => parseAndValidateImport(serializeAssessment({
      clientId: r.clientId, assessmentDate: r.assessmentDate,
      indicators: r.indicators, layer0: r.layer0, targets: r.targets,
    }).json).data;

    const A = roundTrip(rec({ 'IH-06': meas(20), 'BC-08': measPct(4, 5) }));
    const B = roundTrip(rec({ 'IH-06': meas(18), 'BC-08': measPct(9, 10) }));
    const c = computeComparison(A, B);
    expect(c.indicators['IH-06'].rawValueA).toBe(20);
    expect(c.indicators['IH-06'].rawValueB).toBe(18);
    expect(c.indicators['IH-06'].rawDirection).toBe('improved');
    expect(c.indicators['BC-08'].rawValueA).toBe(80);   // 4/5 derived %
    expect(c.indicators['BC-08'].rawValueB).toBe(90);   // 9/10 derived %
  });

  it('within-band raw movement does NOT change aggregate / dimension deltas', () => {
    // IH complete both sides; only IH-06 moves WITHIN band 3 (20h → 18h)
    const A = rec({ 'IH-06': meas(20), 'IH-07': meas(2), 'IH-08': meas(5) });
    const B = rec({ 'IH-06': meas(18), 'IH-07': meas(2), 'IH-08': meas(5) });
    const c = computeComparison(A, B);
    // raw moved:
    expect(c.indicators['IH-06'].rawDirection).toBe('improved');
    // but the IH dimension score is band-based and unchanged:
    expect(c.dimensions.ih.delta).toBe(0);
    expect(c.dimensions.ih.scoreA).toBe(c.dimensions.ih.scoreB);
  });
});
