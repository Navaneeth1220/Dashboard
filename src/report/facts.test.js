/**
 * Fact builder tests — docs/ai-report-spec.md, Step 1.
 *
 * The golden test pins the full Westmaas baseline output (ids, kinds, text,
 * refs) so every wording change shows up in review. Text checks apply to the
 * fact text outside an assessor note: assessor free text is quoted verbatim
 * and is exempt.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import baselineJson from '../../scenarios/Westmaas_2026-01-01_assessment.json?raw';
import followUpJson from '../../scenarios/Westmaas_2026-06-01_assessment.json?raw';
import sparseJson from '../../scenarios/Oudendijk_2026-03-01_assessment.json?raw';
import { buildAssessmentFacts, stripAssessorNote, FACT_KINDS } from './facts.js';
import { loadScenario, assessmentArb } from './testSupport.js';
import { computeAssessment, createBlankAssessment, scoreIndicator } from '../engine/scoring.js';
import { computeGapAnalysis } from '../engine/projection.js';
import { createBlankLayer0 } from '../engine/layer0.js';
import {
  INDICATORS,
  ALL_INDICATOR_IDS,
  SCORE_ZERO_STATES,
  STATE,
} from '../data/indicatorDefinitions.js';
import { LAYER0_ITEMS, LAYER0_ALL_IDS } from '../data/layer0Definitions.js';
import { formatScore } from '../data/displayNames.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const meas = v => ({ state: STATE.MEASURED, value: String(v) });
const ratio = (n, d) => ({ state: STATE.MEASURED, numerator: String(n), denominator: String(d) });

/** Every indicator scored 3 or 4 and every Layer 0 item in a satisfactory state. */
function healthyRecord() {
  return {
    meta: { clientId: 'Acme', assessmentDate: '2026-03-01' },
    indicators: {
      'IH-06': meas(4), 'IH-07': meas(3), 'IH-08': meas(10),
      'BC-01': meas(95), 'BC-02': meas(80),
      'BC-04': ratio(0, 10), 'BC-08': ratio(9, 10), 'BC-09': ratio(8, 10),
    },
    layer0: {
      'L0-asset-inventory': { state: 'present' },
      'L0-risk-assessment': { state: 'present' },
      'L0-interdependency': { state: 'present' },
      'L0-it-ot-boundary': { state: 'present' },
      'L0-multi-homed': { state: 'requirement_satisfied' },
      'L0-bc-plan-doc': { state: 'present' },
      'RM-04': ratio(95, 100),
      'RM-05': { state: 'measured', value: '20' },
      'L0-bc-plan-tested': { state: 'qualifying_test_performed' },
    },
  };
}

function withInputs(base, { indicators = {}, layer0 = {} }) {
  return {
    ...base,
    indicators: { ...base.indicators, ...indicators },
    layer0: { ...base.layer0, ...layer0 },
  };
}

const factsOf = (facts, kind) => facts.filter(f => f.kind === kind);
const factFor = (facts, id) => facts.find(f => ['scored', 'gap_zero', 'no_score'].includes(f.kind) && f.refs.includes(id));

const INTERNAL_ID = /\b(IH|BC|RM)-\d+\b|L0-/;
const RAW_ENUM = /\w*_\w*/;
const LONG_DECIMAL = /\d\.\d{3,}/;
const LAYER_JARGON = /\bLayer\s*[01]\b/i;

/** First text-check violation for a fact (outside its assessor note), or null. */
function textViolation(f) {
  const text = stripAssessorNote(f.text);
  if (INTERNAL_ID.test(text)) return `${f.id}: internal ID`;
  if (RAW_ENUM.test(text)) return `${f.id}: raw enum`;
  if (LONG_DECIMAL.test(text)) return `${f.id}: more than 2 decimals`;
  if (LAYER_JARGON.test(text)) return `${f.id}: layer jargon`;
  return null;
}

// ─── 1. Golden: Westmaas baseline (2026-01-01) ────────────────────────────────

