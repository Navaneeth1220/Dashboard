/**
 * Layer 1 Priority View (F engine) test suite — Stage 3b-i (§7).
 */

import { describe, it, expect } from 'vitest';
import { computePriorityView } from './priorityView.js';
import { computeAssessment, createBlankAssessment, scoreIndicator } from './scoring.js';
import { computeLayer0, createBlankLayer0 } from './layer0.js';
import { STATE } from '../data/indicatorDefinitions.js';
import { L0_STATE } from '../data/layer0Definitions.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fullRecord(indicatorOverrides = {}, layer0Overrides = {}) {
  const blank = createBlankAssessment();
  return {
    ...blank,
    indicators: { ...blank.indicators, ...indicatorOverrides },
    layer0: { ...createBlankLayer0(), ...layer0Overrides },
  };
}

function pv(record) {
  return computePriorityView(record, computeAssessment(record), computeLayer0(record));
}

const sv = (score) => score;   // readability marker

// Measured value helpers producing known scores
const ihHours = { 4: '4', 3: '12', 2: '96', 1: '400' };       // IH-06/08 bands
const bcPct = (n, d) => ({ numerator: String(n), denominator: String(d) });

// ===========================================================================
// Three-lane assignment
// ===========================================================================

describe('three-lane assignment', () => {
  it('Measured indicators go to Lane 1; not-measurable to Lane 2; non-events to Lane 3', () => {
    const rec = fullRecord({
      'IH-06': { state: 'measured', value: '4' },               // Lane 1 (score 4)
      'IH-07': { state: 'not_measurable' },                      // Lane 2
      'IH-08': { state: 'no_qualifying_event' },                 // Lane 3
      'BC-01': { state: 'no_qualifying_disruption' },            // Lane 3
      'BC-02': { state: 'measured', value: '90' },               // Lane 1 (90% score 4)
    });
    const view = pv(rec);
    expect(view.lane1.entries.map(e => e.indicatorId)).toEqual(expect.arrayContaining(['IH-06', 'BC-02']));
    expect(view.lane2.groups.flatMap(g => g.affectedIndicators)).toContain('IH-07');
    expect(view.lane3.entries.map(e => e.indicatorId)).toEqual(expect.arrayContaining(['IH-08', 'BC-01']));
  });

  it('all programme-gap score-0 states land in Lane 1, NOT Lane 2', () => {
    const rec = fullRecord({
      'IH-06': { state: 'capability_absent' },         // score 0
      'BC-04': { state: 'no_thresholds_defined' },     // score 0
      'BC-08': { state: 'no_rto_defined' },            // score 0
      'BC-09': { state: 'no_rpo_defined' },            // score 0
    });
    const view = pv(rec);
    const lane1Ids = view.lane1.entries.map(e => e.indicatorId);
    expect(lane1Ids).toEqual(expect.arrayContaining(['IH-06', 'BC-04', 'BC-08', 'BC-09']));
    // None of them in Lane 2
    expect(view.lane2.groups.flatMap(g => g.affectedIndicators)).toHaveLength(0);
  });

  it('all measured → Lanes 2 and 3 empty, Lane 1 populated and sorted', () => {
    const rec = fullRecord({
      'IH-06': { state: 'measured', value: '4' },                 // 4
      'IH-07': { state: 'measured', value: '2' },                 // 4
      'IH-08': { state: 'measured', value: '96' },                // 2
      'BC-01': { state: 'measured', value: '85' },                // 3
      'BC-02': { state: 'measured', value: '50' },               // 50% → 2
      'BC-04': { state: 'measured', ...bcPct(0, 5) },             // 4
      'BC-08': { state: 'measured', ...bcPct(4, 10) },            // 40% → 1
      'BC-09': { state: 'measured', ...bcPct(9, 10) },            // 90% → 4
    });
    const view = pv(rec);
    expect(view.lane2.groups).toHaveLength(0);
    expect(view.lane3.entries).toHaveLength(0);
    expect(view.lane1.entries).toHaveLength(8);
    // Sorted ascending
    const scores = view.lane1.entries.map(e => e.score);
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
    expect(scores[0]).toBe(1);   // BC-08 lowest
  });
});

