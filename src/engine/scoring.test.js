/**
 * Scoring engine test suite — Stage 1
 *
 * ─── CONVENTIONS DOCUMENTED HERE ────────────────────────────────────────────
 *
 * 1. BAND BOUNDARY CONVENTION (explicit contiguous intervals, inclusive at
 *    the score-improving side)
 *
 *    Bands are defined as half-open intervals with NO gaps between adjacent
 *    bands, matching the notation in indicatorDefinitions.js:
 *      lower_is_better: gt < value ≤ lte  (inclusive upper bound)
 *      higher_is_better: gte ≤ value < lt  (inclusive lower bound)
 *
 *    A value exactly at a boundary belongs to the HIGHER score:
 *      • IH-06 exactly 6 h → score 4  (≤ 6 h, i.e. [−∞, 6])
 *        IH-06 6.001 h → score 3       (in (6, 24])
 *      • BC-01 exactly 90 % → score 4  (≥ 90 %, i.e. [90, +∞))
 *        BC-01 89.999 % → score 3      (in [70, 90))
 *
 *    Integer band descriptors in the spec (e.g. "6–20 %") are resolved by
 *    the contiguous interval definition: 5.5 % → score 2 because the
 *    score-3 band is (0, 5] and 5.5 > 5. Every possible value maps
 *    unambiguously; no inference is required at lookup time.
 *
 * 2. ROUNDING CONVENTION (full precision internal, display-only rounding)
 *    The engine stores and returns raw IEEE-754 floats for all scores and
 *    means. Nothing inside computeAssessment() rounds. Rounding is applied
 *    only by the UI rendering layer (e.g. toFixed(2) in OverallPanel). This
 *    protects Stage 5 before/after deltas from accumulated rounding error.
 *    Tests assert on raw floats, never on pre-rounded strings.
 *
 * ─── NON-NEGOTIABLE NAMED TESTS ─────────────────────────────────────────────
 *   incomplete-denominator-not-reduced
 *   capability-absent-counts-but-not-measurable-does-not
 *   bc04-zero-violations-scores-4
 *   per-indicator-state-sets-enforced
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  scoreIndicator,
  computeAssessment,
  createBlankAssessment,
} from './scoring.js';
import {
  INDICATORS,
  STATE,
  SCORE_ZERO_STATES,
  NO_SCORE_STATES,
  IH_INDICATOR_IDS,
  BC_INDICATOR_IDS,
} from '../data/indicatorDefinitions.js';

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** Build a full assessment record from explicit per-indicator input objects. */
function makeRecord(indicatorOverrides = {}) {
  const blank = createBlankAssessment();
  return {
    ...blank,
    indicators: { ...blank.indicators, ...indicatorOverrides },
  };
}

/** Shorthand: single-value measured input. */
const sv = (value) => ({ state: STATE.MEASURED, value: String(value) });

/** Shorthand: ratio measured input. */
const ratio = (num, den) => ({ state: STATE.MEASURED, numerator: String(num), denominator: String(den) });

/** Inputs that produce a known score for each indicator — used in PBTs. */
const SCORE_FIXTURES = {
  'IH-06': { 4: sv(3),   3: sv(12),  2: sv(96),  1: sv(400),  0: { state: STATE.CAPABILITY_ABSENT } },
  'IH-07': { 4: sv(2),   3: sv(10),  2: sv(48),  1: sv(100),  0: { state: STATE.CAPABILITY_ABSENT } },
  'IH-08': { 4: sv(4),   3: sv(12),  2: sv(96),  1: sv(400),  0: { state: STATE.CAPABILITY_ABSENT } },
  'BC-01': { 4: sv(95),  3: sv(80),  2: sv(50),  1: sv(15),   0: sv(0) },
  'BC-02': { 4: sv(95), 3: sv(80), 2: sv(50), 1: sv(15), 0: sv(0) },   // direct % (single value)
  'BC-04': { 4: ratio(0,10), 3: ratio(3,100), 2: ratio(10,100), 1: ratio(35,100), 0: ratio(8,10) },
  'BC-08': { 4: ratio(95,100), 3: ratio(80,100), 2: ratio(60,100), 1: ratio(40,100), 0: { state: STATE.NO_RTO_DEFINED } },
  'BC-09': { 4: ratio(95,100), 3: ratio(80,100), 2: ratio(60,100), 1: ratio(40,100), 0: { state: STATE.NO_RPO_DEFINED } },
};

/** Build a record where each indicator is given the input that produces targetScore. */
function recordWithAllScores(ih06, ih07, ih08, bc01, bc02, bc04, bc08, bc09) {
  return makeRecord({
    'IH-06': SCORE_FIXTURES['IH-06'][ih06],
    'IH-07': SCORE_FIXTURES['IH-07'][ih07],
    'IH-08': SCORE_FIXTURES['IH-08'][ih08],
    'BC-01': SCORE_FIXTURES['BC-01'][bc01],
    'BC-02': SCORE_FIXTURES['BC-02'][bc02],
    'BC-04': SCORE_FIXTURES['BC-04'][bc04],
    'BC-08': SCORE_FIXTURES['BC-08'][bc08],
    'BC-09': SCORE_FIXTURES['BC-09'][bc09],
  });
}

// ─── 1. Aggregation arithmetic ────────────────────────────────────────────────

