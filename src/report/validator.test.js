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
import {
  validateNarrative, splitSentences, splitClauses, extractNumbers, VALIDATOR_RULES,
} from './validator.js';
import { buildAssessmentFacts } from './facts.js';
import { SECTION_KEYS } from './schema.js';
import { loadScenario, assessmentArb, echoNarrative } from './testSupport.js';
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
      text: 'Asset inventory, zone risk assessment, IT/OT boundary separation and the BC plan are in place, but a critical flag was raised because uncontrolled inter-zone multi-homed devices were identified. Asset interdependency documentation is incomplete or outdated, and no BC plan test was performed during the assessment period. Vulnerability Remediation Rate is 60%, below target, and Mean Time to Remediate is 75 days, which is satisfactory; neither is scored. Zero uncontrolled multi-homed devices is in a weak state (Uncontrolled multi-homing found) and Mean Time to Contain is not measurable. The multi-homed devices and the poor Zone Availability Rate (score 2) may be related and should be reviewed together.',
    },
    priorities: {
      factIds: ['F20'],
      text: 'The lowest effectiveness result is RPO Achievement Rate, a programme gap at 0. Next, at score 2 and of equal priority, are Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate and RTO Achievement Rate.',
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
    expect(result.errors.filter(e => e.rule === 'shape').map(e => e.section)).toEqual(SECTION_KEYS);
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
    expect(rulesOf(overview('Business Continuity is complete at 2.5.'))).toEqual(['numbers']);
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
    const result = validate(withPart('gapsAndMissingEvidence', ['F6', 'F8'],
      'Mean Time to Contain is not measurable, but Zone Availability Rate is poor.'));
    expect(result.ok).toBe(true);
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