// ===========================================================================
// Lane 1 ordering and entry shape
// ===========================================================================

describe('Lane 1 ordering and entry shape', () => {
  it('sorts by score ascending (lower = more urgent at top)', () => {
    const rec = fullRecord({
      'IH-06': { state: 'measured', value: '4' },     // 4
      'IH-07': { state: 'capability_absent' },        // 0
      'IH-08': { state: 'measured', value: '96' },    // 2
    });
    const view = pv(rec);
    expect(view.lane1.entries.map(e => e.score)).toEqual([0, 2, 4]);
    expect(view.lane1.entries[0].indicatorId).toBe('IH-07');
  });

  it('every Lane 1 entry carries a populated state', () => {
    const rec = fullRecord({
      'IH-06': { state: 'measured', value: '4' },
      'BC-08': { state: 'no_rto_defined' },
      'BC-04': { state: 'no_thresholds_defined' },
    });
    const view = pv(rec);
    expect(view.lane1.entries.length).toBeGreaterThan(0);
    for (const e of view.lane1.entries) {
      expect(e.state).toBeTruthy();
      expect(typeof e.state).toBe('string');
    }
  });

  it('programme-gap zero vs performance zero are distinguishable by state on the Lane 1 entry', () => {
    const rec = fullRecord({
      'BC-08': { state: 'no_rto_defined' },                  // programme-gap zero
      'BC-01': { state: 'measured', value: '0' },            // performance zero (0% → score 0)
    });
    const view = pv(rec);
    const bc08 = view.lane1.entries.find(e => e.indicatorId === 'BC-08');
    const bc01 = view.lane1.entries.find(e => e.indicatorId === 'BC-01');
    expect(bc08.score).toBe(0);
    expect(bc01.score).toBe(0);
    // Same score, different kind — distinguished by state
    expect(bc08.state).toBe('no_rto_defined');
    expect(bc01.state).toBe('measured');
    expect(bc08.state).not.toBe(bc01.state);
  });

  it('programmeGap flag carried onto Lane 1 entries (true for programme-gap zero, false for performance zero)', () => {
    const rec = fullRecord({
      'BC-08': { state: 'no_rto_defined' },
      'BC-01': { state: 'measured', value: '0' },
    });
    const view = pv(rec);
    expect(view.lane1.entries.find(e => e.indicatorId === 'BC-08').programmeGap).toBe(true);
    expect(view.lane1.entries.find(e => e.indicatorId === 'BC-01').programmeGap).toBe(false);
  });
});

// ===========================================================================
// Lane 2 count-based severity boundaries
// ===========================================================================

