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
import sparseJson from '../../scenarios/Oudendijk_2026-03-01_assessment.json?raw';
import { buildGeneratedSections } from './templates.js';
import { buildAssessmentFacts, stripAssessorNote } from './facts.js';
import { validateNarrative } from './validator.js';
import { GENERATED_KEYS, FACT_SECTION_KEYS } from './schema.js';
import { matchAssessmentActions } from '../engine/actions.js';
import { loadScenario, assessmentArb } from './testSupport.js';
import { INDICATORS, ALL_INDICATOR_IDS, SCORE_ZERO_STATES, STATE } from '../data/indicatorDefinitions.js';
import { LAYER0_ITEMS } from '../data/layer0Definitions.js';
import { PROGRAMME_GAP_WORDING, ACTION_WORDING } from '../data/reportWording.js';
import { ACTION_CATALOGUE, NIS2_ARTICLE } from '../data/actionCatalogue.js';
import { displayName } from '../data/displayNames.js';

const BASELINE = loadScenario(baselineJson);

/** The facts and generated sections of an assessment, as generateNarrative builds them. */
function sectionsOf(rec) {
  const facts = buildAssessmentFacts(rec);
  return { facts, generated: buildGeneratedSections(facts, matchAssessmentActions(rec)) };
}

/** The Westmaas baseline's sections with the given matched actions (catalogue rendering only). */
function generatedWithActions(actions) {
  const facts = buildAssessmentFacts(BASELINE);
  return { facts, generated: buildGeneratedSections(facts, actions) };
}

function generatedFor(changes = {}) {
  const rec = loadScenario(baselineJson);
  rec.indicators = { ...rec.indicators, ...(changes.indicators ?? {}) };
  rec.layer0 = { ...rec.layer0, ...(changes.layer0 ?? {}) };
  return sectionsOf(rec);
}

const meas = v => ({ state: STATE.MEASURED, value: String(v) });
const ratio = (n, d) => ({ state: STATE.MEASURED, numerator: String(n), denominator: String(d) });

/** The sections written from the facts; Recommended actions is catalogue text the validator skips (Step 8). */
function validGenerated(facts, generated) {
  return validateNarrative({ sections: generated }, facts, { parts: FACT_SECTION_KEYS });
}

// ─── Westmaas baseline ────────────────────────────────────────────────────────

