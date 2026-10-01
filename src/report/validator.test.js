/**
 * Validator tests — docs/ai-report-spec.md, Step 3.
 *
 * GOOD is a hand-written Westmaas baseline narrative that deliberately uses
 * risky-but-valid phrasings (F18 verbatim, "not a measured failure", 1.8 for
 * 1.80, "the BC plan", the quoted client name). Failing examples replace one
 * part of GOOD and assert the specific rule.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import baselineJson from '../../scenarios/Westmaas_2026-01-01_assessment.json?raw';
import followUpJson from '../../scenarios/Westmaas_2026-06-01_assessment.json?raw';
import sparseJson from '../../scenarios/Oudendijk_2026-03-01_assessment.json?raw';
import {
  validateNarrative, validatePicks, splitSentences, splitClauses, extractNumbers, VALIDATOR_RULES,
} from './validator.js';
import { buildAssessmentFacts, triggerFacts } from './facts.js';
import { matchAssessmentActions } from '../engine/actions.js';
import { SECTION_KEYS, CATALOGUE_KEYS, ACTIONS_KEY } from './schema.js';
import { loadScenario, assessmentArb, echoNarrative, echoPicks, WESTMAAS_PICKS } from './testSupport.js';
import { ALL_INDICATOR_IDS, STATE } from '../data/indicatorDefinitions.js';
import { LAYER0_ALL_IDS } from '../data/layer0Definitions.js';
import { displayName, DIMENSION_NAMES } from '../data/displayNames.js';

// ─── Fixture ──────────────────────────────────────────────────────────────────

const FACTS = buildAssessmentFacts(loadScenario(baselineJson));

const OVERVIEW = ['C1', 'C2', 'C3', 'F1', 'F2', 'F3'];
const MEASURED = ['F4', 'F5', 'F7', 'F8', 'F9', 'F10'];
const GAPS = ['F6', 'F11'];
const FOUNDATIONS = ['F12', 'F13', 'F14', 'F15', 'F16', 'F17', 'F18', 'F19'];

const GOOD = {
  headline: {
    factIds: ['C1', 'F2', 'F13'],
    text: 'The "Westmaas" assessment dated 2026-01-01 found a Business Continuity score of 1.8 out of 4 and a critical finding of uncontrolled inter-zone multi-homed devices.',
  },
  sections: {
    overview: {
      factIds: OVERVIEW,
      text: 'This is the 2026-01-01 assessment of "Westmaas". Effectiveness indicators are scored from 0 to 4, where 4 is best. Business Continuity is complete at 1.80 out of 4, which includes the programme-gap 0 for RPO Achievement Rate. Incident Handling is incomplete because Mean Time to Contain has no score, so no Incident Handling or overall score is available.',
    },
    measuredPerformance: {
      factIds: MEASURED,
      text: 'Mean Time to Detect was 18 hours (score 3) and Mean Time to Respond was 30 hours (score 2). Network Operability Under Disruption reached 85% (score 3), while Zone Availability Rate was 40% (score 2). Operational Threshold Violation Rate was 12.5%, where lower is better (score 2), and RTO Achievement Rate was 50% (score 2).',
    },
    gapsAndMissingEvidence: {
      factIds: GAPS,
      text: 'Mean Time to Contain is not measurable: the evidence needed to compute it is absent or unreliable, and no reason was recorded. This says nothing about how Mean Time to Contain performs. RPO Achievement Rate is not a measured failure: it scores 0 as a programme gap because no recovery point objective has been established yet.',
    },
    foundationsAndFlags: {
      factIds: FOUNDATIONS,
      text: 'Asset inventory, zone risk assessment, IT/OT boundary separation and the BC plan are in place, but a critical flag was raised because uncontrolled inter-zone multi-homed devices were identified. Asset interdependency documentation is incomplete or outdated, and no BC plan test was performed during the assessment period. Vulnerability Remediation Rate is 60%, below target, and Mean Time to Remediate is 75 days, which is satisfactory; neither is scored. Zero uncontrolled multi-homed devices is in a weak state (Uncontrolled multi-homing found) and Mean Time to Contain is not measurable. The multi-homed devices and Zone Availability Rate (score 2, Developing) may be related and should be reviewed together.',
    },
    priorities: {
      factIds: ['F20'],
      text: 'The lowest effectiveness result is RPO Achievement Rate, a programme gap at 0. Next, at score 2 and of equal priority, are Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate and RTO Achievement Rate.',
    },
    targets: {
      factIds: [...MEASURED, ...GAPS],
      text: 'Mean Time to Detect, now 18 hours, reaches score 4 at 6 hours or less. Zone Availability Rate reaches score 3 (Good) at 70% or more. RPO Achievement Rate has no numeric target yet: no recovery point objective has been established.',
    },
  },
};

const clone = value => JSON.parse(JSON.stringify(value));

/** GOOD with one part replaced. */
function withPart(key, factIds, text) {
  const narrative = clone(GOOD);
  if (key === 'headline') narrative.headline = { factIds, text };
  else narrative.sections[key] = { factIds, text };
  return narrative;
}

const rulesOf = result => [...new Set(result.errors.map(e => e.rule))];
const validate = (narrative, facts = FACTS) => validateNarrative(narrative, facts);

const overview = text => validate(withPart('overview', OVERVIEW, text));
const gaps = text => validate(withPart('gapsAndMissingEvidence', GAPS, text));
const foundations = text => validate(withPart('foundationsAndFlags', FOUNDATIONS, text));

function factsWith({ clientId, reasonText } = {}) {
  const rec = loadScenario(baselineJson);
  if (clientId !== undefined) rec.meta = { ...rec.meta, clientId };
  if (reasonText !== undefined) {
    rec.indicators = { ...rec.indicators, 'IH-08': { state: STATE.NOT_MEASURABLE, reason: { text: reasonText } } };
  }
  return buildAssessmentFacts(rec);
}

const INTERNAL_ID = /\b(IH|BC|RM)-\d+\b|L0-/;
const RAW_ENUM = /\w*_\w*/;

// ─── General ──────────────────────────────────────────────────────────────────

describe('GOOD narrative', () => {
  it('passes every check', () => {
    expect(validate(GOOD)).toEqual({ ok: true, errors: [] });
  });

  it('does not mutate its inputs and is deterministic', () => {
    const narrative = clone(GOOD);
    const facts = clone(FACTS);
    const bad = withPart('overview', OVERVIEW, 'Incident Handling scored 2.50.');
    expect(validateNarrative(bad, facts)).toEqual(validateNarrative(bad, facts));
    validateNarrative(narrative, facts);
    expect(narrative).toEqual(GOOD);
    expect(facts).toEqual(FACTS);
  });
});