describe('aggregation arithmetic', () => {
  it('IH mean uses denominator 3, BC mean uses denominator 5', () => {
    // IH: 4+3+2 = 9 → 3.000  BC: 1+2+3+4+3 = 13 → 2.600
    const rec = recordWithAllScores(4, 3, 2, 1, 2, 3, 4, 3);
    const res = computeAssessment(rec);
    expect(res.ih.score).toBeCloseTo(9 / 3, 10);
    expect(res.bc.score).toBeCloseTo(13 / 5, 10);
  });

  it('Overall is mean(IH, BC) — not mean of all 8 raw scores', () => {
    // IH all 4 → 4.000; BC all 1 → 1.000; Overall must be (4+1)/2 = 2.5
    // Mean of all 8 raw scores would be (4+4+4+1+1+1+1+1)/8 = 17/8 = 2.125 — WRONG
    const rec = recordWithAllScores(4, 4, 4, 1, 1, 1, 1, 1);
    const res = computeAssessment(rec);
    expect(res.ih.score).toBeCloseTo(4, 10);
    expect(res.bc.score).toBeCloseTo(1, 10);
    expect(res.overall.score).toBeCloseTo(2.5, 10);
    expect(res.overall.score).not.toBeCloseTo(2.125, 3);
  });

  it('no RM term — extra keys in indicators object are ignored, result unchanged', () => {
    const base = recordWithAllScores(3, 3, 3, 3, 3, 3, 3, 3);
    const withRM = {
      ...base,
      indicators: {
        ...base.indicators,
        'RM-04': { state: STATE.MEASURED, numerator: '50', denominator: '100' },
        'RM-05': { state: STATE.MEASURED, value: '45' },
      },
    };
    const resBase = computeAssessment(base);
    const resRM = computeAssessment(withRM);
    expect(resRM.ih.score).toBe(resBase.ih.score);
    expect(resRM.bc.score).toBe(resBase.bc.score);
    expect(resRM.overall.score).toBe(resBase.overall.score);
    expect(resRM.indicators['RM-04']).toBeUndefined();
    expect(resRM.indicators['RM-05']).toBeUndefined();
  });

  it('rounding convention — internal score is full IEEE-754 float, not pre-rounded', () => {
    // IH: 4+3+2 = 9/3 = 3.000 exact — not interesting
    // IH: 4+4+3 = 11/3 = 3.6666... must be stored as full float
    const rec = recordWithAllScores(4, 4, 3, 3, 3, 3, 3, 3);
    const res = computeAssessment(rec);
    const raw = res.ih.score;
    expect(raw).toBeCloseTo(11 / 3, 12);                 // full precision
    expect(raw).not.toBe(3.67);                           // not pre-rounded to 2dp
    expect(raw).not.toBe(3.7);
    expect(typeof raw).toBe('number');
    // Display rounding is caller's responsibility (not the engine's)
    expect(parseFloat(raw.toFixed(2))).toBe(3.67);        // rounding happens at render
  });
});

// ─── 2. Incomplete-dimension rule ────────────────────────────────────────────

describe('incomplete-dimension rule', () => {
  it('incomplete-denominator-not-reduced: one not_measurable in IH → null, denom stays 3', () => {
    const rec = makeRecord({
      'IH-06': sv(4),
      'IH-07': { state: STATE.NOT_MEASURABLE },
      'IH-08': sv(4),
    });
    const res = computeAssessment(rec);
    expect(res.ih.incomplete).toBe(true);
    expect(res.ih.score).toBeNull();
    // indicatorScores must still list all three positions — denominator not silently reduced
    expect(res.ih.indicatorScores).toHaveLength(3);
    expect(res.ih.indicatorScores[1]).toBeNull();         // IH-07 slot is null
    expect(res.ih.indicatorScores[0]).toBe(4);            // IH-06 still scored
  });

  it('one no_qualifying_event in IH → IH incomplete', () => {
    const rec = makeRecord({
      'IH-06': sv(4),
      'IH-07': { state: STATE.NO_QUALIFYING_EVENT },
      'IH-08': sv(4),
    });
    const res = computeAssessment(rec);
    expect(res.ih.incomplete).toBe(true);
    expect(res.ih.score).toBeNull();
  });

  it('one incomplete in each dimension → both incomplete', () => {
    const rec = makeRecord({
      'IH-06': { state: STATE.NOT_MEASURABLE },
      'BC-01': { state: STATE.NO_QUALIFYING_DISRUPTION },
    });
    const res = computeAssessment(rec);
    expect(res.ih.incomplete).toBe(true);
    expect(res.bc.incomplete).toBe(true);
  });

  it('all three IH not_measurable → IH incomplete, no crash', () => {
    const rec = makeRecord({
      'IH-06': { state: STATE.NOT_MEASURABLE },
      'IH-07': { state: STATE.NOT_MEASURABLE },
      'IH-08': { state: STATE.NOT_MEASURABLE },
    });
    const res = computeAssessment(rec);
    expect(res.ih.score).toBeNull();
    expect(res.ih.incomplete).toBe(true);
    expect(res.ih.indicatorScores).toEqual([null, null, null]);
  });

  it('incomplete IH + complete BC → Overall incomplete', () => {
    const rec = recordWithAllScores(4, 4, 4, 3, 3, 3, 3, 3);
    // Inject incomplete into IH
    const r2 = { ...rec, indicators: { ...rec.indicators, 'IH-06': { state: STATE.NOT_MEASURABLE } } };
    const res = computeAssessment(r2);
    expect(res.ih.incomplete).toBe(true);
    expect(res.bc.incomplete).toBe(false);
    expect(res.overall.incomplete).toBe(true);
    expect(res.overall.score).toBeNull();
  });

  it('complete IH + incomplete BC → Overall incomplete', () => {
    const rec = recordWithAllScores(4, 4, 4, 3, 3, 3, 3, 3);
    const r2 = { ...rec, indicators: { ...rec.indicators, 'BC-01': { state: STATE.NO_QUALIFYING_DISRUPTION } } };
    const res = computeAssessment(r2);
    expect(res.bc.incomplete).toBe(true);
    expect(res.ih.incomplete).toBe(false);
    expect(res.overall.incomplete).toBe(true);
  });

  it('both dimensions incomplete → Overall incomplete', () => {
    const rec = makeRecord({
      'IH-06': { state: STATE.NOT_MEASURABLE },
      'BC-01': { state: STATE.NOT_MEASURABLE },
    });
    const res = computeAssessment(rec);
    expect(res.overall.incomplete).toBe(true);
    expect(res.overall.score).toBeNull();
  });

  it('anti-bug: IH scores [4, 3, null] → score null AND incomplete true, NOT 3.5', () => {
    const rec = makeRecord({
      'IH-06': sv(4),    // score 4
      'IH-07': sv(12),   // score 3
      'IH-08': { state: STATE.NOT_MEASURABLE }, // null
    });
    const res = computeAssessment(rec);
    expect(res.ih.score).toBeNull();
    expect(res.ih.incomplete).toBe(true);
    expect(res.ih.score).not.toBe(3.5);   // must not average the two present scores
  });

  it('capability_absent (0) + not_measurable in same dimension → incomplete; 0 appears in indicatorScores', () => {
    const rec = makeRecord({
      'IH-06': { state: STATE.CAPABILITY_ABSENT },   // score 0
      'IH-07': { state: STATE.NOT_MEASURABLE },      // null
      'IH-08': sv(4),
    });
    const res = computeAssessment(rec);
    expect(res.ih.incomplete).toBe(true);
    expect(res.ih.score).toBeNull();
    expect(res.ih.indicatorScores[0]).toBe(0);   // capability_absent still visible
    expect(res.ih.indicatorScores[1]).toBeNull();
  });
});

