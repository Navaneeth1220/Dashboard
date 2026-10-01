/**
 * No internal IDs in user-facing text (feature/ui-no-ids).
 *
 * Every view is rendered with the Westmaas scenarios (and Oudendijk), plus
 * two copies of the Westmaas baseline that reach the conditional paths the
 * scenario files never trigger: Rule A/B/D messages, not-measurable reasons,
 * not-verifiable items, invalid values. A property test renders the
 * dashboard panels with engine output for random assessments. What is read:
 * visible text, text-box and input values, dropdown options, SVG text and the
 * title / aria-label / placeholder / alt attributes, with every <details>
 * opened. Text the user typed (client name, not-measurable reasons) and a
 * file's own unknown keys are shown as they are, so they are removed first.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import baselineJson from '../../scenarios/Westmaas_2026-01-01_assessment.json?raw';
import followUpJson from '../../scenarios/Westmaas_2026-06-01_assessment.json?raw';
import sparseJson from '../../scenarios/Oudendijk_2026-03-01_assessment.json?raw';
import App from '../App.jsx';
import ComparisonReport from './ComparisonReport.jsx';
import ComparisonView from './ComparisonView.jsx';
import TimelineReport from './TimelineReport.jsx';
import TimelineView from './TimelineView.jsx';
import NarrativePanel from './NarrativePanel.jsx';
import MeasureCard from './MeasureCard.jsx';
import OverallPanel from './OverallPanel.jsx';
import Layer0ReferenceView from './Layer0ReferenceView.jsx';
import Layer0ActionPanel from './Layer0ActionPanel.jsx';
import CrossIndicatorPanel from './CrossIndicatorPanel.jsx';
import PriorityView from './PriorityView.jsx';
import GapProjectionPanel from './GapProjectionPanel.jsx';
import { computeComparison } from '../engine/comparison.js';
import { computeTimeline } from '../engine/timeline.js';
import { computeAssessment } from '../engine/scoring.js';
import { computeLayer0 } from '../engine/layer0.js';
import { computeCrossIndicator } from '../engine/crossIndicator.js';
import { computePriorityView } from '../engine/priorityView.js';
import { computeGapAnalysis, computeProjection } from '../engine/projection.js';
import { computePairFindings } from '../data/pairFindings.js';
import { parseAndValidateImport } from '../engine/persistence.js';
import { IH_INDICATOR_IDS, BC_INDICATOR_IDS } from '../data/indicatorDefinitions.js';
import { loadScenario, scriptedResults, assessmentArb } from '../report/testSupport.js';

// ─── What counts as an ID ─────────────────────────────────────────────────────

const INTERNAL_ID = /\b(?:IH|BC|RM)-\d+\b|L0-|ACT-/;
const FACT_ID = /\b[CF]\d+\b/;
// A bare dimension code; "BC plan …" is part of two item names.
const DIMENSION_CODE = /\b(?:IH|BC)\b(?! plan)/;

function idsIn(text) {
  return [INTERNAL_ID, FACT_ID, DIMENSION_CODE]
    .map(pattern => text.match(pattern))
    .filter(Boolean)
    .map(m => `${m[0]} in …${text.slice(Math.max(0, m.index - 60), m.index + 60)}…`);
}

/** Everything the user can read in the container, with <details> opened. */
function readable(container) {
  container.querySelectorAll('details').forEach(d => { d.open = true; });
  const parts = [container.textContent];
  for (const el of container.querySelectorAll('*')) {
    for (const attr of ['title', 'aria-label', 'placeholder', 'alt']) {
      const value = el.getAttribute(attr);
      if (value) parts.push(value);
    }
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') parts.push(el.value ?? '');
  }
  return parts.join('\n');
}