describe('Westmaas baseline', () => {
  it('produces the agreed facts (ids, kinds, text, refs)', () => {
    expect(buildAssessmentFacts(loadScenario(baselineJson)).map(({ data: _data, ...f }) => f)).toEqual([
      { id: 'C1', kind: 'context', refs: [],
        text: 'Assessment of "Westmaas", dated 2026-01-01.' },
      { id: 'C2', kind: 'context', refs: [],
        text: '8 effectiveness indicators in 2 dimensions: Incident Handling (3 indicators) and Business Continuity (5 indicators).' },
      { id: 'C3', kind: 'scale', refs: [],
        text: 'Each indicator is scored 0–4, where 4 is best. A dimension score is the mean of its indicators. If any indicator in a dimension has no score, the dimension is incomplete and has no score.' },
      { id: 'F1', kind: 'dim_incomplete', refs: ['IH', 'IH-08'],
        text: 'Incident Handling: incomplete. Mean Time to Contain has no score, so no Incident Handling score is available.' },
      { id: 'F2', kind: 'dim_complete', refs: ['BC', 'BC-09'],
        text: 'Business Continuity: complete, score 1.80 out of 4 (5 indicators). This includes the programme-gap 0 for RPO Achievement Rate.' },
      { id: 'F3', kind: 'dim_incomplete', refs: ['OVERALL', 'IH'],
        text: 'Overall score: not available, because Incident Handling is incomplete.' },
      { id: 'F4', kind: 'scored', refs: ['IH-06'],
        text: 'Mean Time to Detect: measured at 18 hours (lower is better); score 3. Next level: score 4 at 6 hours or less.' },
      { id: 'F5', kind: 'scored', refs: ['IH-07'],
        text: 'Mean Time to Respond: measured at 30 hours (lower is better); score 2. Next level: score 3 at 24 hours or less.' },
      { id: 'F6', kind: 'no_score', refs: ['IH-08'],
        text: 'Mean Time to Contain: not measurable. Evidence to compute the value is absent or unreliable. No score. This says nothing about how Mean Time to Contain performs. No reason was recorded.' },
      { id: 'F7', kind: 'scored', refs: ['BC-01'],
        text: 'Network Operability Under Disruption: measured at 85%; score 3. Next level: score 4 at 90% or more.' },
      { id: 'F8', kind: 'scored', refs: ['BC-02'],
        text: 'Zone Availability Rate: measured at 40%; score 2. Next level: score 3 at 70% or more.' },
      { id: 'F9', kind: 'scored', refs: ['BC-04'],
        text: 'Operational Threshold Violation Rate: measured at 12.5% (lower is better); score 2. Next level: score 3 at 5% or less.' },
      { id: 'F10', kind: 'scored', refs: ['BC-08'],
        text: 'RTO Achievement Rate: measured at 50%; score 2. Next level: score 3 at 75% or more.' },
      { id: 'F11', kind: 'gap_zero', refs: ['BC-09'],
        text: 'RPO Achievement Rate: recovery point objective not established. Scored 0 as a programme gap: the objective or capability does not exist yet. Not a measured failure.' },
      { id: 'F12', kind: 'l0_ok', refs: ['L0-asset-inventory', 'L0-risk-assessment', 'L0-it-ot-boundary', 'L0-bc-plan-doc'],
        text: 'In place: Asset inventory maintained; Risk assessment per zone; Controlled IT/OT boundary separation; BC plan documented for critical processes.' },
      { id: 'F13', kind: 'l0_flag', refs: ['L0-multi-homed'],
        text: 'CRITICAL. Uncontrolled inter-zone multi-homed devices were identified.' },
      { id: 'F14', kind: 'l0_flag', refs: ['L0-interdependency'],
        text: 'HIGH. Asset interdependency documentation is incomplete or outdated.' },
      { id: 'F15', kind: 'l0_flag', refs: ['L0-bc-plan-tested'],
        text: 'HIGH. No BC plan test was performed during the assessment period — a scheduled action was not completed.' },
      { id: 'F16', kind: 'process', refs: ['RM-04'],
        text: 'MEDIUM NOTE. Vulnerability Remediation Rate: 60%. Vulnerability remediation rate is below target (50–69%) — moderate programme improvement warranted. Process evidence, not scored.' },
      { id: 'F17', kind: 'process', refs: ['RM-05'],
        text: 'Mean Time to Remediate: 75 days. Mean time to remediate is satisfactory (31–90 days) — continue monitoring. Process evidence, not scored.' },
      { id: 'F18', kind: 'advisory', refs: ['L0-multi-homed', 'IH-08'],
        text: 'Zero uncontrolled multi-homed devices is in a weak state (Uncontrolled multi-homing found) and Mean Time to Contain is not measurable. Establishing the architecture foundation and the evidence needed to measure Mean Time to Contain are both measurement-readiness actions — address them together.' },
      { id: 'F19', kind: 'advisory', refs: ['L0-multi-homed', 'BC-02'],
        text: 'Uncontrolled multi-homed devices were found while Zone Availability Rate is poor (score 2). A segmentation bypass of this kind can be directly implicated in this outcome — these may be related; review them together.' },
      { id: 'F20', kind: 'priority', refs: ['BC-09', 'IH-07', 'BC-02', 'BC-04', 'BC-08'],
        text: 'Only 7 of 8 effectiveness indicators have a score. Lowest effectiveness results: RPO Achievement Rate (programme gap, 0); then, at score 2 and of equal priority, listed in catalogue order: Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, RTO Achievement Rate.' },
    ]);
  });

  it('passes the text checks', () => {
    const violations = buildAssessmentFacts(loadScenario(baselineJson)).map(textViolation).filter(Boolean);
    expect(violations).toEqual([]);
  });

  it('carries structured data for the generated sections (never sent to the model)', () => {
    const scored = (name, dimension, value, score, level, lowerIsBetter, target) => ({ name, dimension, value, score, level, lowerIsBetter, target });
    const target = (score, level, value, bound) => ({ score, level, value, bound });
    const multiHomed = { archItemId: 'L0-multi-homed', archState: 'uncontrolled_multi_homing_found' };
    const data = Object.fromEntries(buildAssessmentFacts(loadScenario(baselineJson)).map(f => [f.id, f.data]));
    expect(data).toEqual({
      C1: { clientId: 'Westmaas', assessmentDate: '2026-01-01' },
      C2: {
        indicatorCount: 8,
        dimensions: [
          { dimension: 'IH', name: 'Incident Handling', indicatorCount: 3 },
          { dimension: 'BC', name: 'Business Continuity', indicatorCount: 5 },
        ],
      },
      C3: { min: 0, max: 4 },
      F1: { dimension: 'IH', name: 'Incident Handling', complete: false, missing: ['Mean Time to Contain'] },
      F2: { dimension: 'BC', name: 'Business Continuity', complete: true, score: '1.80', programmeGaps: ['RPO Achievement Rate'] },
      F3: { dimension: 'OVERALL', name: 'Overall score', complete: false, incomplete: ['Incident Handling'] },
      F4: scored('Mean Time to Detect', 'IH', '18 hours', 3, 'Good', true, target(4, 'Excellent', '6 hours', 'max')),
      F5: scored('Mean Time to Respond', 'IH', '30 hours', 2, 'Developing', true, target(3, 'Good', '24 hours', 'max')),
      F6: { name: 'Mean Time to Contain', dimension: 'IH', status: 'not_measurable', rootCause: null, note: null, groupCount: null },
      F7: scored('Network Operability Under Disruption', 'BC', '85%', 3, 'Good', false, target(4, 'Excellent', '90%', 'min')),
      F8: scored('Zone Availability Rate', 'BC', '40%', 2, 'Developing', false, target(3, 'Good', '70%', 'min')),
      F9: scored('Operational Threshold Violation Rate', 'BC', '12.5%', 2, 'Developing', true, target(3, 'Good', '5%', 'max')),
      F10: scored('RTO Achievement Rate', 'BC', '50%', 2, 'Developing', false, target(3, 'Good', '75%', 'min')),
      F11: { name: 'RPO Achievement Rate', dimension: 'BC', state: 'no_rpo_defined' },
      F12: { names: ['Asset inventory maintained', 'Risk assessment per zone', 'Controlled IT/OT boundary separation', 'BC plan documented for critical processes'] },
      F13: { name: 'Zero uncontrolled multi-homed devices', severity: 'critical', message: 'Uncontrolled inter-zone multi-homed devices were identified.' },
      F14: { name: 'Asset interdependency documentation', severity: 'high', message: 'Asset interdependency documentation is incomplete or outdated.' },
      F15: { name: 'BC plan tested within defined period', severity: 'high', message: 'No BC plan test was performed during the assessment period — a scheduled action was not completed.' },
      F16: {
        name: 'Vulnerability Remediation Rate', state: 'measured', value: '60%', severity: 'medium_note',
        band: { band: '50–69%', verdict: 'below target', advice: 'moderate programme improvement warranted' },
        message: 'Vulnerability remediation rate is below target (50–69%) — moderate programme improvement warranted.',
      },
      F17: {
        name: 'Mean Time to Remediate', state: 'measured', value: '75 days', severity: null,
        band: { band: '31–90 days', verdict: 'satisfactory', advice: 'continue monitoring' },
        message: 'Mean time to remediate is satisfactory (31–90 days) — continue monitoring.',
      },
      F18: { rule: 'C', variant: 'readiness', ...multiHomed, relatedId: 'IH-08', relatedName: 'Mean Time to Contain', relatedScore: null, relatedProgrammeGap: false },
      F19: { rule: 'C', variant: 'bypass', ...multiHomed, relatedId: 'BC-02', relatedName: 'Zone Availability Rate', relatedScore: 2, relatedProgrammeGap: false },
      F20: {
        fallback: null,
        scoredCount: 7,
        indicatorCount: 8,
        tiers: [
          { score: 0, level: 'None', items: [{ name: 'RPO Achievement Rate', programmeGap: true }] },
          {
            score: 2, level: 'Developing',
            items: ['Mean Time to Respond', 'Zone Availability Rate', 'Operational Threshold Violation Rate', 'RTO Achievement Rate']
              .map(name => ({ name, programmeGap: false })),
          },
        ],
      },
    });
  });
});