// ─── 3. Score 0 vs no-score ───────────────────────────────────────────────────

describe('score 0 vs no-score', () => {
  it('capability-absent-counts-but-not-measurable-does-not', () => {
    // [4, 4, capability_absent(0)] → complete; score = 8/3 ≈ 2.667
    const recAbsent = makeRecord({
      'IH-06': sv(4),
      'IH-07': sv(4),
      'IH-08': { state: STATE.CAPABILITY_ABSENT },
    });
    const resAbsent = computeAssessment(recAbsent);
    expect(resAbsent.ih.incomplete).toBe(false);
    expect(resAbsent.ih.score).toBeCloseTo(8 / 3, 10);

    // [4, 4, not_measurable] → incomplete; score = null
    const recNM = makeRecord({
      'IH-06': sv(4),
      'IH-07': sv(4),
      'IH-08': { state: STATE.NOT_MEASURABLE },
    });
    const resNM = computeAssessment(recNM);
    expect(resNM.ih.incomplete).toBe(true);
    expect(resNM.ih.score).toBeNull();
  });

  it('all capability_absent dimension → score 0, complete (not null)', () => {
    const rec = makeRecord({
      'IH-06': { state: STATE.CAPABILITY_ABSENT },
      'IH-07': { state: STATE.CAPABILITY_ABSENT },
      'IH-08': { state: STATE.CAPABILITY_ABSENT },
    });
    const res = computeAssessment(rec);
    expect(res.ih.score).toBe(0);
    expect(res.ih.incomplete).toBe(false);
  });

  it('not_measurable → score null, no_qualifying_event → score null (both distinct from 0)', () => {
    const nm = scoreIndicator('IH-06', { state: STATE.NOT_MEASURABLE });
    expect(nm.score).toBeNull();
    const nqe = scoreIndicator('IH-06', { state: STATE.NO_QUALIFYING_EVENT });
    expect(nqe.score).toBeNull();
    const abs = scoreIndicator('IH-06', { state: STATE.CAPABILITY_ABSENT });
    expect(abs.score).toBe(0);
  });

  it('adding capability_absent (0) to a dimension never raises its mean', () => {
    // [4, 4] average would be 4 if only two; adding 0 → 8/3 = 2.667 — should lower
    const rec3 = makeRecord({
      'IH-06': sv(4),
      'IH-07': sv(4),
      'IH-08': { state: STATE.CAPABILITY_ABSENT },
    });
    const res = computeAssessment(rec3);
    expect(res.ih.score).toBeCloseTo(8 / 3, 10);
    expect(res.ih.score).toBeLessThan(4);
  });
});

// ─── 4. BC-04 reverse-scoring ─────────────────────────────────────────────────