describe('error objects', () => {
  const bad = clone(GOOD);
  bad.sections.overview.text = 'See F6 and IH-08 for the not_measurable Incident Handling, which scored 2.50 and is weak.';
  bad.sections.gapsAndMissingEvidence.text = 'RPO Achievement Rate failed. Mean Time to Contain is poor.';
  bad.sections.foundationsAndFlags.text = 'The BC score shows the multi-homing caused the low availability.';
  const result = validate(bad);

  it('carry section, sentence, rule and detail; ok is false', () => {
    expect(result.ok).toBe(false);
    for (const e of result.errors) {
      expect(Object.keys(e).sort()).toEqual(['detail', 'rule', 'section', 'sentence']);
      expect(VALIDATOR_RULES).toContain(e.rule);
      expect(['headline', ...SECTION_KEYS]).toContain(e.section);
      expect(typeof e.detail).toBe('string');
    }
  });

  it('details use descriptive names only', () => {
    for (const e of result.errors) {
      expect(e.detail).not.toMatch(INTERNAL_ID);
      expect(e.detail).not.toMatch(RAW_ENUM);
    }
  });

  it('are reported once each', () => {
    const keys = result.errors.map(e => JSON.stringify(e));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ─── 0. Shape ─────────────────────────────────────────────────────────────────

describe('shape', () => {
  it('null narrative', () => {
    expect(validate(null)).toMatchObject({ ok: false, errors: [{ section: null, rule: 'shape' }] });
  });

  it('missing sections object → every section reported', () => {
    const result = validate({ headline: GOOD.headline });
    expect(result.errors.filter(e => e.rule === 'shape').map(e => e.section)).toEqual(SECTION_KEYS.filter(k => !CATALOGUE_KEYS.includes(k)));
  });

  it('the catalogue section is never checked, even when named (Step 8)', () => {
    const catalogueText = { factIds: [], text: 'Mean Time to Contain is poor. IH-06 scored 7.3 out of 4. See IEC 62443-3-3 SR 7.3.' };
    const narrative = { ...GOOD, sections: { ...GOOD.sections, [ACTIONS_KEY]: catalogueText } };
    expect(validate(narrative)).toEqual({ ok: true, errors: [] });
    expect(validateNarrative(narrative, FACTS, { parts: [ACTIONS_KEY] })).toEqual({ ok: true, errors: [] });
    expect(validateNarrative({ headline: GOOD.headline, sections: {} }, FACTS, { parts: CATALOGUE_KEYS }).ok).toBe(true);
  });

  it('missing section, bad text, bad factIds', () => {
    const cases = [
      undefined,
      { factIds: ['F20'], text: 42 },
      { factIds: ['F20'], text: '   ' },
      { factIds: [], text: 'Fine.' },
      { factIds: 'F20', text: 'Fine.' },
    ];
    for (const part of cases) {
      const narrative = clone(GOOD);
      narrative.sections.priorities = part;
      expect(rulesOf(validate(narrative))).toEqual(['shape']);
    }
  });
});

// ─── 1. Fact IDs ──────────────────────────────────────────────────────────────

describe('factIds', () => {
  it('unknown ID', () => {
    const result = validate(withPart('priorities', ['F20', 'F99'], GOOD.sections.priorities.text));
    expect(result.errors).toEqual([expect.objectContaining({ rule: 'factIds', detail: 'Cited fact ID "F99" does not exist.' })]);
  });

  it('duplicate ID within a section', () => {
    const result = validate(withPart('priorities', ['F20', 'F20'], GOOD.sections.priorities.text));
    expect(rulesOf(result)).toEqual(['factIds']);
  });

  it('same ID in two sections is fine', () => {
    expect(validate(withPart('headline', ['C1', 'F2', 'F13', 'F20'], GOOD.headline.text)).ok).toBe(true);
  });
});

// ─── 2. Numbers ───────────────────────────────────────────────────────────────

describe('numbers', () => {
  it('a number in no cited fact', () => {
    // Also attribution since complete dimensions are in check 8 (final fix round).
    expect(rulesOf(overview('Business Continuity is complete at 2.5.'))).toEqual(['numbers', 'attribution']);
  });

  it('"six of the eight indicators": only "six" fails (8 is in C2)', () => {
    // The spec's original "two of the five" no longer fails: 2 and 5 are in C2.
    const result = overview('Six of the eight effectiveness indicators are below target.');
    expect(result.errors).toEqual([expect.objectContaining({
      rule: 'numbers', detail: 'The number "Six" does not appear in any fact cited by this section.',
    })]);
  });

  it('a number only in an uncited fact', () => {
    expect(rulesOf(overview('Mean Time to Detect was 18 hours.'))).toEqual(['numbers']);
  });

  it('normalised forms pass: 1.8 for 1.80, 3.00 for 3, 85%, ranges', () => {
    expect(overview('Business Continuity is complete at 1.8 out of 4.').ok).toBe(true);
    expect(validate(withPart('measuredPerformance', MEASURED, 'Mean Time to Detect scored 3.00 and Network Operability Under Disruption reached 85%.')).ok).toBe(true);
    expect(foundations('Vulnerability Remediation Rate is below target (50–69%).').ok).toBe(true);
  });

  it('ISO dates are one token; the context date counts as cited everywhere', () => {
    expect(overview('The assessment is dated 2026-01-01.').ok).toBe(true);
    expect(validate(withPart('measuredPerformance', MEASURED, 'The assessment is dated 2026-01-01.')).ok).toBe(true);
    expect(rulesOf(overview('This is the 2026 assessment.'))).toEqual(['numbers']);
  });

  it('number words count, including "one" and "zero"', () => {
    expect(rulesOf(overview('One indicator in Incident Handling has no score.'))).toEqual(['numbers']);
    expect(rulesOf(gaps('Mean Time to Contain is one of the missing results.'))).toContain('numbers');
  });

  it('item names are masked: "Zero uncontrolled multi-homed devices" is not a number', () => {
    expect(foundations('Zero uncontrolled multi-homed devices is in a weak state.').ok).toBe(true);
  });
});

// ─── 3. Leaked IDs ────────────────────────────────────────────────────────────

describe('leakedIds', () => {
  for (const text of ['See F6 for details.', 'See C1 for details.', 'IH-08 is not measurable.', 'L0-multi-homed is flagged.', 'It is not_measurable.']) {
    it(text, () => {
      expect(rulesOf(gaps(text))).toEqual(['leakedIds']);
    });
  }

  it('bare dimension codes', () => {
    expect(rulesOf(overview('The BC score is 1.80.'))).toEqual(['leakedIds']);
    expect(rulesOf(overview('IH is incomplete.'))).toEqual(['leakedIds']);
  });

  it('"BC plan" is not a leak (phrase from item names; also in engine messages)', () => {
    expect(foundations('The BC plan is documented, but no BC plan test was performed.').ok).toBe(true);
  });

  it('quoted client name is exempt only when C1 is cited', () => {
    const facts = factsWith({ clientId: 'Plant_7' });
    const cited = withPart('overview', OVERVIEW, 'This assessment covers "Plant_7".');
    expect(validate(cited, facts).ok).toBe(true);
    const uncited = withPart('measuredPerformance', MEASURED, 'At "Plant_7", Mean Time to Detect was 18 hours.');
    expect(rulesOf(validate(uncited, facts))).toContain('leakedIds');
  });

  it('quoted assessor note is exempt only when it matches', () => {
    const facts = factsWith({ reasonText: 'Logs for IH-07 purged after 12.3456 days' });
    const exact = withPart('gapsAndMissingEvidence', GAPS, 'Mean Time to Contain is not measurable; the assessor noted "Logs for IH-07 purged after 12.3456 days".');
    expect(validate(exact, facts).ok).toBe(true);
    const altered = withPart('gapsAndMissingEvidence', GAPS, 'Mean Time to Contain is not measurable; the assessor noted "Logs for IH-09 purged".');
    expect(rulesOf(validate(altered, facts))).toContain('leakedIds');
  });
});

// ─── 4. No-score wording ──────────────────────────────────────────────────────

describe('noScoreWording', () => {
  it('"Mean Time to Contain is poor."', () => {
    expect(gaps('Mean Time to Contain is poor.').errors).toEqual([{
      section: 'gapsAndMissingEvidence',
      sentence: 'Mean Time to Contain is poor.',
      rule: 'noScoreWording',
      detail: 'Mean Time to Contain has no score; do not describe it as "poor".',
    }]);
  });

  it('short name: "MTTC is weak."', () => {
    expect(rulesOf(gaps('MTTC is weak.'))).toEqual(['noScoreWording']);
  });

  for (const word of ['poor', 'weak', 'bad', 'failing', 'failed', 'good', 'strong', 'underperforming', 'low', 'high']) {
    it(`performance word "${word}"`, () => {
      expect(rulesOf(gaps(`Mean Time to Contain is ${word}.`))).toEqual(['noScoreWording']);
    });
  }

  it('inheritance: "Mean Time to Contain, which is poor, …" fails', () => {
    expect(rulesOf(gaps('Mean Time to Contain, which is poor, needs evidence.'))).toEqual(['noScoreWording']);
  });

  it('inheritance: "…is not measurable and poor." fails', () => {
    expect(rulesOf(gaps('Mean Time to Contain is not measurable and poor.'))).toEqual(['noScoreWording']);
  });

  it('another named item resets the subject', () => {
    // No noScoreWording for Mean Time to Contain. "poor" for a scored item
    // fails check 16 (judgement) since the June re-run.
    const result = validate(withPart('gapsAndMissingEvidence', ['F6', 'F8'],
      'Mean Time to Contain is not measurable, but Zone Availability Rate is poor.'));
    expect(rulesOf(result)).toEqual(['judgement']);
    expect(validate(withPart('gapsAndMissingEvidence', ['F6', 'F8'],
      'Mean Time to Contain is not measurable, but Zone Availability Rate is Developing.')).ok).toBe(true);
  });

  it('contrast words split clauses: F18 paraphrase with "while" passes', () => {
    expect(foundations('Zero uncontrolled multi-homed devices is in a weak state while Mean Time to Contain is not measurable.').ok).toBe(true);
  });

  it('F18 verbatim passes', () => {
    expect(foundations(FACTS.find(f => f.id === 'F18').text).ok).toBe(true);
  });

  it('"high priority" / "high-priority" / "high severity" are not performance words', () => {
    expect(gaps('Mean Time to Contain is a high-priority evidence gap.').ok).toBe(true);
    expect(gaps('Mean Time to Contain is a high priority evidence gap.').ok).toBe(true);
    expect(gaps('Mean Time to Contain is a high severity evidence gap.').ok).toBe(true);
  });

  it('"high-risk" / "high risk" are not performance words (run set 3, run 2)', () => {
    expect(gaps('Mean Time to Contain is a high-risk evidence gap.').ok).toBe(true);
    expect(gaps('Mean Time to Contain is a high risk evidence gap.').ok).toBe(true);
    expect(overview('The overall score is not available, and high-risk process issues remain.').ok).toBe(true);
  });

  it('whole words only: "highlights" is not "high"', () => {
    expect(gaps('Mean Time to Contain highlights an evidence gap.').ok).toBe(true);
  });

  it('inherited clauses are never exempt: "poor" is in cited F19, still fails', () => {
    expect(FACTS.find(f => f.id === 'F19').text).toContain('poor');
    expect(rulesOf(foundations('Mean Time to Contain is not measurable and poor.'))).toEqual(['noScoreWording']);
    expect(rulesOf(foundations('Mean Time to Contain, which is poor, needs evidence.'))).toEqual(['noScoreWording']);
  });

  it('verbatim exemption applies only when the fact is cited', () => {
    const facts = [...FACTS, { id: 'F21', kind: 'advisory', text: 'Mean Time to Contain looks weak on paper only.', refs: ['IH-08'] }];
    const text = 'Mean Time to Contain looks weak on paper only.';
    expect(validate(withPart('gapsAndMissingEvidence', ['F6', 'F21'], text), facts).ok).toBe(true);
    expect(rulesOf(validate(withPart('gapsAndMissingEvidence', ['F6'], text), facts))).toEqual(['noScoreWording']);
  });

  it('incomplete dimension: "Incident Handling is weak." fails', () => {
    expect(rulesOf(overview('Incident Handling is weak.'))).toEqual(['noScoreWording']);
  });

  it('unassessed foundational item: judged as weak fails', () => {
    const rec = loadScenario(baselineJson);
    rec.layer0 = { ...rec.layer0, 'L0-asset-inventory': { state: null } };
    const facts = buildAssessmentFacts(rec);
    const unset = facts.find(f => f.kind === 'l0_unset');
    const narrative = withPart('foundationsAndFlags', [unset.id], 'Asset inventory maintained is weak.');
    // The extra l0_unset fact shifts later IDs; cite the priority fact by kind.
    narrative.sections.priorities.factIds = [facts.find(f => f.kind === 'priority').id];
    expect(validateNarrative(narrative, facts).errors).toEqual([expect.objectContaining({
      rule: 'noScoreWording', detail: 'Asset inventory maintained was not assessed; do not describe it as "weak".',
    })]);
  });
});

// ─── 5. No score for unscored things ──────────────────────────────────────────

describe('unscoredScore', () => {
  it('"Incident Handling scored 2.50"', () => {
    expect(rulesOf(overview('Incident Handling scored 2.50.'))).toContain('unscoredScore');
  });

  it('"Incident Handling scored zero" (number word)', () => {
    expect(rulesOf(overview('Incident Handling scored zero.'))).toEqual(['unscoredScore']);
  });

  it('dimension name followed by a number: "The overall score is 2.40"', () => {
    expect(rulesOf(overview('The overall score is 2.40.'))).toContain('unscoredScore');
  });

  it('"<number> out of <number>"', () => {
    expect(rulesOf(overview('Incident Handling is 2.5 out of 4.'))).toContain('unscoredScore');
  });

  it('no-score indicator given a score', () => {
    expect(rulesOf(gaps('Mean Time to Contain has a score of 3.'))).toContain('unscoredScore');
  });

  it('process item given a score (number is in the cited fact)', () => {
    expect(rulesOf(foundations('Vulnerability Remediation Rate scored 60%.'))).toEqual(['unscoredScore']);
  });

  it('foundational control given a score', () => {
    expect(rulesOf(foundations('Asset inventory maintained is rated 4 out of 4.'))).toContain('unscoredScore');
  });

  it('allowed: no score, complete dimension score, process value', () => {
    expect(gaps('Mean Time to Contain has no score.').ok).toBe(true);
    expect(overview('Business Continuity scored 1.80.').ok).toBe(true);
    expect(foundations('Vulnerability Remediation Rate is 60%, below target.').ok).toBe(true);
  });
});

// ─── 6. Programme gap ─────────────────────────────────────────────────────────

describe('programmeGap', () => {
  for (const text of [
    'RPO Achievement Rate failed.',
    'RPO Achievement Rate was missed.',
    'This is a poor RPO Achievement Rate.',
    'RPO Achievement is failing.',
  ]) {
    it(text, () => {
      expect(rulesOf(gaps(text))).toEqual(['programmeGap']);
    });
  }

  it('negated: "not a measured failure", "rather than a failure"', () => {
    expect(gaps('RPO Achievement Rate is not a measured failure.').ok).toBe(true);
    expect(gaps('RPO Achievement Rate is a programme gap rather than a failure.').ok).toBe(true);
  });

  it('fail-word about another named item', () => {
    const result = validate(withPart('gapsAndMissingEvidence', ['F10', 'F11'],
      'RPO Achievement Rate is a programme gap, while RTO Achievement Rate failed half of its recoveries.'));
    expect(result.ok).toBe(true);
  });
});

// ─── 7. Causal overclaim ──────────────────────────────────────────────────────

describe('causal', () => {
  it('"the multi-homing caused the low availability" with a "may be related" fact cited', () => {
    expect(rulesOf(foundations('The multi-homing caused the low availability.'))).toEqual(['causal']);
  });

  for (const phrase of ['caused', 'causes', 'because of', 'due to', 'led to', 'results from', 'resulted in']) {
    it(`"${phrase}"`, () => {
      expect(rulesOf(foundations(`The Zone Availability Rate result ${phrase} the multi-homed devices.`))).toEqual(['causal']);
    });
  }

  it('no "may be related" fact cited → not checked', () => {
    expect(validate(withPart('measuredPerformance', MEASURED, 'Zone Availability Rate was 40% due to the disruption.')).ok).toBe(true);
  });
});

// ─── Changes from the first manual check ──────────────────────────────────────

describe('manual check 1: BC plans (bare-code prefix match)', () => {
  it('"the BC plans" and "BC planning" are not leaks', () => {
    expect(foundations('The BC plans are documented and BC planning continues.').ok).toBe(true);
  });

  it('run 2 sentence passes: "…and documented BC plans."', () => {
    expect(foundations('Westmaas has foundational controls in place such as asset inventory, risk assessment, IT/OT boundary separation, and documented BC plans.').ok).toBe(true);
  });

  it('"the BC score" is still a leak', () => {
    expect(rulesOf(overview('The BC score is 1.80.'))).toEqual(['leakedIds']);
  });
});

describe('manual check 1: attribution (check 8)', () => {
  it('"RPO Achievement Rate scored 1.80" fails although F2 refs it and contains 1.80', () => {
    expect(FACTS.find(f => f.id === 'F2')).toMatchObject({ refs: expect.arrayContaining(['BC-09']), text: expect.stringContaining('1.80') });
    expect(overview('RPO Achievement Rate scored 1.80.').errors).toEqual([{
      section: 'overview',
      sentence: 'RPO Achievement Rate scored 1.80.',
      rule: 'attribution',
      detail: 'The number "1.80" is not in the fact about RPO Achievement Rate.',
    }]);
  });

  it('"Zone Availability Rate (3)" fails (run 3)', () => {
    const result = validate(withPart('measuredPerformance', MEASURED,
      'Network Operability Under Disruption (3) and Zone Availability Rate (3) are also measured.'));
    expect(rulesOf(result)).toEqual(['attribution']);
    expect(result.errors[0].detail).toBe('The number "3" is not in the fact about Zone Availability Rate.');
  });

  it('numbers from the item\'s own fact pass, even when that fact is not cited', () => {
    expect(overview('This includes the programme-gap 0 for RPO Achievement Rate.').ok).toBe(true);
  });

  it('inherited clauses are not checked (reverted after the second manual check: 0 catches, 6 misfires)', () => {
    expect(validate(withPart('measuredPerformance', MEASURED, 'Zone Availability Rate is 40%, scoring 3.')).ok).toBe(true);
    expect(validate(withPart('headline', ['F11', 'F20'],
      'RPO Achievement Rate is a programme gap, and several areas have scores of 2, including Mean Time to Respond.')).ok).toBe(true);
  });

  it('the priority fact\'s own wording passes', () => {
    expect(validate(withPart('priorities', ['F20'],
      'RPO Achievement Rate is a programme gap (0); then, at score 2, Mean Time to Respond.')).ok).toBe(true);
    expect(validate(withPart('priorities', ['F20'], FACTS.find(f => f.id === 'F20').text)).ok).toBe(true);
  });
});

describe('severity attribution (check 9)', () => {
  it('"critical gaps in RPO Achievement Rate" fails: its fact is not CRITICAL', () => {
    const result = validate(withPart('headline', ['F11', 'F20'], 'The assessment highlights critical gaps in RPO Achievement Rate.'));
    expect(result.errors).toEqual([expect.objectContaining({
      rule: 'severity', detail: 'RPO Achievement Rate is not marked CRITICAL in its fact; do not call it critical.',
    })]);
  });

  it('"multi-homed devices are a critical issue" passes: its flag is CRITICAL', () => {
    expect(foundations('Uncontrolled multi-homed devices are a critical issue.').ok).toBe(true);
  });

  it('an item named "critical" is masked first ("BC plan documented for critical processes")', () => {
    expect(foundations('The BC plan documented for critical processes is in place.').ok).toBe(true);
  });

  it('"critical processes" is not a severity claim (run 1: "documented BC plan for critical processes")', () => {
    expect(foundations('Controls include asset inventory and documented BC plan for critical processes.').ok).toBe(true);
  });

  it('"high" is not checked', () => {
    expect(foundations('Asset interdependency documentation is a high priority.').ok).toBe(true);
  });
});

describe('manual check 1: context facts count as cited (numbers)', () => {
  it('"covered 8 effectiveness indicators" passes without C2 cited', () => {
    expect(validate(withPart('overview', ['F1', 'F2', 'F3'], 'The assessment covered 8 effectiveness indicators.')).ok).toBe(true);
  });

  it('"Zone Availability Rate scored 4" still fails: not in its own fact (and 4 is in C3, not cited here)', () => {
    expect(rulesOf(validate(withPart('measuredPerformance', MEASURED, 'Zone Availability Rate scored 4.')))).toEqual(['numbers', 'attribution']);
  });
});

describe('manual check 2: C2 counts, C3 scale', () => {
  it('"across two dimensions" passes (2 is in C2, always counted as cited)', () => {
    expect(validate(withPart('overview', ['F1', 'F2', 'F3'], 'The assessment covered 8 effectiveness indicators across two dimensions.')).ok).toBe(true);
  });

  it('"four dimensions" fails where no cited fact contains 4 (numbers and dimension count)', () => {
    expect(rulesOf(gaps('Westmaas was assessed across four dimensions.'))).toEqual(['numbers', 'dimensionCount']);
  });

  it('"scores range from 1.80 to 4" fails where no cited fact contains them', () => {
    expect(rulesOf(gaps('Scores range from 1.80 to 4.'))).toEqual(['numbers']);
  });

  it('the 0–4 scale needs C3 cited', () => {
    expect(rulesOf(gaps('Indicators are scored from 0 to 4.'))).toEqual(['numbers']);
    expect(validate(withPart('gapsAndMissingEvidence', [...GAPS, 'C3'], 'Indicators are scored from 0 to 4.')).ok).toBe(true);
  });
});

describe('manual check 2: dimension count (check 11)', () => {
  it('"three dimensions" fails even though 3 is in C2 and F2 is cited', () => {
    expect(overview('The assessment covered 8 effectiveness indicators across three dimensions.').errors).toEqual([expect.objectContaining({
      rule: 'dimensionCount', detail: 'The facts state 2 dimensions; do not write "three dimensions".',
    })]);
  });

  it('"four dimensions" fails even though 4 is in cited F2 (run 5)', () => {
    expect(rulesOf(overview('The assessment covered 8 effectiveness indicators across four dimensions.'))).toEqual(['dimensionCount']);
  });

  it('digits count too: "3 dimensions" fails', () => {
    expect(rulesOf(overview('Westmaas was assessed in 3 dimensions.'))).toEqual(['dimensionCount']);
  });

  it('"two dimensions" and "2 dimensions" pass', () => {
    expect(overview('The assessment covered 8 effectiveness indicators across two dimensions.').ok).toBe(true);
    expect(overview('Westmaas was assessed in 2 dimensions.').ok).toBe(true);
  });
});

// ─── 12. Headline facts ───────────────────────────────────────────────────────

describe('hybrid run set 1: the headline cites a finding (check 12)', () => {
  const HEADLINE_FACTS_ERROR = {
    section: 'headline', sentence: null, rule: 'headlineFacts',
    detail: 'The headline cites only the assessment context. State the most important finding and cite the fact it comes from.',
  };
  const TITLE = 'OT Cybersecurity Assessment of Westmaas as of 2026-01-01.';

  it('a title citing only C1 fails with one section-level error (all five runs)', () => {
    expect(validate(withPart('headline', ['C1'], TITLE)).errors).toEqual([HEADLINE_FACTS_ERROR]);
  });

  it('citing C1–C3 (context and scale) still fails', () => {
    expect(validate(withPart('headline', ['C1', 'C2', 'C3'], TITLE)).errors).toEqual([HEADLINE_FACTS_ERROR]);
  });

  it('C1 with a finding fact passes', () => {
    expect(validate(withPart('headline', ['C1', 'F2'], 'Business Continuity is complete at 1.80 out of 4.')).ok).toBe(true);
  });

  it('headline only: an overview citing only C1 does not fail it', () => {
    expect(rulesOf(overview('This is the 2026-01-01 assessment of "Westmaas".'))).toEqual([]);
    expect(validate(withPart('overview', ['C1'], 'This is the 2026-01-01 assessment of "Westmaas".')).ok).toBe(true);
  });

  it('applies when only the model parts are checked', () => {
    const narrative = { headline: { factIds: ['C1'], text: TITLE }, sections: { overview: GOOD.sections.overview } };
    expect(validateNarrative(narrative, FACTS, { parts: ['headline', 'overview'] }).errors).toEqual([HEADLINE_FACTS_ERROR]);
  });

  it('an unknown cited ID is not a finding', () => {
    expect(rulesOf(validate(withPart('headline', ['C1', 'F99'], TITLE)))).toEqual(['factIds', 'headlineFacts']);
  });
});

// ─── 0. Shape: braces ─────────────────────────────────────────────────────────

describe('June manual check: braces in the text (check 0)', () => {
  const BRACE_ERROR = {
    section: 'overview', sentence: null, rule: 'shape',
    detail: 'The text contains "{" or "}". Write plain sentences only, without JSON.',
  };
  const PLAIN = 'Business Continuity is complete at 1.80 out of 4.';

  it('a stray " }" at the end fails once (June run 4, accepted)', () => {
    expect(overview(`${PLAIN} }`).errors).toEqual([BRACE_ERROR]);
  });

  it('"{" fails too; several braces give one error', () => {
    expect(overview(`{ ${PLAIN} }`).errors).toEqual([BRACE_ERROR]);
  });

  it('the other checks still run', () => {
    expect(rulesOf(overview(`Mean Time to Contain is poor. }`))).toEqual(['shape', 'noScoreWording']);
  });

  it('a client name with a brace, quoted exactly in a part citing C1, passes', () => {
    const facts = factsWith({ clientId: 'Plant {7}' });
    expect(validate(withPart('overview', OVERVIEW, 'This assessment covers "Plant {7}".'), facts).ok).toBe(true);
  });
});

// ─── 13. Relation ─────────────────────────────────────────────────────────────

describe('June manual check: an invented "may be related" (check 13)', () => {
  const INVENTED = 'Asset interdependency documentation is incomplete or outdated, which may be related to the Incident Handling score.';
  const detail = 'Do not write "may be related": no cited fact relates these items. Only an advisory fact can state that two items may be related.';

  it('fails in a part that cites no "may be related" fact (June run 2, accepted)', () => {
    expect(validate(withPart('overview', [...OVERVIEW, 'F14'], INVENTED)).errors).toEqual([
      { section: 'overview', sentence: INVENTED, rule: 'relation', detail },
    ]);
  });

  it('any case: "May be related" fails too', () => {
    expect(rulesOf(overview('Incident Handling and Business Continuity. May be related, the two dimensions are incomplete.'))).toContain('relation');
  });

  it('passes in a part that cites a "may be related" fact (F19)', () => {
    expect(foundations(GOOD.sections.foundationsAndFlags.text).ok).toBe(true);
    expect(validate(withPart('overview', [...OVERVIEW, 'F14', 'F19'], INVENTED)).errors.map(e => e.rule)).not.toContain('relation');
  });

  it('is a known rule', () => {
    expect(VALIDATOR_RULES).toContain('relation');
  });
});

// ─── 14. Flag count ───────────────────────────────────────────────────────────

describe('June and sparse re-runs: flag counts (check 14)', () => {
  const flags = (ids, text) => validate(withPart('overview', [...OVERVIEW, ...ids], text));

  it('"There are two flags" citing one flag fails (June run 1)', () => {
    expect(flags(['F14'], 'There are two flags: asset interdependency documentation is incomplete or outdated.').errors).toEqual([{
      section: 'overview',
      sentence: 'There are two flags: asset interdependency documentation is incomplete or outdated.',
      rule: 'flagCount',
      detail: 'The cited facts contain 1 flag; do not write "two flags".',
    }]);
  });

  it('"three flags" citing F13–F15 passes', () => {
    expect(flags(['F13', 'F14', 'F15'], 'Three flags were raised.').ok).toBe(true);
  });

  it('a severity word counts only flags of that severity', () => {
    const text = 'There are two HIGH severity flags.';
    expect(flags(['F13', 'F14', 'F15'], text).ok).toBe(true);
    expect(rulesOf(flags(['F13', 'F14'], text))).toEqual(['flagCount']);
    expect(flags(['F13', 'F14'], text).errors[0].detail).toBe('The cited facts contain 1 HIGH flag; do not write "two HIGH severity flags".');
  });

  it('a process fact with a severity is a flag (F16, MEDIUM NOTE)', () => {
    expect(flags(['F13', 'F16'], 'There are two flags.').ok).toBe(true);
  });

  it('digits count too; the number must be within two words of "flag(s)"', () => {
    expect(rulesOf(flags(['F13'], 'There are 2 flags.'))).toEqual(['flagCount']);
    expect(flags(['F13'], 'Of the 8 effectiveness indicators none has a flag.').ok).toBe(true);
  });

  it('is a known rule', () => {
    expect(VALIDATOR_RULES).toContain('flagCount');
  });
});

// ─── 15. Missing ──────────────────────────────────────────────────────────────

describe('baseline re-run: "missing" for an item with no score (check 15)', () => {
  const PHRASE = 'Do not write "missing indicator": the indicator exists; say it has no score.';

  it('"a missing indicator" fails anywhere (baseline runs 2, 3, 5)', () => {
    const sentence = 'Incident Handling is incomplete due to a missing indicator.';
    expect(gaps(sentence).errors).toEqual([{ section: 'gapsAndMissingEvidence', sentence, rule: 'missing', detail: PHRASE }]);
  });

  it('"missing indicators" and "missing effectiveness indicators" fail (sparse run 2)', () => {
    expect(rulesOf(overview('Both dimensions are incomplete, with no scores available due to missing indicators.'))).toEqual(['missing']);
    expect(rulesOf(overview('Both dimensions are incomplete due to missing effectiveness indicators.'))).toEqual(['missing']);
  });

  it('"missing" with a no-score item as subject fails; the hint matches its state (not measurable)', () => {
    expect(gaps('Mean Time to Contain is missing.').errors).toEqual([expect.objectContaining({
      rule: 'missing',
      detail: 'Do not call Mean Time to Contain missing: it exists and has no score. Say it could not be measured.',
    })]);
  });

  it('the hint matches the state: not yet assessed (indicator and foundational item), otherwise "has no score"', () => {
    const rec = loadScenario(sparseJson);
    rec.indicators = { ...rec.indicators, 'IH-08': { state: STATE.NO_QUALIFYING_EVENT } };
    const facts = buildAssessmentFacts(rec);
    const cite = facts.filter(f => f.kind === 'no_score' || f.kind === 'l0_unset').map(f => f.id);
    const detailFor = text => validateNarrative({ sections: { gapsAndMissingEvidence: { factIds: cite, text } } }, facts,
      { parts: ['gapsAndMissingEvidence'] }).errors.filter(e => e.rule === 'missing').map(e => e.detail);
    expect(detailFor('Mean Time to Respond is missing.')).toEqual([
      'Do not call Mean Time to Respond missing: it exists and has no score. Say it is not yet assessed.',
    ]);
    expect(detailFor('The risk assessment is missing.')).toEqual([
      'Do not call Risk assessment per zone missing: it exists and has no score. Say it is not yet assessed.',
    ]);
    expect(detailFor('Mean Time to Contain is missing.')).toEqual([
      'Do not call Mean Time to Contain missing: it exists and has no score. Say it has no score.',
    ]);
  });

  it('Oudendijk re-run false positive: "missing A and B scores" passes like "a missing A score"; "missing A and B" fails', () => {
    const rec = loadScenario(sparseJson);
    const facts = buildAssessmentFacts(rec);
    const cite = facts.filter(f => f.kind === 'dim_incomplete').map(f => f.id);
    const missingOf = text => validateNarrative({ sections: { overview: { factIds: cite, text } } }, facts, { parts: ['overview'] })
      .errors.filter(e => e.rule === 'missing');
    // Run 5, attempt 3 (2026-09-29 18:38 run set).
    expect(missingOf('For Incident Handling, there are three indicators, but the dimension is incomplete due to missing Mean Time to Respond and Mean Time to Contain scores.')).toEqual([]);
    expect(missingOf('Business Continuity is incomplete due to missing Zone Availability Rate, Operational Threshold Violation Rate, RTO Achievement Rate and RPO Achievement Rate scores.')).toEqual([]);
    expect(missingOf('Incident Handling is incomplete due to missing Mean Time to Respond and Mean Time to Contain data.')).toEqual([]);
    // Still fails; as before, the error names the item in the clause with "missing".
    expect(missingOf('Incident Handling is incomplete due to missing Mean Time to Respond and Mean Time to Contain.').map(e => e.detail)).toEqual([
      'Do not call Mean Time to Respond missing: it exists and has no score. Say it is not yet assessed.',
    ]);
    // One listed "missing … scores" does not excuse another bare "missing".
    expect(missingOf('Scores are absent due to missing Mean Time to Respond and Mean Time to Contain scores; Zone Availability Rate is missing.').map(e => e.detail)).toEqual([
      'Do not call Zone Availability Rate missing: it exists and has no score. Say it is not yet assessed.',
    ]);
    // Still caught: the names are followed by "indicators", not by what is missing.
    expect(missingOf('Incident Handling is incomplete due to missing Mean Time to Respond and Mean Time to Contain indicators.')).not.toEqual([]);
  });

  it('"missing data", "missing scores", "missing evidence" pass', () => {
    expect(gaps('Incident Handling is incomplete due to missing data on Mean Time to Contain.').ok).toBe(true);
    expect(overview('Both dimensions are incomplete due to missing scores.').ok).toBe(true);
    expect(gaps('Mean Time to Contain has no score because of missing evidence.').ok).toBe(true);
  });

  it('replay false positive: "a missing Mean Time to Contain score" passes (the score is missing)', () => {
    expect(gaps('Incident Handling is incomplete due to a missing Mean Time to Contain score.').ok).toBe(true);
  });

  it('is a known rule', () => {
    expect(VALIDATOR_RULES).toContain('missing');
  });
});

// ─── 9. Severity, per sentence ────────────────────────────────────────────────

describe('June re-run: "critical" naming no flagged item (check 9, per sentence)', () => {
  const HEADLINE = 'The assessment identified equal priority critical issues with response times and recovery rates.';

  it('fails once when no cited flag fact is CRITICAL (June run 5, accepted)', () => {
    expect(validate(withPart('headline', ['F20'], HEADLINE)).errors).toEqual([{
      section: 'headline', sentence: HEADLINE, rule: 'severity',
      detail: 'None of the cited flags is CRITICAL; do not write "critical".',
    }]);
    expect(rulesOf(validate(withPart('headline', ['F14', 'F20'], HEADLINE)))).toEqual(['severity']);
  });

  it('passes when a cited flag fact is CRITICAL', () => {
    expect(validate(withPart('headline', ['F13', 'F20'], HEADLINE)).ok).toBe(true);
  });

  it('replay false positive: a negated "critical" passes ("no critical or high flags")', () => {
    expect(rulesOf(validate(withPart('headline', ['F20'], 'There are no critical flags among the lowest effectiveness results.')))).not.toContain('severity');
  });

  it('passes when the sentence names a flagged item (the clause rule decides)', () => {
    expect(validate(withPart('headline', ['F13'], 'Critical: uncontrolled inter-zone multi-homed devices were identified.')).ok).toBe(true);
  });

  it('is not reported twice when the clause rule already failed the sentence', () => {
    const result = validate(withPart('headline', ['F11', 'F20'], 'The assessment highlights critical gaps in RPO Achievement Rate.'));
    expect(result.errors.filter(e => e.rule === 'severity')).toHaveLength(1);
  });
});

// ─── 16. Judgement ────────────────────────────────────────────────────────────

describe('June re-run: judgements about scored results (check 16)', () => {
  const detail = word => `Do not describe a score as "${word}": describe it only by its number or its level label (for example Good or Developing).`;
  const measured = text => validate(withPart('measuredPerformance', MEASURED, text));

  it('"Both dimensions are complete but scored below average" fails (score word, no item named; June run 4)', () => {
    const sentence = 'Both dimensions are complete but scored below average.';
    expect(overview(sentence).errors).toEqual([{ section: 'overview', sentence, rule: 'judgement', detail: detail('below average') }]);
  });

  it('each judgement word fails in a sentence naming a scored item', () => {
    for (const phrase of ['weak', 'poor', 'low', 'a weakness', 'weaknesses', 'an area of concern', 'areas of concern', 'below average']) {
      expect(rulesOf(measured(`Mean Time to Respond is ${phrase}.`))).toEqual(['judgement']);
    }
  });

  it('"equal priority weaknesses in Mean Time to Respond" fails (June run 4)', () => {
    expect(rulesOf(validate(withPart('priorities', ['F20'], 'There are equal priority weaknesses in Mean Time to Respond and RTO Achievement Rate.')))).toEqual(['judgement']);
  });

  it('a complete dimension counts as scored', () => {
    expect(rulesOf(overview('Business Continuity is low.'))).toEqual(['judgement']);
  });

  it('replay false positive: "Business Continuity plan test" is not the dimension', () => {
    expect(rulesOf(foundations('A Business Continuity plan test was not performed, and the architecture foundation for Mean Time to Contain is weak.'))).not.toContain('judgement');
  });

  it('"Zone Availability Rate is poor (score 2)" fails unless verbatim in a cited fact', () => {
    expect(rulesOf(measured('Zone Availability Rate is poor (score 2).'))).toEqual(['judgement']);
    const advisory = FACTS.find(f => f.id === 'F19').text;
    expect(foundations(advisory).ok).toBe(true);
  });

  it('level labels pass', () => {
    expect(measured('Mean Time to Respond scored 2 (Developing).').ok).toBe(true);
    for (const label of ['Excellent', 'Good', 'Developing', 'Initial', 'None']) {
      expect(rulesOf(measured(`Mean Time to Detect was rated ${label}.`))).not.toContain('judgement');
    }
  });

  it('"lower" and "lowest" are not "low"; a sentence about no scored item is not checked', () => {
    expect(measured('For Mean Time to Detect, lower values are better.').ok).toBe(true);
    expect(validate(withPart('priorities', ['F20'], 'The lowest effectiveness result is RPO Achievement Rate, a programme gap at 0.')).ok).toBe(true);
    expect(rulesOf(foundations('Asset interdependency documentation is weak.'))).not.toContain('judgement');
  });

  it('is a known rule', () => {
    expect(VALIDATOR_RULES).toContain('judgement');
  });
});

describe('manual check 2: "respectively" (check 10)', () => {
  const detail = 'Give each item its own number or label; do not write "respectively".';

  it('run 2: "…critical and high priority issues, respectively" fails only on "respectively"', () => {
    expect(foundations('Uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation are identified as critical and high priority issues, respectively.').errors)
      .toEqual([expect.objectContaining({ rule: 'respectively', detail })]);
  });

  it('run 5: "…scored 3 and 2, respectively" fails only on "respectively"', () => {
    expect(rulesOf(validate(withPart('measuredPerformance', MEASURED,
      'Network Operability Under Disruption and Zone Availability Rate scored 3 and 2, respectively.')))).toEqual(['respectively']);
  });

  it('checks 4–6 still apply in a "respectively" sentence', () => {
    expect(rulesOf(gaps('Mean Time to Contain is poor and RPO Achievement Rate is failing, respectively.')))
      .toEqual(expect.arrayContaining(['respectively', 'noScoreWording', 'programmeGap']));
  });
});

describe('manual check 2: causal detail names the replacement', () => {
  it('suggests the fact\'s own wording', () => {
    expect(foundations('The Zone Availability Rate result is due to the multi-homed devices.').errors).toEqual([expect.objectContaining({
      rule: 'causal',
      detail: 'Do not write "due to": a cited fact says "may be related", and "due to" claims a cause. Use the fact\'s own wording (for example "so") or leave the explanation out.',
    })]);
  });
});

describe('manual check 1: "measured" on a no-score indicator (check 4)', () => {
  it('"Mean Time to Contain was measured." fails', () => {
    expect(gaps('Mean Time to Contain was measured.').errors).toEqual([expect.objectContaining({
      rule: 'noScoreWording', detail: 'Mean Time to Contain has no score; do not describe it as "measured".',
    })]);
  });

  it('run 5 sentence fails: "…mean time to contain were measured."', () => {
    expect(rulesOf(gaps('Mean time to detect and mean time to contain were measured.'))).toEqual(['noScoreWording']);
  });

  it('negated passes: "could not be measured", "was not measured"', () => {
    expect(gaps('Mean Time to Contain could not be measured.').ok).toBe(true);
    expect(gaps('Mean Time to Contain was not measured.').ok).toBe(true);
  });
});

describe('manual check 1: aliases for foundational items', () => {
  function withUnsetAssetInventory(text) {
    const rec = loadScenario(baselineJson);
    rec.layer0 = { ...rec.layer0, 'L0-asset-inventory': { state: null } };
    const facts = buildAssessmentFacts(rec);
    const narrative = withPart('foundationsAndFlags', [facts.find(f => f.kind === 'l0_unset').id], text);
    narrative.sections.priorities.factIds = [facts.find(f => f.kind === 'priority').id];
    return validateNarrative(narrative, facts);
  }

  it('"the asset inventory" names the item: unassessed and "weak" fails', () => {
    expect(withUnsetAssetInventory('The asset inventory is weak.').errors).toEqual([expect.objectContaining({
      rule: 'noScoreWording', detail: 'Asset inventory maintained was not assessed; do not describe it as "weak".',
    })]);
  });

  it('plural alias: "documented BC plans" names the item and is not scored', () => {
    expect(rulesOf(foundations('The documented BC plans scored 3.'))).toContain('unscoredScore');
  });
});

// ─── Parts option (hybrid report: only the model parts are validated) ─────────

describe('parts option', () => {
  const MODEL = ['headline', 'overview'];
  const modelOnly = { headline: GOOD.headline, sections: { overview: GOOD.sections.overview } };

  it('checks only the given parts: the other sections may be absent', () => {
    expect(validateNarrative(modelOnly, FACTS, { parts: MODEL })).toEqual({ ok: true, errors: [] });
    expect(rulesOf(validateNarrative(modelOnly, FACTS))).toEqual(['shape']);
  });

  it('errors outside the given parts are not reported', () => {
    const narrative = withPart('measuredPerformance', MEASURED, 'Mean Time to Detect was 99 hours.');
    expect(validateNarrative(narrative, FACTS, { parts: MODEL }).ok).toBe(true);
    expect(rulesOf(validateNarrative(narrative, FACTS))).toContain('numbers');
  });

  it('categories still come from all facts (a no-score item the part never cited)', () => {
    const narrative = { headline: GOOD.headline, sections: { overview: { factIds: ['C1', 'F2'], text: 'Mean Time to Contain is poor.' } } };
    expect(rulesOf(validateNarrative(narrative, FACTS, { parts: MODEL }))).toEqual(['noScoreWording']);
  });
});

// ─── Splitting and extraction ─────────────────────────────────────────────────

describe('splitSentences', () => {
  it('splits on . ! ? before an uppercase letter or digit', () => {
    expect(splitSentences('Score 1.80 out of 4. Next one! Really? 3 more.')).toEqual(['Score 1.80 out of 4.', 'Next one!', 'Really?', '3 more.']);
  });

  it('does not split decimals or "e.g. the"', () => {
    expect(splitSentences('It was 12.5%, e.g. the worst value')).toEqual(['It was 12.5%, e.g. the worst value']);
  });

  it('keeps a final sentence without punctuation and splits before a quote', () => {
    expect(splitSentences('First. "Quoted" second')).toEqual(['First.', '"Quoted" second']);
  });
});

describe('splitClauses', () => {
  it('splits on , ; — spaced dashes and conjunctions', () => {
    expect(splitClauses('a, b; c — d – e - f and g but h while i whereas j although k though l'))
      .toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']);
  });

  it('does not split unspaced dashes or words containing "and"', () => {
    expect(splitClauses('Incident Handling is below target (50–69%) for multi-homed devices'))
      .toEqual(['Incident Handling is below target (50–69%) for multi-homed devices']);
  });
});

describe('extractNumbers', () => {
  it('normalises digits, words and dates', () => {
    expect(extractNumbers('score 1.80 out of 4')).toEqual(['1.8', '4']);
    expect(extractNumbers('85% and 3.00')).toEqual(['85', '3']);
    expect(extractNumbers('dated 2026-01-01')).toEqual(['2026-01-01']);
    expect(extractNumbers('Two of five, zero left')).toEqual(['2', '5', '0']);
    expect(extractNumbers('(50–69%)')).toEqual(['50', '69']);
  });
});

// ─── Property tests ───────────────────────────────────────────────────────────

function withSentence(narrative, sentence) {
  const n = clone(narrative);
  n.sections.overview.text += ` ${sentence}`;
  return n;
}

// Each run validates several whole narratives; under the full parallel suite
// the default 5 s per test was exceeded occasionally (timing only, no
// counterexample in 3,000 extra runs).
const PROPERTY_TIMEOUT_MS = 30_000;

// ─── Final fix round ──────────────────────────────────────────────────────────

const JUNE_FACTS = buildAssessmentFacts(loadScenario(followUpJson));
const SPARSE_FACTS = buildAssessmentFacts(loadScenario(sparseJson));
const juneOverview = text => validateNarrative(
  { sections: { overview: { factIds: ['C2', 'F1', 'F2', 'F3'], text } } }, JUNE_FACTS, { parts: ['overview'] });

describe('re-run after checks 14–16: complete dimensions in check 8', () => {
  it('"Business Continuity, with a score of 5 out of 4" fails although 5 is in its fact (June run 4)', () => {
    expect(juneOverview('Business Continuity, with a score of 5 out of 4.').errors).toEqual([{
      section: 'overview', sentence: 'Business Continuity, with a score of 5 out of 4.', rule: 'attribution',
      detail: 'The score of Business Continuity is 2.80; do not write "5".',
    }]);
  });

  it('the right score passes, written as in the fact or normalised', () => {
    expect(juneOverview('Business Continuity scored 2.80 out of 4.').ok).toBe(true);
    expect(juneOverview('Business Continuity, with 5 indicators, scored 2.8 out of 4.').ok).toBe(true);
    expect(juneOverview('The overall score is 2.73 out of 4.').ok).toBe(true);
  });

  it('another dimension\'s score fails, named or inherited', () => {
    expect(rulesOf(juneOverview('Incident Handling scored 2.80.'))).toEqual(['attribution']);
    expect(rulesOf(juneOverview('The overall score is 2.67 out of 4.'))).toEqual(['attribution']);
    expect(rulesOf(juneOverview('Incident Handling, with a score of 3 out of 4, is complete.'))).toEqual(['attribution']);
  });

  it('a number in a clause naming the dimension must be in its fact', () => {
    expect(rulesOf(juneOverview('Business Continuity covers 7 indicators.'))).toContain('numbers');
    // 3 is in C2, which describes the dimensions: not caught (known limitation for counts).
    expect(juneOverview('Business Continuity covers 3 indicators.').ok).toBe(true);
    expect(juneOverview('The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity.').ok).toBe(true);
  });
});

describe('re-run after checks 14–16: numbers next to "flag(s)" are left to check 14', () => {
  const flags = (ids, text) => validate(withPart('overview', [...OVERVIEW, ...ids], text));

  it('"There is one HIGH severity flag" passes with one flag fact cited (June runs 2 and 4)', () => {
    expect(flags(['F14'], 'There is one HIGH severity flag.').ok).toBe(true);
    expect(flags(['F14'], 'There is one flag.').ok).toBe(true);
  });

  it('a wrong count still fails, as flagCount only', () => {
    expect(rulesOf(flags(['F13', 'F14'], 'There is one flag.'))).toEqual(['flagCount']);
  });
});

describe('re-run after checks 14–16: level labels in the model parts (check 17)', () => {
  const detail = label => `Do not write the level label "${label}": describe a score only by its number.`;

  it('"The overall score is Developing" fails in the overview (June runs 1, 3, 5)', () => {
    expect(overview('The overall score is Developing.').errors).toEqual([{
      section: 'overview', sentence: 'The overall score is Developing.', rule: 'levelLabel', detail: detail('Developing'),
    }]);
  });

  it('"both at Good level" and "a good level" fail; the headline too', () => {
    expect(rulesOf(overview('Only two indicators are scored, both at Good level.'))).toEqual(['levelLabel']);
    expect(rulesOf(validate(withPart('headline', ['F2'], 'Business Continuity is at a good level.')))).toEqual(['levelLabel']);
    for (const label of ['Excellent', 'Initial', 'None']) {
      expect(rulesOf(overview(`Business Continuity is rated ${label}.`))).toContain('levelLabel');
    }
  });

  it('a fact\'s own "3 (Good)" passes (F15, sparse scenario)', () => {
    const text = 'Only 2 of 8 effectiveness indicators have a score; neither is below 3 (Good).';
    expect(validateNarrative({ sections: { overview: { factIds: ['C2', 'F15'], text } } }, SPARSE_FACTS, { parts: ['overview'] }).ok).toBe(true);
    const paraphrase = 'Only two out of eight effectiveness indicators have scores, but neither is below 3 (Good).';
    expect(validateNarrative({ sections: { overview: { factIds: ['C2', 'F15'], text: paraphrase } } }, SPARSE_FACTS, { parts: ['overview'] }).ok).toBe(true);
  });

  it('sentence-initial words are not labels; the generated sections keep theirs', () => {
    expect(overview('None of the dimensions has a level label here.').ok).toBe(true);
    expect(validate(withPart('measuredPerformance', MEASURED, 'Mean Time to Detect scored 3 (Good).')).ok).toBe(true);
  });

  it('is a known rule', () => {
    expect(VALIDATOR_RULES).toContain('levelLabel');
  });
});

describe('re-run after checks 14–16: "performing well" (check 16)', () => {
  it('fails with a scored item named, and without one (sparse run 3)', () => {
    expect(rulesOf(validate(withPart('measuredPerformance', MEASURED, 'Mean Time to Detect is performing well.')))).toEqual(['judgement']);
    expect(rulesOf(overview('Only two out of eight effectiveness indicators are performing well.'))).toEqual(['judgement']);
  });
});

describe('the app: the headline is exactly one sentence (check 18)', () => {
  it('a headline copying two flag facts fails once', () => {
    const text = 'CRITICAL: Uncontrolled inter-zone multi-homed devices were identified. HIGH: Asset interdependency documentation is incomplete or outdated.';
    expect(validate(withPart('headline', ['F13', 'F14'], text)).errors).toEqual([{
      section: 'headline', sentence: null, rule: 'headlineSentences', detail: 'The headline must be exactly one sentence.',
    }]);
  });

  it('one sentence passes; other parts may have several', () => {
    expect(validate(withPart('headline', ['F13'], 'Uncontrolled inter-zone multi-homed devices were identified.')).ok).toBe(true);
    expect(validate(GOOD).ok).toBe(true);
  });

  it('is a known rule', () => {
    expect(VALIDATOR_RULES).toContain('headlineSentences');
  });
});

describe('sparse re-run after the final fix round: a count is not a dimension score (check 5)', () => {
  const sparse = text => validateNarrative(
    { sections: { overview: { factIds: ['C2', 'F1', 'F2', 'F3'], text } } }, SPARSE_FACTS, { parts: ['overview'] });

  it('"Business Continuity has five effectiveness indicators" passes (runs 2 and 3 failed on it)', () => {
    expect(sparse('Similarly, Business Continuity has five effectiveness indicators, but the dimension is incomplete because Zone Availability Rate, Operational Threshold Violation Rate, RTO Achievement Rate, and RPO Achievement Rate have no scores.').ok).toBe(true);
    expect(sparse('The assessment covered Incident Handling and Business Continuity across 8 effectiveness indicators.').ok).toBe(true);
    expect(sparse('Business Continuity has 5 indicators.').ok).toBe(true);
  });

  it('a score for an incomplete dimension still fails', () => {
    expect(rulesOf(sparse('Business Continuity scored 2.'))).toEqual(['unscoredScore']);
    expect(rulesOf(sparse('Business Continuity: 2.5 out of 4.'))).toContain('unscoredScore');
  });
});

describe('June re-run after the final fix round: "moderate" (check 16)', () => {
  it('"reflecting moderate performance" fails', () => {
    expect(rulesOf(juneOverview('The overall score is 2.73 out of 4, reflecting moderate performance.'))).toEqual(['judgement']);
  });

  it('the generated process sentence names no score and passes', () => {
    const text = 'Vulnerability Remediation Rate is 60%, in the 50–69% band, which is below target — moderate programme improvement warranted (medium note).';
    expect(validateNarrative({ sections: { foundationsAndFlags: { factIds: ['F14'], text } } }, JUNE_FACTS, { parts: ['foundationsAndFlags'] }).ok).toBe(true);
  });
});

describe('property-based tests (fast-check)', () => {
  it('the cited facts\' own text always passes', () => {
    fc.assert(fc.property(assessmentArb, rec => {
      const facts = buildAssessmentFacts(rec);
      expect(validateNarrative(echoNarrative(facts), facts).errors).toEqual([]);
    }), { numRuns: 200 });
  }, PROPERTY_TIMEOUT_MS);

  it('an injected violation of checks 3–6 is always caught', () => {
    fc.assert(fc.property(assessmentArb, fc.constantFrom(...ALL_INDICATOR_IDS, ...LAYER0_ALL_IDS), (rec, leakedId) => {
      const facts = buildAssessmentFacts(rec);
      const base = echoNarrative(facts);
      const rules = sentence => rulesOf(validateNarrative(withSentence(base, sentence), facts));

      expect(rules(`See ${leakedId}.`)).toContain('leakedIds');
      for (const f of facts) {
        if (f.kind === 'no_score') expect(rules(`${displayName(f.refs[0])} is poor.`)).toContain('noScoreWording');
        if (f.kind === 'dim_incomplete') expect(rules(`${DIMENSION_NAMES[f.refs[0]]} scored 2.`)).toContain('unscoredScore');
        if (f.kind === 'process') expect(rules(`${displayName(f.refs[0])} scored 3.`)).toContain('unscoredScore');
        if (f.kind === 'gap_zero') expect(rules(`${displayName(f.refs[0])} failed.`)).toContain('programmeGap');
      }
    }), { numRuns: 100 });
  }, PROPERTY_TIMEOUT_MS);

  it('malformed input never throws', () => {
    const partArb = fc.oneof(fc.anything(), fc.record({ factIds: fc.anything(), text: fc.anything() }));
    const narrativeArb = fc.oneof(
      fc.anything(),
      fc.record({ headline: partArb, sections: fc.oneof(fc.anything(), fc.dictionary(fc.constantFrom(...SECTION_KEYS), partArb)) }),
    );
    fc.assert(fc.property(narrativeArb, narrative => {
      const result = validateNarrative(narrative, FACTS);
      expect(typeof result.ok).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
    }), { numRuns: 300 });
  }, PROPERTY_TIMEOUT_MS);
});

// ─── Step 7: target sentences in check 8 ──────────────────────────────────────

describe('Step 7: a target score is not the current score (check 8)', () => {
  const TARGET_SENTENCE = 'Zone Availability Rate, now 40% (score 2, Developing), reaches score 3 (Good) at 70% or more.';

  it('the own fact of Zone Availability Rate now contains its target score 3', () => {
    expect(FACTS.find(f => f.id === 'F8').text).toContain('Next level: score 3 at 70% or more.');
  });

  it('"Zone Availability Rate is at 3" fails in the overview (3 is in C2, so only check 8 can catch it)', () => {
    const result = overview('Zone Availability Rate is at 3.');
    expect(rulesOf(result)).toEqual(['attribution']);
    expect(result.errors[0].detail).toBe('The number "3" is not in the fact about Zone Availability Rate.');
  });

  it('the logged 2026-09-28 sentence still fails in Measured performance', () => {
    const logged = 'Measurable performance indicators showed Mean Time to Detect at 3, Mean Time to Respond at 2, Network Operability Under Disruption at 3, Zone Availability Rate at 3, Operational Threshold Violation Rate at 2, RTO Achievement Rate at 2, and RPO Achievement Rate at 0 due to a programme gap.';
    const details = validate(withPart('measuredPerformance', [...MEASURED, 'F11'], logged)).errors.map(e => e.detail);
    expect(details).toContain('The number "3" is not in the fact about Zone Availability Rate.');
  });

  it('the Targets sentence passes in the Targets section and fails in any other: 70 is only in the target sentence', () => {
    expect(validate(withPart('targets', ['F8'], TARGET_SENTENCE))).toEqual({ ok: true, errors: [] });
    for (const key of ['overview', 'measuredPerformance', 'priorities']) {
      const result = validate(withPart(key, ['C1', 'C2', 'C3', 'F8', 'F20'], TARGET_SENTENCE));
      expect(result.errors.map(e => e.detail), key).toContain('The number "70" does not appear in any fact cited by this section.');
    }
  });

  it('copying the target sentence verbatim is no exemption outside the Targets section', () => {
    const result = validate(withPart('measuredPerformance', ['F8'], 'Zone Availability Rate: next level: score 3 at 70% or more.'));
    expect(rulesOf(result)).toContain('numbers');
  });

  it('property: an overview claiming a scored indicator already has its target score always fails', () => {
    fc.assert(fc.property(assessmentArb, assessment => {
      const facts = buildAssessmentFacts(assessment);
      const cited = facts.filter(f => f.kind === 'context' || f.kind === 'scale').map(f => f.id);
      for (const f of facts.filter(x => x.kind === 'scored' && x.data.target)) {
        const narrative = { sections: { overview: { factIds: cited, text: `${f.data.name} scored ${f.data.target.score}.` } } };
        const result = validateNarrative(narrative, facts, { parts: ['overview'] });
        expect(result.ok).toBe(false);
        // 2, 3 and 4 are in the context and scale facts: only check 8 stands between them and a pass.
        if (f.data.target.score >= 2) expect(rulesOf(result)).toContain('attribution');
      }
    }), { numRuns: 100 });
  });
});

// ─── Step 9: Where to start (validatePicks) ───────────────────────────────────

describe('validatePicks (Step 9)', () => {
  const BASELINE = loadScenario(baselineJson);
  const ACTIONS = matchAssessmentActions(BASELINE);
  const clone = value => JSON.parse(JSON.stringify(value));
  const check = (draft, facts = FACTS, actions = ACTIONS) => validatePicks(draft, facts, actions);
  const rules = draft => check(draft).errors.map(e => e.rule);

  /** WESTMAAS_PICKS with one pick replaced (by action ID) or its reason changed. */
  function withPick(actionId, reason, replacing = actionId) {
    const draft = clone(WESTMAAS_PICKS);
    const i = draft.picks.findIndex(p => p.actionId === replacing);
    draft.picks[i] = { actionId, reason };
    return draft;
  }

  it('the hand-written Westmaas picks pass', () => {
    expect(check(WESTMAAS_PICKS)).toEqual({ ok: true, errors: [] });
  });

  it('the new rules are validator rules', () => {
    for (const rule of ['pickSet', 'criticalPick', 'pickSubject', 'reasonSentences', 'urgency']) {
      expect(VALIDATOR_RULES).toContain(rule);
    }
  });

  it('errors: section whereToStart, the pick\'s action ID (null for the set), descriptive details', () => {
    const { errors } = check(withPick('ACT-BC-08', 'RPO Achievement Rate failed.'));
    expect(errors).toEqual([{
      section: 'whereToStart',
      pick: 'ACT-BC-08',
      sentence: 'RPO Achievement Rate failed.',
      rule: 'programmeGap',
      detail: 'RPO Achievement Rate is a programme gap, not a measured failure; do not describe it as "failed".',
    }]);
  });

  describe('shape', () => {
    it('no list of picks: one set-level error', () => {
      for (const draft of [null, 42, 'x', [], {}, { picks: 'x' }]) {
        expect(check(draft).errors).toEqual([{
          section: 'whereToStart', pick: null, sentence: null, rule: 'shape', detail: 'The reply has no list of picks.',
        }]);
      }
    });

    it('a pick without an action ID is a set-level error', () => {
      const draft = clone(WESTMAAS_PICKS);
      draft.picks[2] = { reason: 'No BC plan test was performed during the assessment period.' };
      expect(check(draft).errors).toContainEqual(expect.objectContaining({
        pick: null, rule: 'shape', detail: 'Pick 3 has no action ID.',
      }));
    });

    it('a matched pick without a reason is a per-pick error', () => {
      const draft = clone(WESTMAAS_PICKS);
      draft.picks[2].reason = '  ';
      expect(check(draft).errors).toEqual([expect.objectContaining({
        pick: 'ACT-L0-08', rule: 'shape', detail: '"Test the BC plan" has no reason.',
      })]);
    });
  });

  describe('pickSet', () => {
    it('an action that was not matched: by title, or generic when it is not in the catalogue', () => {
      expect(check(withPick('ACT-BC-07', 'RPO Achievement Rate has no recovery point objective.', 'ACT-BC-08')).errors).toContainEqual(
        expect.objectContaining({ pick: null, rule: 'pickSet',
          detail: '"Meet recovery point objectives" was not matched for this assessment; pick only actions from the list.' }));
      expect(check(withPick('ACT-XX-99', 'Something.', 'ACT-BC-08')).errors).toContainEqual(
        expect.objectContaining({ pick: null, rule: 'pickSet',
          detail: 'An action that is not in the list was picked; pick only actions from the list.' }));
    });

    it('an action picked twice', () => {
      const draft = withPick('ACT-L0-05', WESTMAAS_PICKS.picks[0].reason, 'ACT-BC-08');
      expect(check(draft).errors).toEqual([expect.objectContaining({ pick: null, rule: 'pickSet',
        detail: '"Remove or control multi-homed devices" is picked more than once; pick each action at most once.' })]);
    });

    it('the wrong number of picks', () => {
      const two = { picks: WESTMAAS_PICKS.picks.slice(0, 2) };
      expect(check(two).errors).toEqual([expect.objectContaining({ pick: null, rule: 'pickSet',
        detail: 'Pick exactly 3 actions; 2 were picked.' })]);
      const four = { picks: [...WESTMAAS_PICKS.picks,
        { actionId: 'ACT-L0-03', reason: 'Asset interdependency documentation is incomplete or outdated.' }] };
      expect(check(four).errors).toEqual([expect.objectContaining({ rule: 'pickSet',
        detail: 'Pick exactly 3 actions; 4 were picked.' })]);
    });

    it('three or fewer matched actions: every one must be picked', () => {
      const sparse = loadScenario(sparseJson);
      const facts = buildAssessmentFacts(sparse);
      const actions = matchAssessmentActions(sparse);
      expect(actions.map(a => a.id)).toEqual(['ACT-L0-03']);
      expect(validatePicks({ picks: [] }, facts, actions).errors).toEqual([expect.objectContaining({
        rule: 'pickSet', detail: 'Pick exactly 1 action; 0 were picked.' })]);
      const one = { picks: [{ actionId: 'ACT-L0-03', reason: 'Asset interdependency documentation is incomplete or outdated.' }] };
      expect(validatePicks(one, facts, actions)).toEqual({ ok: true, errors: [] });

      const two = ACTIONS.filter(a => ['ACT-BC-08', 'ACT-L0-05'].includes(a.id));
      expect(check({ picks: [WESTMAAS_PICKS.picks[0]] }, FACTS, two).errors.map(e => e.detail))
        .toContain('Pick exactly 2 actions; 1 was picked.');
      expect(check({ picks: WESTMAAS_PICKS.picks.slice(0, 2) }, FACTS, two)).toEqual({ ok: true, errors: [] });
    });
  });

  describe('criticalPick', () => {
    it('Westmaas: the multi-homed devices action (CRITICAL flag) must be picked', () => {
      const draft = withPick('ACT-L0-03', 'Asset interdependency documentation is incomplete or outdated.', 'ACT-L0-05');
      expect(check(draft).errors).toEqual([{
        section: 'whereToStart', pick: null, sentence: null, rule: 'criticalPick',
        detail: '"Remove or control multi-homed devices" addresses a CRITICAL flag and must be among the picks.',
      }]);
    });

    it('June: no CRITICAL flag, so any three pass the rule', () => {
      const june = loadScenario(followUpJson);
      const facts = buildAssessmentFacts(june);
      const actions = matchAssessmentActions(june);
      expect(validatePicks(echoPicks(facts, actions), facts, actions)).toEqual({ ok: true, errors: [] });
    });

    it('more CRITICAL actions than picks: every pick must address one', () => {
      // F14–F16 made CRITICAL: four CRITICAL actions for three picks.
      const facts = clone(FACTS).map(f => (['F14', 'F15', 'F16'].includes(f.id)
        ? { ...f, text: f.text.replace(/^(HIGH|MEDIUM NOTE)\./, 'CRITICAL.') } : f));
      const draft = withPick('ACT-L0-03', 'Asset interdependency documentation is incomplete or outdated.', 'ACT-L0-08');
      expect(check(draft, facts).errors).toEqual([expect.objectContaining({ pick: null, rule: 'criticalPick',
        detail: 'More actions address a CRITICAL flag than can be picked, so pick only those; "Define recovery point objectives" does not address one.' })]);
      const allCritical = withPick('ACT-L0-03', 'Asset interdependency documentation is incomplete or outdated.', 'ACT-BC-08');
      allCritical.picks[2].reason = 'No BC plan test was performed during the assessment period.';
      expect(check(allCritical, facts)).toEqual({ ok: true, errors: [] });
    });
  });

  describe('pickSubject', () => {
    it('a reason about another action\'s item fails, and so does one naming none of its items', () => {
      const { errors } = check(withPick('ACT-L0-05', 'Zone Availability Rate was measured at 40%.'));
      expect(errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ pick: 'ACT-L0-05', rule: 'pickSubject',
          detail: 'Name what the reason is about: Zero uncontrolled multi-homed devices.' }),
        expect.objectContaining({ pick: 'ACT-L0-05', rule: 'pickSubject',
          detail: 'Zone Availability Rate is not in the facts of "Remove or control multi-homed devices"; write the reason from that action\'s own facts only.' }),
      ]));
      expect(rules(withPick('ACT-L0-05', 'The finding was recorded.'))).toEqual(['pickSubject']);
    });

    it('a second item that is not its own fails even next to its own item', () => {
      expect(rules(withPick('ACT-L0-05', 'Uncontrolled multi-homed devices were identified, as was Zone Availability Rate.')))
        .toEqual(['pickSubject']);
    });

    it('a dimension name passes', () => {
      const draft = withPick('ACT-IH-06', 'Mean Time to Contain is not measurable, so Incident Handling has no score.', 'ACT-L0-08');
      expect(check(draft)).toEqual({ ok: true, errors: [] });
    });

    it('a root cause named in its trigger fact passes', () => {
      const rec = loadScenario(baselineJson);
      rec.indicators['IH-08'] = { state: STATE.NOT_MEASURABLE, reason: { layer0ItemId: 'L0-asset-inventory', text: '' } };
      const facts = buildAssessmentFacts(rec);
      const actions = matchAssessmentActions(rec);
      const draft = withPick('ACT-IH-06', 'Mean Time to Contain is not measurable, and its recorded root cause is Asset inventory maintained.', 'ACT-L0-08');
      expect(validatePicks(draft, facts, actions)).toEqual({ ok: true, errors: [] });
    });
  });

  it('reasonSentences: exactly one sentence', () => {
    const draft = withPick('ACT-L0-05', 'Uncontrolled inter-zone multi-homed devices were identified. This is a CRITICAL flag.');
    expect(check(draft).errors).toEqual([expect.objectContaining({ pick: 'ACT-L0-05', rule: 'reasonSentences',
      detail: 'Write the reason as exactly one sentence.' })]);
  });

  describe('urgency', () => {
    it.each([
      ['urgent', 'Uncontrolled inter-zone multi-homed devices were identified and need urgent attention.'],
      ['urgently', 'Uncontrolled inter-zone multi-homed devices were identified and must be removed urgently.'],
      ['urgency', 'Uncontrolled inter-zone multi-homed devices were identified, which adds urgency.'],
      ['immediate', 'Uncontrolled inter-zone multi-homed devices were identified and need immediate removal.'],
      ['immediately', 'Uncontrolled inter-zone multi-homed devices were identified and should be removed immediately.'],
      ['top priority', 'Uncontrolled inter-zone multi-homed devices were identified, a top priority.'],
      ['highest priority', 'Uncontrolled inter-zone multi-homed devices were identified, the highest priority.'],
      ['first priority', 'Uncontrolled inter-zone multi-homed devices were identified, the first priority.'],
      ['most important', 'The most important finding is that uncontrolled inter-zone multi-homed devices were identified.'],
      ['risk', 'Uncontrolled inter-zone multi-homed devices were identified, posing a CRITICAL risk.'],
      ['risks', 'Uncontrolled inter-zone multi-homed devices were identified, which risks zone separation.'],
    ])('"%s" fails', (word, reason) => {
      const { errors } = check(withPick('ACT-L0-05', reason));
      expect(errors).toContainEqual(expect.objectContaining({ pick: 'ACT-L0-05', rule: 'urgency',
        detail: `Do not write "${word}": describe the finding, not its risk, urgency or rank.` }));
    });

    it('the urgency rule does not apply to the headline or overview', () => {
      const narrative = withPart('overview', OVERVIEW, `${GOOD.sections.overview.text} This is urgent.`);
      expect(validate(narrative).errors.map(e => e.rule)).not.toContain('urgency');
    });
  });

  it('an action ID in the reason is a leaked internal code', () => {
    expect(rules(withPick('ACT-L0-05', 'Uncontrolled inter-zone multi-homed devices were identified (ACT-L0-05).')))
      .toContain('leakedIds');
    expect(rules(withPick('ACT-BC-08', 'RPO Achievement Rate has no objective yet, see ACT-BC-08.'))).toContain('leakedIds');
  });

  describe('the overview checks apply to each reason, against its trigger facts', () => {
    const IH06 = reason => withPick('ACT-IH-06', reason, 'ACT-L0-08');
    const BC02 = reason => withPick('ACT-BC-02', reason, 'ACT-L0-08');

    it('"Mean Time to Contain is poor" (noScoreWording)', () => {
      expect(rules(IH06('Mean Time to Contain is poor.'))).toEqual(['noScoreWording']);
    });

    it('"Zone Availability Rate scored 3" (attribution: 3 is the target score, not the current one)', () => {
      expect(rules(BC02('Zone Availability Rate scored 3.'))).toEqual(['attribution']);
    });

    it('a target value (numbers: target sentences are not read here)', () => {
      expect(rules(BC02('Zone Availability Rate reaches score 3 at 70% or more.'))).toContain('numbers');
    });

    it('a number from another action\'s fact (numbers)', () => {
      expect(rules(withPick('ACT-L0-05', 'Uncontrolled inter-zone multi-homed devices were identified, with 40% zone availability.')))
        .toContain('numbers');
    });

    it('"a missing indicator" (missing)', () => {
      expect(rules(IH06('Mean Time to Contain is a missing indicator.'))).toEqual(['missing']);
    });

    it('a level label (levelLabel)', () => {
      expect(rules(BC02('Zone Availability Rate was 40%, which is Developing.'))).toEqual(['levelLabel']);
    });

    it('its own fact\'s numbers pass', () => {
      expect(check(BC02('Zone Availability Rate was measured at 40%, a score of 2.'))).toEqual({ ok: true, errors: [] });
    });
  });

  describe('property-based tests (fast-check)', () => {
    it('trigger-fact sentences that name their item always pass as reasons', () => {
      fc.assert(fc.property(assessmentArb, a => {
        const facts = buildAssessmentFacts(a);
        const actions = matchAssessmentActions(a);
        if (actions.length === 0) return;
        const result = validatePicks(echoPicks(facts, actions), facts, actions);
        expect(result.errors).toEqual([]);
      }), { numRuns: 300 });
    });

    it('injected violations of checks 3–6 are always caught', () => {
      fc.assert(fc.property(assessmentArb, a => {
        const facts = buildAssessmentFacts(a);
        const actions = matchAssessmentActions(a);
        const draft = echoPicks(facts, actions);
        if (draft === null) return;
        draft.picks.forEach((pick, i) => {
          const action = actions.find(x => x.id === pick.actionId);
          const own = triggerFacts(facts, action.triggers);
          const broken = text => {
            const copy = clone(draft);
            copy.picks[i].reason = text;
            return validatePicks(copy, facts, actions).errors.filter(e => e.pick === pick.actionId).map(e => e.rule);
          };
          expect(broken(`${pick.reason.slice(0, -1)} (F1).`)).toContain('leakedIds');
          for (const f of own) {
            const name = displayName(f.refs[0]);
            if (f.kind === 'no_score') expect(broken(`${name} is poor.`)).toContain('noScoreWording');
            if (f.kind === 'no_score') expect(broken(`${name} scored 2.`)).toContain('unscoredScore');
            if (f.kind === 'gap_zero') expect(broken(`${name} failed.`)).toContain('programmeGap');
          }
        });
      }), { numRuns: 200 });
    });

    it('malformed input never throws', () => {
      fc.assert(fc.property(fc.anything(), fc.anything(), (draft, actions) => {
        expect(() => validatePicks(draft, FACTS, ACTIONS)).not.toThrow();
        expect(() => validatePicks(WESTMAAS_PICKS, FACTS, actions)).not.toThrow();
        expect(() => validatePicks(draft, draft, actions)).not.toThrow();
      }), { numRuns: 300 });
    });
  });
});