describe('Westmaas baseline', () => {
  const { facts, generated } = sectionsOf(BASELINE);

  it('returns the six generated sections', () => {
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

  it('targets (Step 7)', () => {
    expect(generated.targets).toEqual({
      factIds: ['F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11'],
      text: [
        'Each target is the value an indicator needs for its next score level, taken from the scoring bands.',
        'In Incident Handling, Mean Time to Detect, now 18 hours (score 3, Good), reaches score 4 (Excellent) at 6 hours or less. Mean Time to Respond, now 30 hours (score 2, Developing), reaches score 3 (Good) at 24 hours or less.',
        'In Business Continuity, Network Operability Under Disruption, now 85% (score 3, Good), reaches score 4 (Excellent) at 90% or more. Zone Availability Rate, now 40% (score 2, Developing), reaches score 3 (Good) at 70% or more. Operational Threshold Violation Rate, now 12.5% (score 2, Developing), reaches score 3 (Good) at 5% or less. RTO Achievement Rate, now 50% (score 2, Developing), reaches score 3 (Good) at 75% or more.',
        'RPO Achievement Rate has no numeric target yet: no recovery point objective has been established. Define the objective first; the scoring bands apply once it exists.',
        'Mean Time to Contain has no score, so it has no target.',
      ].join('\n\n'),
    });
  });

  it('passes the validator', () => {
    expect(validGenerated(facts, generated).errors).toEqual([]);
  });
});

describe('Westmaas follow-up (2026-06-01)', () => {
  const { facts, generated } = sectionsOf(loadScenario(followUpJson));

  it('passes the validator and reports the now-measured Mean Time to Contain', () => {
    expect(validGenerated(facts, generated).errors).toEqual([]);
    expect(generated.measuredPerformance.text).toContain('Mean Time to Contain was 20 hours (score 3, Good)');
    expect(generated.gapsAndMissingEvidence.text).toBe(
      'No evidence is missing and no programme gaps were found: every effectiveness indicator has a score.'
    );
  });

  it('targets: Mean Time to Contain now has one; RPO Achievement Rate is at the highest level', () => {
    expect(generated.targets.text).toContain('Mean Time to Contain, now 20 hours (score 3, Good), reaches score 4 (Excellent) at 6 hours or less.');
    expect(generated.targets.text).toContain('Zone Availability Rate, now 82% (score 3, Good), reaches score 4 (Excellent) at 90% or more.');
    expect(generated.targets.text.split('\n\n').at(-1)).toBe('Already at the highest level (score 4, Excellent): RPO Achievement Rate.');
    expect(generated.targets.text).not.toContain('no score');
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
    expect(sectionsOf({ ...rec, indicators }).generated.measuredPerformance).toEqual({
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
      'the missing IT/OT boundary separation and Network Operability Under Disruption (score 1, Initial) may be related, because boundary separation can affect network operability; review them together.'
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
      'Mean Time to Contain was fast (score 3, Good) while Business Continuity scored 0.80, below 2; in OT, rapid containment can itself disrupt operations, and the containment action appears to have been operationally costly.'
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
    const unset = { ...rec, indicators: Object.fromEntries(ALL_INDICATOR_IDS.map(id => [id, { state: null }])) };
    expect(sectionsOf(unset).generated.priorities.text).toBe(
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
      const { facts, generated } = sectionsOf(rec);
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

// ─── Targets (Step 7) ─────────────────────────────────────────────────────────

describe('targets variants', () => {
  const paragraphs = generated => generated.targets.text.split('\n\n');
  const THEN = 'the scoring bands apply once it exists.';

  it('a measured 0 gets a target like any other score', () => {
    const { generated } = generatedFor({ indicators: { 'BC-02': meas(0) } });
    expect(generated.targets.text).toContain('Zone Availability Rate, now 0% (score 0, measured failure), reaches score 1 (Initial) at 1% or more.');
  });

  it('Operational Threshold Violation Rate: score 4 needs exactly 0%, a maximum otherwise (direction-inverted, no second reversal)', () => {
    expect(generatedFor({ indicators: { 'BC-04': ratio(1, 40) } }).generated.targets.text).toContain(
      'Operational Threshold Violation Rate, now 2.5% (score 3, Good), reaches score 4 (Excellent) at 0%.');
    expect(generatedFor({ indicators: { 'BC-04': ratio(6, 10) } }).generated.targets.text).toContain(
      'Operational Threshold Violation Rate, now 60% (score 0, measured failure), reaches score 1 (Initial) at 50% or less.');
  });

  it('every programme-gap state has its own sentence, never a number', () => {
    const paragraphOf = (id, state) => paragraphs(generatedFor({ indicators: { [id]: { state } } }).generated)
      .flatMap(p => p.split(/(?<=exists\.) /)).find(x => x.startsWith(`${displayName(id)} has no numeric target`));
    expect(paragraphOf('IH-06', STATE.CAPABILITY_ABSENT)).toBe(`Mean Time to Detect has no numeric target: no detection capability exists yet. Establish it first; ${THEN}`);
    expect(paragraphOf('IH-07', STATE.CAPABILITY_ABSENT)).toBe(`Mean Time to Respond has no numeric target: no response capability exists yet. Establish it first; ${THEN}`);
    expect(paragraphOf('IH-08', STATE.CAPABILITY_ABSENT)).toBe(`Mean Time to Contain has no numeric target: no response capability exists yet. Establish it first; ${THEN}`);
    expect(paragraphOf('BC-04', STATE.NO_THRESHOLDS_DEFINED)).toBe(`Operational Threshold Violation Rate has no numeric target yet: no operational thresholds have been established. Define the thresholds first; ${THEN}`);
    expect(paragraphOf('BC-08', STATE.NO_RTO_DEFINED)).toBe(`RTO Achievement Rate has no numeric target yet: no recovery time objective has been established. Define the objective first; ${THEN}`);
    expect(paragraphOf('BC-09', STATE.NO_RPO_DEFINED)).toBe(`RPO Achievement Rate has no numeric target yet: no recovery point objective has been established. Define the objective first; ${THEN}`);
    for (const id of ALL_INDICATOR_IDS) {
      for (const state of INDICATORS[id].allowedStates.filter(x => SCORE_ZERO_STATES.has(x))) {
        expect(paragraphOf(id, state), `${id} ${state}`).toMatch(/^\D+$/);
      }
    }
  });

  it('several programme gaps share one paragraph, one sentence each, in catalogue order', () => {
    const { generated } = generatedFor({ indicators: { 'BC-08': { state: STATE.NO_RTO_DEFINED } } });
    expect(paragraphs(generated)).toContain([
      `RTO Achievement Rate has no numeric target yet: no recovery time objective has been established. Define the objective first; ${THEN}`,
      `RPO Achievement Rate has no numeric target yet: no recovery point objective has been established. Define the objective first; ${THEN}`,
    ].join(' '));
  });

  it('no score, in every variant, never gets a number: one sentence names them all', () => {
    const { generated } = generatedFor({ indicators: {
      'IH-06': { state: STATE.NO_QUALIFYING_EVENT }, 'BC-01': { state: STATE.NO_QUALIFYING_DISRUPTION },
      'BC-02': { state: null }, 'IH-07': meas(-3),
    } });
    expect(paragraphs(generated).at(-1)).toBe(
      'Mean Time to Detect, Mean Time to Respond, Mean Time to Contain, Network Operability Under Disruption and Zone Availability Rate have no score, so they have no target.');
    for (const name of ['Mean Time to Detect', 'Mean Time to Respond', 'Network Operability Under Disruption', 'Zone Availability Rate']) {
      expect(generated.targets.text.split(name)).toHaveLength(2);   // named once, in the no-score sentence
    }
  });

  it('nothing below 4: the fallback, then the highest-level sentence; no lead-in', () => {
    const rec = loadScenario(baselineJson);
    const { facts, generated } = sectionsOf({ ...rec, indicators: {
      'IH-06': meas(4), 'IH-07': meas(3), 'IH-08': meas(5),
      'BC-01': meas(95), 'BC-02': meas(92), 'BC-04': ratio(0, 10), 'BC-08': ratio(9, 10), 'BC-09': ratio(10, 10),
    } });
    expect(paragraphs(generated)).toEqual([
      'No measured indicator is below score 4.',
      'Already at the highest level (score 4, Excellent): Mean Time to Detect, Mean Time to Respond, Mean Time to Contain, Network Operability Under Disruption, Zone Availability Rate, Operational Threshold Violation Rate, RTO Achievement Rate and RPO Achievement Rate.',
    ]);
    expect(validGenerated(facts, generated).errors).toEqual([]);
  });

  it('nothing scored: only the fallback', () => {
    const rec = loadScenario(baselineJson);
    const indicators = Object.fromEntries(ALL_INDICATOR_IDS.map(id => [id, { state: null }]));
    expect(sectionsOf({ ...rec, indicators }).generated.targets.text).toBe('No indicator has a score, so there are no targets.');
  });

  it('property: every number in Targets is in a cited scored fact, and no-score indicators are never given one', () => {
    fc.assert(fc.property(assessmentArb, rec => {
      const { facts, generated: { targets } } = sectionsOf(rec);
      const cited = facts.filter(f => targets.factIds.includes(f.id));
      const numbers = new Set(cited.filter(f => f.kind === 'scored').flatMap(f => f.text.match(/\d+(?:\.\d+)?/g) ?? []));
      for (const n of targets.text.match(/\d+(?:\.\d+)?/g) ?? []) expect(numbers.has(n), n).toBe(true);
      const noScore = facts.filter(f => f.kind === 'no_score').map(f => f.data.name);
      for (const sentence of targets.text.split(/(?<=\.)\s+/)) {
        if (noScore.some(name => sentence.includes(name))) expect(sentence).toMatch(/ha(?:s|ve) no score, so (?:it has|they have) no target\.$/);
      }
    }), { numRuns: 200 });
  });
});

// ─── Recommended actions (Step 8) ─────────────────────────────────────────────

/** The Westmaas baseline section, pinned: every catalogue or wording change shows up in review. */
const WESTMAAS_ACTIONS = `Each action comes from the dashboard's action catalogue and is matched to a result in this assessment. Actions are grouped by area in catalogue order; this is not an order of action.

Incident Handling

Shorten response time
Reduce the time from detection to the start of a response.
Steps: Set target response times per incident severity. Arrange on-call cover that includes someone with OT knowledge. Review recent incidents for hand-over delays between IT, security and operations.
Why it matters: Delays between detection and response are often organisational, not technical, and can be fixed without new tooling.
Who: Security team with plant operations
NIS2 Article 21(2): (b) incident handling

Make incident handling measurable
Record detection, response and containment times for every incident.
Steps: Add mandatory timestamp fields to incident tickets: incident start (if known), detection, response start, containment. Agree which clock is authoritative. Check the fields are filled in when a ticket is closed.
Why it matters: The next assessment can only score these indicators if the times are recorded. This says nothing about current performance.
Who: Security team
NIS2 Article 21(2): (b) incident handling; (f) assessing the effectiveness of measures

Business Continuity

Improve zone availability
Address the main causes of zone outages.
Steps: Use the disruption log to find the most common causes of zones becoming unavailable. Fix the top causes first. Check whether uncontrolled connections between zones, such as multi-homed devices, contribute.
Why it matters: Zone outages directly affect the processes running in them.
Who: OT engineering
NIS2 Article 21(2): (c) business continuity
Standard: IEC 62443-3-3 FR 7 (resource availability)

Reduce operational threshold violations
Reduce how often process parameters leave their safe operating range during disruptions.
Steps: Review each violation: which disruption caused it, and how long it lasted. Improve operator procedures for degraded operation. Check that alarms for these parameters work and reach operators in time.
Why it matters: Threshold violations are where a cyber disruption turns into a process or safety impact.
Who: Plant operations with process engineering
NIS2 Article 21(2): (c) business continuity

Meet recovery time objectives
Make recovery of OT systems faster and more predictable.
Steps: Analyse recoveries that exceeded their RTO. Keep tested recovery media and system images for HMIs, servers and engineering workstations. Write step-by-step rebuild procedures and practise them.
Why it matters: Recoveries that take longer than agreed extend process downtime.
Who: OT engineering
NIS2 Article 21(2): (c) business continuity, disaster recovery
Standard: IEC 62443-3-3 SR 7.4 (control system recovery and reconstitution)

Define recovery point objectives
Define recovery point objectives for critical processes.
Steps: Agree with operations the maximum acceptable data loss per critical process. Align backup frequency for historians, SCADA/PLC configurations and engineering workstations with it. Verify with a restore test on a test system or spare hardware.
Why it matters: Without an RPO, recovery cannot be measured, so the indicator stays at 0.
Who: Plant operations with OT engineering
NIS2 Article 21(2): (c) business continuity, backup management
Standard: IEC 62443-3-3 SR 7.3 (control system backup)

Foundational controls

Document asset interdependencies
Document which assets and services each critical process depends on.
Steps: For each critical process, list the PLCs, HMIs, servers, network paths and IT services it needs. Include external dependencies such as vendor remote access. Keep it linked to the asset inventory.
Why it matters: Without this, the impact of losing an asset is guesswork, both during incidents and when planning recovery.
Who: OT engineering with plant operations
NIS2 Article 21(2): (c) business continuity (supports)

Remove or control multi-homed devices
Remove or control hosts connected to more than one zone.
Steps: List every host with interfaces in more than one zone. Remove the second interface, or route that traffic through a controlled conduit with a firewall. Re-scan to confirm none remain.
Why it matters: A dual-homed host bypasses the zone boundary and can connect zones that should be separated.
Who: OT engineering
Standard: IEC 62443-3-3 SR 5.1 (network segmentation), SR 5.2 (zone boundary protection)

Test the BC plan
Test the BC plan within the defined period.
Steps: Schedule a test: a tabletop exercise at minimum, ideally including a restore of at least one OT system to a test environment. Record the results and fix the gaps found.
Why it matters: An untested plan often fails on details nobody noticed on paper.
Who: Plant operations with OT engineering
NIS2 Article 21(2): (c) business continuity; (f) assessing the effectiveness of measures

Vulnerability management

Improve the remediation rate
Remediate more of the known vulnerabilities, prioritising by risk.
Steps: Prioritise by exposure and process criticality, for example known-exploited vulnerabilities on reachable systems first. Use vendor-approved patches. Where patching is not possible, apply and document compensating controls.
Why it matters: In OT, not every vulnerability can be patched, but every one needs a decision.
Who: OT engineering with the security team
NIS2 Article 21(2): (e) vulnerability handling
Standard: IEC TR 62443-2-3 (patch management in the IACS environment)`;

describe('recommended actions', () => {
  const paragraphs = generated => generated.recommendedActions.text.split('\n\n');

  it("Westmaas baseline: the text, the cited facts (the triggering items' own facts) and the entry IDs", () => {
    const { facts, generated } = sectionsOf(BASELINE);
    expect(generated.recommendedActions.text).toBe(WESTMAAS_ACTIONS);
    expect(generated.recommendedActions.factIds).toEqual(['F5', 'F6', 'F8', 'F9', 'F10', 'F11', 'F13', 'F14', 'F15', 'F16']);
    expect(generated.recommendedActions.factIds.map(id => facts.find(f => f.id === id).refs[0])).toEqual([
      'IH-07', 'IH-08', 'BC-02', 'BC-04', 'BC-08', 'BC-09', 'L0-multi-homed', 'L0-interdependency', 'L0-bc-plan-tested', 'RM-04',
    ]);
    expect(generated.recommendedActions.actionIds).toEqual([
      'ACT-IH-04', 'ACT-IH-06', 'ACT-BC-02', 'ACT-BC-03', 'ACT-BC-05', 'ACT-BC-08', 'ACT-L0-03', 'ACT-L0-05', 'ACT-L0-08', 'ACT-RM-02',
    ]);
  });

  it('Westmaas follow-up: five actions, each paragraph as in the baseline', () => {
    const { generated } = sectionsOf(loadScenario(followUpJson));
    expect(generated.recommendedActions.actionIds).toEqual(['ACT-IH-04', 'ACT-BC-03', 'ACT-BC-05', 'ACT-L0-03', 'ACT-RM-02']);
    const baseline = WESTMAAS_ACTIONS.split('\n\n');
    for (const p of paragraphs(generated)) expect(baseline).toContain(p);
  });

  it('Oudendijk: one action, then the not-yet-assessed sentence', () => {
    const ps = paragraphs(sectionsOf(loadScenario(sparseJson)).generated);
    expect(ps[0]).toBe(ACTION_WORDING.leadIn);
    expect(ps.slice(1, 3).map(p => p.split('\n')[0])).toEqual(['Foundational controls', 'Document asset interdependencies']);
    expect(ps.at(-1)).toBe(ACTION_WORDING.notAssessed);
    expect(ps).toHaveLength(4);
  });

  it('no match: the fallback, citing the priority fact', () => {
    const { facts, generated } = generatedFor({
      indicators: { 'IH-07': meas(3), 'IH-08': meas(10), 'BC-02': meas(80), 'BC-04': ratio(0, 10), 'BC-08': ratio(9, 10), 'BC-09': ratio(8, 10) },
      layer0: {
        'L0-interdependency': { state: 'present' }, 'L0-multi-homed': { state: 'requirement_satisfied' },
        'L0-bc-plan-tested': { state: 'qualifying_test_performed' }, 'RM-04': { state: 'measured', numerator: '8', denominator: '10' },
      },
    });
    expect(generated.recommendedActions).toEqual({
      factIds: [facts.find(f => f.kind === 'priority').id], text: ACTION_WORDING.noMatch,
      blocks: [{ kind: 'text', text: ACTION_WORDING.noMatch }], actionIds: [],
    });
  });

  it('nothing assessed: the fallback and the not-yet-assessed sentence, one paragraph', () => {
    const rec = loadScenario(baselineJson);
    const indicators = Object.fromEntries(ALL_INDICATOR_IDS.map(id => [id, { state: null }]));
    const layer0 = Object.fromEntries(Object.keys(rec.layer0).map(id => [id, { state: null }]));
    expect(sectionsOf({ ...rec, indicators, layer0 }).generated.recommendedActions.text)
      .toBe(`${ACTION_WORDING.noMatch} ${ACTION_WORDING.notAssessed}`);
  });

  it('empty references are left out', () => {
    const ps = paragraphs(sectionsOf(BASELINE).generated);
    const noNis2 = ps.find(p => p.startsWith('Remove or control multi-homed devices'));
    expect(noNis2).not.toMatch(/^NIS2/m);
    expect(noNis2).toMatch(/^Standard: /m);
    expect(ps.find(p => p.startsWith('Shorten response time'))).not.toMatch(/^Standard/m);
  });

  it('every entry renders as title, action, steps, why, who and its references, verbatim', () => {
    for (const entry of ACTION_CATALOGUE) {
      const lines = [entry.title, entry.action, `Steps: ${entry.steps}`, `Why it matters: ${entry.why}`, `Who: ${entry.who}`];
      if (entry.nis2) lines.push(`NIS2 ${NIS2_ARTICLE}: ${entry.nis2}`);
      if (entry.standard) lines.push(`Standard: ${entry.standard}`);
      const { generated } = generatedWithActions([{ id: entry.id, triggers: [] }]);
      expect(paragraphs(generated)).toContain(lines.join('\n'));
    }
  });

  // PDF formatting (Step 8): the structure the text is derived from.
  const textOfBlocks = blocks => blocks.map(b => (b.kind === 'action'
    ? [b.title, ...b.lines.map(l => `${l.label ?? ''}${l.text}`)].join('\n')
    : b.text)).join('\n\n');

  it('Westmaas blocks: lead-in, area headings, actions with labelled lines from the catalogue', () => {
    const { blocks } = sectionsOf(BASELINE).generated.recommendedActions;
    const summary = b => ({ action: `action:${b.title}`, heading: `heading:${b.text}`, text: `text:${b.text?.slice(0, 20)}` })[b.kind];
    expect(blocks.map(summary)).toEqual([
      `text:${ACTION_WORDING.leadIn.slice(0, 20)}`,
      'heading:Incident Handling', 'action:Shorten response time', 'action:Make incident handling measurable',
      'heading:Business Continuity', 'action:Improve zone availability', 'action:Reduce operational threshold violations',
      'action:Meet recovery time objectives', 'action:Define recovery point objectives',
      'heading:Foundational controls', 'action:Document asset interdependencies', 'action:Remove or control multi-homed devices',
      'action:Test the BC plan',
      'heading:Vulnerability management', 'action:Improve the remediation rate',
    ]);
    const multiHomed = blocks.find(b => b.title === 'Remove or control multi-homed devices');
    const entry = ACTION_CATALOGUE.find(e => e.id === 'ACT-L0-05');
    expect(multiHomed.lines).toEqual([
      { label: null, text: entry.action },
      { label: ACTION_WORDING.steps, text: entry.steps },
      { label: ACTION_WORDING.why, text: entry.why },
      { label: ACTION_WORDING.who, text: entry.who },
      { label: ACTION_WORDING.standard, text: entry.standard },
    ]);
    const response = blocks.find(b => b.title === 'Shorten response time');
    expect(response.lines.at(-1)).toEqual({ label: ACTION_WORDING.nis2Label(NIS2_ARTICLE), text: '(b) incident handling' });
  });

  it('the fallback is one text block', () => {
    const rec = loadScenario(baselineJson);
    const indicators = Object.fromEntries(ALL_INDICATOR_IDS.map(id => [id, { state: null }]));
    const layer0 = Object.fromEntries(Object.keys(rec.layer0).map(id => [id, { state: null }]));
    const section = sectionsOf({ ...rec, indicators, layer0 }).generated.recommendedActions;
    expect(section.blocks).toEqual([{ kind: 'text', text: section.text }]);
  });

  it('property: the text is always the text of the blocks', () => {
    fc.assert(fc.property(assessmentArb, rec => {
      const section = sectionsOf(rec).generated.recommendedActions;
      expect(section.text).toBe(textOfBlocks(section.blocks));
    }), { numRuns: 200 });
  });

  it('property: no internal or entry IDs, raw enums or "poor"; numbers only from the catalogue; each title once', () => {
    const catalogueNumbers = new Set(ACTION_CATALOGUE.flatMap(e =>
      [e.title, e.action, e.steps, e.why, e.who, e.nis2 ?? '', e.standard ?? '', NIS2_ARTICLE].join(' ').match(/\d+(?:\.\d+)?/g) ?? []));
    fc.assert(fc.property(assessmentArb, rec => {
      const actions = matchAssessmentActions(rec);
      const section = sectionsOf(rec).generated.recommendedActions;
      expect(section.text).not.toMatch(INTERNAL_ID);
      expect(section.text).not.toMatch(/ACT-/);
      expect(section.text).not.toMatch(RAW_ENUM);
      expect(section.text).not.toMatch(/\bpoor\b/i);
      for (const n of section.text.match(/\d+(?:\.\d+)?/g) ?? []) expect(catalogueNumbers.has(n), n).toBe(true);
      expect(section.actionIds).toEqual(actions.map(a => a.id));
      for (const id of section.actionIds) {
        const title = ACTION_CATALOGUE.find(e => e.id === id).title;
        expect(section.text.split('\n').filter(line => line === title)).toHaveLength(1);
      }
      expect(section.factIds.length).toBeGreaterThan(0);
    }), { numRuns: 200 });
  });
});

// ─── Grouped no-score states (Oudendijk manual check) ─────────────────────────

describe('gapsAndMissingEvidence groups', () => {
  it('Oudendijk: six unassessed indicators in one sentence, counted from the facts', () => {
    const { facts, generated } = sectionsOf(loadScenario(sparseJson));
    expect(generated.gapsAndMissingEvidence).toEqual({
      factIds: facts.filter(f => ['dim_incomplete', 'no_score'].includes(f.kind)).map(f => f.id),
      text: 'Six indicators are not yet assessed: Mean Time to Respond, Mean Time to Contain, Zone Availability Rate, ' +
        'Operational Threshold Violation Rate, RTO Achievement Rate and RPO Achievement Rate. This says nothing about how they perform, ' +
        'but without them Incident Handling and Business Continuity have no score, so there is no overall score either.',
    });
    expect(validGenerated(facts, generated).errors).toEqual([]);
  });

  it('several groups: each state once, reasons kept per item, one consequence sentence', () => {
    const { facts, generated } = generatedFor({ indicators: {
      'IH-06': { state: STATE.NOT_MEASURABLE, reason: { layer0ItemId: 'L0-asset-inventory', text: '' } },
      'IH-07': { state: STATE.NOT_MEASURABLE },
      'BC-01': { state: STATE.NO_QUALIFYING_DISRUPTION }, 'BC-02': { state: STATE.NO_QUALIFYING_DISRUPTION },
      'BC-04': ratio(5, 2), 'BC-08': ratio(-1, 2),
    } });
    expect(generated.gapsAndMissingEvidence.text.split('\n\n')[0]).toBe([
      'Three indicators are not measurable: Mean Time to Detect, Mean Time to Respond and Mean Time to Contain.',
      'For each, evidence to compute the value is absent or unreliable.',
      'For Mean Time to Detect, the recorded root cause is Asset inventory maintained.',
      'No reason was recorded for Mean Time to Respond and Mean Time to Contain.',
      'Two indicators had no qualifying disruption: Network Operability Under Disruption and Zone Availability Rate.',
      'For each, no qualifying disruption occurred this period. Nothing occurred to assess them.',
      'Invalid values were entered for two indicators: Operational Threshold Violation Rate and RTO Achievement Rate, so they could not be scored.',
      'This says nothing about how any of these indicators performs, but without them Incident Handling and Business Continuity have no score, so there is no overall score either.',
    ].join(' '));
    expect(validGenerated(facts, generated).errors).toEqual([]);
  });

  it('a not-measurable group without any reason: "No reason was recorded for them."', () => {
    const { facts, generated } = generatedFor({ indicators: { 'IH-06': { state: STATE.NOT_MEASURABLE } } });
    expect(generated.gapsAndMissingEvidence.text.split('\n\n')[0]).toBe(
      'Two indicators are not measurable: Mean Time to Detect and Mean Time to Contain. ' +
      'For each, evidence to compute the value is absent or unreliable. No reason was recorded for them. ' +
      'This says nothing about how they perform, but without them Incident Handling has no score, so there is no overall score either.'
    );
    expect(validGenerated(facts, generated).errors).toEqual([]);
  });

  it('two with an assessor note each, and no qualifying event', () => {
    const { facts, generated } = generatedFor({ indicators: {
      'IH-06': { state: STATE.NO_QUALIFYING_EVENT }, 'IH-07': { state: STATE.NO_QUALIFYING_EVENT },
      'BC-01': { state: STATE.NOT_MEASURABLE, reason: { text: 'logger offline' } },
      'BC-02': { state: STATE.NOT_MEASURABLE, reason: { layer0ItemId: 'L0-asset-inventory', text: 'CMDB stale' } },
    } });
    const text = generated.gapsAndMissingEvidence.text;
    expect(text).toContain('Two indicators had no qualifying event: Mean Time to Detect and Mean Time to Respond. ' +
      'For each, no qualifying incident, exercise, or disruption occurred. Nothing occurred to assess them.');
    expect(text).toContain('Three indicators are not measurable: Mean Time to Contain, Network Operability Under Disruption and Zone Availability Rate.');
    expect(text).toContain('For Network Operability Under Disruption, the assessor noted "logger offline".');
    expect(text).toContain('For Zone Availability Rate, the recorded root cause is Asset inventory maintained, and the assessor noted "CMDB stale".');
    expect(text).toContain('No reason was recorded for Mean Time to Contain.');
    expect(validGenerated(facts, generated).errors).toEqual([]);
  });

  it('property: every no-score indicator is named exactly once in the missing-evidence paragraph', () => {
    fc.assert(fc.property(assessmentArb, rec => {
      const { facts, generated } = sectionsOf(rec);
      const noScore = facts.filter(f => f.kind === 'no_score');
      if (noScore.length === 0) return;
      const paragraph = stripAssessorNote(generated.gapsAndMissingEvidence.text.split('\n\n')[0]).replace(/"[^"]*"/g, '""');
      const listing = paragraph.slice(0, paragraph.indexOf('This says nothing'));
      for (const f of noScore) {
        const mentions = listing.split(f.data.name).length - 1;
        // In a not-measurable group with some reasons, each item is named again: "For A, …" or "No reason was recorded for B".
        const group = noScore.filter(g => g.data.status === f.data.status);
        const someReasons = group.some(g => g.data.rootCause || g.data.note);
        const again = f.data.groupCount !== null && f.data.status === STATE.NOT_MEASURABLE && someReasons;
        expect(mentions, f.data.name).toBe(again ? 2 : 1);
      }
    }), { numRuns: 200 });
  });
});