describe('Lane 2 count-based severity', () => {
  it('IH: 1 not-measurable → high', () => {
    const rec = fullRecord({ 'IH-06': { state: 'not_measurable' } });
    expect(pv(rec).lane2.ih.severity).toBe('high');
  });

  it('IH: 2 of 3 not-measurable → high', () => {
    const rec = fullRecord({ 'IH-06': { state: 'not_measurable' }, 'IH-07': { state: 'not_measurable' } });
    const view = pv(rec);
    expect(view.lane2.ih.count).toBe(2);
    expect(view.lane2.ih.severity).toBe('high');
  });

  it('IH: 3 of 3 not-measurable → critical (total blackout)', () => {
    const rec = fullRecord({
      'IH-06': { state: 'not_measurable' },
      'IH-07': { state: 'not_measurable' },
      'IH-08': { state: 'not_measurable' },
    });
    const view = pv(rec);
    expect(view.lane2.ih.count).toBe(3);
    expect(view.lane2.ih.severity).toBe('critical');
  });

  it('BC: 4 of 5 not-measurable → high', () => {
    const rec = fullRecord({
      'BC-01': { state: 'not_measurable' },
      'BC-02': { state: 'not_measurable' },
      'BC-04': { state: 'not_measurable' },
      'BC-08': { state: 'not_measurable' },
    });
    const view = pv(rec);
    expect(view.lane2.bc.count).toBe(4);
    expect(view.lane2.bc.severity).toBe('high');
  });

  it('BC: 5 of 5 not-measurable → critical (total blackout)', () => {
    const rec = fullRecord({
      'BC-01': { state: 'not_measurable' },
      'BC-02': { state: 'not_measurable' },
      'BC-04': { state: 'not_measurable' },
      'BC-08': { state: 'not_measurable' },
      'BC-09': { state: 'not_measurable' },
    });
    const view = pv(rec);
    expect(view.lane2.bc.count).toBe(5);
    expect(view.lane2.bc.severity).toBe('critical');
  });

  it('0 not-measurable → severity null per measure', () => {
    const rec = fullRecord({ 'IH-06': { state: 'measured', value: '4' } });
    const view = pv(rec);
    expect(view.lane2.ih.severity).toBeNull();
    expect(view.lane2.bc.severity).toBeNull();
  });
});

// ===========================================================================
// Lane 2 grouping + severity-independence
// ===========================================================================

describe('Lane 2 root-cause grouping', () => {
  it('two not-measurable with SAME reason text → one self-created group', () => {
    const rec = fullRecord({
      'BC-08': { state: 'not_measurable', reason: { text: 'no incident-timestamp process' } },
      'BC-09': { state: 'not_measurable', reason: { text: 'no incident-timestamp process' } },
    });
    const view = pv(rec);
    expect(view.lane2.groups).toHaveLength(1);
    expect(view.lane2.groups[0].kind).toBe('self_created');
    expect(view.lane2.groups[0].affectedIndicators).toEqual(['BC-08', 'BC-09']);
  });

  it('two not-measurable with DIFFERENT reasons → two groups', () => {
    const rec = fullRecord({
      'BC-08': { state: 'not_measurable', reason: { text: 'reason alpha' } },
      'BC-09': { state: 'not_measurable', reason: { text: 'reason beta' } },
    });
    expect(pv(rec).lane2.groups).toHaveLength(2);
  });

  it('grouping does NOT change count-based severity: 3 same-reason IH still Critical', () => {
    const rec = fullRecord({
      'IH-06': { state: 'not_measurable', reason: { text: 'shared cause' } },
      'IH-07': { state: 'not_measurable', reason: { text: 'shared cause' } },
      'IH-08': { state: 'not_measurable', reason: { text: 'shared cause' } },
    });
    const view = pv(rec);
    expect(view.lane2.groups).toHaveLength(1);             // grouped into one
    expect(view.lane2.ih.count).toBe(3);                   // count still 3
    expect(view.lane2.ih.severity).toBe('critical');       // severity still Critical
  });
});

// ===========================================================================
// E↔F linking
// ===========================================================================