describe('Westmaas follow-up (2026-06-01)', () => {
  const facts = buildAssessmentFacts(loadScenario(followUpJson));

  it('passes the text checks', () => {
    expect(facts.map(textViolation).filter(Boolean)).toEqual([]);
  });

  it('Incident Handling and Overall are complete', () => {
    expect(facts.find(f => f.refs[0] === 'IH').kind).toBe('dim_complete');
    expect(facts.find(f => f.refs[0] === 'OVERALL').text).toBe(
      'Overall score: 2.73 out of 4, the mean of Incident Handling and Business Continuity. It is a secondary summary; the two dimension scores are the primary results.'
    );
  });
});

// ─── 2. Indicator kinds ───────────────────────────────────────────────────────

describe('indicator facts', () => {
  it('measured score 0 is scored + measured failure, not gap_zero', () => {
    const facts = buildAssessmentFacts(withInputs(healthyRecord(), { indicators: { 'BC-02': meas(0) } }));
    const f = factFor(facts, 'BC-02');
    expect(f.kind).toBe('scored');
    expect(f.text).toBe('Zone Availability Rate: measured at 0%; score 0. Measured failure: a measured result, not a programme gap. Next level: score 1 at 1% or more.');
  });

  it('every programme-gap state gives gap_zero, never scored', () => {
    for (const id of ALL_INDICATOR_IDS) {
      for (const state of INDICATORS[id].allowedStates.filter(s => SCORE_ZERO_STATES.has(s))) {
        const facts = buildAssessmentFacts(withInputs(healthyRecord(), { indicators: { [id]: { state } } }));
        const f = factFor(facts, id);
        expect(f.kind, `${id} ${state}`).toBe('gap_zero');
        expect(f.text).toContain('Scored 0 as a programme gap');
        expect(f.text).toContain('Not a measured failure.');
      }
    }
  });

  it('capability absent is worded from its label detail', () => {
    const facts = buildAssessmentFacts(withInputs(healthyRecord(), { indicators: { 'IH-06': { state: STATE.CAPABILITY_ABSENT } } }));
    expect(factFor(facts, 'IH-06').text).toBe(
      'Mean Time to Detect: no identifiable pathway exists for this outcome. Scored 0 as a programme gap: the objective or capability does not exist yet. Not a measured failure.'
    );
  });

  it('no qualifying event gives no_score and no performance wording', () => {
    const facts = buildAssessmentFacts(withInputs(healthyRecord(), { indicators: { 'IH-06': { state: STATE.NO_QUALIFYING_EVENT } } }));
    const f = factFor(facts, 'IH-06');
    expect(f.kind).toBe('no_score');
    expect(f.text).toBe(
      'Mean Time to Detect: no qualifying event. No qualifying incident, exercise, or disruption occurred. No score. This says nothing about how Mean Time to Detect performs.'
    );
  });

  it('no qualifying disruption gives no_score', () => {
    const facts = buildAssessmentFacts(withInputs(healthyRecord(), { indicators: { 'BC-01': { state: STATE.NO_QUALIFYING_DISRUPTION } } }));
    expect(factFor(facts, 'BC-01').kind).toBe('no_score');
    expect(factFor(facts, 'BC-01').text).toContain('no qualifying disruption. No qualifying disruption occurred this period.');
  });

  it('unset gives no_score "not yet assessed"', () => {
    const facts = buildAssessmentFacts(withInputs(healthyRecord(), { indicators: { 'IH-06': { state: null, value: '' } } }));
    expect(factFor(facts, 'IH-06')).toMatchObject({
      kind: 'no_score',
      text: 'Mean Time to Detect: not yet assessed. No state was recorded. No score. This says nothing about how Mean Time to Detect performs.',
    });
  });

  it('invalid input gives no_score "invalid value entered"', () => {
    const facts = buildAssessmentFacts(withInputs(healthyRecord(), { indicators: { 'IH-07': meas(-3) } }));
    expect(factFor(facts, 'IH-07')).toMatchObject({
      kind: 'no_score',
      text: 'Mean Time to Respond: invalid value entered. The value could not be scored. No score. This says nothing about how Mean Time to Respond performs.',
    });
  });

  it('not measurable linked to a Layer 0 item names the item', () => {
    const facts = buildAssessmentFacts(withInputs(healthyRecord(), {
      indicators: { 'IH-08': { state: STATE.NOT_MEASURABLE, reason: { layer0ItemId: 'L0-asset-inventory' } } },
    }));
    expect(factFor(facts, 'IH-08').text).toMatch(/performs\. Recorded root cause: Asset inventory maintained\.$/);
  });

  it('Operational Threshold Violation Rate: 0% → score 4, 60% → score 0 (no second reversal)', () => {
    const best = buildAssessmentFacts(withInputs(healthyRecord(), { indicators: { 'BC-04': ratio(0, 10) } }));
    expect(factFor(best, 'BC-04').text).toBe('Operational Threshold Violation Rate: measured at 0% (lower is better); score 4.');
    const worst = buildAssessmentFacts(withInputs(healthyRecord(), { indicators: { 'BC-04': ratio(6, 10) } }));
    expect(factFor(worst, 'BC-04').text).toMatch(/measured at 60% \(lower is better\); score 0\. Measured failure/);
  });

  it('repeating ratio is rounded to two decimals', () => {
    const facts = buildAssessmentFacts(withInputs(healthyRecord(), { indicators: { 'BC-08': ratio(1, 3) } }));
    expect(factFor(facts, 'BC-08').text).toBe('RTO Achievement Rate: measured at 33.33%; score 1. Next level: score 2 at 50% or more.');
  });
});