describe('BC-04 reverse-scoring', () => {
  it('bc04-zero-violations-scores-4', () => {
    const r = scoreIndicator('BC-04', ratio(0, 10));
    expect(r.score).toBe(4);
    expect(r.derivedPct).toBe(0);
  });

  // Band boundaries for BC-04 (lower_is_better, explicit contiguous intervals):
  //   Score 4: [0, 0]    Score 3: (0, 5]    Score 2: (5, 20]    Score 1: (20, 50]
  // The spec's "1–5 %" and "6–20 %" integer ranges are bridged continuously:
  // any value in (5, 6) — e.g. 5.5 % — falls to score 2 (> score-3 ceiling of 5 %).
  it('5 % exactly → score 3 (lte: 5 boundary, inclusive)', () => {
    expect(scoreIndicator('BC-04', ratio(5, 100)).score).toBe(3);
  });
  it('5.0001 % → score 2 (gt: 5 exclusive; first value above score-3 ceiling)', () => {
    expect(scoreIndicator('BC-04', ratio(50001, 1000000)).score).toBe(2);
  });
  it('5.5 % → score 2 (in the 5–6 % integer gap; resolved by contiguous intervals)', () => {
    expect(scoreIndicator('BC-04', ratio(55, 1000)).score).toBe(2);
  });
  it('6 % → score 2', () => {
    expect(scoreIndicator('BC-04', ratio(6, 100)).score).toBe(2);
  });
  it('20 % exactly → score 2 (upper edge)', () => {
    expect(scoreIndicator('BC-04', ratio(20, 100)).score).toBe(2);
  });
  it('20.001 % → score 1', () => {
    expect(scoreIndicator('BC-04', ratio(20001, 100000)).score).toBe(1);
  });
  it('21 % → score 1', () => {
    expect(scoreIndicator('BC-04', ratio(21, 100)).score).toBe(1);
  });
  it('50 % exactly → score 1 (upper edge of score 1)', () => {
    expect(scoreIndicator('BC-04', ratio(50, 100)).score).toBe(1);
  });
  it('50.001 % → score 0 (band fallthrough)', () => {
    expect(scoreIndicator('BC-04', ratio(50001, 100000)).score).toBe(0);
  });
  it('51 % → score 0', () => {
    expect(scoreIndicator('BC-04', ratio(51, 100)).score).toBe(0);
  });

  // ── NON-NEGOTIABLE NAMED TEST ────────────────────────────────────────────
  it('bc04-score-zero-routes-distinguished: programme-gap and band-fallthrough both score 0 but carry different markers', () => {
    // Route A — programme gap: no_thresholds_defined state
    const rGap = scoreIndicator('BC-04', { state: STATE.NO_THRESHOLDS_DEFINED });
    expect(rGap.score).toBe(0);
    expect(rGap.programmeGap).toBe(true);    // explicit marker for Stage 2/3 action-flag logic
    expect(rGap.derivedPct).toBeNull();       // no measured value computed

    // Route B — performance failure: measured >50 % violations → band fallthrough
    const rBand = scoreIndicator('BC-04', ratio(6, 10));   // 60 % → score 0
    expect(rBand.score).toBe(0);
    expect(rBand.programmeGap).toBeFalsy();  // NOT a programme gap — this is observed bad performance
    expect(rBand.derivedPct).toBeCloseTo(60, 5);  // measured value is present

    // The two routes MUST NOT be indistinguishable — assert the marker differs
    expect(rGap.programmeGap).not.toBe(rBand.programmeGap);
  });

  it('no_thresholds_defined → score 0 via explicit state (programme-gap path)', () => {
    const r = scoreIndicator('BC-04', { state: STATE.NO_THRESHOLDS_DEFINED });
    expect(r.score).toBe(0);
    expect(r.programmeGap).toBe(true);
  });

  it('high-violation score 0 (measured >50 %) is NOT flagged as invalidState or programmeGap', () => {
    const r = scoreIndicator('BC-04', ratio(6, 10));   // 60 % → score 0 via band
    expect(r.score).toBe(0);
    expect(r.invalidState).toBeFalsy();
    expect(r.invalidInput).toBeFalsy();
    expect(r.programmeGap).toBeFalsy();
  });

  it('BC-04=4 alongside four BC 4s → BC mean 4.0 (good BC-04 does not drag down)', () => {
    const rec = makeRecord({
      'BC-01': sv(95), 'BC-02': sv(95),
      'BC-04': ratio(0, 10),
      'BC-08': ratio(95, 100), 'BC-09': ratio(95, 100),
    });
    const res = computeAssessment(rec);
    expect(res.bc.score).toBeCloseTo(4, 10);
  });

  it('BC-04=0 (high violations) alongside four BC 4s → BC mean 3.2 (pulls down)', () => {
    const rec = makeRecord({
      'BC-01': sv(95), 'BC-02': sv(95),
      'BC-04': ratio(6, 10),   // 60 % → score 0
      'BC-08': ratio(95, 100), 'BC-09': ratio(95, 100),
    });
    const res = computeAssessment(rec);
    expect(res.bc.score).toBeCloseTo((4 + 4 + 0 + 4 + 4) / 5, 10);  // 3.2
  });

  it('BC-04 monotonic: as violation rate increases 0→100 %, score never increases', () => {
    const rates = [0, 1, 2, 3, 4, 5, 5.5, 6, 10, 15, 20, 20.5, 21, 30, 40, 50, 50.5, 51, 75, 100];
    let prevScore = 4;
    for (const pct of rates) {
      const r = scoreIndicator('BC-04', ratio(pct, 100));
      expect(r.score).toBeLessThanOrEqual(prevScore);
      prevScore = r.score;
    }
  });
});

// ─── 5. Per-indicator state sets ─────────────────────────────────────────────