/** The readable text without what the user typed or the file itself contains. */
function expectNoIds(container, userText = []) {
  let text = readable(container);
  for (const typed of userText.filter(Boolean)) text = text.split(typed).join(' ');
  expect(idsIn(text)).toEqual([]);
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function variant(json, change) {
  const doc = JSON.parse(json);
  change(doc.assessment.indicators, doc.assessment.layer0);
  return JSON.stringify(doc);
}

/** Rule A (slow detection and response), Rule B (fast containment, low BC), Rule D (BC plan missing). */
const RULES = variant(baselineJson, (ind, l0) => {
  ind['IH-06'] = { state: 'measured', value: '500' };
  ind['IH-07'] = { state: 'measured', value: '500' };
  ind['IH-08'] = { state: 'measured', value: '0.1' };
  l0['L0-bc-plan-doc'] = { state: 'missing' };
  l0['RM-05'] = { state: 'no_remediated_vulnerabilities' };
});

/** Not-measurable reasons, not verifiable, an invalid value, programme gaps, process absent, Rule D softer. */
const STATES = variant(baselineJson, (ind, l0) => {
  ind['IH-06'] = { state: 'not_measurable', reason: { layer0ItemId: 'L0-asset-inventory', text: '' } };
  ind['IH-07'] = { state: 'not_measurable', reason: { text: 'SIEM retention too short' } };
  ind['BC-01'] = { state: 'not_measurable', reason: { text: 'SIEM retention too short' } };
  ind['BC-02'] = { state: 'measured', value: 'abc' };
  ind['BC-08'] = { state: 'no_rto_defined' };
  for (const id of ['L0-asset-inventory', 'L0-risk-assessment', 'L0-multi-homed']) l0[id] = { state: 'not_verifiable' };
  l0['L0-bc-plan-doc'] = { state: 'incomplete_outdated' };
  l0['RM-04'] = { state: 'not_measurable' };
  l0['RM-05'] = { state: 'process_absent' };
});

const SCENARIOS = [
  ['Westmaas baseline', baselineJson],
  ['Westmaas June', followUpJson],
  ['Oudendijk', sparseJson],
  ['Westmaas baseline, Rules A/B/D', RULES],
  ['Westmaas baseline, other states', STATES],
];

const record = json => parseAndValidateImport(json).data;
const typedIn = json => {
  const r = record(json);
  return [r.clientId, ...Object.values(r.indicators).map(i => i?.reason?.text)];
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
  vi.stubGlobal('confirm', () => true);
  vi.stubGlobal('alert', () => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ─── The dashboard and the reports ───────────────────────────────────────────

describe('the dashboard shows no internal ID', () => {
  it.each(SCENARIOS)('%s', async (_, json) => {
    const { container } = render(<App />);
    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [new File([json], 'a.json', { type: 'application/json' })] } });
    const client = record(json).clientId;
    await waitFor(() => expect(container.querySelector('input[type="text"]').value).toBe(client));
    expectNoIds(container, typedIn(json));
  }, 30_000);
});

describe('comparison and timeline show no internal ID', () => {
  it.each([
    ['baseline → June', baselineJson, followUpJson],
    ['Rules A/B/D → other states', RULES, STATES],
  ])('ComparisonReport %s', (_, a, b) => {
    const { container } = render(<ComparisonReport comparison={computeComparison(record(a), record(b))} />);
    expectNoIds(container, [...typedIn(a), ...typedIn(b)]);
  });

  it('TimelineReport over the baseline, both copies and June', () => {
    const records = [
      record(baselineJson),
      { ...record(RULES), assessmentDate: '2026-02-01' },
      { ...record(STATES), assessmentDate: '2026-03-01' },
      record(followUpJson),
    ];
    const { container } = render(<TimelineReport timeline={computeTimeline(records)} />);
    expectNoIds(container, [RULES, STATES, baselineJson].flatMap(typedIn));
  });
});

describe('the report panel shows no internal or fact ID', () => {
  const S = scriptedResults(loadScenario(baselineJson));
  it.each([
    ['ok', () => S.ok()],
    ['failed', () => S.failed()],
    ['Where to start failed', () => S.picksFailed()],
    ['unavailable', () => S.unavailable('timeout', 'No response.')],
  ])('%s', async (_, make) => {
    const result = await make();
    const { container } = render(
      <NarrativePanel phase="done" attempt={0} maxAttempts={0} result={result} model="qwen2.5:7b"
        stale={false} onGenerate={() => {}} onCancel={() => {}} />
    );
    expectNoIds(container, typedIn(baselineJson));
  });
});

// ─── Import errors: names for known items, quoted keys for unknown ────────────