// ─── 2b. Targets (Step 7) ─────────────────────────────────────────────────────

describe('targets on scored facts', () => {
  const targetOf = (inputs, id) => factFor(buildAssessmentFacts(withInputs(healthyRecord(), { indicators: inputs })), id);

  it('score 4 has no target and no "Next level" sentence', () => {
    const f = targetOf({}, 'IH-06');   // 4 hours → score 4
    expect(f.data.score).toBe(4);
    expect(f.data.target).toBeNull();
    expect(f.text).not.toContain('Next level');
  });

  it('Operational Threshold Violation Rate is direction-inverted: its targets are maxima', () => {
    const at = (n, d) => targetOf({ 'BC-04': ratio(n, d) }, 'BC-04');
    expect(at(1, 40)).toMatchObject({ // 2.5% → score 3
      text: 'Operational Threshold Violation Rate: measured at 2.5% (lower is better); score 3. Next level: score 4 at 0%.',
      data: { target: { score: 4, level: 'Excellent', value: '0%', bound: 'exact' } },
    });
    expect(at(2, 16).data.target).toEqual({ score: 3, level: 'Good', value: '5%', bound: 'max' });
    expect(at(3, 10).data.target).toEqual({ score: 2, level: 'Developing', value: '20%', bound: 'max' });
    expect(at(6, 10)).toMatchObject({ // 60% → score 0, a measured failure
      text: 'Operational Threshold Violation Rate: measured at 60% (lower is better); score 0. Measured failure: a measured result, not a programme gap. Next level: score 1 at 50% or less.',
      data: { target: { score: 1, level: 'Initial', value: '50%', bound: 'max' } },
    });
  });

  it('a measured 0 on a lower-is-better time targets score 1 in hours', () => {
    expect(targetOf({ 'IH-06': meas(800) }, 'IH-06').text).toBe(
      'Mean Time to Detect: measured at 800 hours (lower is better); score 0. Measured failure: a measured result, not a programme gap. Next level: score 1 at 720 hours or less.'
    );
  });

  it('programme gaps and no-score indicators get no target', () => {
    for (const id of ALL_INDICATOR_IDS) {
      for (const state of INDICATORS[id].allowedStates.filter(s => s !== STATE.MEASURED)) {
        const f = targetOf({ [id]: { state } }, id);
        expect(f.kind, `${id} ${state}`).not.toBe('scored');
        expect(f.text).not.toContain('Next level');
        expect(f.data.target).toBeUndefined();
      }
    }
  });

  it('capability absent carries the capability: detection or response', () => {
    const capability = id => targetOf({ [id]: { state: STATE.CAPABILITY_ABSENT } }, id).data.capability;
    expect(capability('IH-06')).toBe('detection');
    expect(capability('IH-07')).toBe('response');
    expect(capability('IH-08')).toBe('response');
    expect(targetOf({ 'BC-09': { state: STATE.NO_RPO_DEFINED } }, 'BC-09').data.capability).toBeUndefined();
  });

  it('property: every target is the engine\'s next band, in the right direction, and scores as promised', () => {
    const measuredAt = (id, value) => (INDICATORS[id].inputType === 'ratio'
      ? { state: STATE.MEASURED, numerator: String(Math.round(value * 100)), denominator: '10000' }
      : { state: STATE.MEASURED, value: String(value) });
    fc.assert(fc.property(assessmentArb, assessment => {
      const results = computeAssessment(assessment);
      const { gaps } = computeGapAnalysis(assessment, results);
      for (const f of buildAssessmentFacts(assessment).filter(x => x.kind === 'scored')) {
        const id = f.refs[0];
        const gap = gaps.find(g => g.indicatorId === id);
        if (f.data.score === 4) {
          expect(f.data.target).toBeNull();
          continue;
        }
        const { targetScore, thresholdValue } = gap.nextBand;
        const lower = INDICATORS[id].direction === 'lower_is_better';
        expect(f.data.target.score).toBe(targetScore);
        expect(f.data.target.bound).toBe(lower ? (thresholdValue === 0 ? 'exact' : 'max') : 'min');
        expect(f.text.endsWith(`Next level: score ${targetScore} at ${f.data.target.value}${
          f.data.target.bound === 'max' ? ' or less' : f.data.target.bound === 'min' ? ' or more' : ''}.`)).toBe(true);
        // A value at the target reaches the target score; just past it on the wrong side does not.
        expect(scoreIndicator(id, measuredAt(id, thresholdValue)).score).toBe(targetScore);
        expect(scoreIndicator(id, measuredAt(id, thresholdValue + (lower ? 0.01 : -0.01))).score).toBeLessThan(targetScore);
      }
    }), { numRuns: 200 });
  });
});

