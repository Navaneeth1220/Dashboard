/**
 * Gap Analysis + Projection UI tests — Stage 4-ii (§8).
 * Confirms direction-aware gap text, projectable-vs-excluded controls,
 * the three completeness cases rendering distinctly, the capability tag,
 * rejected-target surfacing, and the no-targets / set-then-clear baseline.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react';
import GapProjectionPanel from './GapProjectionPanel.jsx';
import { computeGapAnalysis, computeProjection } from '../engine/projection.js';
import { computeAssessment, createBlankAssessment } from '../engine/scoring.js';

function record(indicatorOverrides = {}) {
  const blank = createBlankAssessment();
  return { ...blank, indicators: { ...blank.indicators, ...indicatorOverrides } };
}

// Render the panel with a given targets object (static); onTargetChange is a spy-less noop here.
function renderPanel(rec, targets = {}, onTargetChange = () => {}) {
  const results = computeAssessment(rec);
  const gapResult = computeGapAnalysis(rec, results);
  const projectionResult = computeProjection(rec, results, { targets });
  return render(
    <GapProjectionPanel gapResult={gapResult} projectionResult={projectionResult} onTargetChange={onTargetChange} />
  );
}

// A small stateful harness mirroring App's targets state (incl. delete-on-clear)
function Harness({ rec }) {
  const [targets, setTargets] = React.useState({});
  function onTargetChange(id, score) {
    setTargets(prev => {
      if (score === null) { const n = { ...prev }; delete n[id]; return n; }
      return { ...prev, [id]: score };
    });
  }
  const results = computeAssessment(rec);
  const gapResult = computeGapAnalysis(rec, results);
  const projectionResult = computeProjection(rec, results, { targets });
  return (
    <div>
      <div data-testid="targets-json">{JSON.stringify(targets)}</div>
      <GapProjectionPanel gapResult={gapResult} projectionResult={projectionResult} onTargetChange={onTargetChange} />
    </div>
  );
}

// ===========================================================================
// Gap analysis — direction-aware
// ===========================================================================

describe('gap analysis rendering', () => {
  it('higher-is-better renders "Increase to"', () => {
    renderPanel(record({ 'BC-01': { state: 'measured', value: '50' } }));   // score 2
    const row = document.querySelector('[data-gap-row="BC-01"]');
    expect(within(row).getByText(/Increase to/i)).toBeInTheDocument();
    expect(within(row).queryByText(/Reduce to/i)).toBeNull();
  });

  it('lower-is-better renders "Reduce to"', () => {
    renderPanel(record({ 'IH-06': { state: 'measured', value: '96' } }));   // score 2
    const row = document.querySelector('[data-gap-row="IH-06"]');
    expect(within(row).getByText(/Reduce to/i)).toBeInTheDocument();
    expect(within(row).queryByText(/Increase to/i)).toBeNull();
  });

  it('score 4 renders "At maximum"', () => {
    renderPanel(record({ 'IH-06': { state: 'measured', value: '4' } }));    // score 4
    const row = document.querySelector('[data-gap-row="IH-06"]');
    expect(within(row).getByText(/At maximum/i)).toBeInTheDocument();
  });

  it('excluded indicator shows "no gap, not scored" with reason, not a numeric gap', () => {
    renderPanel(record({ 'BC-01': { state: 'not_measurable' } }));
    const ex = document.querySelector('[data-gap-excluded="BC-01"]');
    expect(ex).not.toBeNull();
    expect(ex.textContent).toMatch(/no gap, not scored/i);
    expect(ex.textContent).toMatch(/Not measurable/i);
    expect(document.querySelector('[data-gap-row="BC-01"]')).toBeNull();
  });
});

// ===========================================================================
// Projection — projectable vs excluded controls
// ===========================================================================

describe('projection controls', () => {
  it('projectable indicator gets a target select', () => {
    renderPanel(record({ 'BC-01': { state: 'measured', value: '50' } }));
    expect(document.querySelector('[data-proj-target="BC-01"]')).not.toBeNull();
  });

  it('excluded indicator gets NO target select, shows the reason instead', () => {
    renderPanel(record({ 'BC-01': { state: 'not_measurable' } }));
    expect(document.querySelector('[data-proj-target="BC-01"]')).toBeNull();
    const row = document.querySelector('[data-proj-row="BC-01"]');
    expect(row.getAttribute('data-projectable')).toBe('false');
    expect(within(row).getByText(/Resolve the evidence state first/i)).toBeInTheDocument();
  });

  it('capability-absent IS projectable (has a target select)', () => {
    renderPanel(record({ 'IH-06': { state: 'capability_absent' } }));
    expect(document.querySelector('[data-proj-target="IH-06"]')).not.toBeNull();
  });

  it('rejected target surfaces its reason (not swallowed)', () => {
    // Force a target onto an excluded indicator via the targets prop
    renderPanel(record({ 'BC-01': { state: 'not_measurable' } }), { 'BC-01': 4 });
    const rej = document.querySelector('[data-proj-rejected="BC-01"]');
    expect(rej).not.toBeNull();
    expect(rej.textContent).toMatch(/rejected/i);
    expect(rej.textContent).toMatch(/resolve the evidence state first/i);
  });
});

// ===========================================================================
// Three completeness cases render distinctly (structural)
// ===========================================================================

describe('completeness cases render distinctly', () => {
  const completeBC = {
    'BC-01': { state: 'measured', value: '85' },
    'BC-02': { state: 'measured', value: '90' },
    'BC-04': { state: 'measured', numerator: '0', denominator: '5' },
    'BC-08': { state: 'measured', numerator: '9', denominator: '10' },
    'BC-09': { state: 'measured', numerator: '9', denominator: '10' },
  };

  it('complete dimension renders as a projected score (data-proj-kind="complete")', () => {
    renderPanel(record(completeBC));
    const bc = document.querySelector('[data-proj-dim="BC"]');
    expect(bc.getAttribute('data-proj-kind')).toBe('complete');
    expect(within(bc).getByText(/Projected BC/i)).toBeInTheDocument();
  });

  it('partial dimension renders as a labelled planning scenario, NOT a complete score', () => {
    const rec = record({
      ...completeBC,
      'BC-01': { state: 'not_measurable' },   // one excluded → partial
    });
    renderPanel(rec);
    const bc = document.querySelector('[data-proj-dim="BC"]');
    expect(bc.getAttribute('data-proj-kind')).toBe('partial');
    // explicit subset framing + coverage + exclusions visible
    expect(within(bc).getByText(/Planning scenario/i)).toBeInTheDocument();
    expect(within(bc).getByText(/projected average of 4 of 5 BC indicators/i)).toBeInTheDocument();
    expect(within(bc).getByText(/not a complete BC score/i)).toBeInTheDocument();
    expect(within(bc).getByText(/Excluded:/i)).toBeInTheDocument();
    // structurally distinct: it is NOT the complete presentation
    expect(within(bc).queryByText(/Projected BC$/)).toBeNull();
  });

  it('partial and complete presentations differ structurally (different data-proj-kind)', () => {
    const completeBox = renderPanel(record(completeBC)).container.querySelector('[data-proj-dim="BC"]');
    const completeKind = completeBox.getAttribute('data-proj-kind');
    cleanup();
    const partialBox = renderPanel(record({ ...completeBC, 'BC-01': { state: 'not_measurable' } }))
      .container.querySelector('[data-proj-dim="BC"]');
    const partialKind = partialBox.getAttribute('data-proj-kind');
    expect(completeKind).toBe('complete');
    expect(partialKind).toBe('partial');
    expect(completeKind).not.toBe(partialKind);
  });

  it('fully-unscoreable dimension renders no number, shows blockers', () => {
    const rec = record({
      'IH-06': { state: 'not_measurable' },
      'IH-07': { state: 'not_measurable' },
      'IH-08': { state: 'not_measurable' },
    });
    renderPanel(rec);
    const ih = document.querySelector('[data-proj-dim="IH"]');
    expect(ih.getAttribute('data-proj-kind')).toBe('unscoreable');
    expect(within(ih).getByText(/Cannot project IH/i)).toBeInTheDocument();
    expect(within(ih).getByText(/Resolve first/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// Capability-assumption tag
// ===========================================================================

describe('capability-assumption tag', () => {
  it('projected capability-absent indicator (moved to positive) shows the tag', () => {
    renderPanel(record({ 'IH-06': { state: 'capability_absent' } }), { 'IH-06': 3 });
    const row = document.querySelector('[data-proj-row="IH-06"]');
    expect(within(row).getByText(/assumes capability established/i)).toBeInTheDocument();
  });

  it('projected programme-gap-zero indicator (moved to positive) shows the tag', () => {
    renderPanel(record({ 'BC-08': { state: 'no_rto_defined' } }), { 'BC-08': 4 });
    const row = document.querySelector('[data-proj-row="BC-08"]');
    expect(within(row).getByText(/assumes capability established/i)).toBeInTheDocument();
  });

  it('projected measured-performance-zero does NOT show the tag', () => {
    renderPanel(record({ 'BC-01': { state: 'measured', value: '0' } }), { 'BC-01': 3 });
    const row = document.querySelector('[data-proj-row="BC-01"]');
    expect(within(row).queryByText(/assumes capability established/i)).toBeNull();
  });

  it('dimension surfaces the capability-assumed rollup note', () => {
    const rec = record({
      'IH-06': { state: 'capability_absent' },
      'IH-07': { state: 'measured', value: '2' },
      'IH-08': { state: 'measured', value: '5' },
    });
    renderPanel(rec, { 'IH-06': 3 });
    const ih = document.querySelector('[data-proj-dim="IH"]');
    expect(within(ih).getByText(/Includes capability-assumed gains: Mean Time to Detect/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// Baseline — no targets, and set-then-clear restoration
// ===========================================================================

describe('baseline state', () => {
  it('no targets set → renders the baseline hint cleanly', () => {
    renderPanel(record({ 'BC-01': { state: 'measured', value: '50' } }));
    expect(document.querySelector('[data-proj-baseline]')).not.toBeNull();
    expect(screen.getByText(/Baseline — no targets set yet/i)).toBeInTheDocument();
  });

  it('set a target then clear it → targets state has no stale key, baseline restored', () => {
    render(<Harness rec={record({ 'BC-01': { state: 'measured', value: '50' } })} />);

    // Baseline initially
    expect(screen.getByTestId('targets-json').textContent).toBe('{}');
    expect(document.querySelector('[data-proj-baseline]')).not.toBeNull();

    // Set target BC-01 → 4
    const select = document.querySelector('[data-proj-target="BC-01"]');
    fireEvent.change(select, { target: { value: '4' } });
    expect(JSON.parse(screen.getByTestId('targets-json').textContent)).toEqual({ 'BC-01': 4 });
    // baseline hint gone (a target is applied)
    expect(document.querySelector('[data-proj-baseline]')).toBeNull();

    // Clear it back to baseline (value '')
    const select2 = document.querySelector('[data-proj-target="BC-01"]');
    fireEvent.change(select2, { target: { value: '' } });
    // The key is DELETED, not left as a stale entry
    expect(screen.getByTestId('targets-json').textContent).toBe('{}');
    expect(document.querySelector('[data-proj-baseline]')).not.toBeNull();
  });
});