describe('per-indicator-state-sets-enforced', () => {
  it('IH-06/07/08 include capability_absent', () => {
    for (const id of IH_INDICATOR_IDS) {
      expect(INDICATORS[id].allowedStates).toContain(STATE.CAPABILITY_ABSENT);
    }
  });

  it('BC-04 includes no_thresholds_defined, NOT capability_absent', () => {
    expect(INDICATORS['BC-04'].allowedStates).toContain(STATE.NO_THRESHOLDS_DEFINED);
    expect(INDICATORS['BC-04'].allowedStates).not.toContain(STATE.CAPABILITY_ABSENT);
  });

  it('BC-08 includes no_rto_defined, NOT capability_absent', () => {
    expect(INDICATORS['BC-08'].allowedStates).toContain(STATE.NO_RTO_DEFINED);
    expect(INDICATORS['BC-08'].allowedStates).not.toContain(STATE.CAPABILITY_ABSENT);
  });

  it('BC-09 includes no_rpo_defined, NOT capability_absent', () => {
    expect(INDICATORS['BC-09'].allowedStates).toContain(STATE.NO_RPO_DEFINED);
    expect(INDICATORS['BC-09'].allowedStates).not.toContain(STATE.CAPABILITY_ABSENT);
  });

  it('BC-01 and BC-02 have no programme-gap state — only measured/no_qualifying_disruption/not_measurable', () => {
    for (const id of ['BC-01', 'BC-02']) {
      const states = INDICATORS[id].allowedStates;
      expect(states).toContain(STATE.MEASURED);
      expect(states).toContain(STATE.NO_QUALIFYING_DISRUPTION);
      expect(states).toContain(STATE.NOT_MEASURABLE);
      expect(states).not.toContain(STATE.CAPABILITY_ABSENT);
      expect(states).not.toContain(STATE.NO_THRESHOLDS_DEFINED);
      expect(states).not.toContain(STATE.NO_RTO_DEFINED);
      expect(states).not.toContain(STATE.NO_RPO_DEFINED);
      expect(states).toHaveLength(3);
    }
  });

  it('negative test: BC-08 + capability_absent → invalidState flagged, score null', () => {
    const r = scoreIndicator('BC-08', { state: STATE.CAPABILITY_ABSENT });
    expect(r.score).toBeNull();
    expect(r.invalidState).toBe(true);
  });

  it('negative test: BC-04 + no_rto_defined → invalidState flagged', () => {
    const r = scoreIndicator('BC-04', { state: STATE.NO_RTO_DEFINED });
    expect(r.invalidState).toBe(true);
    expect(r.score).toBeNull();
  });

  it('negative test: IH-06 + no_thresholds_defined → invalidState flagged', () => {
    const r = scoreIndicator('IH-06', { state: STATE.NO_THRESHOLDS_DEFINED });
    expect(r.invalidState).toBe(true);
    expect(r.score).toBeNull();
  });

  it('negative test: BC-01 + capability_absent → invalidState flagged', () => {
    const r = scoreIndicator('BC-01', { state: STATE.CAPABILITY_ABSENT });
    expect(r.invalidState).toBe(true);
    expect(r.score).toBeNull();
  });
});

// ─── 6. Band boundaries — every edge, every indicator ─────────────────────────

