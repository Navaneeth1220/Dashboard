/**
 * Generated sections tests — docs/ai-report-spec.md, Step 3b.
 *
 * The Westmaas text is pinned exactly: every wording change shows up in
 * review. The generated sections must always pass the validator.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import baselineJson from '../../scenarios/Westmaas_2026-01-01_assessment.json?raw';
import followUpJson from '../../scenarios/Westmaas_2026-06-01_assessment.json?raw';
import { buildGeneratedSections } from './templates.js';
import { buildAssessmentFacts, stripAssessorNote } from './facts.js';
import { validateNarrative } from './validator.js';
import { GENERATED_KEYS } from './schema.js';
import { loadScenario, assessmentArb } from './testSupport.js';
import { INDICATORS, ALL_INDICATOR_IDS, SCORE_ZERO_STATES, STATE } from '../data/indicatorDefinitions.js';
import { LAYER0_ITEMS } from '../data/layer0Definitions.js';
import { PROGRAMME_GAP_WORDING } from '../data/reportWording.js';
import { displayName } from '../data/displayNames.js';

const BASELINE = loadScenario(baselineJson);

function generatedFor(changes = {}) {
  const rec = loadScenario(baselineJson);
  rec.indicators = { ...rec.indicators, ...(changes.indicators ?? {}) };
  rec.layer0 = { ...rec.layer0, ...(changes.layer0 ?? {}) };
  const facts = buildAssessmentFacts(rec);
  return { facts, generated: buildGeneratedSections(facts) };
}

const meas = v => ({ state: STATE.MEASURED, value: String(v) });
const ratio = (n, d) => ({ state: STATE.MEASURED, numerator: String(n), denominator: String(d) });

function validGenerated(facts, generated) {
  return validateNarrative({ sections: generated }, facts, { parts: GENERATED_KEYS });
}

// ─── Westmaas baseline ────────────────────────────────────────────────────────

describe('Westmaas baseline', () => {
  const facts = buildAssessmentFacts(BASELINE);
  const generated = buildGeneratedSections(facts);

  it('returns the four generated sections', () => {
    expect(Object.keys(generated)).toEqual(GENERATED_KEYS);
  });

  it('measuredPerformance', () => {
    expect(generated.measuredPerformance).toEqual({
      factIds: ['C3', 'F4', 'F5', 'F7', 'F8', 'F9', 'F10'],
      text: 'Each effectiveness indicator is scored from 0 to 4, where 4 is best. In Incident Handling, Mean Time to Detect was 18 hours (score 3, Good) and Mean Time to Respond was 30 hours (score 2, Developing). In Business Continuity, Network Operability Under Disruption was 85% (score 3, Good), Zone Availability Rate was 40% (score 2, Developing), Operational Threshold Violation Rate was 12.5% (score 2, Developing) and RTO Achievement Rate was 50% (score 2, Developing). For Mean Time to Detect, Mean Time to Respond and Operational Threshold Violation Rate, lower values are better.',
    });
  });

  it('gapsAndMissingEvidence', () => {
    expect(generated.gapsAndMissingEvidence).toEqual({
      factIds: ['F1', 'F3', 'F6', 'F11'],
      text: [
        'Mean Time to Contain is not measurable: evidence to compute the value is absent or unreliable, and no reason was recorded. This says nothing about how Mean Time to Contain performs, but without it Incident Handling has no score, so there is no overall score either.',
        'No recovery point objective has been established for RPO Achievement Rate, so it scores 0 as a programme gap; this is not a measured failure.',
      ].join('\n\n'),
    });
  });

  it('foundationsAndFlags', () => {
    expect(generated.foundationsAndFlags).toEqual({
      factIds: ['F12', 'F13', 'F14', 'F15', 'F16', 'F17', 'F18', 'F19'],
      text: [
        'In place: Asset inventory maintained, Risk assessment per zone, Controlled IT/OT boundary separation and BC plan documented for critical processes.',
        'The following issues were flagged (listed by severity; this is not an order of action). Critical: uncontrolled inter-zone multi-homed devices were identified. High: asset interdependency documentation is incomplete or outdated, and no BC plan test was performed during the assessment period — a scheduled action was not completed.',
        'Process evidence is reported without a score. Vulnerability Remediation Rate is 60%, in the 50–69% band, which is below target — moderate programme improvement warranted (medium note). Mean Time to Remediate is 75 days, in the 31–90 days band, which is satisfactory — continue monitoring.',
        'Read together (advisory only; no scores change): the uncontrolled multi-homed devices and Zone Availability Rate (score 2, Developing) may be related, because a segmentation bypass can affect zone availability; review them together. Removing the multi-homed devices and establishing the evidence to measure Mean Time to Contain are both measurement-readiness actions; address them together.',
      ].join('\n\n'),
    });
  });

  it('priorities', () => {
    expect(generated.priorities).toEqual({
      factIds: ['F6', 'F20'],
      text: 'Ranked by score, where a lower score is more urgent: the lowest effectiveness result is RPO Achievement Rate, a programme gap at score 0. Next, at score 2 and of equal priority, are Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate and RTO Achievement Rate, listed in catalogue order. Mean Time to Contain is not ranked because it has no score.',
    });
  });

  it('passes the validator', () => {
    expect(validGenerated(facts, generated).errors).toEqual([]);
  });
});

describe('Westmaas follow-up (2026-06-01)', () => {
  const facts = buildAssessmentFacts(loadScenario(followUpJson));
  const generated = buildGeneratedSections(facts);

  it('passes the validator and reports the now-measured Mean Time to Contain', () => {
    expect(validGenerated(facts, generated).errors).toEqual([]);
    expect(generated.measuredPerformance.text).toContain('Mean Time to Contain was 20 hours (score 3, Good)');
    expect(generated.gapsAndMissingEvidence.text).toBe(
      'No evidence is missing and no programme gaps were found: every effectiveness indicator has a score.'
    );
  });
});

// ─── Variants ─────────────────────────────────────────────────────────────────

describe('measuredPerformance variants', () => {
  it('a measured 0 is a measured failure', () => {
    const { generated } = generatedFor({ indicators: { 'BC-02': meas(0) } });
    expect(generated.measuredPerformance.text).toContain('Zone Availability Rate was 0% (score 0, measured failure)');
  });

  it('nothing measured', () => {
    const rec = loadScenario(baselineJson);
    const indicators = Object.fromEntries(ALL_INDICATOR_IDS.map(id => [id, { state: null }]));
    const facts = buildAssessmentFacts({ ...rec, indicators });
    expect(buildGeneratedSections(facts).measuredPerformance).toEqual({
      factIds: ['C2'], text: 'No effectiveness indicator was measured and scored in this assessment.',
    });
  });
});

describe('gapsAndMissingEvidence variants', () => {
  it('not measurable with a linked root cause and an assessor note', () => {
    const { generated } = generatedFor({
      indicators: { 'IH-08': { state: STATE.NOT_MEASURABLE, reason: { layer0ItemId: 'L0-asset-inventory', text: 'CMDB stale' } } },
    });
    expect(generated.gapsAndMissingEvidence.text).toContain(
      'Mean Time to Contain is not measurable: evidence to compute the value is absent or unreliable; the recorded root cause is Asset inventory maintained, and the assessor noted "CMDB stale".'
    );
  });

  it('not measurable with an assessor note only', () => {
    const { generated } = generatedFor({ indicators: { 'IH-08': { state: STATE.NOT_MEASURABLE, reason: { text: 'SIEM retention too short' } } } });
    expect(generated.gapsAndMissingEvidence.text).toContain('; the assessor noted "SIEM retention too short".');
  });

  it('no qualifying event, not yet assessed, invalid value', () => {
    const { generated } = generatedFor({ indicators: { 'IH-06': { state: STATE.NO_QUALIFYING_EVENT }, 'IH-07': meas(-3), 'BC-01': { state: null } } });
    const text = generated.gapsAndMissingEvidence.text;
    expect(text).toContain('For Mean Time to Detect, no qualifying incident, exercise, or disruption occurred. Nothing occurred to assess this indicator.');
    expect(text).toContain('An invalid value was entered for Mean Time to Respond, so it could not be scored.');
    expect(text).toContain('Network Operability Under Disruption is not yet assessed.');
    expect(text).toContain('This says nothing about how Mean Time to Detect, Mean Time to Respond, Mean Time to Contain and Network Operability Under Disruption perform, but without them Incident Handling and Business Continuity have no score, so there is no overall score either.');
  });

  it('every programme-gap state has its own sentence', () => {
    for (const id of ALL_INDICATOR_IDS) {
      for (const state of INDICATORS[id].allowedStates.filter(s => SCORE_ZERO_STATES.has(s))) {
        const { facts, generated } = generatedFor({ indicators: { [id]: { state } } });
        expect(generated.gapsAndMissingEvidence.text, `${id} ${state}`).toContain(
          `${PROGRAMME_GAP_WORDING[state](displayName(id))}, so it scores 0 as a programme gap; this is not a measured failure.`
        );
        expect(validGenerated(facts, generated).errors, `${id} ${state}`).toEqual([]);
      }
    }
  });
});

describe('foundationsAndFlags variants', () => {
  it('unassessed foundational item', () => {
    const { generated } = generatedFor({ layer0: { 'L0-asset-inventory': { state: null } } });
    expect(generated.foundationsAndFlags.text).toContain('Not yet assessed: Asset inventory maintained. This says nothing about whether it is in place.');
  });

  it('a flag message starting with an acronym keeps its capitals ("BC plan …")', () => {
    const { generated } = generatedFor({ layer0: { 'L0-bc-plan-doc': { state: 'missing' } } });
    expect(generated.foundationsAndFlags.text).toContain('Critical: uncontrolled inter-zone multi-homed devices were identified, and BC plan for critical processes is not documented.');
  });

  it('process evidence: process absent, not measurable, best band, invalid value', () => {
    let text = generatedFor({ layer0: { 'RM-04': { state: 'process_absent' } } }).generated.foundationsAndFlags.text;
    expect(text).toContain('For Vulnerability Remediation Rate, no vulnerability management programme or remediation tracking exists (critical).');
    text = generatedFor({ layer0: { 'RM-05': { state: 'not_measurable' } } }).generated.foundationsAndFlags.text;
    expect(text).toContain('For Mean Time to Remediate, remediation time data is not available — evidence gap (high).');
    text = generatedFor({ layer0: { 'RM-04': ratio(95, 100) } }).generated.foundationsAndFlags.text;
    expect(text).toContain('Vulnerability Remediation Rate is 95%.');
    text = generatedFor({ layer0: { 'RM-04': ratio(5, 0) } }).generated.foundationsAndFlags.text;
    expect(text).toContain('An invalid value was entered for Vulnerability Remediation Rate.');
  });

  it('advisory: missing boundary with a poor related result', () => {
    const { generated } = generatedFor({
      layer0: { 'L0-it-ot-boundary': { state: 'missing' } },
      indicators: { 'BC-01': meas(10) },
    });
    expect(generated.foundationsAndFlags.text).toContain(
      'the missing IT/OT boundary separation and Network Operability Under Disruption (score 1, Initial) may be related, because a weak boundary control can affect network operability; review them together.'
    );
  });

  it('advisory: programme-gap related result', () => {
    const { generated } = generatedFor({ indicators: { 'IH-08': { state: STATE.CAPABILITY_ABSENT } } });
    expect(generated.foundationsAndFlags.text).toContain(
      'the uncontrolled multi-homed devices and Mean Time to Contain (score 0, programme gap) may be related, because a segmentation bypass can affect containment; review them together.'
    );
  });

  it('advisory: detection slow (hard) and response slow (soft)', () => {
    const { generated } = generatedFor({ indicators: { 'IH-06': meas(100), 'IH-07': meas(100) } });
    const text = generated.foundationsAndFlags.text;
    expect(text).toContain('With Mean Time to Detect at score 2 (Developing), improving Mean Time to Respond has limited value while detection remains slow.');
    expect(text).toContain('With Mean Time to Respond at score 1 (Initial), check that Mean Time to Contain is read correctly given the slow response.');
  });

  it('advisory: fast containment with low Business Continuity', () => {
    const { generated } = generatedFor({
      indicators: { 'IH-08': meas(10), 'BC-01': meas(10), 'BC-02': meas(10), 'BC-04': ratio(6, 10), 'BC-08': ratio(1, 10), 'BC-09': ratio(1, 10) },
    });
    expect(generated.foundationsAndFlags.text).toContain(
      'Mean Time to Contain was fast (score 3, Good) while Business Continuity is low (0.80); in OT, rapid containment can itself disrupt operations, and the containment action appears to have been operationally costly.'
    );
  });
});

describe('priorities variants', () => {
  it('nothing below 3, nothing scored', () => {
    const healthy = generatedFor({
      indicators: { 'IH-07': meas(3), 'IH-08': meas(10), 'BC-02': meas(80), 'BC-04': ratio(0, 10), 'BC-08': ratio(9, 10), 'BC-09': ratio(8, 10) },
    });
    expect(healthy.generated.priorities.text).toBe('No scored effectiveness indicator is below 3 (Good).');

    const rec = loadScenario(baselineJson);
    const facts = buildAssessmentFacts({ ...rec, indicators: Object.fromEntries(ALL_INDICATOR_IDS.map(id => [id, { state: null }])) });
    expect(buildGeneratedSections(facts).priorities.text).toBe(
      'No effectiveness indicator has a score, so there is no ranking of results. Mean Time to Detect, Mean Time to Respond, Mean Time to Contain, Network Operability Under Disruption, Zone Availability Rate, Operational Threshold Violation Rate, RTO Achievement Rate and RPO Achievement Rate are not ranked because they have no score.'
    );
  });

  it('a single lowest scored result', () => {
    const { generated } = generatedFor({ indicators: { 'BC-09': ratio(8, 10), 'BC-02': meas(10) } });
    expect(generated.priorities.text).toContain('the lowest effectiveness result is Zone Availability Rate at score 1 (Initial).');
  });
});

// ─── Wording sources ──────────────────────────────────────────────────────────

describe('wording sources', () => {
  it('process bands agree with the dashboard messages', () => {
    for (const id of ['RM-04', 'RM-05']) {
      const def = LAYER0_ITEMS[id];
      for (const [score, message] of Object.entries(def.processMessages)) {
        const band = def.processBands[score];
        if (band.advice) expect(message, `${id} ${score}`).toContain(band.advice);
        if (band.band) {
          expect(message, `${id} ${score}`).toContain(`(${band.band})`);
          expect(message, `${id} ${score}`).toContain(band.verdict);
        }
      }
    }
  });
});

// ─── Property tests ───────────────────────────────────────────────────────────

const INTERNAL_ID = /\b(IH|BC|RM)-\d+\b|L0-/;
const RAW_ENUM = /\w*_\w*/;

describe('property-based tests (fast-check)', () => {
  it('generated sections always pass the validator, never say "poor", and leak no codes', () => {
    fc.assert(fc.property(assessmentArb, rec => {
      const facts = buildAssessmentFacts(rec);
      const generated = buildGeneratedSections(facts);
      expect(validGenerated(facts, generated).errors).toEqual([]);
      for (const key of GENERATED_KEYS) {
        const text = generated[key].text.replace(/"[^"]*"/g, '""');
        expect(text).not.toMatch(/\bpoor\b/i);
        expect(stripAssessorNote(text)).not.toMatch(INTERNAL_ID);
        expect(text).not.toMatch(RAW_ENUM);
        expect(generated[key].factIds.length).toBeGreaterThan(0);
      }
    }), { numRuns: 300 });
  }, 30_000);
});
