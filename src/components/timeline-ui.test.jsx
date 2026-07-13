/**
 * Timeline UI tests — TimelineReport render + TimelineView slot management.
 */

import { describe, it, expect } from 'vitest';
import { render, within, fireEvent, waitFor } from '@testing-library/react';
import TimelineReport from './TimelineReport.jsx';
import TimelineView from './TimelineView.jsx';
import { computeTimeline } from '../engine/timeline.js';
import { serializeAssessment } from '../engine/persistence.js';
import { createBlankAssessment } from '../engine/scoring.js';
import { createBlankLayer0 } from '../engine/layer0.js';

function recAt(assessmentDate, indicatorOverrides = {}, clientId = 'Acme') {
  return {
    clientId, assessmentDate,
    indicators: { ...createBlankAssessment().indicators, ...indicatorOverrides },
    layer0: { ...createBlankLayer0() },
    targets: {},
  };
}
const meas = (v) => ({ state: 'measured', value: String(v) });
const measPct = (n, d) => ({ state: 'measured', numerator: String(n), denominator: String(d) });
const NM = { state: 'not_measurable' };
const CAP = { state: 'capability_absent' };

function renderTimeline(records) {
  return render(<TimelineReport timeline={computeTimeline(records)} />);
}
function trajRow(container, id) {
  return container.querySelector(`[data-traj-indicator="${id}"]`);
}

// ===========================================================================
// Part 1 — N−1 blocks render the existing comparison content
// ===========================================================================

describe('TimelineReport — blocks', () => {
  it('N=4 renders three comparison blocks, each with comparison content', () => {
    const { container } = renderTimeline([
      recAt('2026-01-01', { 'IH-06': meas(300) }),
      recAt('2026-02-01', { 'IH-06': meas(96) }),
      recAt('2026-03-01', { 'IH-06': meas(20) }),
      recAt('2026-04-01', { 'IH-06': meas(4) }),
    ]);
    const blocks = container.querySelectorAll('[data-timeline-block]');
    expect(blocks).toHaveLength(3);
    // each block contains an existing ComparisonReport (transition rows)
    for (const b of blocks) {
      expect(b.querySelector('[data-transition-type]')).not.toBeNull();
    }
  });

  it('N=2 renders exactly one block (matches the 2-way view)', () => {
    const { container } = renderTimeline([
      recAt('2026-01-01', { 'IH-06': meas(96) }),
      recAt('2026-02-01', { 'IH-06': meas(4) }),
    ]);
    expect(container.querySelectorAll('[data-timeline-block]')).toHaveLength(1);
  });
});

// ===========================================================================
// Part 2 — trajectory point-states
// ===========================================================================

describe('TimelineReport — trajectory', () => {
  it('mixed sequence renders four distinct point-states; no-score shows NO number, gap-zero shows "0 (…)"', () => {
    const { container } = renderTimeline([
      recAt('2026-01-01', { 'IH-06': meas(30) }),   // measured
      recAt('2026-02-01', { 'IH-06': NM }),          // no_score
      recAt('2026-03-01', { 'IH-06': meas(18) }),    // measured
      recAt('2026-04-01', { 'IH-06': CAP }),         // gap_zero
    ]);
    const rowEl = trajRow(container, 'IH-06');
    const points = rowEl.querySelectorAll('[data-traj-point]');
    expect(Array.from(points).map(p => p.getAttribute('data-point-kind')))
      .toEqual(['measured', 'no_score', 'measured', 'gap_zero']);

    // measured points show hours
    expect(points[0].textContent).toBe('30h');
    expect(points[2].textContent).toBe('18h');
    // no-score point: state marker, NO number
    expect(points[1].textContent).toMatch(/Not measurable/i);
    expect(points[1].textContent).not.toMatch(/\d/);
    // gap-zero point: "0 (Capability absent)" — a real score-0, distinct from no-score
    expect(points[3].textContent).toMatch(/^0 \(Capability absent\)/);

    // score line: no-score point renders "—", others a 2-decimal score
    const scorePts = rowEl.querySelectorAll('[data-traj-score-point]');
    expect(scorePts[0].textContent).toBe('2.00');
    expect(scorePts[1].textContent).toBe('—');
    expect(scorePts[3].textContent).toBe('0.00');
  });

  it('num/den indicator trajectory shows % ; time indicator shows h', () => {
    const { container } = renderTimeline([
      recAt('2026-01-01', { 'BC-08': measPct(4, 5), 'IH-06': meas(30) }),
      recAt('2026-02-01', { 'BC-08': measPct(9, 10), 'IH-06': meas(18) }),
    ]);
    const bc = trajRow(container, 'BC-08').querySelectorAll('[data-traj-point]');
    expect(bc[0].textContent).toBe('80%');
    expect(bc[1].textContent).toBe('90%');
    const ih = trajRow(container, 'IH-06').querySelectorAll('[data-traj-point]');
    expect(ih[0].textContent).toBe('30h');
  });

  it('uses full descriptive names, no IDs', () => {
    const { container } = renderTimeline([recAt('2026-01-01', { 'IH-06': meas(30) }), recAt('2026-02-01', { 'IH-06': meas(18) })]);
    expect(within(trajRow(container, 'IH-06')).getByText('Mean Time to Detect')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\bIH-0\d/);
  });
});

// ===========================================================================
// Client mismatch
// ===========================================================================