describe('band boundaries', () => {
  describe('IH-06 (lower_is_better, hours) — intervals (−∞,6]·(6,24]·(24,168]·(168,720]·(720,+∞)→0', () => {
    it('exactly 6 h → score 4', () => expect(scoreIndicator('IH-06', sv(6)).score).toBe(4));
    it('6.001 h → score 3', () => expect(scoreIndicator('IH-06', sv(6.001)).score).toBe(3));
    it('exactly 24 h → score 3', () => expect(scoreIndicator('IH-06', sv(24)).score).toBe(3));
    it('24.001 h → score 2', () => expect(scoreIndicator('IH-06', sv(24.001)).score).toBe(2));
    it('exactly 168 h (7 d) → score 2', () => expect(scoreIndicator('IH-06', sv(168)).score).toBe(2));
    it('168.001 h → score 1', () => expect(scoreIndicator('IH-06', sv(168.001)).score).toBe(1));
    it('exactly 720 h (30 d) → score 1', () => expect(scoreIndicator('IH-06', sv(720)).score).toBe(1));
    it('720.001 h → score 0 (band fallthrough)', () => expect(scoreIndicator('IH-06', sv(720.001)).score).toBe(0));
    it('0 h → score 4', () => expect(scoreIndicator('IH-06', sv(0)).score).toBe(4));
  });

  describe('IH-07 (lower_is_better, hours) — intervals (−∞,4]·(4,24]·(24,72]·(72,168]·(168,+∞)→0', () => {
    it('exactly 4 h → score 4', () => expect(scoreIndicator('IH-07', sv(4)).score).toBe(4));
    it('4.001 h → score 3', () => expect(scoreIndicator('IH-07', sv(4.001)).score).toBe(3));
    it('exactly 24 h → score 3', () => expect(scoreIndicator('IH-07', sv(24)).score).toBe(3));
    it('24.001 h → score 2', () => expect(scoreIndicator('IH-07', sv(24.001)).score).toBe(2));
    it('exactly 72 h (3 d) → score 2', () => expect(scoreIndicator('IH-07', sv(72)).score).toBe(2));
    it('72.001 h → score 1', () => expect(scoreIndicator('IH-07', sv(72.001)).score).toBe(1));
    it('exactly 168 h (7 d) → score 1', () => expect(scoreIndicator('IH-07', sv(168)).score).toBe(1));
    it('168.001 h → score 0', () => expect(scoreIndicator('IH-07', sv(168.001)).score).toBe(0));
    it('0 h → score 4', () => expect(scoreIndicator('IH-07', sv(0)).score).toBe(4));
  });

  describe('IH-08 (lower_is_better, hours) — same boundaries as IH-06', () => {
    it('exactly 6 h → score 4', () => expect(scoreIndicator('IH-08', sv(6)).score).toBe(4));
    it('6.001 h → score 3', () => expect(scoreIndicator('IH-08', sv(6.001)).score).toBe(3));
    it('exactly 720 h → score 1', () => expect(scoreIndicator('IH-08', sv(720)).score).toBe(1));
    it('720.001 h → score 0', () => expect(scoreIndicator('IH-08', sv(720.001)).score).toBe(0));
  });

  describe('BC-01 (higher_is_better, %) — intervals [90,+∞)·[70,90)·[30,70)·[1,30)·[0,1)→0', () => {
    it('exactly 90 % → score 4', () => expect(scoreIndicator('BC-01', sv(90)).score).toBe(4));
    it('89.999 % → score 3', () => expect(scoreIndicator('BC-01', sv(89.999)).score).toBe(3));
    it('exactly 70 % → score 3', () => expect(scoreIndicator('BC-01', sv(70)).score).toBe(3));
    it('69.999 % → score 2', () => expect(scoreIndicator('BC-01', sv(69.999)).score).toBe(2));
    it('exactly 30 % → score 2', () => expect(scoreIndicator('BC-01', sv(30)).score).toBe(2));
    it('29.999 % → score 1', () => expect(scoreIndicator('BC-01', sv(29.999)).score).toBe(1));
    it('exactly 1 % → score 1', () => expect(scoreIndicator('BC-01', sv(1)).score).toBe(1));
    it('0 % → score 0 (below all lowerBounds)', () => expect(scoreIndicator('BC-01', sv(0)).score).toBe(0));
    it('100 % → score 4', () => expect(scoreIndicator('BC-01', sv(100)).score).toBe(4));
  });

  describe('BC-02 (higher_is_better, direct %)', () => {
    it('exactly 90 % → score 4', () => expect(scoreIndicator('BC-02', sv(90)).score).toBe(4));
    it('89.999 % → score 3', () => expect(scoreIndicator('BC-02', sv(89.999)).score).toBe(3));
    it('exactly 70 % → score 3', () => expect(scoreIndicator('BC-02', sv(70)).score).toBe(3));
    it('0 % → score 0', () => expect(scoreIndicator('BC-02', sv(0)).score).toBe(0));
    it('100 % → score 4', () => expect(scoreIndicator('BC-02', sv(100)).score).toBe(4));
  });

  describe('BC-08 (higher_is_better, ratio)', () => {
    it('exactly 90 % → score 4', () => expect(scoreIndicator('BC-08', ratio(90, 100)).score).toBe(4));
    it('89.999 % → score 3', () => expect(scoreIndicator('BC-08', ratio(89999, 100000)).score).toBe(3));
    it('exactly 75 % → score 3', () => expect(scoreIndicator('BC-08', ratio(75, 100)).score).toBe(3));
    it('74.999 % → score 2', () => expect(scoreIndicator('BC-08', ratio(74999, 100000)).score).toBe(2));
    it('exactly 50 % → score 2', () => expect(scoreIndicator('BC-08', ratio(50, 100)).score).toBe(2));
    it('49.999 % → score 1', () => expect(scoreIndicator('BC-08', ratio(49999, 100000)).score).toBe(1));
    it('exactly 1 % → score 1', () => expect(scoreIndicator('BC-08', ratio(1, 100)).score).toBe(1));
    it('0 % → score 0', () => expect(scoreIndicator('BC-08', ratio(0, 100)).score).toBe(0));
  });

  describe('BC-09 (higher_is_better, ratio) — same thresholds as BC-08', () => {
    it('exactly 90 % → score 4', () => expect(scoreIndicator('BC-09', ratio(90, 100)).score).toBe(4));
    it('exactly 75 % → score 3', () => expect(scoreIndicator('BC-09', ratio(75, 100)).score).toBe(3));
    it('exactly 50 % → score 2', () => expect(scoreIndicator('BC-09', ratio(50, 100)).score).toBe(2));
    it('0 % → score 0', () => expect(scoreIndicator('BC-09', ratio(0, 100)).score).toBe(0));
  });
});

// ─── 7. IH time-unit conversion ───────────────────────────────────────────────

describe('IH time-unit conversion', () => {
  it('168 h and 7 d (if entered as 168) land in same band (score 2 upper edge)', () => {
    // 7 days = 168 hours; spec band 2 = 1–7 days = 24–168 h; 168 is the ceiling → score 2
    expect(scoreIndicator('IH-06', sv(168)).score).toBe(2);
  });

  it('168.01 h (just over 7 d) → score 1 — boundary is lossless', () => {
    expect(scoreIndicator('IH-06', sv(168.01)).score).toBe(1);
  });

  it('24 h (exactly 1 d) → score 3 upper edge for IH-06', () => {
    expect(scoreIndicator('IH-06', sv(24)).score).toBe(3);
  });

  it('24.01 h → score 2 — no silent rounding shifts boundary', () => {
    expect(scoreIndicator('IH-06', sv(24.01)).score).toBe(2);
  });

  it('IH-07: 72 h = 3 d exactly → score 2 upper edge', () => {
    expect(scoreIndicator('IH-07', sv(72)).score).toBe(2);
  });

  it('IH-07: 72.01 h → score 1 (above 3-day boundary)', () => {
    expect(scoreIndicator('IH-07', sv(72.01)).score).toBe(1);
  });

  it('IH-07: 168 h = 7 d exactly → score 1 upper edge', () => {
    expect(scoreIndicator('IH-07', sv(168)).score).toBe(1);
  });
});

