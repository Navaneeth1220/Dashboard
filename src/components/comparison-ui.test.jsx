/**
 * Comparison UI tests — Stage 5-ii-UI.
 * Wording correctness per transition type, no-delta types show no number,
 * dimension gating, Layer 0 labels (no raw enums), mismatch, A==B, loading flow.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import ComparisonReport from './ComparisonReport.jsx';
import ComparisonView from './ComparisonView.jsx';
import { computeComparison } from '../engine/comparison.js';
import { serializeAssessment } from '../engine/persistence.js';
import { createBlankAssessment } from '../engine/scoring.js';
import { createBlankLayer0 } from '../engine/layer0.js';

function rec(indicatorOverrides = {}, { clientId = 'C', assessmentDate = '2026-01-01', layer0Overrides = {} } = {}) {
  return {
    clientId, assessmentDate,
    indicators: { ...createBlankAssessment().indicators, ...indicatorOverrides },
    layer0: { ...createBlankLayer0(), ...layer0Overrides },
    targets: {},
  };
}
const meas = (v) => ({ state: 'measured', value: String(v) });
const measPct = (n, d) => ({ state: 'measured', numerator: String(n), denominator: String(d) });
const NM = { state: 'not_measurable' };
const NQE = { state: 'no_qualifying_event' };
const CAP = { state: 'capability_absent' };

function renderReport(A, B) {
  return render(<ComparisonReport comparison={computeComparison(A, B)} />);
}
function row(container, id) {
  // Rows no longer render ID codes; target via the data-indicator-id attribute.
  return container.querySelector(`[data-indicator-id="${id}"]`);
}

// ===========================================================================
// Per-transition wording + no-delta = no number
// ===========================================================================

describe('transition wording', () => {
  it('performance_change shows a signed delta badge', () => {
    const { container } = renderReport(rec({ 'IH-06': meas(96) }), rec({ 'IH-06': meas(4) }));   // 2 → 4
    const r = row(container, 'IH-06');
    expect(r.getAttribute('data-transition-type')).toBe('performance_change');
    expect(r.getAttribute('data-has-delta')).toBe('true');
    expect(within(r).getByText(/improved \+2/i)).toBeInTheDocument();
    expect(within(r).getByText('improved +2')).toBeInTheDocument();
  });

  it('capability_established shows delta but framed as built-then-performing', () => {
    const { container } = renderReport(rec({ 'IH-06': CAP }), rec({ 'IH-06': meas(12) }));   // 0 → 3
    const r = row(container, 'IH-06');
    expect(r.getAttribute('data-transition-type')).toBe('capability_established');
    expect(r.getAttribute('data-has-delta')).toBe('true');
    expect(within(r).getByText(/Capability established/i)).toBeInTheDocument();
    expect(within(r).getByText(/now scores 3/i)).toBeInTheDocument();
  });

  it('capability_lost shows regression framed as capability loss', () => {
    const { container } = renderReport(rec({ 'IH-06': meas(4) }), rec({ 'IH-06': CAP }));
    const r = row(container, 'IH-06');
    expect(r.getAttribute('data-transition-type')).toBe('capability_lost');
    expect(within(r).getByText(/Capability lost/i)).toBeInTheDocument();
  });

  it('became_measurable shows NO signed number and reads "not a performance comparison"', () => {
    const { container } = renderReport(rec({ 'IH-06': NM }), rec({ 'IH-06': meas(4) }));
    const r = row(container, 'IH-06');
    expect(r.getAttribute('data-transition-type')).toBe('became_measurable');
    expect(r.getAttribute('data-has-delta')).toBe('false');
    expect(within(r).queryByTestId('delta-badge')).toBeNull();
    expect(r.querySelector('[data-delta-badge]')).toBeNull();
    expect(within(r).getByText(/not a performance comparison/i)).toBeInTheDocument();
    // must not read as an improvement
    expect(within(r).queryByText(/improved/i)).toBeNull();
  });

  it('gap_identified reads as a discovered problem, NOT an improvement, no number', () => {
    const { container } = renderReport(rec({ 'BC-08': NM }), rec({ 'BC-08': { state: 'no_rto_defined' } }));
    const r = row(container, 'BC-08');
    expect(r.getAttribute('data-transition-type')).toBe('gap_identified');
    expect(r.getAttribute('data-has-delta')).toBe('false');
    expect(r.querySelector('[data-delta-badge]')).toBeNull();
    expect(within(r).getByText(/Gap identified/i)).toBeInTheDocument();
    expect(within(r).getByText(/determined absent/i)).toBeInTheDocument();
    expect(within(r).queryByText(/improved/i)).toBeNull();
  });

  it('became_unmeasurable words differently by fromClass (SCORED vs GAP_ZERO)', () => {
    const fromScored = renderReport(rec({ 'IH-06': meas(4) }), rec({ 'IH-06': NM }));
    const rScored = row(fromScored.container, 'IH-06');
    expect(rScored.getAttribute('data-transition-type')).toBe('became_unmeasurable');
    expect(within(rScored).getByText(/Lost a measurement/i)).toBeInTheDocument();

    const fromGap = renderReport(rec({ 'IH-06': CAP }), rec({ 'IH-06': NM }));
    const rGap = row(fromGap.container, 'IH-06');
    expect(rGap.getAttribute('data-transition-type')).toBe('became_unmeasurable');
    expect(within(rGap).getByText(/Lost certainty about a programme gap/i)).toBeInTheDocument();
    // the two wordings differ
    expect(within(rScored).queryByText(/Lost certainty/i)).toBeNull();
  });

  it('both_unscored and programme_gap_change render as no-number state transitions', () => {
    const bothUnscored = renderReport(rec({ 'IH-06': NM }), rec({ 'IH-06': NQE }));
    const r1 = row(bothUnscored.container, 'IH-06');
    expect(r1.getAttribute('data-transition-type')).toBe('both_unscored');
    expect(r1.getAttribute('data-has-delta')).toBe('false');
    expect(r1.querySelector('[data-delta-badge]')).toBeNull();

    const gapChange = renderReport(rec({ 'BC-08': { state: 'no_rto_defined' } }), rec({ 'BC-08': { state: 'no_rto_defined' } }));
    const r2 = row(gapChange.container, 'BC-08');
    expect(r2.getAttribute('data-transition-type')).toBe('programme_gap_change');
    expect(r2.querySelector('[data-delta-badge]')).toBeNull();
  });

  it('no no-delta transition ever renders a delta badge', () => {
    const { container } = renderReport(
      rec({ 'IH-06': NM, 'IH-07': meas(4), 'BC-08': NM }),
      rec({ 'IH-06': meas(4), 'IH-07': NM, 'BC-08': { state: 'no_rto_defined' } })
    );
    const noDeltaRows = container.querySelectorAll('[data-has-delta="false"]');
    expect(noDeltaRows.length).toBeGreaterThan(0);
    for (const r of noDeltaRows) {
      expect(r.querySelector('[data-delta-badge]')).toBeNull();
    }
  });
});

// ===========================================================================
// Dimension comparability gating
// ===========================================================================

describe('dimension comparability', () => {
  const completeIH = (a, b, c) => ({ 'IH-06': meas(a), 'IH-07': meas(b), 'IH-08': meas(c) });

  it('comparable → shows signed delta', () => {
    const { container } = renderReport(rec(completeIH('96', '48', '96')), rec(completeIH('4', '2', '5')));
    const ih = container.querySelector('[data-dim="IH"]');
    expect(ih.getAttribute('data-comparable')).toBe('true');
    expect(within(ih).getByText(/improved \+2\.00/i)).toBeInTheDocument();
  });

  it('not comparable → no delta number, shows incompleteIn explanation', () => {
    const { container } = renderReport(rec(completeIH('4', '2', '5')), rec({ 'IH-06': meas(4), 'IH-07': meas(2), 'IH-08': NM }));
    const ih = container.querySelector('[data-dim="IH"]');
    expect(ih.getAttribute('data-comparable')).toBe('false');
    expect(within(ih).getByText(/Not comparable at dimension level/i)).toBeInTheDocument();
    expect(within(ih).getByText(/incomplete in B/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// Layer 0 transitions + label correctness (no raw enums)
// ===========================================================================

describe('Layer 0 transitions', () => {
  it('renders qualitative transitions with proper state labels (no raw enums)', () => {
    const A = rec({}, { layer0Overrides: { 'L0-asset-inventory': { state: 'missing' }, 'L0-risk-assessment': { state: 'incomplete_outdated' } } });
    const B = rec({}, { layer0Overrides: { 'L0-asset-inventory': { state: 'present' }, 'L0-risk-assessment': { state: 'incomplete_outdated' } } });
    const { container } = render(<ComparisonReport comparison={computeComparison(A, B)} />);

    const asset = container.querySelector('[data-l0-item="L0-asset-inventory"]');
    expect(asset.getAttribute('data-l0-transition')).toBe('improved');
    expect(within(asset).getByText(/Missing → Present/)).toBeInTheDocument();
    // proper label, never the raw enum
    expect(asset.textContent).toMatch(/Incomplete or outdated|Present|Missing/);
    expect(asset.textContent).not.toMatch(/incomplete_outdated|_/);
  });

  it('RM measured state renders as "Measured", not a raw enum', () => {
    const A = rec({}, { layer0Overrides: { 'RM-04': { state: 'process_absent' } } });
    const B = rec({}, { layer0Overrides: { 'RM-04': { state: 'measured', numerator: '5', denominator: '10' } } });
    const { container } = render(<ComparisonReport comparison={computeComparison(A, B)} />);
    const rm = container.querySelector('[data-l0-item="RM-04"]');
    expect(rm.textContent).toMatch(/Measured/);
    expect(rm.textContent).not.toMatch(/process_absent|measured\b(?![A-Za-z])/);
    // No raw underscore enum anywhere in the Layer 0 section
    const allL0 = container.querySelectorAll('[data-l0-item]');
    for (const el of allL0) expect(el.textContent).not.toMatch(/[a-z]+_[a-z]/);
  });

  it('still_flagged for Missing → Missing', () => {
    const A = rec({}, { layer0Overrides: { 'L0-bc-plan-doc': { state: 'missing' } } });
    const B = rec({}, { layer0Overrides: { 'L0-bc-plan-doc': { state: 'missing' } } });
    const { container } = render(<ComparisonReport comparison={computeComparison(A, B)} />);
    expect(container.querySelector('[data-l0-item="L0-bc-plan-doc"]').getAttribute('data-l0-transition')).toBe('still_flagged');
  });
});

// ===========================================================================
// Metadata, mismatch, A==B
// ===========================================================================

describe('metadata and edge cases', () => {
  it('renders the before/after header with both clients and dates', () => {
    renderReport(rec({}, { clientId: 'Acme', assessmentDate: '2026-01-01' }), rec({}, { clientId: 'Acme', assessmentDate: '2026-06-01' }));
    expect(screen.getByText(/Before: Acme 2026-01-01/)).toBeInTheDocument();
    expect(screen.getByText(/After: Acme 2026-06-01/)).toBeInTheDocument();
  });

  it('clientMismatch renders a non-blocking warning', () => {
    const { container } = renderReport(rec({}, { clientId: 'Acme' }), rec({}, { clientId: 'Globex' }));
    expect(container.querySelector('[data-client-mismatch]')).not.toBeNull();
    expect(screen.getByText(/different clients/i)).toBeInTheDocument();
  });

  it('A == B → performance rows read "no change", dimensions "no change"', () => {
    const same = rec({ 'IH-06': meas(4), 'IH-07': meas(2), 'IH-08': meas(5) });
    const { container } = render(<ComparisonReport comparison={computeComparison(same, same)} />);
    const r = row(container, 'IH-06');
    expect(r.getAttribute('data-transition-type')).toBe('performance_change');
    expect(within(r).getByText(/no change/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// Visual hierarchy (Change 1) + mixed-movement display (Change 2)
// ===========================================================================

describe('dimension hierarchy and mixed movement', () => {
  const full = (ih, bc) => rec({
    'IH-06': meas(ih[0]), 'IH-07': meas(ih[1]), 'IH-08': meas(ih[2]),
    'BC-01': meas(bc[0]), 'BC-02': meas(bc[1]),
    'BC-04': measPct(bc[2], 100), 'BC-08': measPct(bc[3], 100), 'BC-09': measPct(bc[4], 100),
  });

  it('IH and BC are marked primary; Overall is marked secondary and labelled', () => {
    const { container } = renderReport(
      full(['400', '100', '400'], ['15', '15', 60, 15, 15]),
      full(['4', '2', '5'], ['95', '95', 0, 95, 95]),
    );
    const primaries = container.querySelectorAll('[data-score-role="primary"]');
    const ids = Array.from(primaries).map(el => el.getAttribute('data-dim'));
    expect(ids).toEqual(expect.arrayContaining(['IH', 'BC']));
    const overall = container.querySelector('[data-dim="Overall"][data-score-role="secondary"]');
    expect(overall).not.toBeNull();
    expect(overall.textContent).toMatch(/secondary summary of Incident Handling and Business Continuity/i);
  });

  it('mixed (IH improved, BC regressed) → labelled "Mixed", leads with BOTH dimension deltas', () => {
    const { container } = renderReport(
      full(['400', '100', '400'], ['95', '95', 0, 95, 95]),   // IH low, BC high
      full(['4', '2', '5'], ['15', '15', 60, 15, 15]),          // IH high, BC low
    );
    const overall = container.querySelector('[data-dim="Overall"]');
    expect(overall.getAttribute('data-overall-movement')).toBe('mixed');
    expect(overall.textContent).toMatch(/Mixed — dimensions moved in opposite directions/i);
    // leads with both dimension deltas, each direction-aware
    const dims = overall.querySelector('[data-mixed-dimensions]');
    expect(dims.textContent).toMatch(/Incident Handling improved/i);
    expect(dims.textContent).toMatch(/Business Continuity regressed/i);
    // net Overall present but clearly secondary (the caveat text)
    expect(overall.textContent).toMatch(/can mask this divergence/i);
  });

  it('aligned (both improved) → aligned marker, no mixed alarm', () => {
    const { container } = renderReport(
      full(['400', '100', '400'], ['15', '15', 60, 15, 15]),
      full(['4', '2', '5'], ['95', '95', 0, 95, 95]),
    );
    const overall = container.querySelector('[data-dim="Overall"]');
    expect(overall.getAttribute('data-overall-movement')).toBe('aligned');
    expect(overall.textContent).not.toMatch(/Mixed —/i);
  });

  it('partial_move → labelled partial, notes the other dimension unchanged, no mixed alarm', () => {
    const { container } = renderReport(
      full(['400', '100', '400'], ['85', '85', 3, 85, 85]),
      full(['4', '2', '5'], ['85', '85', 3, 85, 85]),   // BC identical
    );
    const overall = container.querySelector('[data-dim="Overall"]');
    expect(overall.getAttribute('data-overall-movement')).toBe('partial_move');
    expect(overall.textContent).toMatch(/one dimension moved, the other unchanged/i);
    expect(overall.textContent).not.toMatch(/Mixed —/i);
  });
});

// ===========================================================================
// Loading flow (ComparisonView)
// ===========================================================================

describe('ComparisonView loading flow', () => {
  function fileOf(record) {
    const { json } = serializeAssessment({
      clientId: record.clientId, assessmentDate: record.assessmentDate,
      indicators: record.indicators, layer0: record.layer0, targets: record.targets,
    });
    return new File([json], 'a.json', { type: 'application/json' });
  }

  it('shows the prompt until both slots are filled, then renders the comparison', async () => {
    const { container } = render(<ComparisonView />);
    expect(container.querySelector('[data-compare-prompt]')).not.toBeNull();

    const inputs = container.querySelectorAll('input[type="file"]');
    // Load slot A
    fireEvent.change(inputs[0], { target: { files: [fileOf(rec({ 'IH-06': meas(96) }, { clientId: 'Before' }))] } });
    await waitFor(() => expect(container.querySelector('[data-slot-loaded="A"]')).not.toBeNull());
    // Still prompting (only one slot)
    expect(container.querySelector('[data-compare-prompt]')).not.toBeNull();

    // Load slot B
    fireEvent.change(inputs[1], { target: { files: [fileOf(rec({ 'IH-06': meas(4) }, { clientId: 'After' }))] } });
    await waitFor(() => expect(container.querySelector('[data-compare-prompt]')).toBeNull());
    // Comparison now renders
    expect(container.querySelector('[data-transition-type="performance_change"]')).not.toBeNull();
  });

  it('a validation error on a file is surfaced without crashing or half-loading', async () => {
    const { container } = render(<ComparisonView />);
    const inputs = container.querySelectorAll('input[type="file"]');
    fireEvent.change(inputs[0], { target: { files: [new File(['{ not json'], 'bad.json', { type: 'application/json' })] } });
    await waitFor(() => expect(container.querySelector('[data-slot-error="A"]')).not.toBeNull());
    expect(container.querySelector('[data-slot-error="A"]').textContent).toMatch(/not valid JSON/i);
    expect(container.querySelector('[data-slot-loaded="A"]')).toBeNull();   // no half-load
    expect(container.querySelector('[data-compare-prompt]')).not.toBeNull();
  });
});

// ===========================================================================
// Raw-value line (additive)
// ===========================================================================

describe('raw-value line', () => {
  it('within-band improvement renders the raw line (20h → 18h, improved 2h) even though the band is unchanged', () => {
    const { container } = renderReport(rec({ 'IH-06': meas(20) }), rec({ 'IH-06': meas(18) }));  // both band 3
    const r = row(container, 'IH-06');
    // score/band line still reads "no change"
    expect(within(r).getByText(/no change/i)).toBeInTheDocument();
    // raw line present and reads as improved
    const raw = r.querySelector('[data-raw-line]');
    expect(raw).not.toBeNull();
    expect(raw.getAttribute('data-raw-direction')).toBe('improved');
    expect(raw.textContent).toMatch(/20h → 18h/);
    expect(raw.textContent).toMatch(/improved 2h/);
  });

  it('Threshold Violation Rate 20% → 12% raw line reads improved (falling rate), pp unit', () => {
    const { container } = renderReport(rec({ 'BC-04': measPct(20, 100) }), rec({ 'BC-04': measPct(12, 100) }));
    const raw = row(container, 'BC-04').querySelector('[data-raw-line]');
    expect(raw.getAttribute('data-raw-direction')).toBe('improved');
    expect(raw.textContent).toMatch(/20% → 12%/);
    expect(raw.textContent).toMatch(/improved 8pp/);
  });

  it('capability_established renders "now <value>" and no delta', () => {
    const { container } = renderReport(rec({ 'IH-06': CAP }), rec({ 'IH-06': meas(18) }));
    const r = row(container, 'IH-06');
    const raw = r.querySelector('[data-raw-line]');
    expect(raw.getAttribute('data-raw-direction')).toBe('established');
    expect(raw.textContent).toMatch(/now 18h/);
  });

  it('other transition types render NO raw line', () => {
    const bm = renderReport(rec({ 'IH-06': NM }), rec({ 'IH-06': meas(18) }));   // became_measurable
    expect(row(bm.container, 'IH-06').querySelector('[data-raw-line]')).toBeNull();

    const bu = renderReport(rec({ 'IH-06': meas(18) }), rec({ 'IH-06': NM }));    // became_unmeasurable
    expect(row(bu.container, 'IH-06').querySelector('[data-raw-line]')).toBeNull();
  });
});
