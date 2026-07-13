/**
 * Layer 0 two-lens UI tests — Stage 2, §9 presentation logic.
 *
 * Confirms the "same items, two lenses, two orderings" principle holds in the
 * rendered components, not only in the engine:
 *   - Layer0ReferenceView groups by 0A/0B (prerequisites then process evidence),
 *     independent of severity.
 *   - Layer0ActionPanel orders by severity first, then displayGroup; never by 0A/0B.
 *   - The same underlying data appears in both lenses in different orderings.
 *   - The asset-inventory contextual note renders on that item only.
 *   - A context-only non-event appears in the reference view but NOT the action panel.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import Layer0ReferenceView from './Layer0ReferenceView.jsx';
import Layer0ActionPanel from './Layer0ActionPanel.jsx';
import { computeLayer0, createBlankLayer0 } from '../engine/layer0.js';
import { createBlankAssessment } from '../engine/scoring.js';
import { L0_STATE } from '../data/layer0Definitions.js';

function noop() {}

function makeRecord(layer0Overrides = {}) {
  return {
    ...createBlankAssessment(),
    layer0: { ...createBlankLayer0(), ...layer0Overrides },
  };
}
const q = (state) => ({ state });
const rv = (n, d) => ({ state: L0_STATE.MEASURED, numerator: String(n), denominator: String(d) });

// Index of a substring in a container's full text — for DOM-order assertions
function textIndex(container, substr) {
  return container.textContent.indexOf(substr);
}

// ---------------------------------------------------------------------------
// Reference view — grouped by 0A/0B, independent of severity
// ---------------------------------------------------------------------------

describe('Layer0ReferenceView — grouped by 0A/0B', () => {
  it('renders two labelled groups: prerequisites then process evidence', () => {
    const result = computeLayer0(makeRecord());
    const { container } = render(
      <Layer0ReferenceView layer0Result={result} inputs={makeRecord().layer0} onItemChange={noop} />
    );
    const prereqIdx = textIndex(container, 'Layer 0A — Prerequisites');
    const procIdx = textIndex(container, 'Layer 0B — Process evidence');
    expect(prereqIdx).toBeGreaterThanOrEqual(0);
    expect(procIdx).toBeGreaterThanOrEqual(0);
    // 0A group is rendered before 0B group
    expect(prereqIdx).toBeLessThan(procIdx);
  });

  it('groups by 0A/0B independent of severity — a Critical 0B item still renders under process evidence, after all 0A items', () => {
    // RM-04 process_absent = Critical, but it is 0B and must stay in the second group
    const rec = makeRecord({
      'RM-04':              { state: L0_STATE.PROCESS_ABSENT },   // Critical, 0B
      'L0-asset-inventory': q(L0_STATE.PRESENT),                  // healthy, 0A
    });
    const result = computeLayer0(rec);
    const { container } = render(
      <Layer0ReferenceView layer0Result={result} inputs={rec.layer0} onItemChange={noop} />
    );
    const assetIdx = textIndex(container, 'Asset inventory maintained');       // 0A
    const rm04Idx = textIndex(container, 'Vulnerability Remediation Rate');    // 0B
    // Despite RM-04 being Critical and asset-inventory healthy, 0A renders first
    expect(assetIdx).toBeLessThan(rm04Idx);
  });

  it('all 9 items render in the reference view regardless of state', () => {
    const result = computeLayer0(makeRecord());
    render(<Layer0ReferenceView layer0Result={result} inputs={makeRecord().layer0} onItemChange={noop} />);
    expect(screen.getByText('Asset inventory maintained')).toBeInTheDocument();
    expect(screen.getByText('Risk assessment per zone')).toBeInTheDocument();
    expect(screen.getByText('Asset interdependency documentation')).toBeInTheDocument();
    expect(screen.getByText('Controlled IT/OT boundary separation')).toBeInTheDocument();
    expect(screen.getByText('Zero uncontrolled multi-homed devices')).toBeInTheDocument();
    expect(screen.getByText('BC plan documented for critical processes')).toBeInTheDocument();
    expect(screen.getByText('Vulnerability Remediation Rate')).toBeInTheDocument();
    expect(screen.getByText('Mean Time to Remediate')).toBeInTheDocument();
    expect(screen.getByText('BC plan tested within defined period')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Action panel — ordered by severity, never by 0A/0B
// ---------------------------------------------------------------------------

describe('Layer0ActionPanel — ordered by severity, not 0A/0B', () => {
  it('Critical flags render before High flags', () => {
    const rec = makeRecord({
      'L0-it-ot-boundary':  q(L0_STATE.INCOMPLETE_OUTDATED),  // High
      'L0-asset-inventory': q(L0_STATE.MISSING),               // Critical
    });
    const { actionFlags } = computeLayer0(rec);
    const { container } = render(<Layer0ActionPanel actionFlags={actionFlags} />);
    const assetIdx = textIndex(container, 'Asset inventory maintained');           // Critical
    const itOtIdx = textIndex(container, 'Controlled IT/OT boundary separation');  // High
    expect(assetIdx).toBeLessThan(itOtIdx);
  });

  it('does NOT render 0A/0B group headers (the action panel is not grouped by taxonomy)', () => {
    const rec = makeRecord({ 'L0-asset-inventory': q(L0_STATE.MISSING) });
    const { actionFlags } = computeLayer0(rec);
    render(<Layer0ActionPanel actionFlags={actionFlags} />);
    expect(screen.queryByText('Layer 0A — Prerequisites')).toBeNull();
    expect(screen.queryByText('Layer 0B — Process evidence')).toBeNull();
  });

  it('within Critical tier, displayGroup orders flags (architecture group 1 before scope group 2)', () => {
    const rec = makeRecord({
      'L0-asset-inventory': q(L0_STATE.MISSING),  // Critical group 2
      'L0-it-ot-boundary':  q(L0_STATE.MISSING),  // Critical group 1
    });
    const { actionFlags } = computeLayer0(rec);
    const { container } = render(<Layer0ActionPanel actionFlags={actionFlags} />);
    const itOtIdx = textIndex(container, 'Controlled IT/OT boundary separation'); // group 1
    const assetIdx = textIndex(container, 'Asset inventory maintained');          // group 2
    expect(itOtIdx).toBeLessThan(assetIdx);
  });

  it('renders the type tag for each flag', () => {
    const rec = makeRecord({ 'L0-it-ot-boundary': q(L0_STATE.MISSING) });
    const { actionFlags } = computeLayer0(rec);
    render(<Layer0ActionPanel actionFlags={actionFlags} />);
    // IT/OT boundary in non-not_verifiable state carries the Architecture tag
    expect(screen.getByText('[Architecture]')).toBeInTheDocument();
  });

  it('empty action flags → renders the "good standing" message, no flag rows', () => {
    render(<Layer0ActionPanel actionFlags={[]} />);
    expect(screen.getByText(/good standing/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// The core "two views, two logics" claim — same data, two orderings
// ---------------------------------------------------------------------------

describe('two-lens principle — same data, reversed orderings', () => {
  it('IT/OT-boundary (High, 0A) and RM-04 (Critical, 0B) appear in OPPOSITE order across the two lenses', () => {
    const rec = makeRecord({
      'L0-it-ot-boundary': q(L0_STATE.INCOMPLETE_OUTDATED),  // High, 0A
      'RM-04':             { state: L0_STATE.PROCESS_ABSENT }, // Critical, 0B
    });
    const result = computeLayer0(rec);

    // Reference lens: grouped by 0A/0B → it-ot-boundary (0A) before RM-04 (0B)
    const ref = render(
      <Layer0ReferenceView layer0Result={result} inputs={rec.layer0} onItemChange={noop} />
    );
    const refItOt = textIndex(ref.container, 'Controlled IT/OT boundary separation');
    const refRm04 = textIndex(ref.container, 'Vulnerability Remediation Rate');
    expect(refItOt).toBeLessThan(refRm04);   // 0A before 0B

    // Action lens: ranked by severity → RM-04 (Critical) before it-ot-boundary (High)
    const act = render(<Layer0ActionPanel actionFlags={result.actionFlags} />);
    const actItOt = textIndex(act.container, 'Controlled IT/OT boundary separation');
    const actRm04 = textIndex(act.container, 'Vulnerability Remediation Rate');
    expect(actRm04).toBeLessThan(actItOt);   // Critical before High

    // The orderings are genuinely reversed between the two lenses
    expect(refItOt < refRm04).toBe(true);
    expect(actRm04 < actItOt).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Asset-inventory contextual note — renders on that item only
// ---------------------------------------------------------------------------

describe('asset-inventory contextual note rendering', () => {
  it('contextual note renders in the action panel for a flagged asset-inventory item', () => {
    const rec = makeRecord({ 'L0-asset-inventory': q(L0_STATE.MISSING) });
    const { actionFlags } = computeLayer0(rec);
    render(<Layer0ActionPanel actionFlags={actionFlags} />);
    expect(screen.getByText(/consider addressing first/i)).toBeInTheDocument();
  });

  it('no contextual note renders when only OTHER items are flagged', () => {
    const rec = makeRecord({
      'L0-it-ot-boundary': q(L0_STATE.MISSING),   // Critical, but not asset-inventory
      'L0-bc-plan-doc':    q(L0_STATE.MISSING),
    });
    const { actionFlags } = computeLayer0(rec);
    render(<Layer0ActionPanel actionFlags={actionFlags} />);
    expect(screen.queryByText(/consider addressing first/i)).toBeNull();
  });

  it('contextual note appears exactly once even with many flags present', () => {
    const rec = makeRecord({
      'L0-asset-inventory': q(L0_STATE.MISSING),
      'L0-risk-assessment': q(L0_STATE.MISSING),
      'L0-it-ot-boundary':  q(L0_STATE.MISSING),
      'L0-bc-plan-doc':     q(L0_STATE.MISSING),
    });
    const { actionFlags } = computeLayer0(rec);
    render(<Layer0ActionPanel actionFlags={actionFlags} />);
    expect(screen.getAllByText(/consider addressing first/i)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Context-only non-event — in reference view, not in action panel
// ---------------------------------------------------------------------------

describe('context-only non-event across the two lenses', () => {
  it('RM-04 no_qualifying_vulnerability renders in reference view but NOT in action panel', () => {
    const rec = makeRecord({
      'RM-04':             { state: L0_STATE.NO_QUALIFYING_VULNERABILITY },  // context-only
      'L0-asset-inventory': q(L0_STATE.MISSING),                             // a real flag, so panel is non-empty
    });
    const result = computeLayer0(rec);

    // Reference view: RM-04 card is present (item always shown)
    const ref = render(
      <Layer0ReferenceView layer0Result={result} inputs={rec.layer0} onItemChange={noop} />
    );
    expect(within(ref.container).getByText('Vulnerability Remediation Rate')).toBeInTheDocument();

    // Action panel: RM-04 must NOT appear (neutral non-event, no flag)
    const act = render(<Layer0ActionPanel actionFlags={result.actionFlags} />);
    expect(within(act.container).queryByText('Vulnerability Remediation Rate')).toBeNull();
    // But the genuine flag (asset inventory) does appear
    expect(within(act.container).getByText('Asset inventory maintained')).toBeInTheDocument();
  });

  it('RM-05 no_remediated_vulnerabilities renders in reference view but NOT in action panel', () => {
    const rec = makeRecord({
      'RM-05':             { state: L0_STATE.NO_REMEDIATED_VULNERABILITIES },
      'L0-bc-plan-doc':    q(L0_STATE.MISSING),
    });
    const result = computeLayer0(rec);

    const ref = render(
      <Layer0ReferenceView layer0Result={result} inputs={rec.layer0} onItemChange={noop} />
    );
    expect(within(ref.container).getByText('Mean Time to Remediate')).toBeInTheDocument();

    const act = render(<Layer0ActionPanel actionFlags={result.actionFlags} />);
    expect(within(act.container).queryByText('Mean Time to Remediate')).toBeNull();
  });
});