// ─── 8. Input validation / malformed records ──────────────────────────────────

describe('input validation', () => {
  it('numerator > denominator → invalidInput, score null (no silent >100 %)', () => {
    const r = scoreIndicator('BC-08', ratio(11, 10));
    expect(r.score).toBeNull();
    expect(r.invalidInput).toBe(true);
  });

  it('denominator = 0 → invalidInput, score null (no divide-by-zero)', () => {
    const r = scoreIndicator('BC-04', { state: STATE.MEASURED, numerator: '0', denominator: '0' });
    expect(r.score).toBeNull();
    expect(r.invalidInput).toBe(true);
  });

  it('negative value (single) → invalidInput, score null', () => {
    const r = scoreIndicator('IH-06', sv(-5));
    expect(r.score).toBeNull();
    expect(r.invalidInput).toBe(true);
  });

  it('negative numerator → invalidInput, score null', () => {
    const r = scoreIndicator('BC-08', ratio(-1, 10));
    expect(r.score).toBeNull();
    expect(r.invalidInput).toBe(true);
  });

  it('negative denominator → invalidInput, score null', () => {
    const r = scoreIndicator('BC-08', ratio(5, -10));
    expect(r.score).toBeNull();
    expect(r.invalidInput).toBe(true);
  });

  it('non-numeric string while state=measured → invalidInput, score null', () => {
    const r = scoreIndicator('IH-06', { state: STATE.MEASURED, value: 'abc' });
    expect(r.score).toBeNull();
    expect(r.invalidInput).toBe(true);
  });

  it('null value while state=measured → invalidInput, score null', () => {
    const r = scoreIndicator('IH-06', { state: STATE.MEASURED, value: null });
    expect(r.score).toBeNull();
    expect(r.invalidInput).toBe(true);
  });

  it('empty string value while state=measured → invalidInput, score null', () => {
    const r = scoreIndicator('IH-06', { state: STATE.MEASURED, value: '' });
    expect(r.score).toBeNull();
    expect(r.invalidInput).toBe(true);
  });

  it('value present but state=not_measurable → state wins, score null, no invalidInput', () => {
    const r = scoreIndicator('IH-06', { state: STATE.NOT_MEASURABLE, value: '3' });
    expect(r.score).toBeNull();
    expect(r.invalidInput).toBeFalsy();
    expect(r.invalidState).toBeFalsy();
  });

  it('missing indicator from record → score null, no crash', () => {
    // Don't include IH-07 in the record at all
    const rec = makeRecord({
      'IH-06': sv(4),
      'IH-08': sv(4),
    });
    const res = computeAssessment(rec);
    // IH-07 missing → treated as null state → null score → IH incomplete
    expect(res.ih.incomplete).toBe(true);
    expect(res.ih.score).toBeNull();
  });

  it('NaN does not propagate into the dimension mean', () => {
    const rec = makeRecord({
      'IH-06': { state: STATE.MEASURED, value: 'NaN' },
      'IH-07': sv(10),
      'IH-08': sv(10),
    });
    const res = computeAssessment(rec);
    // invalidInput → null → IH incomplete; mean must not be NaN
    expect(res.ih.score).toBeNull();
    expect(Number.isNaN(res.ih.score)).toBe(false);
  });
});

// ─── 9. Pure-function / determinism ───────────────────────────────────────────

describe('pure-function and determinism', () => {
  it('same record twice → deep-equal results', () => {
    const rec = recordWithAllScores(3, 2, 4, 1, 3, 2, 4, 3);
    const r1 = computeAssessment(rec);
    const r2 = computeAssessment(rec);
    expect(r1).toEqual(r2);
  });

  it('computeAssessment does not mutate its input (frozen-input test)', () => {
    const rec = Object.freeze(recordWithAllScores(3, 3, 3, 3, 3, 3, 3, 3));
    expect(() => computeAssessment(rec)).not.toThrow();
    // Record still intact
    expect(rec.indicators['IH-06'].state).toBe(STATE.MEASURED);
  });

  it('result object serializes to JSON and back without score loss', () => {
    const rec = recordWithAllScores(4, 4, 3, 3, 3, 2, 4, 3);
    const res = computeAssessment(rec);
    const serialised = JSON.parse(JSON.stringify(res));
    expect(serialised.ih.score).toBeCloseTo(res.ih.score, 12);
    expect(serialised.bc.score).toBeCloseTo(res.bc.score, 12);
    expect(serialised.overall.score).toBeCloseTo(res.overall.score, 12);
  });

  it('call order does not affect result — two different indicators scored first', () => {
    // Score IH-06 standalone before full assessment
    scoreIndicator('IH-06', sv(4));
    const rec = recordWithAllScores(3, 3, 3, 3, 3, 3, 3, 3);
    const res = computeAssessment(rec);
    expect(res.ih.score).toBeCloseTo(3, 10);
  });
});

// ─── 10. Record round-trip ───────────────────────────────────────────────────