// ─── Step 9, after the first Where to start manual check ──────────────────────

describe('first Where to start manual check: "critical" for a named HIGH flag (check 9, per sentence)', () => {
  const BASELINE = loadScenario(baselineJson);
  const ACTIONS = matchAssessmentActions(BASELINE);
  const overview = text => validate(withPart('overview', [...OVERVIEW, 'F13', 'F14', 'F15'], text)).errors
    .filter(e => e.section === 'overview');
  const LOGGED = 'Asset interdependency documentation is incomplete or outdated, posing a critical risk.';
  const DETAIL = 'Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.';

  it('the logged reason fails `severity` (and `urgency`) in Where to start', () => {
    const draft = { picks: [
      WESTMAAS_PICKS.picks[0],
      { actionId: 'ACT-L0-03', reason: LOGGED },
      WESTMAAS_PICKS.picks[2],
    ] };
    const errors = validatePicks(draft, FACTS, ACTIONS).errors;
    expect(errors).toContainEqual(expect.objectContaining({ pick: 'ACT-L0-03', rule: 'severity', detail: DETAIL }));
    expect(errors.map(e => e.rule)).toContain('urgency');
  });

  it('the same sentence fails in the overview, once', () => {
    expect(overview(`${GOOD.sections.overview.text} ${LOGGED}`).filter(e => e.rule === 'severity'))
      .toEqual([expect.objectContaining({ sentence: LOGGED, detail: DETAIL })]);
  });

  it('passes: a CRITICAL item named; a CRITICAL and a HIGH item named together; a negated "critical"', () => {
    for (const text of [
      'Uncontrolled inter-zone multi-homed devices were identified, a critical finding.',
      'The assessment identifies critical and high severity issues, including uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation.',
      'Asset interdependency documentation is incomplete or outdated, which is not critical but HIGH.',
    ]) {
      expect(overview(`${GOOD.sections.overview.text} ${text}`).filter(e => e.rule === 'severity')).toEqual([]);
    }
  });

  it('the clause rule still reports a clause that names the item itself, once', () => {
    const text = 'Critical asset interdependency documentation is incomplete.';
    expect(overview(`${GOOD.sections.overview.text} ${text}`).filter(e => e.rule === 'severity')).toHaveLength(1);
  });
});

