/**
 * PriorityView UI tests — Stage 3b-ii (§7).
 * Confirms each of the six engine distinctions is VISIBLY rendered (distinct
 * text/structure), plus per-lane empty states.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import PriorityView from './PriorityView.jsx';
import { computePriorityView } from '../engine/priorityView.js';
import { computeAssessment, createBlankAssessment } from '../engine/scoring.js';
import { computeLayer0, createBlankLayer0 } from '../engine/layer0.js';
import { L0_STATE } from '../data/layer0Definitions.js';
import { STATE_PRIORITY_LABELS } from '../data/indicatorDefinitions.js';

function fullRecord(indicatorOverrides = {}, layer0Overrides = {}) {
  const blank = createBlankAssessment();
  return {
    ...blank,
    indicators: { ...blank.indicators, ...indicatorOverrides },
    layer0: { ...createBlankLayer0(), ...layer0Overrides },
  };
}

function renderPV(record) {
  const result = computePriorityView(record, computeAssessment(record), computeLayer0(record));
  return { result, ...render(<PriorityView priorityResult={result} />) };
}

// ===========================================================================
// Distinction 1 — programme-gap zero vs performance zero in Lane 1
// ===========================================================================

describe('Lane 1 — programme-gap zero vs performance zero', () => {
  it('renders a programme-gap zero and a performance zero with DIFFERENT labels', () => {
    const rec = fullRecord({
      'BC-08': { state: 'no_rto_defined' },              // programme-gap zero
      'BC-01': { state: 'measured', value: '0' },        // performance zero
    });
    const { container } = renderPV(rec);

    // programme-gap zero shows the structural chip text
    expect(screen.getByText(/Recovery time objective not established/i)).toBeInTheDocument();
    // performance zero shows the measured-failure chip text
    expect(screen.getByText(/genuinely failed — measured score 0/i)).toBeInTheDocument();

    // The two chips carry different data-zero-kind markers
    expect(container.querySelector('[data-zero-kind="programme-gap"]')).not.toBeNull();
    expect(container.querySelector('[data-zero-kind="performance-failure"]')).not.toBeNull();
  });

  it('chip text comes from the centralised STATE_PRIORITY_LABELS map', () => {
    const rec = fullRecord({ 'BC-09': { state: 'no_rpo_defined' } });
    renderPV(rec);
    // Exact string from the map — proves single-source labelling
    expect(screen.getByText(new RegExp(STATE_PRIORITY_LABELS.no_rpo_defined.detail, 'i'))).toBeInTheDocument();
  });

  it('an ordinary scored indicator shows no zero-kind chip', () => {
    const rec = fullRecord({ 'IH-06': { state: 'measured', value: '4' } });  // score 4
    const { container } = renderPV(rec);
    expect(container.querySelector('[data-zero-kind]')).toBeNull();
  });
});

// ===========================================================================
// Distinction 2 — Lane 2 (serious) vs Lane 3 (neutral)
// ===========================================================================

describe('Lane 2 vs Lane 3 framing', () => {
  it('Lane 2 count-based severity renders: 3-of-3 IH → Critical', () => {
    const rec = fullRecord({
      'IH-06': { state: 'not_measurable' },
      'IH-07': { state: 'not_measurable' },
      'IH-08': { state: 'not_measurable' },
    });
    renderPV(rec);
    // IH shows Critical (3/3 blackout); BC has no not-measurable → no BC badge
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('Lane 2 count-based severity renders: 1 IH not-measurable → High', () => {
    const rec = fullRecord({ 'IH-06': { state: 'not_measurable' } });
    renderPV(rec);
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('Lane 2 uses blunt obligation framing, not soft "measurement readiness"', () => {
    const rec = fullRecord({ 'IH-06': { state: 'not_measurable' } });
    const { container } = renderPV(rec);
    expect(screen.getByText(/cannot currently be demonstrated/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/measurement readiness/i);
  });

  it('Lane 3 renders without any severity badge and reads neutrally', () => {
    const rec = fullRecord({ 'IH-08': { state: 'no_qualifying_event' } });
    renderPV(rec);
    const lane3Rows = document.querySelectorAll('[data-lane="3"]');
    expect(lane3Rows.length).toBe(1);
    expect(screen.getByText(/Nothing occurred to assess this indicator/i)).toBeInTheDocument();
    // No Critical/High badge inside Lane 3 rows
    for (const row of lane3Rows) {
      expect(within(row).queryByText('Critical')).toBeNull();
      expect(within(row).queryByText('High')).toBeNull();
    }
  });
});

// ===========================================================================
// Distinction 3 — Lane 2 entry kinds render distinguishably
// ===========================================================================

describe('Lane 2 entry kinds', () => {
  it('layer0_link renders as a reference (not a copy of the flag content)', () => {
    const rec = fullRecord(
      { 'BC-08': { state: 'not_measurable', reason: { layer0ItemId: 'L0-bc-plan-doc', text: 'BC plan missing' } } },
      { 'L0-bc-plan-doc': { state: L0_STATE.MISSING } }
    );
    const { container } = renderPV(rec);
    expect(container.querySelector('[data-entry-kind="layer0_link"]')).not.toBeNull();
    expect(screen.getByText(/Linked to Layer 0 action/i)).toBeInTheDocument();
  });

  it('self_created renders as a standalone evidence-infrastructure flag', () => {
    const rec = fullRecord({
      'BC-08': { state: 'not_measurable', reason: { text: 'no incident-timestamp recording process exists' } },
    });
    const { container } = renderPV(rec);
    const card = container.querySelector('[data-entry-kind="self_created"]');
    expect(card).not.toBeNull();
    // heading + message both contain the phrase — assert within the card
    expect(within(card).getAllByText(/Evidence-infrastructure gap/i).length).toBeGreaterThanOrEqual(1);
  });

  it('ungrouped_no_reason renders with a reason-needed prompt', () => {
    const rec = fullRecord({ 'BC-08': { state: 'not_measurable' } });
    const { container } = renderPV(rec);
    expect(container.querySelector('[data-entry-kind="ungrouped_no_reason"]')).not.toBeNull();
    expect(screen.getByText(/Reason needed to group/i)).toBeInTheDocument();
  });

  it('the three kinds are visually distinct (different data-entry-kind markers present together)', () => {
    const rec = fullRecord(
      {
        'BC-08': { state: 'not_measurable', reason: { layer0ItemId: 'L0-bc-plan-doc', text: 'BC plan missing' } },
        'BC-09': { state: 'not_measurable', reason: { text: 'no timestamp process' } },
        'BC-01': { state: 'not_measurable' },
      },
      { 'L0-bc-plan-doc': { state: L0_STATE.MISSING } }
    );
    const { container } = renderPV(rec);
    expect(container.querySelector('[data-entry-kind="layer0_link"]')).not.toBeNull();
    expect(container.querySelector('[data-entry-kind="self_created"]')).not.toBeNull();
    expect(container.querySelector('[data-entry-kind="ungrouped_no_reason"]')).not.toBeNull();
  });
});

// ===========================================================================
// Distinction 4 — linkedFlagExists:false inconsistency cue
// ===========================================================================

describe('linkedFlagExists:false inconsistency', () => {
  it('renders a visible inconsistency cue, not a dead link', () => {
    const rec = fullRecord(
      { 'BC-08': { state: 'not_measurable', reason: { layer0ItemId: 'L0-bc-plan-doc', text: 'BC plan missing' } } },
      { 'L0-bc-plan-doc': { state: L0_STATE.PRESENT } }   // healthy → no flag
    );
    const { container } = renderPV(rec);
    const mismatch = container.querySelector('[data-entry-kind="layer0_link_mismatch"]');
    expect(mismatch).not.toBeNull();
    // Unique heading text (avoids matching the body "Resolve this inconsistency")
    expect(within(mismatch).getByText(/Inconsistency — cited cause is not currently flagged/i)).toBeInTheDocument();
    expect(within(mismatch).getByText(/not currently raising an action flag/i)).toBeInTheDocument();
    // Must NOT render the normal link row
    expect(container.querySelector('[data-entry-kind="layer0_link"]')).toBeNull();
  });
});

// ===========================================================================
// Point 2 — linkedFlagSeverity mirrors the source Layer 0 flag (no recompute)
// ===========================================================================

describe('layer0_link severity mirrors the source flag', () => {
  it('link severity equals the Layer 0 panel severity for the same item', () => {
    const rec = fullRecord(
      { 'BC-08': { state: 'not_measurable', reason: { layer0ItemId: 'L0-bc-plan-doc', text: 'BC plan missing' } } },
      { 'L0-bc-plan-doc': { state: L0_STATE.MISSING } }
    );
    // Engine: what severity does the Layer 0 panel assign to this item?
    const l0 = computeLayer0(rec);
    const sourceFlag = l0.actionFlags.find(f => f.itemId === 'L0-bc-plan-doc');
    expect(sourceFlag.severity).toBe('critical');

    // UI: the Lane 2 link shows the SAME severity (Critical), straight from the entry
    const result = computePriorityView(rec, computeAssessment(rec), l0);
    expect(result.lane2.groups[0].linkedFlagSeverity).toBe('critical');  // mirrored, not recomputed
    render(<PriorityView priorityResult={result} />);
    const linkRow = document.querySelector('[data-entry-kind="layer0_link"]');
    expect(within(linkRow).getByText('Critical')).toBeInTheDocument();
  });
});

// ===========================================================================
// Distinction 5 — invalid_input prominent vs unset low-key
// ===========================================================================

describe('unassigned — invalid_input vs unset', () => {
  it('invalid_input renders prominently as a correctable error', () => {
    const rec = fullRecord({ 'BC-08': { state: 'measured', numerator: '11', denominator: '10' } });
    const { container } = renderPV(rec);
    const invalidRow = container.querySelector('[data-unassigned="invalid_input"]');
    expect(invalidRow).not.toBeNull();
    expect(invalidRow.textContent).toMatch(/Invalid value entered/i);
    expect(invalidRow.textContent).toMatch(/correct it/i);
  });

  it('unset renders low-key as not-yet-assessed', () => {
    const rec = fullRecord({});  // everything blank
    const { container } = renderPV(rec);
    const unsetRows = container.querySelectorAll('[data-unassigned="unset"]');
    expect(unsetRows.length).toBe(8);
    expect(unsetRows[0].textContent).toMatch(/not yet assessed/i);
  });

  it('invalid_input and unset render as DIFFERENT row types in the same view', () => {
    const rec = fullRecord({ 'BC-08': { state: 'measured', numerator: '11', denominator: '10' } });
    const { container } = renderPV(rec);
    expect(container.querySelector('[data-unassigned="invalid_input"]')).not.toBeNull();
    expect(container.querySelector('[data-unassigned="unset"]')).not.toBeNull();
  });
});

// ===========================================================================
// Distinction 6 — grouped multi-indicator entry as ONE card with children
// ===========================================================================

describe('grouped entry renders as one card with children', () => {
  it('two indicators sharing a reason render as ONE entry listing both', () => {
    const rec = fullRecord(
      {
        'BC-08': { state: 'not_measurable', reason: { layer0ItemId: 'L0-bc-plan-doc', text: 'BC plan missing' } },
        'BC-09': { state: 'not_measurable', reason: { layer0ItemId: 'L0-bc-plan-doc', text: 'BC plan missing' } },
      },
      { 'L0-bc-plan-doc': { state: L0_STATE.MISSING } }
    );
    const { container } = renderPV(rec);
    // Exactly one layer0_link card
    const linkCards = container.querySelectorAll('[data-entry-kind="layer0_link"]');
    expect(linkCards.length).toBe(1);
    // Both indicators listed beneath it (full names, no ID codes)
    expect(within(linkCards[0]).getByText(/RTO Achievement Rate/)).toBeInTheDocument();
    expect(within(linkCards[0]).getByText(/RPO Achievement Rate/)).toBeInTheDocument();
  });
});

// ===========================================================================
// Per-lane empty states
// ===========================================================================

describe('per-lane empty states', () => {
  it('all-measured assessment: Lane 2 empty reads POSITIVE, not blank', () => {
    const rec = fullRecord({
      'IH-06': { state: 'measured', value: '4' },
      'IH-07': { state: 'measured', value: '2' },
      'IH-08': { state: 'measured', value: '5' },
      'BC-01': { state: 'measured', value: '85' },
      'BC-02': { state: 'measured', value: '90' },
      'BC-04': { state: 'measured', numerator: '0', denominator: '5' },
      'BC-08': { state: 'measured', numerator: '9', denominator: '10' },
      'BC-09': { state: 'measured', numerator: '9', denominator: '10' },
    });
    renderPV(rec);
    expect(screen.getByText(/no unverifiable areas/i)).toBeInTheDocument();
    expect(screen.getByText(/can be demonstrated/i)).toBeInTheDocument();
  });

  it('Lane 1 empty reads neutral', () => {
    const rec = fullRecord({ 'IH-06': { state: 'no_qualifying_event' } });  // nothing scored
    renderPV(rec);
    expect(screen.getByText(/No performance priorities/i)).toBeInTheDocument();
  });

  it('Lane 3 empty reads neutral', () => {
    const rec = fullRecord({ 'IH-06': { state: 'measured', value: '4' } });
    renderPV(rec);
    expect(screen.getByText(/No non-events this period/i)).toBeInTheDocument();
  });

  it('unassigned empty renders nothing (no "Not yet in a lane" header)', () => {
    const rec = fullRecord({
      'IH-06': { state: 'measured', value: '4' },
      'IH-07': { state: 'measured', value: '2' },
      'IH-08': { state: 'measured', value: '5' },
      'BC-01': { state: 'measured', value: '85' },
      'BC-02': { state: 'measured', value: '90' },
      'BC-04': { state: 'measured', numerator: '0', denominator: '5' },
      'BC-08': { state: 'measured', numerator: '9', denominator: '10' },
      'BC-09': { state: 'measured', numerator: '9', denominator: '10' },
    });
    renderPV(rec);
    expect(screen.queryByText(/Not yet in a lane/i)).toBeNull();
  });
});
