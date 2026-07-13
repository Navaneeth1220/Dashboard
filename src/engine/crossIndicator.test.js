/**
 * Cross-Indicator Logic test suite — Stage 3a (§5 rules A, B, C, D).
 *
 * Everything here is advisory; tests also confirm NO score is mutated.
 */

import { describe, it, expect } from 'vitest';
import {
  generateIHDependencyNotes,
  generateInterpretivePairs,
  generateArchitectureAdvisories,
  generateBCPlanHints,
  computeCrossIndicator,
  buildLayer1View,
  IH06_HARD_THRESHOLD,
  IH07_SOFT_THRESHOLD,
  IH08_HIGH_THRESHOLD,
  BC_LOW_THRESHOLD,
} from './crossIndicator.js';
import { STATE } from '../data/indicatorDefinitions.js';
import { L0_STATE } from '../data/layer0Definitions.js';
import { computeAssessment, createBlankAssessment } from './scoring.js';
import { computeLayer0, createBlankLayer0 } from './layer0.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Build a Layer 1 view map directly: { id: {state, score} }
function l1(overrides = {}) {
  const base = {
    'IH-06': { state: null, score: null },
    'IH-07': { state: null, score: null },
    'IH-08': { state: null, score: null },
    'BC-01': { state: null, score: null },
    'BC-02': { state: null, score: null },
    'BC-04': { state: null, score: null },
    'BC-08': { state: null, score: null },
    'BC-09': { state: null, score: null },
  };
  return { ...base, ...overrides };
}

const measured = (score) => ({ state: STATE.MEASURED, score });
const capAbsent = () => ({ state: STATE.CAPABILITY_ABSENT, score: 0 });
const notMeasurable = () => ({ state: STATE.NOT_MEASURABLE, score: null });
const noEvent = () => ({ state: STATE.NO_QUALIFYING_EVENT, score: null });
const noDisruption = () => ({ state: STATE.NO_QUALIFYING_DISRUPTION, score: null });

// Minimal layer0Result stub with item states
function layer0Stub(stateOverrides = {}) {
  const items = {};
  for (const [id, state] of Object.entries(stateOverrides)) {
    items[id] = { state };
  }
  return { items };
}

// ===========================================================================
// Rule A — IH dependency chain
// ===========================================================================

