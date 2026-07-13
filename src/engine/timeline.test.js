/**
 * Sequential timeline comparison tests — orchestration layer.
 */

import { describe, it, expect } from 'vitest';
import { computeTimeline } from './timeline.js';
import { computeComparison } from './comparison.js';
import { createBlankAssessment } from './scoring.js';
import { createBlankLayer0 } from './layer0.js';

function recAt(assessmentDate, indicatorOverrides = {}, clientId = 'Acme') {
  return {
    clientId, assessmentDate,
    indicators: { ...createBlankAssessment().indicators, ...indicatorOverrides },
    layer0: { ...createBlankLayer0() },
    targets: {},
  };
}
const meas = (v) => ({ state: 'measured', value: String(v) });
const measPct = (n, d) => ({ state: 'measured', numerator: String(n), denominator: String(d) });
const NM = { state: 'not_measurable' };
const CAP = { state: 'capability_absent' };

// ===========================================================================
// Ordering
// ===========================================================================

describe('chronological ordering', () => {
  it('orders loaded assessments by assessmentDate (earliest = step 1)', () => {
    const t = computeTimeline([
      recAt('2026-03-01', {}, 'Acme'),
      recAt('2026-01-01', {}, 'Acme'),
      recAt('2026-02-01', {}, 'Acme'),
    ]);
    expect(t.steps.map(s => s.assessmentDate)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
  });

  it('tied dates → stable load order', () => {
    const t = computeTimeline([
      recAt('2026-01-01', { 'IH-06': meas(4) }, 'X'),
      recAt('2026-01-01', { 'IH-06': meas(96) }, 'Y'),
    ]);
    expect(t.steps.map(s => s.clientId)).toEqual(['X', 'Y']);
  });

  it('missing date → load-order fallback (undated stays in its loaded position)', () => {
    const t = computeTimeline([
      recAt('', {}, 'First'),          // no date
      recAt('2026-01-01', {}, 'Second'),
    ]);
    expect(t.steps.map(s => s.clientId)).toEqual(['First', 'Second']);
  });

  it('step label shows date + clientId', () => {
    const t = computeTimeline([recAt('2026-01-01', {}, 'Acme'), recAt('2026-02-01', {}, 'Acme')]);
    expect(t.steps[0].label).toMatch(/2026-01-01/);
    expect(t.steps[0].label).toMatch(/Acme/);
  });
});

// ===========================================================================
// N−1 blocks — each an untouched pairwise comparison
// ===========================================================================

describe('N−1 consecutive-pair blocks', () => {
  it('N=4 → exactly three blocks (1→2, 2→3, 3→4)', () => {
    const r1 = recAt('2026-01-01', { 'IH-06': meas(300) });
    const r2 = recAt('2026-02-01', { 'IH-06': meas(96) });
    const r3 = recAt('2026-03-01', { 'IH-06': meas(20) });
    const r4 = recAt('2026-04-01', { 'IH-06': meas(4) });
    const t = computeTimeline([r1, r2, r3, r4]);
    expect(t.blocks).toHaveLength(3);
    expect(t.blocks.map(b => [b.fromIndex, b.toIndex])).toEqual([[0, 1], [1, 2], [2, 3]]);
  });

  it('each block equals computeComparison on the right consecutive pair', () => {
    const r1 = recAt('2026-01-01', { 'IH-06': meas(20) });
    const r2 = recAt('2026-02-01', { 'IH-06': meas(18) });
    const r3 = recAt('2026-03-01', { 'IH-06': meas(4) });
    const t = computeTimeline([r1, r2, r3]);
    expect(t.blocks[0].comparison).toEqual(computeComparison(r1, r2));
    expect(t.blocks[1].comparison).toEqual(computeComparison(r2, r3));
  });

  it('N=2 → one block + a 2-point trajectory (matches the 2-way case)', () => {
    const r1 = recAt('2026-01-01', { 'IH-06': meas(96) });
    const r2 = recAt('2026-02-01', { 'IH-06': meas(4) });
    const t = computeTimeline([r1, r2]);
    expect(t.blocks).toHaveLength(1);
    expect(t.blocks[0].comparison).toEqual(computeComparison(r1, r2));
    expect(t.trajectory['IH-06']).toHaveLength(2);
  });
});

// ===========================================================================
// Trajectory — honest no-score vs score-0 handling
// ===========================================================================

describe('per-indicator trajectory', () => {
  it('measured at all points → full value/score sequence in order', () => {
    const t = computeTimeline([
      recAt('2026-01-01', { 'IH-06': meas(300) }),   // score 1
      recAt('2026-02-01', { 'IH-06': meas(20) }),    // score 3
      recAt('2026-03-01', { 'IH-06': meas(4) }),     // score 4
    ]);
    const pts = t.trajectory['IH-06'];
    expect(pts.map(p => p.kind)).toEqual(['measured', 'measured', 'measured']);
    expect(pts.map(p => p.value)).toEqual([300, 20, 4]);
    expect(pts.map(p => p.score)).toEqual([1, 3, 4]);
  });

  it('mixed sequence → four distinct point-states, no-score has NO number, capability-absent is score-0', () => {
    const t = computeTimeline([
      recAt('2026-01-01', { 'IH-06': meas(30) }),   // measured
      recAt('2026-02-01', { 'IH-06': NM }),          // not measurable — no number
      recAt('2026-03-01', { 'IH-06': meas(18) }),    // measured
      recAt('2026-04-01', { 'IH-06': CAP }),         // capability absent — score 0
    ]);
    const pts = t.trajectory['IH-06'];
    expect(pts.map(p => p.kind)).toEqual(['measured', 'no_score', 'measured', 'gap_zero']);

    // measured points carry value + score
    expect(pts[0].value).toBe(30);
    expect(pts[0].score).toBe(2);
    // no-score point: NO value, NO score
    expect(pts[1]).not.toHaveProperty('value');
    expect(pts[1]).not.toHaveProperty('score');
    expect(pts[1].state).toBe('not_measurable');
    // capability-absent: score 0 is a real value, distinct from no-score
    expect(pts[3].kind).toBe('gap_zero');
    expect(pts[3].score).toBe(0);
    expect(pts[3].state).toBe('capability_absent');
  });

  it('programme-gap zero (no_rto_defined) is score-0, not no-score', () => {
    const t = computeTimeline([
      recAt('2026-01-01', { 'BC-08': measPct(9, 10) }),
      recAt('2026-02-01', { 'BC-08': { state: 'no_rto_defined' } }),
    ]);
    const pts = t.trajectory['BC-08'];
    expect(pts[1].kind).toBe('gap_zero');
    expect(pts[1].score).toBe(0);
    expect(pts[1].state).toBe('no_rto_defined');
  });

  it('num/den indicator trajectory uses the derived percentage', () => {
    const t = computeTimeline([
      recAt('2026-01-01', { 'BC-08': measPct(4, 5) }),   // 80%
      recAt('2026-02-01', { 'BC-08': measPct(9, 10) }),  // 90%
    ]);
    expect(t.trajectory['BC-08'].map(p => p.value)).toEqual([80, 90]);
  });

  it('time indicator trajectory keeps hours', () => {
    const t = computeTimeline([recAt('2026-01-01', { 'IH-06': meas(30) }), recAt('2026-02-01', { 'IH-06': meas(18) })]);
    expect(t.trajectory['IH-06'].map(p => p.value)).toEqual([30, 18]);
  });
});

// ===========================================================================
// Client mismatch + engine-untouched
// ===========================================================================

describe('client mismatch and engine independence', () => {
  it('flags clientMismatch when clients differ, not when same', () => {
    expect(computeTimeline([recAt('2026-01-01', {}, 'A'), recAt('2026-02-01', {}, 'B')]).clientMismatch).toBe(true);
    expect(computeTimeline([recAt('2026-01-01', {}, 'A'), recAt('2026-02-01', {}, 'A')]).clientMismatch).toBe(false);
  });

  it('computeComparison is called pairwise and unchanged — blocks reproduce it exactly', () => {
    const r1 = recAt('2026-01-01', { 'IH-06': meas(20), 'BC-08': measPct(4, 5) });
    const r2 = recAt('2026-02-01', { 'IH-06': meas(18), 'BC-08': measPct(9, 10) });
    const t = computeTimeline([r1, r2]);
    // The block carries the exact pairwise result, incl. raw-value fields
    const direct = computeComparison(r1, r2);
    expect(t.blocks[0].comparison).toEqual(direct);
    expect(t.blocks[0].comparison.indicators['IH-06'].rawDirection).toBe('improved');
  });

  it('does not mutate its input records', () => {
    const recs = [recAt('2026-01-01', { 'IH-06': meas(20) }), recAt('2026-02-01', { 'IH-06': meas(18) })];
    const snap = JSON.stringify(recs);
    computeTimeline(recs);
    expect(JSON.stringify(recs)).toBe(snap);
  });
});
