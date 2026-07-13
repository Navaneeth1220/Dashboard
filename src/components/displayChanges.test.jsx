/**
 * Display-layer changes — Change 2 (no ID codes on screen) and Change 3
 * (scores rounded to exactly 2 decimals; engine stays full-precision).
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App.jsx';
import IndicatorInput from './IndicatorInput.jsx';
import MeasureCard from './MeasureCard.jsx';
import OverallPanel from './OverallPanel.jsx';
import { INDICATORS } from '../data/indicatorDefinitions.js';
import { scoreIndicator } from '../engine/scoring.js';
import { INDICATOR_INFO } from '../data/indicatorInfo.js';
import PriorityView from './PriorityView.jsx';
import GapProjectionPanel from './GapProjectionPanel.jsx';
import ComparisonReport from './ComparisonReport.jsx';
import { computeAssessment, createBlankAssessment } from '../engine/scoring.js';
import { computeLayer0, createBlankLayer0 } from '../engine/layer0.js';
import { computePriorityView } from '../engine/priorityView.js';
import { computeGapAnalysis, computeProjection } from '../engine/projection.js';
import { computeComparison } from '../engine/comparison.js';
import { formatScore } from '../data/displayNames.js';

// Any internal ID code: IH-06 / BC-08 / RM-04 / L0-bc-plan-doc, etc.
const ID_PATTERN = /\b(?:IH|BC|RM)-\d|\bL0-[a-z]/;

function rec(indicatorOverrides = {}, layer0Overrides = {}) {
  const blank = createBlankAssessment();
  return {
    clientId: 'Client', assessmentDate: '2026-01-01',
    indicators: { ...blank.indicators, ...indicatorOverrides },
    layer0: { ...createBlankLayer0(), ...layer0Overrides },
    targets: {},
  };
}

const populated = rec(
  {
    'IH-06': { state: 'measured', value: '4' },
    'IH-07': { state: 'not_measurable' },
    'IH-08': { state: 'capability_absent' },
    'BC-01': { state: 'measured', value: '85' },
    'BC-02': { state: 'measured', value: '90' },
    'BC-04': { state: 'no_thresholds_defined' },
    'BC-08': { state: 'no_qualifying_event' },
    'BC-09': { state: 'measured', numerator: '7', denominator: '10' },
  },
  { 'L0-asset-inventory': { state: 'missing' }, 'L0-bc-plan-doc': { state: 'present' } },
);

// ===========================================================================
// Change 2 — no ID codes appear anywhere
// ===========================================================================

describe('Change 2 — no indicator/item IDs in rendered output', () => {
  it('the full App (blank) renders no ID-pattern string', () => {
    const { container } = render(<App />);
    expect(container.textContent).not.toMatch(ID_PATTERN);
    // and full names DO appear
    expect(container.textContent).toMatch(/Mean Time to Detect/);
    expect(container.textContent).toMatch(/RTO Achievement Rate/);
  });

  it('PriorityView (populated) renders no ID-pattern, shows full names', () => {
    const results = computeAssessment(populated);
    const pv = computePriorityView(populated, results, computeLayer0(populated));
    const { container } = render(<PriorityView priorityResult={pv} />);
    expect(container.textContent).not.toMatch(ID_PATTERN);
    expect(container.textContent).toMatch(/Operational Threshold Violation Rate|RPO Achievement Rate|Mean Time/);
  });

  it('GapProjectionPanel (populated) renders no ID-pattern', () => {
    const results = computeAssessment(populated);
    const gap = computeGapAnalysis(populated, results);
    const proj = computeProjection(populated, results, { targets: { 'IH-08': 3 } });
    const { container } = render(
      <GapProjectionPanel gapResult={gap} projectionResult={proj} onTargetChange={() => {}} />
    );
    expect(container.textContent).not.toMatch(ID_PATTERN);
  });

  it('ComparisonReport (populated) renders no ID-pattern', () => {
    const A = rec({ 'IH-06': { state: 'measured', value: '96' } });
    const B = rec({ 'IH-06': { state: 'measured', value: '4' } });
    const { container } = render(<ComparisonReport comparison={computeComparison(A, B)} />);
    expect(container.textContent).not.toMatch(ID_PATTERN);
    expect(container.textContent).toMatch(/Mean Time to Detect/);
  });
});

// ===========================================================================
// Change 3 — scores rounded to exactly 2 decimals; engine full-precision
// ===========================================================================

describe('Change 3 — 2-decimal score display, engine unrounded', () => {
  it('a 2.3333… dimension score renders as "2.33"', () => {
    // IH = (4 + 2 + 1) / 3 = 7/3 = 2.3333…
    const r = rec({
      'IH-06': { state: 'measured', value: '4' },    // score 4
      'IH-07': { state: 'measured', value: '48' },   // score 2
      'IH-08': { state: 'measured', value: '400' },  // score 1
    });
    const results = computeAssessment(r);
    render(
      <MeasureCard title="Incident Handling" subtitle="" indicatorIds={['IH-06', 'IH-07', 'IH-08']}
        inputs={r.indicators} results={results.indicators} dimensionResult={results.ih} onIndicatorChange={() => {}} />
    );
    expect(screen.getAllByText('2.33').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/2\.3333/)).toBeNull();
  });

  it('formatScore always gives exactly two decimals', () => {
    expect(formatScore(3)).toBe('3.00');
    expect(formatScore(2.5)).toBe('2.50');
    expect(formatScore(7 / 3)).toBe('2.33');
    expect(formatScore(null)).toBeNull();
  });

  it('the engine keeps full precision (does NOT round)', () => {
    const r = rec({
      'IH-06': { state: 'measured', value: '4' },
      'IH-07': { state: 'measured', value: '48' },
      'IH-08': { state: 'measured', value: '400' },
    });
    const results = computeAssessment(r);
    expect(results.ih.score).not.toBe(2.33);
    expect(Math.abs(results.ih.score - 7 / 3)).toBeLessThan(1e-12);
  });

  it('comparison diffs exact (unrounded) engine values', () => {
    // A IH = 7/3 ≈ 2.333; B IH = 8/3 ≈ 2.667 — both round to different 2dp,
    // but the delta is computed on exact values.
    const A = rec({ 'IH-06': { state: 'measured', value: '4' }, 'IH-07': { state: 'measured', value: '48' }, 'IH-08': { state: 'measured', value: '400' } }); // 4,2,1 = 7/3
    const B = rec({ 'IH-06': { state: 'measured', value: '4' }, 'IH-07': { state: 'measured', value: '48' }, 'IH-08': { state: 'measured', value: '96' } });  // 4,2,2 = 8/3
    const c = computeComparison(A, B);
    expect(Math.abs(c.dimensions.ih.delta - (8 / 3 - 7 / 3))).toBeLessThan(1e-12);
  });
});

// ===========================================================================
// Part 1 — Zone Availability Rate (BC-02) is a direct percentage input
// ===========================================================================

describe('BC-02 direct percentage input', () => {
  it('BC-02 is a single-value % indicator (not a ratio)', () => {
    expect(INDICATORS['BC-02'].inputType).toBe('single_value');
    expect(INDICATORS['BC-02'].unit).toBe('%');
  });

  it('scores from a direct % value, same bands as before', () => {
    expect(scoreIndicator('BC-02', { state: 'measured', value: '90' }).score).toBe(4);
    expect(scoreIndicator('BC-02', { state: 'measured', value: '50' }).score).toBe(2);
    expect(scoreIndicator('BC-02', { state: 'measured', value: '0' }).score).toBe(0);
  });

  it('RTO/RPO remain numerator/denominator (unchanged)', () => {
    expect(INDICATORS['BC-08'].inputType).toBe('ratio');
    expect(INDICATORS['BC-09'].inputType).toBe('ratio');
  });

  it('renders a single value field for BC-02, no numerator/denominator', () => {
    const { container } = render(
      <IndicatorInput indicatorId="BC-02" input={{ state: 'measured', value: '' }}
        result={{ score: null }} onChange={() => {}} />
    );
    expect(screen.getByPlaceholderText(/e\.g\. 85/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('numerator')).toBeNull();
    expect(screen.queryByPlaceholderText('denominator')).toBeNull();
  });
});

// ===========================================================================
// Part 3 — info-icon tooltips on all 17 indicators
// ===========================================================================

describe('info-icon tooltips', () => {
  it('INDICATOR_INFO covers all 17 indicators/items', () => {
    expect(Object.keys(INDICATOR_INFO)).toHaveLength(17);
  });

  it('tooltip is hidden by default and appears on hover with the exact text', () => {
    const { container } = render(
      <IndicatorInput indicatorId="BC-02" input={{ state: null }} result={{ score: null }} onChange={() => {}} />
    );
    // hidden until interaction
    expect(screen.queryByRole('tooltip')).toBeNull();

    const icon = screen.getByRole('button', { name: /more information/i });
    fireEvent.mouseEnter(icon.parentElement);
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toBe(INDICATOR_INFO['BC-02']);
    // exact text — no scoring/direction/NIS2 cues
    expect(tip.textContent).toMatch(/Share of defined OT zones/);
    expect(tip.textContent).not.toMatch(/NIS2|score|band|higher|lower/i);

    fireEvent.mouseLeave(icon.parentElement);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('tap (click) toggles the tooltip for touch devices', () => {
    render(<IndicatorInput indicatorId="IH-06" input={{ state: null }} result={{ score: null }} onChange={() => {}} />);
    const icon = screen.getByRole('button', { name: /more information/i });
    fireEvent.click(icon);
    expect(screen.getByRole('tooltip').textContent).toBe(INDICATOR_INFO['IH-06']);
    fireEvent.click(icon);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

// ===========================================================================
// Change 1 — dimension scores primary, Overall secondary (main view)
// ===========================================================================

describe('OverallPanel score hierarchy', () => {
  it('IH & BC are primary; Overall is secondary + explicitly labelled; Overall value unchanged', () => {
    const r = rec({
      'IH-06': { state: 'measured', value: '4' },   // 4
      'IH-07': { state: 'measured', value: '2' },   // 4
      'IH-08': { state: 'measured', value: '96' },  // 2  → IH = 10/3 ≈ 3.33
      'BC-01': { state: 'measured', value: '85' },
      'BC-02': { state: 'measured', value: '90' },
      'BC-04': { state: 'measured', numerator: '0', denominator: '5' },
      'BC-08': { state: 'measured', numerator: '9', denominator: '10' },
      'BC-09': { state: 'measured', numerator: '9', denominator: '10' },
    });
    const results = computeAssessment(r);
    const { container } = render(
      <OverallPanel ih={results.ih} bc={results.bc} overall={results.overall} indicatorResults={results.indicators} />
    );
    // two primary dimension blocks
    expect(container.querySelectorAll('[data-score-role="primary"]')).toHaveLength(2);
    // one secondary Overall block, explicitly labelled
    const secondary = container.querySelector('[data-score-role="secondary"]');
    expect(secondary).not.toBeNull();
    expect(secondary.textContent).toMatch(/Overall — secondary summary of IH and BC/i);
    // the Overall value itself is unchanged (still mean(IH,BC), rendered 2dp)
    const expected = ((results.ih.score + results.bc.score) / 2).toFixed(2);
    expect(secondary.textContent).toContain(expected);
    expect(results.overall.score).toBeCloseTo((results.ih.score + results.bc.score) / 2, 12);
  });
});