describe('Rule A — IH dependency chain', () => {
  it('IH-06 score 2 (< 3) → fires hard notes on IH-07 and IH-08', () => {
    const notes = generateIHDependencyNotes(l1({ 'IH-06': measured(2) }));
    const targets = notes.filter(n => n.severity === 'hard').map(n => n.target);
    expect(targets).toContain('IH-07');
    expect(targets).toContain('IH-08');
    expect(notes.filter(n => n.severity === 'hard')).toHaveLength(2);
  });

  it('IH-06 score 3 (not < 3) → no hard notes', () => {
    const notes = generateIHDependencyNotes(l1({ 'IH-06': measured(3) }));
    expect(notes.filter(n => n.source === 'IH-06')).toHaveLength(0);
  });

  it('IH-06 score 0 (capability-absent) IS < 3 → fires hard notes', () => {
    const notes = generateIHDependencyNotes(l1({ 'IH-06': capAbsent() }));
    expect(notes.filter(n => n.source === 'IH-06' && n.severity === 'hard')).toHaveLength(2);
  });

  it('IH-06 not_measurable (no-score) → does NOT fire (null is not < 3)', () => {
    const notes = generateIHDependencyNotes(l1({ 'IH-06': notMeasurable() }));
    expect(notes.filter(n => n.source === 'IH-06')).toHaveLength(0);
  });

  it('IH-06 no_qualifying_event (no-score) → does NOT fire', () => {
    const notes = generateIHDependencyNotes(l1({ 'IH-06': noEvent() }));
    expect(notes.filter(n => n.source === 'IH-06')).toHaveLength(0);
  });

  it('IH-07 score 1 (< 2) → fires soft note on IH-08', () => {
    const notes = generateIHDependencyNotes(l1({ 'IH-07': measured(1) }));
    const soft = notes.filter(n => n.severity === 'soft');
    expect(soft).toHaveLength(1);
    expect(soft[0].target).toBe('IH-08');
    expect(soft[0].source).toBe('IH-07');
  });

  it('IH-07 score 2 (not < 2) → no soft note', () => {
    const notes = generateIHDependencyNotes(l1({ 'IH-07': measured(2) }));
    expect(notes.filter(n => n.severity === 'soft')).toHaveLength(0);
  });

  it('IH-07 score 0 (capability-absent) IS < 2 → fires soft note', () => {
    const notes = generateIHDependencyNotes(l1({ 'IH-07': capAbsent() }));
    expect(notes.filter(n => n.severity === 'soft')).toHaveLength(1);
  });

  it('IH-07 not_measurable → does NOT fire soft note', () => {
    const notes = generateIHDependencyNotes(l1({ 'IH-07': notMeasurable() }));
    expect(notes.filter(n => n.severity === 'soft')).toHaveLength(0);
  });

  it('both IH-06 < 3 and IH-07 < 2 → IH-08 gets two notes (one hard, one soft)', () => {
    const notes = generateIHDependencyNotes(l1({ 'IH-06': measured(1), 'IH-07': measured(1) }));
    const ih08Notes = notes.filter(n => n.target === 'IH-08');
    expect(ih08Notes).toHaveLength(2);
    expect(ih08Notes.map(n => n.severity).sort()).toEqual(['hard', 'soft']);
  });

  it('all IH healthy (≥ thresholds) → no notes', () => {
    const notes = generateIHDependencyNotes(l1({ 'IH-06': measured(4), 'IH-07': measured(4), 'IH-08': measured(4) }));
    expect(notes).toHaveLength(0);
  });

  it('boundary: IH-06 exactly at threshold-1 fires, threshold does not', () => {
    expect(generateIHDependencyNotes(l1({ 'IH-06': measured(IH06_HARD_THRESHOLD - 1) })).length).toBeGreaterThan(0);
    expect(generateIHDependencyNotes(l1({ 'IH-06': measured(IH06_HARD_THRESHOLD) })).filter(n => n.source === 'IH-06')).toHaveLength(0);
  });
});

// ===========================================================================
// Rule B — interpretive pairs
// ===========================================================================