// ─── 3. Assessor notes ────────────────────────────────────────────────────────

describe('assessor notes', () => {
  const note = 'Logs for IH-07   purged after\n12.3456 days; see ticket_42';
  const facts = buildAssessmentFacts(withInputs(healthyRecord(), {
    indicators: { 'IH-08': { state: STATE.NOT_MEASURABLE, reason: { text: note } } },
  }));
  const f = factFor(facts, 'IH-08');

  it('is included verbatim (whitespace collapsed), quoted and marked, at the end', () => {
    expect(f.text).toMatch(/performs\. Assessor note: "Logs for IH-07 purged after 12\.3456 days; see ticket_42"$/);
  });

  it('contains an ID, a raw enum and a long decimal, yet passes the text checks', () => {
    expect(f.text).toMatch(INTERNAL_ID);
    expect(f.text).toMatch(RAW_ENUM);
    expect(f.text).toMatch(LONG_DECIMAL);
    expect(textViolation(f)).toBeNull();
  });

  it('follows the linked root cause when both are given', () => {
    const linked = buildAssessmentFacts(withInputs(healthyRecord(), {
      indicators: { 'IH-08': { state: STATE.NOT_MEASURABLE, reason: { layer0ItemId: 'L0-asset-inventory', text: 'CMDB stale' } } },
    }));
    expect(factFor(linked, 'IH-08').text).toMatch(/Recorded root cause: Asset inventory maintained\. Assessor note: "CMDB stale"$/);
  });

  it('stripAssessorNote leaves text without a note unchanged', () => {
    expect(stripAssessorNote('No reason was recorded.')).toBe('No reason was recorded.');
  });
});

// ─── 4. Dimensions ────────────────────────────────────────────────────────────

describe('dimension facts', () => {
  it('complete Overall is a secondary summary with a two-decimal score', () => {
    const rec = healthyRecord();
    const facts = buildAssessmentFacts(rec);
    const overall = facts.find(f => f.refs[0] === 'OVERALL');
    expect(overall.kind).toBe('dim_complete');
    expect(overall.text).toContain(`Overall score: ${formatScore(computeAssessment(rec).overall.score)} out of 4`);
    expect(overall.text).toContain('secondary summary');
  });

  it('Overall names both dimensions when both are incomplete', () => {
    const facts = buildAssessmentFacts(withInputs(healthyRecord(), {
      indicators: { 'IH-06': { state: STATE.NOT_MEASURABLE }, 'BC-01': { state: STATE.NO_QUALIFYING_DISRUPTION } },
    }));
    expect(facts.find(f => f.refs[0] === 'OVERALL')).toMatchObject({
      kind: 'dim_incomplete',
      refs: ['OVERALL', 'IH', 'BC'],
      text: 'Overall score: not available, because Incident Handling and Business Continuity are incomplete.',
    });
  });

  it('incomplete dimension names every indicator without a score', () => {
    const facts = buildAssessmentFacts(withInputs(healthyRecord(), {
      indicators: { 'IH-06': { state: STATE.NOT_MEASURABLE }, 'IH-08': { state: null, value: '' } },
    }));
    expect(facts.find(f => f.refs[0] === 'IH').text).toBe(
      'Incident Handling: incomplete. Mean Time to Detect and Mean Time to Contain have no score, so no Incident Handling score is available.'
    );
  });

  it('complete dimension without a programme gap does not mention one', () => {
    const facts = buildAssessmentFacts(healthyRecord());
    expect(facts.find(f => f.refs[0] === 'BC').text).not.toContain('programme-gap');
  });
});