describe('import errors name the item; an unknown key is quoted as the file has it', () => {
  const broken = change => variant(baselineJson, change);
  const CASES = [
    ['an invalid indicator entry', broken(ind => { ind['IH-06'] = 'x'; }), 'Mean Time to Detect', null],
    ['an indicator state that is not allowed', broken(ind => { ind['BC-02'] = { state: 'bogus' }; }), 'Zone Availability Rate', null],
    ['an invalid foundational control entry', broken((_, l0) => { l0['L0-multi-homed'] = 'x'; }), 'Zero uncontrolled multi-homed devices', null],
    ['a foundational control state that is not allowed', broken((_, l0) => { l0['RM-04'] = { state: 'bogus' }; }), 'Vulnerability Remediation Rate', null],
    ['an unknown indicator key', broken(ind => { ind['IH-99'] = { state: null }; }), null, 'IH-99'],
    ['an unknown foundational control key', broken((_, l0) => { l0['L0-unknown'] = { state: null }; }), null, 'L0-unknown'],
  ];

  it.each(CASES)('%s: the import error in the main view', (_, json, name, key) => {
    const res = parseAndValidateImport(json);
    expect(res.ok).toBe(false);
    if (name) expect(res.error).toContain(name);
    if (key) expect(res.error).toContain(`"${key}"`);
    expect(res.error).not.toMatch(/Layer 0/);
    expect(idsIn(key ? res.error.split(`"${key}"`).join(' ') : res.error)).toEqual([]);
  });

  it.each(CASES)('%s: shown in the Compare and Timeline import slots', async (_, json, __, key) => {
    for (const View of [ComparisonView, TimelineView]) {
      const { container, unmount } = render(<View />);
      fireEvent.change(container.querySelector('input[type="file"]'), {
        target: { files: [new File([json], 'bad.json', { type: 'application/json' })] },
      });
      await waitFor(() => expect(container.querySelector('[data-slot-error]')).not.toBeNull());
      expectNoIds(container, key ? [`"${key}"`] : []);
      unmount();
    }
  });
});

// ─── Property: the dashboard panels for random assessments ───────────────────

describe('property: the dashboard panels never show an internal ID', () => {
  it('for random assessments (engine output as the App wires it)', () => {
    fc.assert(fc.property(assessmentArb, a => {
      const results = computeAssessment(a);
      const layer0 = computeLayer0(a);
      const cross = computeCrossIndicator(a, results, layer0);
      const aNotes = {};
      for (const note of cross.ihDependencyNotes) (aNotes[note.target] ??= []).push(note);
      const dHints = Object.fromEntries(cross.bcPlanHints.map(h => [h.targetIndicatorId, h]));
      const gap = computeGapAnalysis(a, results);
      const card = (title, ids, dimension) => (
        <MeasureCard title={title} subtitle="" indicatorIds={ids} inputs={a.indicators} results={results.indicators}
          dimensionResult={dimension} onIndicatorChange={() => {}} aNotesByIndicator={aNotes} dHintByIndicator={dHints} />
      );
      const { container, unmount } = render(
        <div>
          <OverallPanel ih={results.ih} bc={results.bc} overall={results.overall} indicatorResults={results.indicators} />
          <Layer0ReferenceView layer0Result={layer0} inputs={a.layer0} onItemChange={() => {}} />
          <Layer0ActionPanel actionFlags={layer0.actionFlags} />
          {card('Incident Handling', IH_INDICATOR_IDS, results.ih)}
          {card('Business Continuity', BC_INDICATOR_IDS, results.bc)}
          <CrossIndicatorPanel interpretivePairs={cross.interpretivePairs} architectureAdvisories={cross.architectureAdvisories}
            membersWithData={[...IH_INDICATOR_IDS, ...BC_INDICATOR_IDS, 'BC', 'RM-04', 'RM-05']}
            pairFindings={computePairFindings(results, layer0, a)} />
          <PriorityView priorityResult={computePriorityView(a, results, layer0)} />
          <GapProjectionPanel gapResult={gap} projectionResult={computeProjection(a, results, { targets: {} })} onTargetChange={() => {}} />
        </div>
      );
      try {
        expectNoIds(container, [a.meta.clientId, ...Object.values(a.indicators).map(i => i?.reason?.text)]);
      } finally {
        unmount();
      }
    }), { numRuns: 40 });
  }, 120_000);
});
