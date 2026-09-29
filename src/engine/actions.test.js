/**
 * Recommended-action matching tests — docs/ai-report-spec.md, Step 8.
 *
 * The choice of entries is where an invariant can break: a low-score action
 * for an indicator with no score would judge missing evidence. The property
 * tests pin the rules from the catalogue header against engine output.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import baselineJson from '../../scenarios/Westmaas_2026-01-01_assessment.json?raw';
import followUpJson from '../../scenarios/Westmaas_2026-06-01_assessment.json?raw';
import sparseJson from '../../scenarios/Oudendijk_2026-03-01_assessment.json?raw';
import { matchActions, matchAssessmentActions } from './actions.js';
import { computeAssessment } from './scoring.js';
import { computeLayer0 } from './layer0.js';
import { loadScenario, assessmentArb } from '../report/testSupport.js';
import { ACTION_CATALOGUE, LOW_SCORE_MAX } from '../data/actionCatalogue.js';
import { ALL_INDICATOR_IDS, STATE } from '../data/indicatorDefinitions.js';
import { LAYER0_ALL_IDS, L0_STATE } from '../data/layer0Definitions.js';

const meas = v => ({ state: STATE.MEASURED, value: String(v) });
const ratio = (n, d) => ({ state: STATE.MEASURED, numerator: String(n), denominator: String(d) });

function actionsFor(changes = {}) {
  const rec = loadScenario(baselineJson);
  rec.indicators = { ...rec.indicators, ...(changes.indicators ?? {}) };
  rec.layer0 = { ...rec.layer0, ...(changes.layer0 ?? {}) };
  return matchAssessmentActions(rec);
}
const ids = actions => actions.map(a => a.id);
const entry = id => ACTION_CATALOGUE.find(e => e.id === id);

// ─── Scenarios ────────────────────────────────────────────────────────────────

describe('scenarios', () => {
  it('Westmaas baseline', () => {
    expect(matchAssessmentActions(loadScenario(baselineJson))).toEqual([
      { id: 'ACT-IH-04', triggers: ['IH-07'] },
      { id: 'ACT-IH-06', triggers: ['IH-08'] },
      { id: 'ACT-BC-02', triggers: ['BC-02'] },
      { id: 'ACT-BC-03', triggers: ['BC-04'] },
      { id: 'ACT-BC-05', triggers: ['BC-08'] },
      { id: 'ACT-BC-08', triggers: ['BC-09'] },
      { id: 'ACT-L0-03', triggers: ['L0-interdependency'] },
      { id: 'ACT-L0-05', triggers: ['L0-multi-homed'] },
      { id: 'ACT-L0-08', triggers: ['L0-bc-plan-tested'] },
      { id: 'ACT-RM-02', triggers: ['RM-04'] },
    ]);
  });

  it('Westmaas June follow-up', () => {
    expect(ids(matchAssessmentActions(loadScenario(followUpJson))))
      .toEqual(['ACT-IH-04', 'ACT-BC-03', 'ACT-BC-05', 'ACT-L0-03', 'ACT-RM-02']);
  });

  it('Oudendijk (sparse): unassessed items trigger nothing', () => {
    expect(matchAssessmentActions(loadScenario(sparseJson))).toEqual([{ id: 'ACT-L0-03', triggers: ['L0-interdependency'] }]);
  });

  it('matchAssessmentActions equals matchActions on the engine output', () => {
    const rec = loadScenario(baselineJson);
    expect(matchAssessmentActions(rec)).toEqual(matchActions(rec, computeAssessment(rec), computeLayer0(rec)));
  });
});

// ─── Each condition kind ──────────────────────────────────────────────────────

describe('low score', () => {
  it('score 3 gets a target, not an action', () => {
    expect(ids(actionsFor({ indicators: { 'IH-07': meas(20) } }))).not.toContain('ACT-IH-04');   // 20 h → 3
  });

  it('a measured 0 matches', () => {
    const a = actionsFor({ indicators: { 'BC-02': meas(0) } });
    expect(a.find(x => x.id === 'ACT-BC-02')).toEqual({ id: 'ACT-BC-02', triggers: ['BC-02'] });
  });

  it('a programme-gap 0 gives only its define entry', () => {
    const a = ids(actionsFor({}));
    expect(a).toContain('ACT-BC-08');
    expect(a).not.toContain('ACT-BC-07');
    const rto = ids(actionsFor({ indicators: { 'BC-08': { state: STATE.NO_RTO_DEFINED } } }));
    expect(rto).toContain('ACT-BC-06');
    expect(rto).not.toContain('ACT-BC-05');
    const thresholds = ids(actionsFor({ indicators: { 'BC-04': { state: STATE.NO_THRESHOLDS_DEFINED } } }));
    expect(thresholds).toContain('ACT-BC-04');
    expect(thresholds).not.toContain('ACT-BC-03');
  });

  it('Operational Threshold Violation Rate: the engine score, never reversed again', () => {
    expect(ids(actionsFor({ indicators: { 'BC-04': ratio(0, 16) } }))).not.toContain('ACT-BC-03');   // 0% → 4
    expect(ids(actionsFor({ indicators: { 'BC-04': ratio(2, 16) } }))).toContain('ACT-BC-03');       // 12.5% → 2
    expect(ids(actionsFor({ indicators: { 'BC-04': ratio(6, 10) } }))).toContain('ACT-BC-03');       // 60% → 0
  });

  it('an invalid value triggers nothing', () => {
    const a = actionsFor({ indicators: { 'IH-07': meas(-5), 'BC-02': meas('abc') } });
    expect(ids(a)).not.toContain('ACT-IH-04');
    expect(ids(a)).not.toContain('ACT-BC-02');
    expect(a.flatMap(x => x.triggers)).not.toContain('IH-07');   // not "make measurable" either
  });
});

describe('indicator states', () => {
  it('non-events trigger nothing', () => {
    const a = actionsFor({ indicators: {
      'IH-07': { state: STATE.NO_QUALIFYING_EVENT },
      'IH-08': { state: STATE.NO_QUALIFYING_EVENT },
      'BC-02': { state: STATE.NO_QUALIFYING_DISRUPTION },
    } });
    expect(ids(a).filter(id => id.startsWith('ACT-IH') || id === 'ACT-BC-02' || id === 'ACT-BC-09')).toEqual([]);
  });

  it('a shared entry appears once, with every trigger', () => {
    const a = actionsFor({ indicators: {
      'IH-07': { state: STATE.CAPABILITY_ABSENT },
      'IH-08': { state: STATE.CAPABILITY_ABSENT },
    } });
    expect(a.filter(x => x.id === 'ACT-IH-03')).toEqual([{ id: 'ACT-IH-03', triggers: ['IH-07', 'IH-08'] }]);
    const nm = actionsFor({ indicators: { 'BC-01': { state: STATE.NOT_MEASURABLE }, 'BC-09': { state: STATE.NOT_MEASURABLE } } });
    expect(nm.filter(x => x.id === 'ACT-BC-09')).toEqual([{ id: 'ACT-BC-09', triggers: ['BC-01', 'BC-09'] }]);
  });

  it('Mean Time to Detect capability absent', () => {
    expect(actionsFor({ indicators: { 'IH-06': { state: STATE.CAPABILITY_ABSENT } } })[0])
      .toEqual({ id: 'ACT-IH-01', triggers: ['IH-06'] });
  });
});

describe('Layer 0 and process evidence', () => {
  it('not verifiable on several items: one entry', () => {
    const a = actionsFor({ layer0: {
      'L0-asset-inventory': { state: L0_STATE.NOT_VERIFIABLE },
      'L0-bc-plan-tested': { state: L0_STATE.NOT_VERIFIABLE },
    } });
    expect(a.filter(x => x.id === 'ACT-L0-09')).toEqual([{ id: 'ACT-L0-09', triggers: ['L0-asset-inventory', 'L0-bc-plan-tested'] }]);
    expect(ids(a)).not.toContain('ACT-L0-08');
  });

  it('Mean Time to Remediate: an action only with an action flag', () => {
    expect(ids(actionsFor({}))).not.toContain('ACT-RM-03');                                          // 75 days: monitor
    expect(ids(actionsFor({ layer0: { 'RM-05': { state: 'measured', value: '120' } } }))).toContain('ACT-RM-03');
  });

  it('Vulnerability Remediation Rate: satisfactory or invalid → no action', () => {
    expect(ids(actionsFor({ layer0: { 'RM-04': { state: 'measured', numerator: '8', denominator: '10' } } }))).not.toContain('ACT-RM-02');
    expect(ids(actionsFor({ layer0: { 'RM-04': { state: 'measured', numerator: '12', denominator: '10' } } }))).not.toContain('ACT-RM-02');
  });

  it('process absent and not measurable are shared entries', () => {
    const a = actionsFor({ layer0: {
      'RM-04': { state: L0_STATE.PROCESS_ABSENT }, 'RM-05': { state: L0_STATE.PROCESS_ABSENT },
    } });
    expect(a.filter(x => x.id.startsWith('ACT-RM'))).toEqual([{ id: 'ACT-RM-01', triggers: ['RM-04', 'RM-05'] }]);
    const nm = actionsFor({ layer0: { 'RM-05': { state: L0_STATE.NOT_MEASURABLE } } });
    expect(nm.filter(x => x.id.startsWith('ACT-RM'))).toEqual([
      { id: 'ACT-RM-02', triggers: ['RM-04'] }, { id: 'ACT-RM-04', triggers: ['RM-05'] },
    ]);
  });

  it('non-events trigger nothing', () => {
    const a = actionsFor({ layer0: {
      'RM-04': { state: L0_STATE.NO_QUALIFYING_VULNERABILITY }, 'RM-05': { state: L0_STATE.NO_REMEDIATED_VULNERABILITIES },
    } });
    expect(a.filter(x => x.id.startsWith('ACT-RM'))).toEqual([]);
  });
});

// ─── Properties ───────────────────────────────────────────────────────────────

const conditionsOf = id => entry(id).trigger.when;
const kindsFor = (id, itemId) => conditionsOf(id).filter(c => c.ids.includes(itemId)).map(c => c.kind);
const lowScoreEntries = ACTION_CATALOGUE.filter(e => e.trigger.when.some(c => c.kind === 'lowScore'));

describe('properties (random assessments)', () => {
  const run = rec => ({ rec, results: computeAssessment(rec), layer0: computeLayer0(rec), actions: matchAssessmentActions(rec) });

  it('a low-score entry matches exactly for measured, non-gap scores ≤ 2', () => {
    fc.assert(fc.property(assessmentArb, a => {
      const { rec, results, actions } = run(a);
      for (const e of lowScoreEntries) {
        const [id] = e.trigger.when.find(c => c.kind === 'lowScore').ids;
        const r = results.indicators[id];
        const expected = rec.indicators[id].state === STATE.MEASURED && r.score !== null && !r.programmeGap && r.score <= LOW_SCORE_MAX;
        expect(actions.some(x => x.id === e.id)).toBe(expected);
      }
    }), { numRuns: 300 });
  });

  it('an indicator with no score triggers only "make measurable", and only when not measurable', () => {
    fc.assert(fc.property(assessmentArb, a => {
      const { rec, results, actions } = run(a);
      for (const id of ALL_INDICATOR_IDS.filter(id => results.indicators[id].score === null)) {
        for (const x of actions.filter(x => x.triggers.includes(id))) {
          expect(rec.indicators[id].state).toBe(STATE.NOT_MEASURABLE);
          expect(kindsFor(x.id, id)).toEqual(['indicatorState']);
          expect(conditionsOf(x.id).find(c => c.ids.includes(id)).states).toEqual([STATE.NOT_MEASURABLE]);
        }
      }
    }), { numRuns: 300 });
  });

  it('a programme gap triggers only its establish / define entry', () => {
    fc.assert(fc.property(assessmentArb, a => {
      const { rec, results, actions } = run(a);
      for (const id of ALL_INDICATOR_IDS.filter(id => results.indicators[id].programmeGap)) {
        const triggered = actions.filter(x => x.triggers.includes(id));
        expect(triggered.length).toBe(1);
        expect(conditionsOf(triggered[0].id).find(c => c.ids.includes(id)).states).toContain(rec.indicators[id].state);
        expect(entry(triggered[0].id).title).toMatch(/^(Establish|Define)\b/);
      }
    }), { numRuns: 300 });
  });

  it('scores 3 and 4 trigger nothing', () => {
    fc.assert(fc.property(assessmentArb, a => {
      const { results, actions } = run(a);
      for (const id of ALL_INDICATOR_IDS.filter(id => results.indicators[id].score >= 3)) {
        expect(actions.filter(x => x.triggers.includes(id))).toEqual([]);
      }
    }), { numRuns: 300 });
  });

  it('the report agrees with the dashboard: Layer 0 actions ⇔ action flags', () => {
    fc.assert(fc.property(assessmentArb, a => {
      const { layer0, actions } = run(a);
      const flagged = new Set(layer0.actionFlags.map(f => f.itemId));
      const triggered = new Set(actions.flatMap(x => x.triggers).filter(id => LAYER0_ALL_IDS.includes(id)));
      expect(triggered).toEqual(flagged);
    }), { numRuns: 300 });
  });

  it('catalogue order, no duplicates, triggers in the entry\'s own order', () => {
    fc.assert(fc.property(assessmentArb, a => {
      const { actions } = run(a);
      const order = actions.map(x => ACTION_CATALOGUE.findIndex(e => e.id === x.id));
      expect(order).toEqual([...new Set(order)].sort((p, q) => p - q));
      for (const x of actions) {
        const listed = [...new Set(conditionsOf(x.id).flatMap(c => c.ids))];
        expect(x.triggers.length).toBeGreaterThan(0);
        expect(x.triggers).toEqual(listed.filter(id => x.triggers.includes(id)));
      }
    }), { numRuns: 300 });
  });
});