// ─── 5. Foundational controls and process evidence ────────────────────────────

describe('Layer 0 facts', () => {
  it('blank Layer 0 gives one l0_unset fact and no l0_ok', () => {
    const facts = buildAssessmentFacts({ ...healthyRecord(), layer0: createBlankLayer0() });
    expect(factsOf(facts, 'l0_ok')).toEqual([]);
    const unset = factsOf(facts, 'l0_unset');
    expect(unset).toHaveLength(1);
    expect(unset[0].refs).toEqual(LAYER0_ALL_IDS);
    expect(unset[0].text).toMatch(/^Not yet assessed \(no state recorded\): Asset inventory maintained; .*\. This says nothing about whether they are in place\.$/);
  });

  it('flagged asset inventory omits the contextual note', () => {
    const facts = buildAssessmentFacts(withInputs(healthyRecord(), { layer0: { 'L0-asset-inventory': { state: 'missing' } } }));
    expect(factsOf(facts, 'l0_flag').map(f => f.text)).toEqual(['CRITICAL. Asset inventory is not maintained.']);
    expect(facts.some(f => f.text.includes(LAYER0_ITEMS['L0-asset-inventory'].contextualNote))).toBe(false);
  });

  it('process items never become l0_flag facts', () => {
    const facts = buildAssessmentFacts(withInputs(healthyRecord(), { layer0: { 'RM-04': { state: 'process_absent' } } }));
    expect(factsOf(facts, 'l0_flag')).toEqual([]);
    expect(factsOf(facts, 'process')[0].text).toBe(
      'CRITICAL. Vulnerability Remediation Rate: process absent. No vulnerability management programme or remediation tracking exists. Process evidence, not scored.'
    );
  });

  it('process item at best band has no severity and no message', () => {
    const facts = buildAssessmentFacts(healthyRecord());
    expect(factsOf(facts, 'process').map(f => f.text)).toEqual([
      'Vulnerability Remediation Rate: 95%. Process evidence, not scored.',
      'Mean Time to Remediate: 20 days. Process evidence, not scored.',
    ]);
  });

  it('engine message IDs are replaced by descriptive names', () => {
    const facts = buildAssessmentFacts(withInputs(healthyRecord(), { layer0: { 'RM-05': { state: 'no_remediated_vulnerabilities' } } }));
    expect(factsOf(facts, 'process')[1].text).toBe(
      'Mean Time to Remediate: no remediated vulnerabilities. No vulnerabilities were remediated this period — interpret alongside Vulnerability Remediation Rate. Process evidence, not scored.'
    );
  });

  it('invalid process value is stated without a value', () => {
    const facts = buildAssessmentFacts(withInputs(healthyRecord(), { layer0: { 'RM-04': ratio(5, 0) } }));
    expect(factsOf(facts, 'process')[0].text).toBe('Vulnerability Remediation Rate: invalid value entered. Process evidence, not scored.');
  });
});

// ─── 6. Advisories ────────────────────────────────────────────────────────────

describe('advisory facts', () => {
  it('Rule A messages carry names, not IDs', () => {
    const facts = buildAssessmentFacts(withInputs(healthyRecord(), { indicators: { 'IH-06': meas(100) } }));
    expect(factsOf(facts, 'advisory').map(f => f.text)).toEqual([
      'Detection is slow (Mean Time to Detect score 2 < 3). Improving response speed (Mean Time to Respond) has limited value while detection remains slow.',
      'Detection is slow (Mean Time to Detect score 2 < 3). Improving containment speed (Mean Time to Contain) has limited value while detection remains slow.',
    ]);
  });

  it('Rule B auto-sentence names the Business Continuity score', () => {
    const facts = buildAssessmentFacts(withInputs(healthyRecord(), {
      indicators: {
        'BC-01': meas(10), 'BC-02': meas(10), 'BC-04': ratio(6, 10), 'BC-08': ratio(1, 10), 'BC-09': ratio(1, 10),
      },
    }));
    const b = factsOf(facts, 'advisory').find(f => f.refs.join() === 'IH-08,BC');
    expect(b.text).toMatch(/^Containment was fast \(Mean Time to Contain score 3 ≥ 3\) but Business Continuity is low \(Business Continuity score 0\.80 < 2\)\./);
  });

  it('Rule D BC plan hints are excluded', () => {
    const facts = buildAssessmentFacts(withInputs(healthyRecord(), { layer0: { 'L0-bc-plan-doc': { state: 'missing' } } }));
    expect(facts.some(f => /assessor may select|before scoring/.test(f.text))).toBe(false);
  });
});

// ─── 7. Priority ──────────────────────────────────────────────────────────────