describe('Rule B — interpretive pairs', () => {
  const completeBC = (score) => ({ score, incomplete: false });
  const incompleteBC = () => ({ score: null, incomplete: true });

  it('returns exactly four pair markers', () => {
    const pairs = generateInterpretivePairs(l1(), completeBC(3));
    expect(pairs).toHaveLength(4);
    expect(pairs.map(p => p.pair)).toEqual([
      ['RM-04', 'RM-05'], ['BC-01', 'BC-02'], ['BC-08', 'BC-09'], ['IH-08', 'BC'],
    ]);
  });

  it('the three non-IH08 pairs NEVER carry an autoSentence', () => {
    // Even with extreme values, only IH-08↔BC may speak
    const pairs = generateInterpretivePairs(l1({ 'IH-08': measured(4) }), completeBC(0));
    const nonIH08 = pairs.filter(p => !(p.pair[0] === 'IH-08' && p.pair[1] === 'BC'));
    expect(nonIH08).toHaveLength(3);
    for (const p of nonIH08) expect(p.autoSentence).toBeNull();
  });

  it('IH-08 high (3) + BC low (1.99) → auto-sentence fires', () => {
    const pairs = generateInterpretivePairs(l1({ 'IH-08': measured(3) }), completeBC(1.99));
    const ih08Pair = pairs.find(p => p.pair[0] === 'IH-08');
    expect(ih08Pair.autoSentence).not.toBeNull();
    expect(ih08Pair.autoSentence.message).toMatch(/operationally costly|costly/i);
  });

  it('boundary: IH-08 = 3, BC exactly 2.0 → does NOT fire (2 is not < 2)', () => {
    const pairs = generateInterpretivePairs(l1({ 'IH-08': measured(3) }), completeBC(2.0));
    expect(pairs.find(p => p.pair[0] === 'IH-08').autoSentence).toBeNull();
  });

  it('boundary: IH-08 = 3, BC just under 2 (1.9999) → fires', () => {
    const pairs = generateInterpretivePairs(l1({ 'IH-08': measured(3) }), completeBC(1.9999));
    expect(pairs.find(p => p.pair[0] === 'IH-08').autoSentence).not.toBeNull();
  });

  it('IH-08 = 4, BC = 0 → fires', () => {
    const pairs = generateInterpretivePairs(l1({ 'IH-08': measured(4) }), completeBC(0));
    expect(pairs.find(p => p.pair[0] === 'IH-08').autoSentence).not.toBeNull();
  });

  it('IH-08 = 2 (not high), BC = 0 (low) → does NOT fire (IH-08 not high)', () => {
    const pairs = generateInterpretivePairs(l1({ 'IH-08': measured(2) }), completeBC(0));
    expect(pairs.find(p => p.pair[0] === 'IH-08').autoSentence).toBeNull();
  });

  it('IH-08 high, BC moderate (2.5) → does NOT fire (BC not low)', () => {
    const pairs = generateInterpretivePairs(l1({ 'IH-08': measured(4) }), completeBC(2.5));
    expect(pairs.find(p => p.pair[0] === 'IH-08').autoSentence).toBeNull();
  });

  it('INCOMPLETE BC suppresses the IH-08↔BC sentence even with high IH-08', () => {
    const pairs = generateInterpretivePairs(l1({ 'IH-08': measured(4) }), incompleteBC());
    expect(pairs.find(p => p.pair[0] === 'IH-08').autoSentence).toBeNull();
  });

  it('IH-08 no-score (not_measurable) + BC low → does NOT fire (IH-08 not high)', () => {
    const pairs = generateInterpretivePairs(l1({ 'IH-08': notMeasurable() }), completeBC(0));
    expect(pairs.find(p => p.pair[0] === 'IH-08').autoSentence).toBeNull();
  });

  it('IH-08 capability-absent (score 0) + BC low → does NOT fire (0 is not ≥ 3)', () => {
    const pairs = generateInterpretivePairs(l1({ 'IH-08': capAbsent() }), completeBC(0));
    expect(pairs.find(p => p.pair[0] === 'IH-08').autoSentence).toBeNull();
  });

  it('all pairs always have displaySideBySide true', () => {
    const pairs = generateInterpretivePairs(l1({ 'IH-08': measured(4) }), completeBC(0));
    for (const p of pairs) expect(p.displaySideBySide).toBe(true);
  });
});

// ===========================================================================
// Rule C — architecture advisories (full matrix)
// ===========================================================================