describe('Lane 2 E↔F linking', () => {
  it('reason mapping to a Layer 0 item with an active flag → layer0_link with linkedFlagExists true', () => {
    const rec = fullRecord(
      { 'BC-08': { state: 'not_measurable', reason: { layer0ItemId: 'L0-bc-plan-doc', text: 'BC plan missing' } } },
      { 'L0-bc-plan-doc': { state: L0_STATE.MISSING } }   // raises a Critical Layer 0 flag
    );
    const view = pv(rec);
    const grp = view.lane2.groups.find(g => g.kind === 'layer0_link');
    expect(grp).toBeDefined();
    expect(grp.linkedLayer0ItemId).toBe('L0-bc-plan-doc');
    expect(grp.linkedFlagExists).toBe(true);
    expect(grp.linkedFlagSeverity).toBe('critical');
    expect(grp.affectedIndicators).toEqual(['BC-08']);
  });

  it('reason mapping to a Layer 0 item that is HEALTHY (no flag) → layer0_link with linkedFlagExists false (mismatch)', () => {
    const rec = fullRecord(
      { 'BC-08': { state: 'not_measurable', reason: { layer0ItemId: 'L0-bc-plan-doc', text: 'BC plan missing' } } },
      { 'L0-bc-plan-doc': { state: L0_STATE.PRESENT } }   // healthy → no flag
    );
    const grp = pv(rec).lane2.groups.find(g => g.kind === 'layer0_link');
    expect(grp.linkedLayer0ItemId).toBe('L0-bc-plan-doc');
    expect(grp.linkedFlagExists).toBe(false);
    expect(grp.linkedFlagSeverity).toBeNull();
  });

  it('reason NOT mapping to a Layer 0 item → self_created flag', () => {
    const rec = fullRecord({
      'BC-08': { state: 'not_measurable', reason: { text: 'no incident-timestamp recording process exists' } },
    });
    const grp = pv(rec).lane2.groups[0];
    expect(grp.kind).toBe('self_created');
    expect(grp.selfFlag).toBeDefined();
    expect(grp.selfFlag.message).toMatch(/Evidence-infrastructure gap/i);
  });

  it('reason.layer0ItemId set but NOT one of the nine → falls back to self_created', () => {
    const rec = fullRecord({
      'BC-08': { state: 'not_measurable', reason: { layer0ItemId: 'NOT-A-REAL-ITEM', text: 'bogus' } },
    });
    expect(pv(rec).lane2.groups[0].kind).toBe('self_created');
  });

  it('two not-measurable both citing the same Layer 0 item → one linked group with both beneath it', () => {
    const rec = fullRecord(
      {
        'BC-08': { state: 'not_measurable', reason: { layer0ItemId: 'L0-bc-plan-doc', text: 'BC plan missing' } },
        'BC-09': { state: 'not_measurable', reason: { layer0ItemId: 'L0-bc-plan-doc', text: 'BC plan missing' } },
      },
      { 'L0-bc-plan-doc': { state: L0_STATE.MISSING } }
    );
    const view = pv(rec);
    const linked = view.lane2.groups.filter(g => g.kind === 'layer0_link');
    expect(linked).toHaveLength(1);
    expect(linked[0].affectedIndicators).toEqual(['BC-08', 'BC-09']);
    // count still 2 regardless of single grouping
    expect(view.lane2.bc.count).toBe(2);
  });
});

// ===========================================================================
// No-reason behavior
// ===========================================================================

describe('Lane 2 no-reason behavior', () => {
  it('not-measurable with NO reason → ungrouped_no_reason standalone, needsReason true', () => {
    const rec = fullRecord({ 'BC-08': { state: 'not_measurable' } });
    const grp = pv(rec).lane2.groups[0];
    expect(grp.kind).toBe('ungrouped_no_reason');
    expect(grp.needsReason).toBe(true);
    expect(grp.affectedIndicators).toEqual(['BC-08']);
  });

  it('two not-measurable both without reason → two separate ungrouped entries (never merged)', () => {
    const rec = fullRecord({
      'BC-08': { state: 'not_measurable' },
      'BC-09': { state: 'not_measurable' },
    });
    const ungrouped = pv(rec).lane2.groups.filter(g => g.kind === 'ungrouped_no_reason');
    expect(ungrouped).toHaveLength(2);
  });

  it('no-reason indicators still count toward count-based severity', () => {
    const rec = fullRecord({
      'IH-06': { state: 'not_measurable' },
      'IH-07': { state: 'not_measurable' },
      'IH-08': { state: 'not_measurable' },
    });
    expect(pv(rec).lane2.ih.severity).toBe('critical');
  });
});

// ===========================================================================
// unassigned: invalid_input vs unset stay DISTINCT
// ===========================================================================