describe('record round-trip', () => {
  it('meta (clientId, assessmentDate) is preserved through scoring', () => {
    const rec = {
      ...recordWithAllScores(3, 3, 3, 3, 3, 3, 3, 3),
      meta: { clientId: 'ClientX', assessmentDate: '2026-06-23' },
    };
    const res = computeAssessment(rec);
    // Engine does not strip meta
    expect(rec.meta.clientId).toBe('ClientX');
    expect(rec.meta.assessmentDate).toBe('2026-06-23');
    // Scores still computed
    expect(res.overall.score).toBeCloseTo(3, 10);
  });

  it('complete record → JSON round-trip → identical record (all indicator inputs preserved)', () => {
    const rec = recordWithAllScores(4, 3, 2, 1, 2, 3, 4, 3);
    const clone = JSON.parse(JSON.stringify(rec));
    const resOrig = computeAssessment(rec);
    const resClone = computeAssessment(clone);
    expect(resOrig).toEqual(resClone);
  });
});

// ─── 11. Property-based tests ────────────────────────────────────────────────

describe('property-based tests (fast-check)', () => {
  const scoreArb = fc.integer({ min: 0, max: 4 });

  it('Overall is always between min(IH, BC) and max(IH, BC)', () => {
    fc.assert(fc.property(
      scoreArb, scoreArb, scoreArb, scoreArb, scoreArb, scoreArb, scoreArb, scoreArb,
      (s06, s07, s08, s01, s02, s04, s08r, s09) => {
        const rec = recordWithAllScores(s06, s07, s08, s01, s02, s04, s08r, s09);
        const res = computeAssessment(rec);
        if (res.overall.score === null) return true;
        const lo = Math.min(res.ih.score, res.bc.score);
        const hi = Math.max(res.ih.score, res.bc.score);
        return res.overall.score >= lo - 1e-10 && res.overall.score <= hi + 1e-10;
      }
    ), { numRuns: 500 });
  });

  it('all-measured dimension → score never null', () => {
    fc.assert(fc.property(
      scoreArb, scoreArb, scoreArb,
      (s06, s07, s08) => {
        const rec = makeRecord({
          'IH-06': SCORE_FIXTURES['IH-06'][s06],
          'IH-07': SCORE_FIXTURES['IH-07'][s07],
          'IH-08': SCORE_FIXTURES['IH-08'][s08],
        });
        const res = computeAssessment(rec);
        return res.ih.score !== null && !res.ih.incomplete;
      }
    ), { numRuns: 200 });
  });

  it('≥1 not_measurable in IH → always incomplete', () => {
    // Generate which of the 3 IH slots is not_measurable (at least one)
    const positionArb = fc.subarray([0, 1, 2], { minLength: 1 });
    fc.assert(fc.property(positionArb, scoreArb, scoreArb, scoreArb,
      (nmPositions, s06, s07, s08) => {
        const scores = [s06, s07, s08];
        const ih06 = nmPositions.includes(0) ? { state: STATE.NOT_MEASURABLE } : SCORE_FIXTURES['IH-06'][scores[0]];
        const ih07 = nmPositions.includes(1) ? { state: STATE.NOT_MEASURABLE } : SCORE_FIXTURES['IH-07'][scores[1]];
        const ih08 = nmPositions.includes(2) ? { state: STATE.NOT_MEASURABLE } : SCORE_FIXTURES['IH-08'][scores[2]];
        const rec = makeRecord({ 'IH-06': ih06, 'IH-07': ih07, 'IH-08': ih08 });
        const res = computeAssessment(rec);
        return res.ih.incomplete === true && res.ih.score === null;
      }
    ), { numRuns: 300 });
  });

  it('BC-04 monotonic across random violation rates', () => {
    fc.assert(fc.property(
      fc.float({ min: 0, max: 50, noNaN: true }),
      fc.float({ min: 0, max: 50, noNaN: true }),
      (a, b) => {
        const low = Math.min(a, b);
        const high = Math.max(a, b);
        if (Math.abs(low - high) < 0.0001) return true;
        const rLow = scoreIndicator('BC-04', ratio(low, 100));
        const rHigh = scoreIndicator('BC-04', ratio(high, 100));
        if (rLow.score === null || rHigh.score === null) return true;
        return rLow.score >= rHigh.score;   // lower rate → higher or equal score
      }
    ), { numRuns: 500 });
  });

  it('adding capability_absent (0) to dimension never raises its mean', () => {
    // Compare IH mean when IH-08=score X vs IH-08=capability_absent (0)
    fc.assert(fc.property(
      scoreArb, scoreArb, fc.integer({ min: 1, max: 4 }), // s08 ≥ 1 so cap-absent lowers mean
      (s06, s07, s08) => {
        const recWithScore = makeRecord({
          'IH-06': SCORE_FIXTURES['IH-06'][s06],
          'IH-07': SCORE_FIXTURES['IH-07'][s07],
          'IH-08': SCORE_FIXTURES['IH-08'][s08],
        });
        const recWithAbsent = makeRecord({
          'IH-06': SCORE_FIXTURES['IH-06'][s06],
          'IH-07': SCORE_FIXTURES['IH-07'][s07],
          'IH-08': { state: STATE.CAPABILITY_ABSENT },
        });
        const resScore = computeAssessment(recWithScore);
        const resAbsent = computeAssessment(recWithAbsent);
        // Replacing a score ≥ 1 with 0 must not raise the mean
        return resAbsent.ih.score <= resScore.ih.score + 1e-10;
      }
    ), { numRuns: 200 });
  });
});