describe('Rule C — architecture advisories', () => {
  it('produces exactly 6 pairings (2 arch items × 3 outcomes)', () => {
    const adv = generateArchitectureAdvisories(l1(), layer0Stub());
    expect(adv).toHaveLength(6);
  });

  it('every pairing always has displaySideBySide true', () => {
    const adv = generateArchitectureAdvisories(l1(), layer0Stub({ 'L0-it-ot-boundary': L0_STATE.PRESENT }));
    for (const a of adv) expect(a.displaySideBySide).toBe(true);
  });

  // ── Row: Present / Requirement satisfied → no advisory ──
  it('boundary Present + IH-08 poor → side-by-side only, no advisory', () => {
    const adv = generateArchitectureAdvisories(
      l1({ 'IH-08': measured(1) }),
      layer0Stub({ 'L0-it-ot-boundary': L0_STATE.PRESENT, 'L0-multi-homed': L0_STATE.REQUIREMENT_SATISFIED })
    );
    const a = adv.find(x => x.archItemId === 'L0-it-ot-boundary' && x.relatedId === 'IH-08');
    expect(a.advisory).toBeNull();
  });

  it('multi-homed Requirement satisfied + BC-01 poor → no advisory', () => {
    const adv = generateArchitectureAdvisories(
      l1({ 'BC-01': measured(0) }),
      layer0Stub({ 'L0-multi-homed': L0_STATE.REQUIREMENT_SATISFIED })
    );
    const a = adv.find(x => x.archItemId === 'L0-multi-homed' && x.relatedId === 'BC-01');
    expect(a.advisory).toBeNull();
  });

  // ── Row: Any weak state + Measured 3–4 → no advisory ──
  it('boundary Missing + IH-08 GOOD (score 4) → side-by-side only, NO advisory', () => {
    const adv = generateArchitectureAdvisories(
      l1({ 'IH-08': measured(4) }),
      layer0Stub({ 'L0-it-ot-boundary': L0_STATE.MISSING })
    );
    const a = adv.find(x => x.archItemId === 'L0-it-ot-boundary' && x.relatedId === 'IH-08');
    expect(a.relatedClass).toBe('good');
    expect(a.advisory).toBeNull();
  });

  it('boundary Missing + IH-08 score 3 → no advisory (3 is good)', () => {
    const adv = generateArchitectureAdvisories(
      l1({ 'IH-08': measured(3) }),
      layer0Stub({ 'L0-it-ot-boundary': L0_STATE.MISSING })
    );
    expect(adv.find(x => x.archItemId === 'L0-it-ot-boundary' && x.relatedId === 'IH-08').advisory).toBeNull();
  });

  // ── Row: Missing + Measured 0–2 → strong advisory ──
  it('boundary Missing + IH-08 score 2 → strong advisory', () => {
    const adv = generateArchitectureAdvisories(
      l1({ 'IH-08': measured(2) }),
      layer0Stub({ 'L0-it-ot-boundary': L0_STATE.MISSING })
    );
    const a = adv.find(x => x.archItemId === 'L0-it-ot-boundary' && x.relatedId === 'IH-08');
    expect(a.advisory).not.toBeNull();
    expect(a.advisory.severity).toBe('strong');
    expect(a.advisory.framing).toBe('may_be_related');
  });

  // ── Row: capability-absent treated as poor ──
  it('boundary Missing + IH-08 capability-absent (score 0) → strong advisory (poor)', () => {
    const adv = generateArchitectureAdvisories(
      l1({ 'IH-08': capAbsent() }),
      layer0Stub({ 'L0-it-ot-boundary': L0_STATE.MISSING })
    );
    const a = adv.find(x => x.archItemId === 'L0-it-ot-boundary' && x.relatedId === 'IH-08');
    expect(a.relatedClass).toBe('poor');
    expect(a.advisory).not.toBeNull();
    expect(a.advisory.severity).toBe('strong');
  });

  // ── Row: Incomplete or outdated + Measured 0–2 → softer ──
  it('boundary Incomplete/outdated + BC-01 score 1 → softer advisory', () => {
    const adv = generateArchitectureAdvisories(
      l1({ 'BC-01': measured(1) }),
      layer0Stub({ 'L0-it-ot-boundary': L0_STATE.INCOMPLETE_OUTDATED })
    );
    const a = adv.find(x => x.archItemId === 'L0-it-ot-boundary' && x.relatedId === 'BC-01');
    expect(a.advisory.severity).toBe('softer');
    expect(a.advisory.message).toMatch(/incomplete or outdated/i);
  });

  it('multi-homed Incomplete/outdated evidence + BC-02 score 0 → softer advisory', () => {
    const adv = generateArchitectureAdvisories(
      l1({ 'BC-02': measured(0) }),
      layer0Stub({ 'L0-multi-homed': L0_STATE.INCOMPLETE_OUTDATED_EVIDENCE })
    );
    const a = adv.find(x => x.archItemId === 'L0-multi-homed' && x.relatedId === 'BC-02');
    expect(a.advisory.severity).toBe('softer');
  });

  // ── Row: Not verifiable + Measured 0–2 → caution ──
  it('boundary Not verifiable + IH-08 score 2 → caution advisory', () => {
    const adv = generateArchitectureAdvisories(
      l1({ 'IH-08': measured(2) }),
      layer0Stub({ 'L0-it-ot-boundary': L0_STATE.NOT_VERIFIABLE })
    );
    const a = adv.find(x => x.archItemId === 'L0-it-ot-boundary' && x.relatedId === 'IH-08');
    expect(a.advisory.severity).toBe('caution');
    expect(a.advisory.message).toMatch(/could not be verified|caution/i);
  });

  // ── Row: Uncontrolled multi-homing found + Measured 0–2 → bypass ──
  it('multi-homed Uncontrolled found + BC-02 score 2 → strong segmentation-bypass advisory', () => {
    const adv = generateArchitectureAdvisories(
      l1({ 'BC-02': measured(2) }),
      layer0Stub({ 'L0-multi-homed': L0_STATE.UNCONTROLLED_MULTI_HOMING_FOUND })
    );
    const a = adv.find(x => x.archItemId === 'L0-multi-homed' && x.relatedId === 'BC-02');
    expect(a.advisory.variant).toBe('bypass');
    expect(a.advisory.severity).toBe('strong');
    expect(a.advisory.message).toMatch(/multi-homed|segmentation bypass/i);
  });

  // ── Row: Any weak state + Not measurable → readiness advisory ──
  it('boundary Missing + IH-08 NOT MEASURABLE → readiness advisory', () => {
    const adv = generateArchitectureAdvisories(
      l1({ 'IH-08': notMeasurable() }),
      layer0Stub({ 'L0-it-ot-boundary': L0_STATE.MISSING })
    );
    const a = adv.find(x => x.archItemId === 'L0-it-ot-boundary' && x.relatedId === 'IH-08');
    expect(a.relatedClass).toBe('not_measurable');
    expect(a.advisory.variant).toBe('readiness');
    expect(a.advisory.severity).toBe('readiness');
    expect(a.advisory.message).toMatch(/measurement-readiness|not measurable/i);
  });

  it('multi-homed Not verifiable + BC-01 not measurable → readiness advisory (readiness wording uniform across weak states)', () => {
    const adv = generateArchitectureAdvisories(
      l1({ 'BC-01': notMeasurable() }),
      layer0Stub({ 'L0-multi-homed': L0_STATE.NOT_VERIFIABLE })
    );
    const a = adv.find(x => x.archItemId === 'L0-multi-homed' && x.relatedId === 'BC-01');
    expect(a.advisory.variant).toBe('readiness');
  });

  // ── Row: non-event → silent (no advisory) ──
  it('boundary Missing + IH-08 no_qualifying_event → NO advisory (non-event is silent)', () => {
    const adv = generateArchitectureAdvisories(
      l1({ 'IH-08': noEvent() }),
      layer0Stub({ 'L0-it-ot-boundary': L0_STATE.MISSING })
    );
    const a = adv.find(x => x.archItemId === 'L0-it-ot-boundary' && x.relatedId === 'IH-08');
    expect(a.relatedClass).toBe('non_event');
    expect(a.advisory).toBeNull();
  });

  it('boundary Missing + BC-01 no_qualifying_disruption → NO advisory (non-event silent)', () => {
    const adv = generateArchitectureAdvisories(
      l1({ 'BC-01': noDisruption() }),
      layer0Stub({ 'L0-it-ot-boundary': L0_STATE.MISSING })
    );
    const a = adv.find(x => x.archItemId === 'L0-it-ot-boundary' && x.relatedId === 'BC-01');
    expect(a.relatedClass).toBe('non_event');
    expect(a.advisory).toBeNull();
  });

  // ── Arch unset → no advisory ──
  it('arch state unset (null) + poor related → no advisory', () => {
    const adv = generateArchitectureAdvisories(
      l1({ 'IH-08': measured(1) }),
      layer0Stub({})  // no states
    );
    const a = adv.find(x => x.archItemId === 'L0-it-ot-boundary' && x.relatedId === 'IH-08');
    expect(a.advisory).toBeNull();
  });

  // ── Cross-layer identity ──
  it('advisory carries cross-layer interpretive identity distinct from a Layer 0 action flag', () => {
    const adv = generateArchitectureAdvisories(
      l1({ 'IH-08': measured(1) }),
      layer0Stub({ 'L0-it-ot-boundary': L0_STATE.MISSING })
    );
    const a = adv.find(x => x.archItemId === 'L0-it-ot-boundary' && x.relatedId === 'IH-08');
    expect(a.rule).toBe('C');
    expect(a.kind).toBe('cross_layer_interpretive');
    expect(a.crossLayer).toBe(true);
    expect(a.relatedId).toBe('IH-08');               // names the related Layer 1 outcome
    expect(a.advisory.framing).toBe('may_be_related'); // interpretive, not imperative
    // It is NOT shaped like a Stage 2 action flag (no severity/itemId/tag fields of that kind)
    expect(a.severity).toBeUndefined();
    expect(a.tag).toBeUndefined();
  });
});