describe('priority fact', () => {
  /** healthyRecord with only the given indicators kept; the rest not yet assessed. */
  function onlyScored(...ids) {
    const rec = healthyRecord();
    const blank = createBlankAssessment().indicators;
    return { ...rec, indicators: { ...blank, ...Object.fromEntries(ids.map(id => [id, rec.indicators[id]])) } };
  }
  const priorityOf = rec => factsOf(buildAssessmentFacts(rec), 'priority')[0];

  it('nothing below 3, all scored: coverage "All 8", then "none is below"', () => {
    expect(priorityOf(healthyRecord())).toMatchObject({
      text: 'All 8 effectiveness indicators have a score; none is below 3 (Good).',
      data: { fallback: 'none_below', threshold: 3, thresholdLevel: 'Good', tiers: [], scoredCount: 8, indicatorCount: 8 },
    });
  });

  it('nothing below 3, 2 scored (sparse-scenario manual check): "Only 2 of 8 …; neither is below"', () => {
    expect(priorityOf(onlyScored('IH-06', 'BC-01'))).toMatchObject({
      text: 'Only 2 of 8 effectiveness indicators have a score; neither is below 3 (Good).',
      data: { fallback: 'none_below', scoredCount: 2, indicatorCount: 8 },
    });
  });

  it('nothing below 3, 1 scored: "Only 1 of 8 … has a score; it is not below"', () => {
    expect(priorityOf(onlyScored('BC-01')).text).toBe('Only 1 of 8 effectiveness indicators has a score; it is not below 3 (Good).');
  });

  it('nothing below 3, 3 scored: "none is below"', () => {
    expect(priorityOf(onlyScored('IH-06', 'IH-07', 'BC-01')).text).toBe('Only 3 of 8 effectiveness indicators have a score; none is below 3 (Good).');
  });

  it('nothing scored gives the fallback, unchanged, with the counts in data', () => {
    const facts = buildAssessmentFacts({ ...healthyRecord(), indicators: createBlankAssessment().indicators });
    expect(factsOf(facts, 'priority')).toEqual([{
      id: expect.any(String), kind: 'priority', refs: [],
      text: 'No effectiveness indicator has a score, so there is no ranking of results.',
      data: { fallback: 'none_scored', tiers: [], scoredCount: 0, indicatorCount: 8 },
    }]);
  });

  it('a tie at 0 keeps programme gap and measured failure distinct', () => {
    const facts = buildAssessmentFacts(withInputs(healthyRecord(), {
      indicators: { 'BC-02': meas(0), 'BC-09': { state: STATE.NO_RPO_DEFINED } },
    }));
    expect(factsOf(facts, 'priority')[0].text).toBe(
      'All 8 effectiveness indicators have a score. Lowest effectiveness results: at score 0 and of equal priority, listed in catalogue order: Zone Availability Rate (measured failure), RPO Achievement Rate (programme gap).'
    );
  });

  it('tiers with partial coverage: "Only N of 8 ….  Lowest effectiveness results: …"', () => {
    const rec = onlyScored('IH-06', 'BC-02');
    rec.indicators['BC-02'] = meas(0);
    expect(priorityOf(rec).text).toBe(
      'Only 2 of 8 effectiveness indicators have a score. Lowest effectiveness results: Zone Availability Rate (measured failure, 0).'
    );
  });

  it('the counts come from the engine: scored = indicators with a score, a programme-gap 0 included', () => {
    fc.assert(fc.property(assessmentArb, rec => {
      const scored = Object.values(computeAssessment(rec).indicators).filter(r => r.score !== null).length;
      const { text, data } = priorityOf(rec);
      expect(data.scoredCount).toBe(scored);
      expect(data.indicatorCount).toBe(8);
      if (scored === 0) expect(text).toBe('No effectiveness indicator has a score, so there is no ranking of results.');
      else if (scored === 8) expect(text).toMatch(/^All 8 effectiveness indicators have a score[.;]/);
      else expect(text).toMatch(new RegExp(`^Only ${scored} of 8 effectiveness indicators ha(s|ve) a score[.;]`));
    }), { numRuns: 200 });
  });
});

// ─── 8. General ───────────────────────────────────────────────────────────────

describe('general', () => {
  it('is deterministic and does not mutate its input', () => {
    const rec = loadScenario(baselineJson);
    const before = JSON.stringify(rec);
    expect(buildAssessmentFacts(rec)).toEqual(buildAssessmentFacts(rec));
    expect(JSON.stringify(rec)).toBe(before);
  });

  it('only emits known kinds', () => {
    const kinds = buildAssessmentFacts(loadScenario(baselineJson)).map(f => f.kind);
    expect(kinds.every(k => FACT_KINDS.includes(k))).toBe(true);
  });
});

// ─── 9. Property tests ────────────────────────────────────────────────────────