describe('unassigned — invalid_input vs unset distinction', () => {
  it('unset (nothing entered) → unassigned with reason "unset"', () => {
    const rec = fullRecord({});   // everything blank
    const view = pv(rec);
    expect(view.unassigned.length).toBe(8);
    for (const u of view.unassigned) expect(u.reason).toBe('unset');
  });

  it('measured-with-invalid-input → unassigned with reason "invalid_input"', () => {
    const rec = fullRecord({
      'BC-08': { state: 'measured', numerator: '11', denominator: '10' },   // 110% invalid
      'IH-06': { state: 'measured', value: '-5' },                          // negative invalid
    });
    const view = pv(rec);
    const bc08 = view.unassigned.find(u => u.indicatorId === 'BC-08');
    const ih06 = view.unassigned.find(u => u.indicatorId === 'IH-06');
    expect(bc08.reason).toBe('invalid_input');
    expect(ih06.reason).toBe('invalid_input');
  });

  it('invalid_input and unset coexist distinctly in the same view (not collapsed)', () => {
    const rec = fullRecord({
      'BC-08': { state: 'measured', numerator: '11', denominator: '10' },   // invalid_input
      // everything else unset
    });
    const view = pv(rec);
    const reasons = new Set(view.unassigned.map(u => u.reason));
    expect(reasons.has('invalid_input')).toBe(true);
    expect(reasons.has('unset')).toBe(true);
    expect(view.unassigned.find(u => u.indicatorId === 'BC-08').reason).toBe('invalid_input');
  });

  it('invalid-input indicators do NOT leak into Lane 1', () => {
    const rec = fullRecord({ 'BC-08': { state: 'measured', numerator: '11', denominator: '10' } });
    const view = pv(rec);
    expect(view.lane1.entries.find(e => e.indicatorId === 'BC-08')).toBeUndefined();
  });
});

// ===========================================================================
// Additive reason field — Stage 1 scoring regression
// ===========================================================================

describe('additive reason field does not disturb Stage 1 scoring', () => {
  it('identical record with and without reason scores identically', () => {
    const withoutReason = fullRecord({ 'BC-08': { state: 'measured', numerator: '9', denominator: '10' } });
    const withReason = fullRecord({
      'BC-08': { state: 'measured', numerator: '9', denominator: '10', reason: { text: 'ignored when measured' } },
    });
    expect(computeAssessment(withReason)).toEqual(computeAssessment(withoutReason));
  });

  it('reason on a not-measurable indicator does not affect its (null) score', () => {
    const a = scoreIndicator('BC-08', { state: 'not_measurable' });
    const b = scoreIndicator('BC-08', { state: 'not_measurable', reason: { layer0ItemId: 'L0-bc-plan-doc', text: 'x' } });
    expect(a.score).toBe(b.score);
    expect(a.score).toBeNull();
  });
});

// ===========================================================================
// Purity / determinism
// ===========================================================================

describe('purity and determinism', () => {
  it('does not mutate inputs', () => {
    const rec = fullRecord({ 'IH-06': { state: 'not_measurable', reason: { text: 'x' } } });
    const l1 = computeAssessment(rec);
    const l0 = computeLayer0(rec);
    const snap = JSON.stringify({ rec, l1, l0 });
    computePriorityView(rec, l1, l0);
    expect(JSON.stringify({ rec, l1, l0 })).toBe(snap);
  });

  it('same inputs → deep-equal output', () => {
    const rec = fullRecord(
      { 'BC-08': { state: 'not_measurable', reason: { layer0ItemId: 'L0-bc-plan-doc', text: 'BC plan missing' } } },
      { 'L0-bc-plan-doc': { state: L0_STATE.MISSING } }
    );
    const l1 = computeAssessment(rec);
    const l0 = computeLayer0(rec);
    expect(computePriorityView(rec, l1, l0)).toEqual(computePriorityView(rec, l1, l0));
  });
});