// ===========================================================================
// Rule D — BC plan hints
// ===========================================================================

describe('Rule D — BC plan hints', () => {
  it('returns exactly two hints, for BC-08 and BC-09', () => {
    const hints = generateBCPlanHints(layer0Stub({ 'L0-bc-plan-doc': L0_STATE.PRESENT }));
    expect(hints).toHaveLength(2);
    expect(hints.map(h => h.targetIndicatorId).sort()).toEqual(['BC-08', 'BC-09']);
  });

  it('plan Missing → strong hint mentioning "No RTO/RPO defined"', () => {
    const hints = generateBCPlanHints(layer0Stub({ 'L0-bc-plan-doc': L0_STATE.MISSING }));
    const bc08 = hints.find(h => h.targetIndicatorId === 'BC-08');
    expect(bc08.hint.severity).toBe('strong');
    expect(bc08.hint.message).toMatch(/No RTO defined/i);
    const bc09 = hints.find(h => h.targetIndicatorId === 'BC-09');
    expect(bc09.hint.message).toMatch(/No RPO defined/i);
  });

  it('plan Incomplete or outdated → softer hint', () => {
    const hints = generateBCPlanHints(layer0Stub({ 'L0-bc-plan-doc': L0_STATE.INCOMPLETE_OUTDATED }));
    expect(hints[0].hint.severity).toBe('softer');
    expect(hints[0].hint.message).toMatch(/verify whether/i);
  });

  it('plan Not verifiable → evidence hint', () => {
    const hints = generateBCPlanHints(layer0Stub({ 'L0-bc-plan-doc': L0_STATE.NOT_VERIFIABLE }));
    expect(hints[0].hint.severity).toBe('evidence');
    expect(hints[0].hint.message).toMatch(/confirm .* from available evidence/i);
  });

  it('plan Present → no hint (null)', () => {
    const hints = generateBCPlanHints(layer0Stub({ 'L0-bc-plan-doc': L0_STATE.PRESENT }));
    for (const h of hints) expect(h.hint).toBeNull();
  });

  it('plan unset → no hint (null)', () => {
    const hints = generateBCPlanHints(layer0Stub({}));
    for (const h of hints) expect(h.hint).toBeNull();
  });

  it('hint object NEVER contains an indicator-state field — cannot auto-fill BC-08/09', () => {
    const hints = generateBCPlanHints(layer0Stub({ 'L0-bc-plan-doc': L0_STATE.MISSING }));
    for (const h of hints) {
      expect(h.hint).not.toHaveProperty('state');
      expect(h).not.toHaveProperty('autoSelectedState');
      // hint carries only severity + message — pure text guidance
      expect(Object.keys(h.hint).sort()).toEqual(['message', 'severity']);
    }
  });

  it('BC-04 has no Rule D hint (not among the targets)', () => {
    const hints = generateBCPlanHints(layer0Stub({ 'L0-bc-plan-doc': L0_STATE.MISSING }));
    expect(hints.find(h => h.targetIndicatorId === 'BC-04')).toBeUndefined();
  });
});