describe('first Where to start manual check: a dimension count is not a score (check 5)', () => {
  const sparse = buildAssessmentFacts(loadScenario(sparseJson));
  const run = text => validateNarrative({ sections: { overview: { factIds: ['C2', 'F1', 'F2', 'F3'], text } } }, sparse,
    { parts: ['overview'] }).errors.map(e => e.rule);

  it('the logged sentence passes', () => {
    expect(run('The assessment covered Incident Handling and Business Continuity in two dimensions.')).toEqual([]);
  });

  it('a score and a wrong dimension count still fail', () => {
    expect(run('Business Continuity scored 2.')).toContain('unscoredScore');
    expect(run('The assessment covered Incident Handling and Business Continuity in three dimensions.')).toContain('dimensionCount');
  });
});

describe('first Where to start manual check: unsupported judgements in reasons (judgement)', () => {
  const BASELINE = loadScenario(baselineJson);
  const ACTIONS = matchAssessmentActions(BASELINE);
  const withIH04 = reason => ({ picks: [WESTMAAS_PICKS.picks[0], WESTMAAS_PICKS.picks[1], { actionId: 'ACT-IH-04', reason }] });

  it.each([
    ['than desired', 'Mean Time to Respond is measured at 30 hours, which is higher than desired.'],
    ['than expected', 'Mean Time to Respond is measured at 30 hours, longer than expected.'],
    ['than acceptable', 'Mean Time to Respond is measured at 30 hours, longer than acceptable.'],
    ['need for improvement', 'Mean Time to Respond is measured at 30 hours, indicating a need for improvement.'],
    ['need to reduce', 'Mean Time to Respond is measured at 30 hours, indicating a need to reduce it.'],
    ['need for reduction', 'Mean Time to Respond is measured at 30 hours, indicating a need for reduction.'],
    ['needs improvement', 'Mean Time to Respond is measured at 30 hours and needs improvement.'],
  ])('"%s" fails', (phrase, reason) => {
    expect(validatePicks(withIH04(reason), FACTS, ACTIONS).errors).toContainEqual(expect.objectContaining({
      pick: 'ACT-IH-04', rule: 'judgement',
      detail: `Do not write "${phrase}": no fact says this; state the finding as its fact does.`,
    }));
  });

  it('the fact\'s own wording passes', () => {
    expect(validatePicks(withIH04('Mean Time to Respond is measured at 30 hours (score 2).'), FACTS, ACTIONS))
      .toEqual({ ok: true, errors: [] });
  });

  it('the overview list is unchanged', () => {
    const narrative = withPart('overview', OVERVIEW, `${GOOD.sections.overview.text} Incident Handling needs improvement.`);
    expect(validate(narrative).errors.map(e => e.rule)).not.toContain('judgement');
  });
});