describe('TimelineReport — client mismatch', () => {
  it('renders the warning when clients differ, not when same', () => {
    const diff = renderTimeline([recAt('2026-01-01', {}, 'A'), recAt('2026-02-01', {}, 'B')]);
    expect(diff.container.querySelector('[data-timeline-mismatch]')).not.toBeNull();

    const same = renderTimeline([recAt('2026-01-01', {}, 'A'), recAt('2026-02-01', {}, 'A')]);
    expect(same.container.querySelector('[data-timeline-mismatch]')).toBeNull();
  });
});

// ===========================================================================
// Overall hierarchy + mixed movement per block (Change 1 + 2 in the timeline)
// ===========================================================================

describe('TimelineReport — Overall secondary + mixed per block', () => {
  const full = (date, ih, bc) => recAt(date, {
    'IH-06': meas(ih[0]), 'IH-07': meas(ih[1]), 'IH-08': meas(ih[2]),
    'BC-01': meas(bc[0]), 'BC-02': meas(bc[1]),
    'BC-04': measPct(bc[2], 100), 'BC-08': measPct(bc[3], 100), 'BC-09': measPct(bc[4], 100),
  });

  it('each block marks Overall secondary; a block with opposite-direction movement is labelled mixed independently', () => {
    // step1→2: aligned (both regress); step2→3: mixed (IH improves, BC regresses)
    const s1 = full('2026-01-01', ['4', '2', '5'], ['95', '95', 0, 95, 95]);    // IH 4, BC 4
    const s2 = full('2026-02-01', ['96', '48', '96'], ['50', '50', 10, 60, 60]); // IH 2, BC 2  (both regressed)
    const s3 = full('2026-03-01', ['4', '2', '5'], ['15', '15', 35, 15, 15]);    // IH 4 (up), BC 1 (down) → mixed
    const { container } = renderTimeline([s1, s2, s3]);

    const blocks = container.querySelectorAll('[data-timeline-block]');
    expect(blocks).toHaveLength(2);

    // Every block has a secondary Overall
    for (const b of blocks) {
      expect(b.querySelector('[data-dim="Overall"][data-score-role="secondary"]')).not.toBeNull();
    }
    // Block 1 aligned, block 2 mixed — classified independently
    expect(blocks[0].querySelector('[data-dim="Overall"]').getAttribute('data-overall-movement')).toBe('aligned');
    expect(blocks[1].querySelector('[data-dim="Overall"]').getAttribute('data-overall-movement')).toBe('mixed');
    expect(blocks[1].textContent).toMatch(/Mixed — dimensions moved in opposite directions/i);
  });
});

// ===========================================================================
// TimelineView — slot management + loading
// ===========================================================================

describe('TimelineView — slots and loading', () => {
  function fileOf(record) {
    const { json } = serializeAssessment({
      clientId: record.clientId, assessmentDate: record.assessmentDate,
      indicators: record.indicators, layer0: record.layer0, targets: record.targets,
    });
    return new File([json], 'a.json', { type: 'application/json' });
  }

  it('starts with 2 slots; cannot remove below 2', () => {
    const { container } = render(<TimelineView />);
    expect(container.querySelectorAll('[data-slot]')).toHaveLength(2);
    // remove buttons hidden at the minimum
    expect(container.querySelector('[data-remove-slot]')).toBeNull();
  });

  it('adds slots up to 6, then the add button disables', () => {
    const { container } = render(<TimelineView />);
    const add = container.querySelector('[data-add-slot]');
    for (let i = 2; i < 6; i++) fireEvent.click(add);
    expect(container.querySelectorAll('[data-slot]')).toHaveLength(6);
    expect(container.querySelector('[data-add-slot]').disabled).toBe(true);
  });

  it('can remove back down to the minimum of 2', () => {
    const { container } = render(<TimelineView />);
    const add = container.querySelector('[data-add-slot]');
    fireEvent.click(add); fireEvent.click(add);   // → 4 slots
    expect(container.querySelectorAll('[data-slot]')).toHaveLength(4);
    // remove until 2
    let removeBtns = container.querySelectorAll('[data-remove-slot]');
    fireEvent.click(removeBtns[0]);
    fireEvent.click(container.querySelectorAll('[data-remove-slot]')[0]);
    expect(container.querySelectorAll('[data-slot]')).toHaveLength(2);
    expect(container.querySelector('[data-remove-slot]')).toBeNull();
  });

  it('prompt until 2 loaded, then renders the timeline; validation error surfaced without half-load', async () => {
    const { container } = render(<TimelineView />);
    expect(container.querySelector('[data-compare-prompt]')).not.toBeNull();
    const inputs = container.querySelectorAll('input[type="file"]');

    // bad file into slot 0 → error, no load
    fireEvent.change(inputs[0], { target: { files: [new File(['{ bad'], 'b.json', { type: 'application/json' })] } });
    await waitFor(() => expect(container.querySelector('[data-slot-error="0"]')).not.toBeNull());
    expect(container.querySelector('[data-slot-loaded="0"]')).toBeNull();
    expect(container.querySelector('[data-compare-prompt]')).not.toBeNull();

    // two good files → timeline renders
    fireEvent.change(inputs[0], { target: { files: [fileOf(recAt('2026-01-01', { 'IH-06': meas(96) }))] } });
    await waitFor(() => expect(container.querySelector('[data-slot-loaded="0"]')).not.toBeNull());
    fireEvent.change(container.querySelectorAll('input[type="file"]')[1], { target: { files: [fileOf(recAt('2026-02-01', { 'IH-06': meas(4) }))] } });
    await waitFor(() => expect(container.querySelector('[data-compare-prompt]')).toBeNull());
    expect(container.querySelector('[data-timeline-block]')).not.toBeNull();
  });
});