// ===========================================================================
// Integration — computeCrossIndicator on real engine outputs
// ===========================================================================

describe('computeCrossIndicator — integration with real engine outputs', () => {
  function fullRecord(indicatorOverrides = {}, layer0Overrides = {}) {
    const blank = createBlankAssessment();
    return {
      ...blank,
      indicators: { ...blank.indicators, ...indicatorOverrides },
      layer0: { ...createBlankLayer0(), ...layer0Overrides },
    };
  }

  it('reads real computeAssessment + computeLayer0 outputs and returns four advisory groups', () => {
    const record = fullRecord(
      {
        'IH-06': { state: 'measured', value: '300' },  // 300h → score 1 (< 3)
        'IH-08': { state: 'measured', value: '4' },     // score 4 (high)
        'BC-01': { state: 'measured', value: '10' },    // score 1
        'BC-02': { state: 'measured', value: '10' },  // 10% → score 1
        'BC-04': { state: 'measured', numerator: '0', denominator: '5' },   // score 4
        'BC-08': { state: 'measured', numerator: '4', denominator: '10' },  // 40% → score 1
        'BC-09': { state: 'measured', numerator: '4', denominator: '10' },  // 40% → score 1
      },
      { 'L0-it-ot-boundary': { state: L0_STATE.MISSING } }
    );
    const l1Results = computeAssessment(record);
    const l0Results = computeLayer0(record);
    const cross = computeCrossIndicator(record, l1Results, l0Results);

    expect(cross).toHaveProperty('ihDependencyNotes');
    expect(cross).toHaveProperty('interpretivePairs');
    expect(cross).toHaveProperty('architectureAdvisories');
    expect(cross).toHaveProperty('bcPlanHints');

    // Rule A fired (IH-06 score 1 < 3)
    expect(cross.ihDependencyNotes.length).toBeGreaterThan(0);
    // Rule C fired (boundary Missing + IH-08 ... but IH-08 is score 4 = good → no advisory there;
    // BC-01/BC-02 are score 1 = poor → advisory)
    const bc01Adv = cross.architectureAdvisories.find(a => a.archItemId === 'L0-it-ot-boundary' && a.relatedId === 'BC-01');
    expect(bc01Adv.advisory).not.toBeNull();
  });

  it('does NOT mutate the assessment record, layer1Results, or layer0Result', () => {
    const record = fullRecord({ 'IH-06': { state: 'measured', value: '300' } });
    const l1Results = computeAssessment(record);
    const l0Results = computeLayer0(record);

    const recordSnapshot = JSON.stringify(record);
    const l1Snapshot = JSON.stringify(l1Results);
    const l0Snapshot = JSON.stringify(l0Results);

    computeCrossIndicator(record, l1Results, l0Results);

    expect(JSON.stringify(record)).toBe(recordSnapshot);
    expect(JSON.stringify(l1Results)).toBe(l1Snapshot);
    expect(JSON.stringify(l0Results)).toBe(l0Snapshot);
  });

  it('advisory output never changes Layer 1 scores (re-run computeAssessment unchanged)', () => {
    const record = fullRecord({ 'IH-06': { state: 'measured', value: '300' }, 'IH-08': { state: 'measured', value: '4' } });
    const before = computeAssessment(record);
    const l0 = computeLayer0(record);
    computeCrossIndicator(record, before, l0);
    const after = computeAssessment(record);
    expect(after).toEqual(before);
  });

  it('buildLayer1View merges state + score correctly', () => {
    const record = fullRecord({ 'IH-06': { state: 'measured', value: '4' } });
    const l1Results = computeAssessment(record);
    const view = buildLayer1View(record, l1Results);
    expect(view['IH-06'].state).toBe('measured');
    expect(view['IH-06'].score).toBe(4);   // 4h → score 4
    expect(view['IH-07'].state).toBeNull();
    expect(view['IH-07'].score).toBeNull();
  });

  it('determinism — same inputs twice give deep-equal advisory output', () => {
    const record = fullRecord(
      { 'IH-06': { state: 'measured', value: '300' } },
      { 'L0-it-ot-boundary': { state: L0_STATE.MISSING } }
    );
    const l1Results = computeAssessment(record);
    const l0Results = computeLayer0(record);
    expect(computeCrossIndicator(record, l1Results, l0Results))
      .toEqual(computeCrossIndicator(record, l1Results, l0Results));
  });
});