describe('property-based tests (fast-check)', () => {
  it('every no-score indicator is in exactly one no_score fact and no scored fact', () => {
    fc.assert(fc.property(assessmentArb, rec => {
      const facts = buildAssessmentFacts(rec);
      const results = computeAssessment(rec);
      for (const id of ALL_INDICATOR_IDS.filter(i => results.indicators[i].score === null)) {
        expect(factsOf(facts, 'no_score').filter(f => f.refs.includes(id))).toHaveLength(1);
        expect(factsOf(facts, 'scored').filter(f => f.refs.includes(id))).toHaveLength(0);
      }
    }), { numRuns: 300 });
  });

  it('process facts never contain "score" followed by a digit', () => {
    fc.assert(fc.property(assessmentArb, rec => {
      for (const f of factsOf(buildAssessmentFacts(rec), 'process')) {
        expect(f.text).not.toMatch(/score\s*\d/i);
      }
    }), { numRuns: 300 });
  });

  it('all facts pass the text checks outside assessor notes', () => {
    fc.assert(fc.property(assessmentArb, rec => {
      expect(buildAssessmentFacts(rec).map(textViolation).filter(Boolean)).toEqual([]);
    }), { numRuns: 300 });
  });

  it('dimension facts follow the engine', () => {
    fc.assert(fc.property(assessmentArb, rec => {
      const facts = buildAssessmentFacts(rec);
      const results = computeAssessment(rec);
      for (const [dim, agg] of [['IH', results.ih], ['BC', results.bc], ['OVERALL', results.overall]]) {
        const f = facts.find(x => x.refs[0] === dim);
        if (agg.score === null) {
          expect(f.kind).toBe('dim_incomplete');
          expect(f.text).not.toMatch(/\d\.\d\d/);
        } else {
          expect(f.kind).toBe('dim_complete');
          expect(f.text).toContain(formatScore(agg.score));
        }
      }
    }), { numRuns: 300 });
  });

  it('each indicator has exactly one indicator fact, with the engine score', () => {
    fc.assert(fc.property(assessmentArb, rec => {
      const facts = buildAssessmentFacts(rec);
      const results = computeAssessment(rec);
      for (const id of ALL_INDICATOR_IDS) {
        const own = facts.filter(f => ['scored', 'gap_zero', 'no_score'].includes(f.kind) && f.refs.includes(id));
        expect(own).toHaveLength(1);
        const score = results.indicators[id].score;
        if (own[0].kind === 'scored') expect(own[0].text).toMatch(new RegExp(`; score ${score}\\.`));
        if (own[0].kind === 'gap_zero') expect(score).toBe(0);
      }
    }), { numRuns: 300 });
  });

  it('ids are unique, contiguous, and there is exactly one priority fact', () => {
    fc.assert(fc.property(assessmentArb, rec => {
      const facts = buildAssessmentFacts(rec);
      const isC = f => f.kind === 'context' || f.kind === 'scale';
      const c = facts.filter(isC).map(f => f.id);
      const other = facts.filter(f => !isC(f)).map(f => f.id);
      expect(c).toEqual(['C1', 'C2', 'C3']);
      expect(c).toEqual(c.map((_, i) => `C${i + 1}`));
      expect(other).toEqual(other.map((_, i) => `F${i + 1}`));
      expect(factsOf(facts, 'priority')).toHaveLength(1);
    }), { numRuns: 200 });
  });
});

// ─── Group counts of no-score states (Oudendijk manual check) ─────────────────

describe('no-score group count', () => {
  const noScoreFacts = rec => buildAssessmentFacts(rec).filter(f => f.kind === 'no_score');

  it('Oudendijk: each of the six unassessed indicators states the group size', () => {
    const facts = noScoreFacts(loadScenario(sparseJson));
    expect(facts.map(f => f.refs[0])).toEqual(['IH-07', 'IH-08', 'BC-02', 'BC-04', 'BC-08', 'BC-09']);
    expect(facts[0].text).toBe(
      'Mean Time to Respond: not yet assessed. No state was recorded. No score. This says nothing about how Mean Time to Respond performs. ' +
      'It is one of 6 effectiveness indicators that are not yet assessed.'
    );
    for (const f of facts) {
      expect(f.data.groupCount).toBe(6);
      expect(f.text.endsWith('It is one of 6 effectiveness indicators that are not yet assessed.')).toBe(true);
    }
  });

  it('a single indicator in its state gets no count (Westmaas F6 unchanged)', () => {
    const f6 = noScoreFacts(loadScenario(baselineJson))[0];
    expect(f6.data.groupCount).toBeNull();
    expect(f6.text).not.toMatch(/one of/);
  });

  it('the count comes before the reason and the assessor note, which stays last', () => {
    const rec = loadScenario(baselineJson);
    rec.indicators = {
      ...rec.indicators,
      'IH-06': { state: STATE.NOT_MEASURABLE, reason: { text: 'SIEM retention too short' } },
      'IH-08': { state: STATE.NOT_MEASURABLE },
    };
    const [detect, contain] = noScoreFacts(rec);
    expect(detect.text).toBe(
      'Mean Time to Detect: not measurable. Evidence to compute the value is absent or unreliable. No score. ' +
      'This says nothing about how Mean Time to Detect performs. It is one of 2 effectiveness indicators that are not measurable. ' +
      'Assessor note: "SIEM retention too short"'
    );
    expect(contain.text).toMatch(/It is one of 2 effectiveness indicators that are not measurable\. No reason was recorded\.$/);
  });

  it('each state has its own group and wording', () => {
    const rec = loadScenario(baselineJson);
    rec.indicators = {
      ...rec.indicators,
      'IH-06': { state: STATE.NO_QUALIFYING_EVENT }, 'IH-07': { state: STATE.NO_QUALIFYING_EVENT },
      'BC-01': { state: STATE.NO_QUALIFYING_DISRUPTION }, 'BC-02': { state: STATE.NO_QUALIFYING_DISRUPTION },
      'BC-04': { state: STATE.MEASURED, numerator: '5', denominator: '2' }, 'BC-08': { state: STATE.MEASURED, numerator: '-1', denominator: '2' },
    };
    const byId = Object.fromEntries(noScoreFacts(rec).map(f => [f.refs[0], f.text]));
    expect(byId['IH-06']).toMatch(/It is one of 2 effectiveness indicators that had no qualifying event\.$/);
    expect(byId['BC-01']).toMatch(/It is one of 2 effectiveness indicators that had no qualifying disruption\.$/);
    expect(byId['BC-04']).toMatch(/It is one of 2 effectiveness indicators that have an invalid value\.$/);
    expect(byId['IH-08']).not.toMatch(/one of/);   // the only not-measurable one
  });

  it('property: the count equals the number of no-score indicators in the same state, stated only for groups of two or more', () => {
    fc.assert(fc.property(assessmentArb, rec => {
      const facts = noScoreFacts(rec);
      for (const f of facts) {
        const size = facts.filter(g => g.data.status === f.data.status).length;
        expect(f.data.groupCount).toBe(size >= 2 ? size : null);
        expect(stripAssessorNote(f.text).includes(`It is one of ${size} effectiveness indicators`)).toBe(size >= 2);
      }
    }), { numRuns: 200 });
  });
});
