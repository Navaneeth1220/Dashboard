/**
 * Layer 0 engine test suite — Stage 2
 *
 * Covers:
 *   - Per-item allowed-state sets (all 9 items, including new RM context-only states)
 *   - RM-04/05 band scoring (all bands, boundary edges)
 *   - RM-04/05 4-state severity mapping (measured/not_measurable/process_absent/context-only)
 *   - Skipped-action vs absent-observation distinction
 *   - No-auto-rank rule and asset-inventory contextual note
 *   - Within-tier display ordering (groups 1–5)
 *   - not_verifiable tag/displayGroup override
 *   - Layer 0 / Layer 1 engine firewall
 *   - Action flag sort order
 *   - processGap flag on process_absent
 *   - medium_note emitted; monitor NOT emitted; score 4 NOT emitted
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateItem,
  generateActionFlags,
  computeLayer0,
  createBlankLayer0,
} from './layer0.js';
import { computeAssessment, createBlankAssessment } from './scoring.js';
import {
  LAYER0_ITEMS,
  LAYER0_ALL_IDS,
  LAYER0_0A_IDS,
  LAYER0_0B_IDS,
  L0_STATE,
  L0_TAG,
  L0_SEVERITY,
  L0_CONTEXT_ONLY_STATES,
} from '../data/layer0Definitions.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecord(layer0Overrides = {}) {
  return {
    ...createBlankAssessment(),
    layer0: { ...createBlankLayer0(), ...layer0Overrides },
  };
}

const q = (state) => ({ state });                              // qualitative input
const rv = (num, den) => ({ state: L0_STATE.MEASURED, numerator: String(num), denominator: String(den) });
const sv = (val) => ({ state: L0_STATE.MEASURED, value: String(val) });

// ---------------------------------------------------------------------------
// 1. Per-item allowed-state sets
// ---------------------------------------------------------------------------

describe('per-item allowed-state sets', () => {
  it('standard 0A items have exactly: present/missing/incomplete_outdated/not_verifiable', () => {
    const standard0A = ['L0-asset-inventory', 'L0-risk-assessment', 'L0-interdependency', 'L0-it-ot-boundary', 'L0-bc-plan-doc'];
    const expected = new Set([L0_STATE.PRESENT, L0_STATE.MISSING, L0_STATE.INCOMPLETE_OUTDATED, L0_STATE.NOT_VERIFIABLE]);
    for (const id of standard0A) {
      expect(new Set(LAYER0_ITEMS[id].allowedStates)).toEqual(expected);
    }
  });

  it('L0-multi-homed has item-specific vocabulary (no "present" or "missing")', () => {
    const states = LAYER0_ITEMS['L0-multi-homed'].allowedStates;
    expect(states).toContain(L0_STATE.REQUIREMENT_SATISFIED);
    expect(states).toContain(L0_STATE.UNCONTROLLED_MULTI_HOMING_FOUND);
    expect(states).toContain(L0_STATE.INCOMPLETE_OUTDATED_EVIDENCE);
    expect(states).toContain(L0_STATE.NOT_VERIFIABLE);
    expect(states).not.toContain(L0_STATE.PRESENT);
    expect(states).not.toContain(L0_STATE.MISSING);
    expect(states).toHaveLength(4);
  });

  it('L0-bc-plan-tested has its specific vocabulary', () => {
    const states = LAYER0_ITEMS['L0-bc-plan-tested'].allowedStates;
    expect(states).toContain(L0_STATE.QUALIFYING_TEST_PERFORMED);
    expect(states).toContain(L0_STATE.NO_QUALIFYING_TEST);
    expect(states).toContain(L0_STATE.INCOMPLETE_OUTDATED);
    expect(states).toContain(L0_STATE.NOT_VERIFIABLE);
    expect(states).toHaveLength(4);
  });

  it('RM-04 has 4 states including context-only no_qualifying_vulnerability', () => {
    const states = LAYER0_ITEMS['RM-04'].allowedStates;
    expect(states).toContain(L0_STATE.MEASURED);
    expect(states).toContain(L0_STATE.NOT_MEASURABLE);
    expect(states).toContain(L0_STATE.PROCESS_ABSENT);
    expect(states).toContain(L0_STATE.NO_QUALIFYING_VULNERABILITY);
    expect(states).toHaveLength(4);
  });

  it('RM-05 has 4 states including context-only no_remediated_vulnerabilities', () => {
    const states = LAYER0_ITEMS['RM-05'].allowedStates;
    expect(states).toContain(L0_STATE.MEASURED);
    expect(states).toContain(L0_STATE.NOT_MEASURABLE);
    expect(states).toContain(L0_STATE.PROCESS_ABSENT);
    expect(states).toContain(L0_STATE.NO_REMEDIATED_VULNERABILITIES);
    expect(states).toHaveLength(4);
  });

  it('RM-04 and RM-05 do NOT have standard 0A states', () => {
    for (const id of ['RM-04', 'RM-05']) {
      expect(LAYER0_ITEMS[id].allowedStates).not.toContain(L0_STATE.PRESENT);
      expect(LAYER0_ITEMS[id].allowedStates).not.toContain(L0_STATE.MISSING);
    }
  });

  it('context-only states are in L0_CONTEXT_ONLY_STATES set', () => {
    expect(L0_CONTEXT_ONLY_STATES.has(L0_STATE.NO_QUALIFYING_VULNERABILITY)).toBe(true);
    expect(L0_CONTEXT_ONLY_STATES.has(L0_STATE.NO_REMEDIATED_VULNERABILITIES)).toBe(true);
    expect(L0_CONTEXT_ONLY_STATES.has(L0_STATE.MISSING)).toBe(false);
    expect(L0_CONTEXT_ONLY_STATES.has(L0_STATE.NOT_MEASURABLE)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. RM-04 band scoring
// ---------------------------------------------------------------------------

describe('RM-04 band scoring (higher_is_better, %)', () => {
  // Contiguous intervals: [90,+∞)→4 · [70,90)→3 · [50,70)→2 · [1,50)→1 · [0,1)→0
  it('exactly 90% → score 4', () => expect(evaluateItem('RM-04', rv(90, 100)).processScore).toBe(4));
  it('89.999% → score 3', () => expect(evaluateItem('RM-04', rv(89999, 100000)).processScore).toBe(3));
  it('exactly 70% → score 3', () => expect(evaluateItem('RM-04', rv(70, 100)).processScore).toBe(3));
  it('69.999% → score 2', () => expect(evaluateItem('RM-04', rv(69999, 100000)).processScore).toBe(2));
  it('exactly 50% → score 2', () => expect(evaluateItem('RM-04', rv(50, 100)).processScore).toBe(2));
  it('49.999% → score 1', () => expect(evaluateItem('RM-04', rv(49999, 100000)).processScore).toBe(1));
  it('exactly 1% → score 1', () => expect(evaluateItem('RM-04', rv(1, 100)).processScore).toBe(1));
  it('0% → score 0 (band fallthrough)', () => expect(evaluateItem('RM-04', rv(0, 100)).processScore).toBe(0));
  it('100% → score 4', () => expect(evaluateItem('RM-04', rv(100, 100)).processScore).toBe(4));
});

// ---------------------------------------------------------------------------
// 3. RM-05 band scoring
// ---------------------------------------------------------------------------

describe('RM-05 band scoring (lower_is_better, days)', () => {
  // Contiguous intervals: (−∞,30]→4 · (30,90]→3 · (90,180]→2 · (180,365]→1 · (365,+∞)→0
  it('exactly 30 days → score 4', () => expect(evaluateItem('RM-05', sv(30)).processScore).toBe(4));
  it('30.001 days → score 3', () => expect(evaluateItem('RM-05', sv(30.001)).processScore).toBe(3));
  it('exactly 90 days → score 3', () => expect(evaluateItem('RM-05', sv(90)).processScore).toBe(3));
  it('90.001 days → score 2', () => expect(evaluateItem('RM-05', sv(90.001)).processScore).toBe(2));
  it('exactly 180 days → score 2', () => expect(evaluateItem('RM-05', sv(180)).processScore).toBe(2));
  it('180.001 days → score 1', () => expect(evaluateItem('RM-05', sv(180.001)).processScore).toBe(1));
  it('exactly 365 days → score 1', () => expect(evaluateItem('RM-05', sv(365)).processScore).toBe(1));
  it('365.001 days → score 0 (band fallthrough)', () => expect(evaluateItem('RM-05', sv(365.001)).processScore).toBe(0));
  it('1 day → score 4', () => expect(evaluateItem('RM-05', sv(1)).processScore).toBe(4));
});

// ---------------------------------------------------------------------------
// 4. RM-04 four-state severity mapping
// ---------------------------------------------------------------------------

describe('RM-04 four-state severity mapping', () => {
  it('measured score 4 → severity null (not flagged)', () =>
    expect(evaluateItem('RM-04', rv(95, 100)).severity).toBeNull());

  it('measured score 3 → severity monitor (not emitted in flags)', () =>
    expect(evaluateItem('RM-04', rv(75, 100)).severity).toBe(L0_SEVERITY.MONITOR));

  it('measured score 2 → severity medium_note', () =>
    expect(evaluateItem('RM-04', rv(55, 100)).severity).toBe(L0_SEVERITY.MEDIUM_NOTE));

  it('measured score 1 → severity high', () =>
    expect(evaluateItem('RM-04', rv(30, 100)).severity).toBe(L0_SEVERITY.HIGH));

  it('measured score 0 → severity critical (bad performance)', () =>
    expect(evaluateItem('RM-04', rv(0, 100)).severity).toBe(L0_SEVERITY.CRITICAL));

  it('not_measurable → severity high', () =>
    expect(evaluateItem('RM-04', { state: L0_STATE.NOT_MEASURABLE }).severity).toBe(L0_SEVERITY.HIGH));

  it('process_absent → severity critical', () =>
    expect(evaluateItem('RM-04', { state: L0_STATE.PROCESS_ABSENT }).severity).toBe(L0_SEVERITY.CRITICAL));

  it('no_qualifying_vulnerability → severity null (context-only non-event, NOT flagged)', () => {
    const r = evaluateItem('RM-04', { state: L0_STATE.NO_QUALIFYING_VULNERABILITY });
    expect(r.severity).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. RM-05 four-state severity mapping
// ---------------------------------------------------------------------------

describe('RM-05 four-state severity mapping', () => {
  it('measured score 4 → null', () => expect(evaluateItem('RM-05', sv(15)).severity).toBeNull());
  it('measured score 3 → monitor', () => expect(evaluateItem('RM-05', sv(60)).severity).toBe(L0_SEVERITY.MONITOR));
  it('measured score 2 → medium_note', () => expect(evaluateItem('RM-05', sv(120)).severity).toBe(L0_SEVERITY.MEDIUM_NOTE));
  it('measured score 1 → high', () => expect(evaluateItem('RM-05', sv(250)).severity).toBe(L0_SEVERITY.HIGH));
  it('measured score 0 → critical', () => expect(evaluateItem('RM-05', sv(400)).severity).toBe(L0_SEVERITY.CRITICAL));
  it('not_measurable → high', () => expect(evaluateItem('RM-05', { state: L0_STATE.NOT_MEASURABLE }).severity).toBe(L0_SEVERITY.HIGH));
  it('process_absent → critical', () => expect(evaluateItem('RM-05', { state: L0_STATE.PROCESS_ABSENT }).severity).toBe(L0_SEVERITY.CRITICAL));

  it('no_remediated_vulnerabilities → severity null (context-only, NOT flagged)', () => {
    const r = evaluateItem('RM-05', { state: L0_STATE.NO_REMEDIATED_VULNERABILITIES });
    expect(r.severity).toBeNull();
  });

  it('no_remediated_vulnerabilities message contains the "interpret alongside RM-04" caveat and does NOT read as all-clear', () => {
    const r = evaluateItem('RM-05', { state: L0_STATE.NO_REMEDIATED_VULNERABILITIES });
    // Exact caveat phrase required by spec (RM-05 non-event is ambiguous, not positive)
    expect(r.message).toContain('interpret alongside RM-04');
    // Must NOT imply "all clear" / good / no issues
    expect(r.message).not.toMatch(/all clear|no issues|good|healthy|fine/i);
  });
});

// ---------------------------------------------------------------------------
// 6. Skipped-action vs absent-observation distinction (§6 spec rule)
// ---------------------------------------------------------------------------

describe('skipped-action vs absent-observation distinction', () => {
  it('BC plan tested no_qualifying_test → High, isSkippedAction true, message reads as gap', () => {
    const r = evaluateItem('L0-bc-plan-tested', q(L0_STATE.NO_QUALIFYING_TEST));
    expect(r.severity).toBe(L0_SEVERITY.HIGH);
    expect(r.isSkippedAction).toBe(true);
    // Message must read as a gap (a scheduled action was not performed)
    expect(r.message).toMatch(/not performed|not completed|not carried out/i);
  });

  it('no_qualifying_vulnerability NOT emitted in action flags (neutral non-event)', () => {
    const rec = makeRecord({ 'RM-04': { state: L0_STATE.NO_QUALIFYING_VULNERABILITY } });
    const { actionFlags } = computeLayer0(rec);
    expect(actionFlags.find(f => f.itemId === 'RM-04')).toBeUndefined();
  });

  it('no_remediated_vulnerabilities NOT emitted in action flags (neutral non-event)', () => {
    const rec = makeRecord({ 'RM-05': { state: L0_STATE.NO_REMEDIATED_VULNERABILITIES } });
    const { actionFlags } = computeLayer0(rec);
    expect(actionFlags.find(f => f.itemId === 'RM-05')).toBeUndefined();
  });

  it('both RM context-only states together → zero total flags (not null/monitor entries that still render)', () => {
    const rec = makeRecord({
      'RM-04': { state: L0_STATE.NO_QUALIFYING_VULNERABILITY },
      'RM-05': { state: L0_STATE.NO_REMEDIATED_VULNERABILITIES },
    });
    // Only these two items have non-null state; everything else is unset (null state → no flag).
    expect(computeLayer0(rec).actionFlags).toHaveLength(0);
  });

  it('no_qualifying_test is emitted but non-events are not — both in same record', () => {
    const rec = makeRecord({
      'L0-bc-plan-tested': q(L0_STATE.NO_QUALIFYING_TEST),
      'RM-04': { state: L0_STATE.NO_QUALIFYING_VULNERABILITY },
      'RM-05': { state: L0_STATE.NO_REMEDIATED_VULNERABILITIES },
    });
    const { actionFlags } = computeLayer0(rec);
    const bcTested = actionFlags.find(f => f.itemId === 'L0-bc-plan-tested');
    const rm04 = actionFlags.find(f => f.itemId === 'RM-04');
    const rm05 = actionFlags.find(f => f.itemId === 'RM-05');
    expect(bcTested).toBeDefined();
    expect(bcTested.severity).toBe(L0_SEVERITY.HIGH);
    expect(rm04).toBeUndefined();
    expect(rm05).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 7. No-auto-rank rule (§6.2)
// ---------------------------------------------------------------------------

describe('no-auto-rank rule', () => {
  it('only asset-inventory has a contextualNote; all other items have contextualNote null', () => {
    // Make every item flagged (Critical)
    const rec = makeRecord({
      'L0-asset-inventory':   q(L0_STATE.MISSING),
      'L0-risk-assessment':   q(L0_STATE.MISSING),
      'L0-interdependency':   q(L0_STATE.MISSING),
      'L0-it-ot-boundary':    q(L0_STATE.MISSING),
      'L0-multi-homed':       q(L0_STATE.UNCONTROLLED_MULTI_HOMING_FOUND),
      'L0-bc-plan-doc':       q(L0_STATE.MISSING),
      'RM-04':                { state: L0_STATE.PROCESS_ABSENT },
      'RM-05':                { state: L0_STATE.PROCESS_ABSENT },
      'L0-bc-plan-tested':    q(L0_STATE.NO_QUALIFYING_TEST),
    });
    const { actionFlags } = computeLayer0(rec);

    for (const flag of actionFlags) {
      if (flag.itemId === 'L0-asset-inventory') {
        expect(flag.contextualNote).not.toBeNull();
        expect(flag.contextualNote).toMatch(/consider addressing first/i);
      } else {
        expect(flag.contextualNote).toBeNull();
      }
    }
  });

  it('asset-inventory contextualNote absent when item is healthy (present)', () => {
    const r = evaluateItem('L0-asset-inventory', q(L0_STATE.PRESENT));
    expect(r.contextualNote).toBeNull();
  });

  it('asset-inventory contextualNote present when missing (Critical)', () => {
    const r = evaluateItem('L0-asset-inventory', q(L0_STATE.MISSING));
    expect(r.contextualNote).toContain('consider addressing first');
  });

  it('asset-inventory contextualNote present when incomplete (High)', () => {
    const r = evaluateItem('L0-asset-inventory', q(L0_STATE.INCOMPLETE_OUTDATED));
    expect(r.contextualNote).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 8. Within-tier display ordering (§9)
// ---------------------------------------------------------------------------

describe('within-tier display ordering', () => {
  it('architecture items (group 1) sort before scope-definition (group 2) at same severity', () => {
    const rec = makeRecord({
      'L0-it-ot-boundary':   q(L0_STATE.MISSING),     // group 1, Critical
      'L0-asset-inventory':  q(L0_STATE.MISSING),      // group 2, Critical
      'L0-risk-assessment':  q(L0_STATE.MISSING),      // group 2, Critical
    });
    const { actionFlags } = computeLayer0(rec);
    const criticals = actionFlags.filter(f => f.severity === L0_SEVERITY.CRITICAL);
    const itOtIdx = criticals.findIndex(f => f.itemId === 'L0-it-ot-boundary');
    const assetIdx = criticals.findIndex(f => f.itemId === 'L0-asset-inventory');
    expect(itOtIdx).toBeLessThan(assetIdx);
  });

  it('scope-definition (group 2) sorts before continuity foundation (group 3) at same severity', () => {
    const rec = makeRecord({
      'L0-bc-plan-doc':      q(L0_STATE.MISSING),      // group 3, Critical
      'L0-risk-assessment':  q(L0_STATE.MISSING),      // group 2, Critical
    });
    const { actionFlags } = computeLayer0(rec);
    const criticals = actionFlags.filter(f => f.severity === L0_SEVERITY.CRITICAL);
    const riskIdx = criticals.findIndex(f => f.itemId === 'L0-risk-assessment');
    const bcDocIdx = criticals.findIndex(f => f.itemId === 'L0-bc-plan-doc');
    expect(riskIdx).toBeLessThan(bcDocIdx);
  });

  it('process-evidence items (group 4) sort after continuity foundation (group 3)', () => {
    const rec = makeRecord({
      'RM-04':           { state: L0_STATE.PROCESS_ABSENT },  // group 4, Critical
      'L0-bc-plan-doc':  q(L0_STATE.MISSING),                  // group 3, Critical
    });
    const { actionFlags } = computeLayer0(rec);
    const criticals = actionFlags.filter(f => f.severity === L0_SEVERITY.CRITICAL);
    const bcDocIdx = criticals.findIndex(f => f.itemId === 'L0-bc-plan-doc');
    const rm04Idx = criticals.findIndex(f => f.itemId === 'RM-04');
    expect(bcDocIdx).toBeLessThan(rm04Idx);
  });

  it('severity overrides display group — Critical group-4 comes before High group-1', () => {
    const rec = makeRecord({
      'RM-04':              { state: L0_STATE.PROCESS_ABSENT }, // Critical group 4
      'L0-it-ot-boundary':  q(L0_STATE.INCOMPLETE_OUTDATED),   // High group 1
    });
    const { actionFlags } = computeLayer0(rec);
    const rm04Idx = actionFlags.findIndex(f => f.itemId === 'RM-04');
    const itOtIdx = actionFlags.findIndex(f => f.itemId === 'L0-it-ot-boundary');
    expect(rm04Idx).toBeLessThan(itOtIdx);
  });

  it('action flags are deterministically sorted — same record twice gives identical order', () => {
    const rec = makeRecord({
      'L0-asset-inventory': q(L0_STATE.MISSING),
      'L0-it-ot-boundary':  q(L0_STATE.INCOMPLETE_OUTDATED),
      'RM-04':              rv(30, 100),
      'L0-bc-plan-tested':  q(L0_STATE.NO_QUALIFYING_TEST),
    });
    const r1 = computeLayer0(rec).actionFlags.map(f => f.itemId);
    const r2 = computeLayer0(rec).actionFlags.map(f => f.itemId);
    expect(r1).toEqual(r2);
  });
});

// ---------------------------------------------------------------------------
// 9. not_verifiable tag/displayGroup override
// ---------------------------------------------------------------------------

describe('not_verifiable tag and displayGroup override', () => {
  it('not_verifiable on standard 0A → Evidence validation tag + displayGroup 5', () => {
    const r = evaluateItem('L0-asset-inventory', q(L0_STATE.NOT_VERIFIABLE));
    expect(r.tag).toBe(L0_TAG.EVIDENCE_VALIDATION);
    expect(r.displayGroup).toBe(5);
  });

  it('not_verifiable on architecture item (IT/OT boundary) → Evidence validation tag + displayGroup 5 (NOT Architecture/group 1)', () => {
    const r = evaluateItem('L0-it-ot-boundary', q(L0_STATE.NOT_VERIFIABLE));
    expect(r.tag).toBe(L0_TAG.EVIDENCE_VALIDATION);
    expect(r.displayGroup).toBe(5);
    expect(r.tag).not.toBe(L0_TAG.ARCHITECTURE);
    expect(r.displayGroup).not.toBe(1);
  });

  it('not_verifiable on multi-homed → Evidence validation tag + displayGroup 5', () => {
    const r = evaluateItem('L0-multi-homed', q(L0_STATE.NOT_VERIFIABLE));
    expect(r.tag).toBe(L0_TAG.EVIDENCE_VALIDATION);
    expect(r.displayGroup).toBe(5);
  });

  it('not_verifiable on BC plan tested → Evidence validation tag + displayGroup 5', () => {
    const r = evaluateItem('L0-bc-plan-tested', q(L0_STATE.NOT_VERIFIABLE));
    expect(r.tag).toBe(L0_TAG.EVIDENCE_VALIDATION);
    expect(r.displayGroup).toBe(5);
  });

  it('non-not_verifiable architecture state retains Architecture tag + group 1', () => {
    const rMissing = evaluateItem('L0-it-ot-boundary', q(L0_STATE.MISSING));
    expect(rMissing.tag).toBe(L0_TAG.ARCHITECTURE);
    expect(rMissing.displayGroup).toBe(1);

    const rIncomplete = evaluateItem('L0-it-ot-boundary', q(L0_STATE.INCOMPLETE_OUTDATED));
    expect(rIncomplete.tag).toBe(L0_TAG.ARCHITECTURE);
    expect(rIncomplete.displayGroup).toBe(1);
  });

  it('not_verifiable items sort AFTER non-not_verifiable items of same severity (group 5 last)', () => {
    const rec = makeRecord({
      'L0-it-ot-boundary':  q(L0_STATE.NOT_VERIFIABLE),    // High, group 5
      'L0-bc-plan-tested':  q(L0_STATE.NO_QUALIFYING_TEST), // High, group 4
      'L0-bc-plan-doc':     q(L0_STATE.INCOMPLETE_OUTDATED), // High, group 3
    });
    const highs = computeLayer0(rec).actionFlags.filter(f => f.severity === L0_SEVERITY.HIGH);
    const bcDocIdx    = highs.findIndex(f => f.itemId === 'L0-bc-plan-doc');
    const bcTestedIdx = highs.findIndex(f => f.itemId === 'L0-bc-plan-tested');
    const itOtIdx     = highs.findIndex(f => f.itemId === 'L0-it-ot-boundary');
    // group 3 < group 4 < group 5
    expect(bcDocIdx).toBeLessThan(bcTestedIdx);
    expect(bcTestedIdx).toBeLessThan(itOtIdx);
  });
});

// ---------------------------------------------------------------------------
// 10. Severity mapping — standard 0A states
// ---------------------------------------------------------------------------

describe('standard 0A state → severity mapping', () => {
  const std0A = ['L0-asset-inventory', 'L0-risk-assessment', 'L0-interdependency', 'L0-bc-plan-doc'];
  for (const id of std0A) {
    it(`${id} present → null`, () => expect(evaluateItem(id, q(L0_STATE.PRESENT)).severity).toBeNull());
    it(`${id} missing → critical`, () => expect(evaluateItem(id, q(L0_STATE.MISSING)).severity).toBe(L0_SEVERITY.CRITICAL));
    it(`${id} incomplete_outdated → high`, () => expect(evaluateItem(id, q(L0_STATE.INCOMPLETE_OUTDATED)).severity).toBe(L0_SEVERITY.HIGH));
    it(`${id} not_verifiable → high`, () => expect(evaluateItem(id, q(L0_STATE.NOT_VERIFIABLE)).severity).toBe(L0_SEVERITY.HIGH));
  }

  it('L0-it-ot-boundary missing → critical (architecture critical)', () =>
    expect(evaluateItem('L0-it-ot-boundary', q(L0_STATE.MISSING)).severity).toBe(L0_SEVERITY.CRITICAL));

  it('L0-multi-homed uncontrolled_found → critical', () =>
    expect(evaluateItem('L0-multi-homed', q(L0_STATE.UNCONTROLLED_MULTI_HOMING_FOUND)).severity).toBe(L0_SEVERITY.CRITICAL));

  it('L0-multi-homed requirement_satisfied → null', () =>
    expect(evaluateItem('L0-multi-homed', q(L0_STATE.REQUIREMENT_SATISFIED)).severity).toBeNull());
});

// ---------------------------------------------------------------------------
// 11. process_absent — processGap flag
// ---------------------------------------------------------------------------

describe('processGap flag on process_absent', () => {
  it('RM-04 process_absent → processGap true, severity critical', () => {
    const r = evaluateItem('RM-04', { state: L0_STATE.PROCESS_ABSENT });
    expect(r.processGap).toBe(true);
    expect(r.severity).toBe(L0_SEVERITY.CRITICAL);
  });

  it('RM-05 process_absent → processGap true, severity critical', () => {
    const r = evaluateItem('RM-05', { state: L0_STATE.PROCESS_ABSENT });
    expect(r.processGap).toBe(true);
    expect(r.severity).toBe(L0_SEVERITY.CRITICAL);
  });

  it('RM-04 measured score 0 → processGap false (performance failure, not process gap)', () => {
    const r = evaluateItem('RM-04', rv(0, 100));
    expect(r.processGap).toBe(false);
    expect(r.severity).toBe(L0_SEVERITY.CRITICAL);
  });

  it('standard 0A missing → processGap false', () => {
    expect(evaluateItem('L0-asset-inventory', q(L0_STATE.MISSING)).processGap).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 12. medium_note emitted; monitor and score-4 NOT emitted
// ---------------------------------------------------------------------------

describe('flag emission rules for RM process scores', () => {
  it('RM-04 score 2 → medium_note emitted in action flags', () => {
    const rec = makeRecord({ 'RM-04': rv(55, 100) });
    const flags = computeLayer0(rec).actionFlags;
    const rm04Flag = flags.find(f => f.itemId === 'RM-04');
    expect(rm04Flag).toBeDefined();
    expect(rm04Flag.severity).toBe(L0_SEVERITY.MEDIUM_NOTE);
  });

  it('RM-05 score 2 → medium_note emitted', () => {
    const rec = makeRecord({ 'RM-05': sv(120) });
    const flags = computeLayer0(rec).actionFlags;
    expect(flags.find(f => f.itemId === 'RM-05')?.severity).toBe(L0_SEVERITY.MEDIUM_NOTE);
  });

  it('RM-04 score 3 (monitor) → NOT in action flags', () => {
    const rec = makeRecord({ 'RM-04': rv(75, 100) });
    const flags = computeLayer0(rec).actionFlags;
    expect(flags.find(f => f.itemId === 'RM-04')).toBeUndefined();
  });

  it('RM-04 score 4 → NOT in action flags', () => {
    const rec = makeRecord({ 'RM-04': rv(95, 100) });
    const flags = computeLayer0(rec).actionFlags;
    expect(flags.find(f => f.itemId === 'RM-04')).toBeUndefined();
  });

  it('fully healthy record → empty action flags list', () => {
    const rec = makeRecord({
      'L0-asset-inventory': q(L0_STATE.PRESENT),
      'L0-risk-assessment': q(L0_STATE.PRESENT),
      'L0-interdependency': q(L0_STATE.PRESENT),
      'L0-it-ot-boundary':  q(L0_STATE.PRESENT),
      'L0-multi-homed':     q(L0_STATE.REQUIREMENT_SATISFIED),
      'L0-bc-plan-doc':     q(L0_STATE.PRESENT),
      'RM-04':              rv(95, 100),
      'RM-05':              sv(20),
      'L0-bc-plan-tested':  q(L0_STATE.QUALIFYING_TEST_PERFORMED),
    });
    expect(computeLayer0(rec).actionFlags).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 13. Layer 0 / Layer 1 engine firewall
// ---------------------------------------------------------------------------

describe('layer0-layer1-firewall', () => {
  it('computeAssessment ignores layer0 field — L1 scores unchanged when layer0 varies', () => {
    const base = makeRecord();
    const withLayer0 = {
      ...base,
      layer0: {
        ...base.layer0,
        'L0-asset-inventory': q(L0_STATE.MISSING),
        'RM-04': { state: L0_STATE.PROCESS_ABSENT },
      },
    };
    const r1 = computeAssessment(base);
    const r2 = computeAssessment(withLayer0);
    expect(r1.ih).toEqual(r2.ih);
    expect(r1.bc).toEqual(r2.bc);
    expect(r1.overall).toEqual(r2.overall);
  });

  it('computeLayer0 ignores indicators field — L0 results unchanged when L1 indicators vary', () => {
    const base = makeRecord({ 'L0-asset-inventory': q(L0_STATE.MISSING) });
    const withIndicators = {
      ...base,
      indicators: {
        ...base.indicators,
        'IH-06': { state: 'measured', value: '4' },
      },
    };
    const r1 = computeLayer0(base);
    const r2 = computeLayer0(withIndicators);
    expect(r1.items['L0-asset-inventory'].severity).toEqual(r2.items['L0-asset-inventory'].severity);
    expect(r1.actionFlags).toEqual(r2.actionFlags);
  });

  it('RM-04/05 process scores NEVER appear in computeAssessment output', () => {
    const rec = makeRecord({ 'RM-04': rv(20, 100), 'RM-05': sv(400) });
    const l1 = computeAssessment(rec);
    expect(l1.indicators['RM-04']).toBeUndefined();
    expect(l1.indicators['RM-05']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 14. Reference view grouping
// ---------------------------------------------------------------------------

describe('reference view grouping (groups 0A and 0B)', () => {
  it('0A group contains exactly 6 items in canonical order', () => {
    const { groups } = computeLayer0(makeRecord());
    expect(groups['0A'].map(i => i.id)).toEqual(LAYER0_0A_IDS);
  });

  it('0B group contains exactly 3 items in canonical order', () => {
    const { groups } = computeLayer0(makeRecord());
    expect(groups['0B'].map(i => i.id)).toEqual(LAYER0_0B_IDS);
  });

  it('groups contain all 9 items total', () => {
    const { groups } = computeLayer0(makeRecord());
    const total = groups['0A'].length + groups['0B'].length;
    expect(total).toBe(9);
  });

  it('subclass stored correctly on each item definition', () => {
    for (const id of LAYER0_0A_IDS) expect(LAYER0_ITEMS[id].subclass).toBe('0A');
    for (const id of LAYER0_0B_IDS) expect(LAYER0_ITEMS[id].subclass).toBe('0B');
  });
});

// ---------------------------------------------------------------------------
// 15. Input validation for RM items
// ---------------------------------------------------------------------------

describe('RM input validation', () => {
  it('RM-04 numerator > denominator → invalidInput', () => {
    const r = evaluateItem('RM-04', { state: L0_STATE.MEASURED, numerator: '11', denominator: '10' });
    expect(r.invalidInput).toBe(true);
    expect(r.severity).toBeNull();
  });

  it('RM-04 denominator 0 → invalidInput', () => {
    const r = evaluateItem('RM-04', { state: L0_STATE.MEASURED, numerator: '0', denominator: '0' });
    expect(r.invalidInput).toBe(true);
  });

  it('RM-05 negative days → invalidInput', () => {
    const r = evaluateItem('RM-05', { state: L0_STATE.MEASURED, value: '-5' });
    expect(r.invalidInput).toBe(true);
  });

  it('RM-05 non-numeric → invalidInput', () => {
    const r = evaluateItem('RM-05', { state: L0_STATE.MEASURED, value: 'abc' });
    expect(r.invalidInput).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 15b. Action-flag queryability for Stage 3 F-linking (E↔F)
// ---------------------------------------------------------------------------

describe('action-flag queryability by itemId (Stage 3 F-linking readiness)', () => {
  it('every flag carries a stable, non-empty itemId matching a known Layer 0 item', () => {
    const rec = makeRecord({
      'L0-asset-inventory': q(L0_STATE.MISSING),
      'L0-it-ot-boundary':  q(L0_STATE.INCOMPLETE_OUTDATED),
      'L0-bc-plan-doc':     q(L0_STATE.MISSING),
      'RM-04':              rv(30, 100),
      'L0-bc-plan-tested':  q(L0_STATE.NO_QUALIFYING_TEST),
    });
    const { actionFlags } = computeLayer0(rec);
    expect(actionFlags.length).toBeGreaterThan(0);
    for (const flag of actionFlags) {
      expect(typeof flag.itemId).toBe('string');
      expect(flag.itemId.length).toBeGreaterThan(0);
      expect(LAYER0_ALL_IDS).toContain(flag.itemId);
    }
  });

  it('BC-plan-documented item id is exactly "L0-bc-plan-doc"', () => {
    expect(LAYER0_ITEMS['L0-bc-plan-doc']).toBeDefined();
    expect(LAYER0_ITEMS['L0-bc-plan-doc'].id).toBe('L0-bc-plan-doc');
  });

  it('a Critical BC-plan-documented flag is findable by itemId (the exact Stage 3 BC-08/09 link query)', () => {
    const rec = makeRecord({ 'L0-bc-plan-doc': q(L0_STATE.MISSING) });
    const { actionFlags } = computeLayer0(rec);
    const bcPlanFlag = actionFlags.find(f => f.itemId === 'L0-bc-plan-doc');
    expect(bcPlanFlag).toBeDefined();
    expect(bcPlanFlag.severity).toBe(L0_SEVERITY.CRITICAL);
  });

  it('actionFlags contains at most one flag per itemId — lookup is unambiguous', () => {
    // Flag every item so the array is maximally populated
    const rec = makeRecord({
      'L0-asset-inventory': q(L0_STATE.MISSING),
      'L0-risk-assessment': q(L0_STATE.NOT_VERIFIABLE),
      'L0-interdependency': q(L0_STATE.INCOMPLETE_OUTDATED),
      'L0-it-ot-boundary':  q(L0_STATE.MISSING),
      'L0-multi-homed':     q(L0_STATE.UNCONTROLLED_MULTI_HOMING_FOUND),
      'L0-bc-plan-doc':     q(L0_STATE.MISSING),
      'RM-04':              rv(0, 100),
      'RM-05':              sv(400),
      'L0-bc-plan-tested':  q(L0_STATE.NO_QUALIFYING_TEST),
    });
    const { actionFlags } = computeLayer0(rec);
    const ids = actionFlags.map(f => f.itemId);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);  // no duplicate itemId
  });

  it('items map (not just flags) is keyed by itemId for items that are not flagged', () => {
    // Stage 3 may also need the item state even when it produced no flag (e.g. BC plan Present)
    const rec = makeRecord({ 'L0-bc-plan-doc': q(L0_STATE.PRESENT) });
    const { items, actionFlags } = computeLayer0(rec);
    expect(items['L0-bc-plan-doc'].state).toBe(L0_STATE.PRESENT);
    expect(actionFlags.find(f => f.itemId === 'L0-bc-plan-doc')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 16. Determinism / pure-function properties
// ---------------------------------------------------------------------------

describe('pure-function properties', () => {
  it('same record → deep-equal results', () => {
    const rec = makeRecord({ 'L0-asset-inventory': q(L0_STATE.MISSING), 'RM-04': rv(30, 100) });
    expect(computeLayer0(rec)).toEqual(computeLayer0(rec));
  });

  it('computeLayer0 does not mutate its input', () => {
    const rec = Object.freeze(makeRecord({ 'L0-bc-plan-doc': q(L0_STATE.MISSING) }));
    expect(() => computeLayer0(rec)).not.toThrow();
  });

  it('createBlankLayer0 produces null states for all 9 items', () => {
    const blank = createBlankLayer0();
    expect(Object.keys(blank)).toHaveLength(9);
    for (const v of Object.values(blank)) {
      expect(v.state).toBeNull();
    }
  });
});
