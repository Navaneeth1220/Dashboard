/**
 * Cross-indicator advisory rendering tests — Stage 3b-iii (§5).
 * Confirms placement + distinctness of Rules A, B, C, D in the rendered UI.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import IndicatorInput from './IndicatorInput.jsx';
import CrossIndicatorPanel from './CrossIndicatorPanel.jsx';
import Layer0ActionPanel from './Layer0ActionPanel.jsx';
import { computeCrossIndicator } from '../engine/crossIndicator.js';
import { computeAssessment, createBlankAssessment } from '../engine/scoring.js';
import { computeLayer0, createBlankLayer0 } from '../engine/layer0.js';
import { L0_STATE } from '../data/layer0Definitions.js';
import { computePairFindings, PAIR_FINDINGS_TEXT } from '../data/pairFindings.js';

function noop() {}

function fullRecord(indicatorOverrides = {}, layer0Overrides = {}) {
  const blank = createBlankAssessment();
  return {
    ...blank,
    indicators: { ...blank.indicators, ...indicatorOverrides },
    layer0: { ...createBlankLayer0(), ...layer0Overrides },
  };
}

function crossOf(record) {
  return computeCrossIndicator(record, computeAssessment(record), computeLayer0(record));
}

// ===========================================================================
// Rule A — IH dependency notes inline on the target indicator
// ===========================================================================

describe('Rule A — IH dependency notes', () => {
  it('renders a hard note on the target indicator (IH-08)', () => {
    const rec = fullRecord({ 'IH-06': { state: 'measured', value: '300' } });  // score 1 < 3 → hard notes
    const cross = crossOf(rec);
    const ih08Notes = cross.ihDependencyNotes.filter(n => n.target === 'IH-08');

    const { container } = render(
      <IndicatorInput indicatorId="IH-08" input={{ state: 'measured', value: '5' }}
        result={{ score: 4 }} onChange={noop} aNotes={ih08Notes} dHint={null} />
    );
    const note = container.querySelector('[data-advisory="ruleA-note"]');
    expect(note).not.toBeNull();
    expect(note.getAttribute('data-note-severity')).toBe('hard');
    expect(note.textContent).toMatch(/limited value while detection remains slow/i);
  });

  it('hard and soft notes render with different weight markers', () => {
    // IH-08 gets a hard note (from IH-06<3) and a soft note (from IH-07<2)
    const rec = fullRecord({
      'IH-06': { state: 'measured', value: '300' },   // score 1
      'IH-07': { state: 'measured', value: '100' },   // score 1 (<2)
    });
    const cross = crossOf(rec);
    const ih08Notes = cross.ihDependencyNotes.filter(n => n.target === 'IH-08');
    expect(ih08Notes).toHaveLength(2);

    const { container } = render(
      <IndicatorInput indicatorId="IH-08" input={{ state: 'measured', value: '5' }}
        result={{ score: 4 }} onChange={noop} aNotes={ih08Notes} dHint={null} />
    );
    const notes = container.querySelectorAll('[data-advisory="ruleA-note"]');
    expect(notes.length).toBe(2);
    const severities = Array.from(notes).map(n => n.getAttribute('data-note-severity')).sort();
    expect(severities).toEqual(['hard', 'soft']);
    // hard is heavier (bolder) than soft
    const hard = Array.from(notes).find(n => n.getAttribute('data-note-severity') === 'hard');
    const soft = Array.from(notes).find(n => n.getAttribute('data-note-severity') === 'soft');
    expect(Number(hard.style.fontWeight)).toBeGreaterThan(Number(soft.style.fontWeight || '400'));
  });

  it('no notes → nothing rendered', () => {
    const { container } = render(
      <IndicatorInput indicatorId="IH-08" input={{ state: 'measured', value: '5' }}
        result={{ score: 4 }} onChange={noop} aNotes={[]} dHint={null} />
    );
    expect(container.querySelector('[data-advisory="ruleA-note"]')).toBeNull();
  });
});

// ===========================================================================
// Rule B — interpretive pairs + single auto-sentence
// ===========================================================================

describe('Rule B — interpretive pairs (relative-comparison findings)', () => {
  const ALL_MEMBERS = ['IH-08', 'BC', 'BC-01', 'BC-02', 'BC-08', 'BC-09', 'RM-04', 'RM-05'];
  function panelFor(record, membersWithData = ALL_MEMBERS) {
    const cross = crossOf(record);
    const results = computeAssessment(record);
    const layer0 = computeLayer0(record);
    const pairFindings = computePairFindings(results, layer0, record);
    return render(
      <CrossIndicatorPanel
        interpretivePairs={cross.interpretivePairs}
        architectureAdvisories={cross.architectureAdvisories}
        membersWithData={membersWithData}
        pairFindings={pairFindings}
      />
    );
  }

  it('Mean Time to Contain ↔ BC auto-sentence still fires unchanged', () => {
    const rec = fullRecord({
      'IH-08': { state: 'measured', value: '4' },                       // score 4
      'BC-01': { state: 'measured', value: '5' },                       // score 1
      'BC-02': { state: 'measured', value: '10' },// score 1
      'BC-04': { state: 'measured', numerator: '6', denominator: '10' },// score 0
      'BC-08': { state: 'measured', numerator: '1', denominator: '10' },// score 1
      'BC-09': { state: 'measured', numerator: '1', denominator: '10' },// score 1
    });
    const { container } = panelFor(rec);
    const sentences = container.querySelectorAll('[data-advisory="ruleB-sentence"]');
    expect(sentences.length).toBe(1);
    expect(sentences[0].textContent).toMatch(/operationally costly/i);
  });

  it('percent pair roughly equal (≤10pp) → hidden, no card rendered', () => {
    const rec = fullRecord({
      'BC-08': { state: 'measured', numerator: '90', denominator: '100' },
      'BC-09': { state: 'measured', numerator: '85', denominator: '100' },   // 5pp gap
    });
    expect(panelFor(rec).container.querySelector('[data-pair="BC08_BC09"]')).toBeNull();
  });

  it('percent pair 10pp boundary: exactly 10.0 not fired, 10.1 fired', () => {
    const eq = fullRecord({
      'BC-08': { state: 'measured', numerator: '900', denominator: '1000' },  // 90.0
      'BC-09': { state: 'measured', numerator: '800', denominator: '1000' },  // 80.0 → gap 10.0
    });
    expect(panelFor(eq).container.querySelector('[data-pair="BC08_BC09"]')).toBeNull();

    const gt = fullRecord({
      'BC-08': { state: 'measured', numerator: '901', denominator: '1000' },  // 90.1
      'BC-09': { state: 'measured', numerator: '800', denominator: '1000' },  // 80.0 → gap 10.1
    });
    expect(panelFor(gt).container.querySelector('[data-advisory="ruleB-finding"][data-pair="BC08_BC09"]')).not.toBeNull();
  });

  it('percent pair finding shows both values, the higher direction, and the centralised text verbatim', () => {
    const rec = fullRecord({
      'BC-08': { state: 'measured', numerator: '95', denominator: '100' },   // 95%
      'BC-09': { state: 'measured', numerator: '50', denominator: '100' },   // 50% → BC-08 higher
    });
    const f = panelFor(rec).container.querySelector('[data-advisory="ruleB-finding"][data-pair="BC08_BC09"]');
    expect(f).not.toBeNull();
    expect(f.textContent).toContain('95%');
    expect(f.textContent).toContain('50%');
    expect(f.textContent).toMatch(/RTO Achievement Rate higher/i);
    expect(f.textContent).toContain(PAIR_FINDINGS_TEXT.BC08_BC09['BC-08']);   // verbatim from the map
  });

  it('one side unscored → fallback line naming the unscored member, no finding', () => {
    const rec = fullRecord({
      'BC-08': { state: 'measured', numerator: '95', denominator: '100' },
      'BC-09': { state: 'not_measurable' },
    });
    const { container } = panelFor(rec);
    const fb = container.querySelector('[data-advisory="ruleB-fallback"][data-pair="BC08_BC09"]');
    expect(fb).not.toBeNull();
    expect(fb.textContent).toMatch(/RPO Achievement Rate isn't scored this period/i);
    expect(container.querySelector('[data-advisory="ruleB-finding"][data-pair="BC08_BC09"]')).toBeNull();
  });

  it('RM pair fires on a different score band (not a % gap)', () => {
    const rec = fullRecord({}, {
      'RM-04': { state: 'measured', numerator: '95', denominator: '100' },   // 95% → band 4
      'RM-05': { state: 'measured', value: '400' },                          // 400 days → band 0
    });
    const f = panelFor(rec).container.querySelector('[data-advisory="ruleB-finding"][data-pair="RM04_RM05"]');
    expect(f).not.toBeNull();
    expect(f.textContent).toContain(PAIR_FINDINGS_TEXT.RM04_RM05['RM-04']);
  });

  it('RM pair same score band → hidden', () => {
    const rec = fullRecord({}, {
      'RM-04': { state: 'measured', numerator: '95', denominator: '100' },   // band 4
      'RM-05': { state: 'measured', value: '20' },                           // 20 days → band 4
    });
    expect(panelFor(rec).container.querySelector('[data-pair="RM04_RM05"]')).toBeNull();
  });

  it('regression: measured RTO + "No RPO defined" (programme-gap zero) → fallback, NO crash', () => {
    // BC-08 measured (has a %), BC-09 No RPO defined (score 0 but NO measured %).
    const rec = fullRecord({
      'BC-08': { state: 'measured', numerator: '1', denominator: '2' },   // 50%
      'BC-09': { state: 'no_rpo_defined' },                               // score 0, no %
    });
    // Must not throw while building findings (the blank-screen bug)
    const results = computeAssessment(rec);
    const layer0 = computeLayer0(rec);
    expect(() => computePairFindings(results, layer0, rec)).not.toThrow();

    const { container } = panelFor(rec);
    // Renders a fallback for the pair, never a finding, and does not blank out
    expect(container.querySelector('[data-advisory="ruleB-fallback"][data-pair="BC08_BC09"]')).not.toBeNull();
    expect(container.querySelector('[data-advisory="ruleB-finding"][data-pair="BC08_BC09"]')).toBeNull();
    expect(screen.getByText(/RPO Achievement Rate isn't scored this period/i)).toBeInTheDocument();
  });

  it('regression: the reverse — measured RPO + "No RTO defined" → fallback, no crash', () => {
    const rec = fullRecord({
      'BC-08': { state: 'no_rto_defined' },
      'BC-09': { state: 'measured', numerator: '1', denominator: '2' },
    });
    const results = computeAssessment(rec);
    const layer0 = computeLayer0(rec);
    expect(() => computePairFindings(results, layer0, rec)).not.toThrow();
    const { container } = panelFor(rec);
    expect(container.querySelector('[data-advisory="ruleB-fallback"][data-pair="BC08_BC09"]')).not.toBeNull();
    expect(screen.getByText(/RTO Achievement Rate isn't scored this period/i)).toBeInTheDocument();
  });

  it('all pairs equal/empty AND no architecture → one quiet whole-panel line, no subsection heading', () => {
    const rec = fullRecord({});
    const { container } = panelFor(rec, []);
    expect(container.querySelector('[data-cross-empty]')).not.toBeNull();
    expect(screen.getByText(/No cross-indicator findings for this assessment/i)).toBeInTheDocument();
    expect(screen.queryByText(/Interpretive pairs/i)).toBeNull();
  });
});

// ===========================================================================
// Rule C — architecture advisories, distinct from Stage 2 action flags
// ===========================================================================

describe('Rule C — architecture advisories', () => {
  it('renders advisory with "may be related" interpretive framing + cross-layer marker', () => {
    const rec = fullRecord(
      { 'IH-08': { state: 'measured', value: '96' } },   // score 2 = poor
      { 'L0-it-ot-boundary': { state: L0_STATE.MISSING } }
    );
    const cross = crossOf(rec);
    const { container } = render(
      <CrossIndicatorPanel interpretivePairs={cross.interpretivePairs}
        architectureAdvisories={cross.architectureAdvisories} membersWithData={['IH-08']} />
    );
    const adv = container.querySelector('[data-advisory="ruleC"]');
    expect(adv).not.toBeNull();
    expect(adv.getAttribute('data-advisory-kind')).toBe('cross_layer_interpretive');
    expect(adv.getAttribute('data-framing')).toBe('may_be_related');
    expect(adv.getAttribute('data-cross-layer')).toBe('true');
    // "may be related" appears both in the badge AND the message body — assert ≥1
    expect(within(adv).getAllByText(/May be related/i).length).toBeGreaterThanOrEqual(1);
  });

  it('Rule C advisory is VISUALLY DISTINCT from a Stage 2 Layer 0 action flag for the SAME item', () => {
    const rec = fullRecord(
      { 'IH-08': { state: 'measured', value: '96' } },   // score 2 poor
      { 'L0-it-ot-boundary': { state: L0_STATE.MISSING } }
    );
    const cross = crossOf(rec);
    const layer0 = computeLayer0(rec);

    // Stage 2 action flag for the same item
    const flagPanel = render(<Layer0ActionPanel actionFlags={layer0.actionFlags} />);
    // It uses an uppercase severity badge ("CRITICAL"/"Critical") — the imperative register
    expect(within(flagPanel.container).getByText('Critical')).toBeInTheDocument();

    // Rule C advisory for the same item
    const cipanel = render(
      <CrossIndicatorPanel interpretivePairs={cross.interpretivePairs}
        architectureAdvisories={cross.architectureAdvisories} membersWithData={['IH-08']} />
    );
    const adv = cipanel.container.querySelector('[data-advisory="ruleC"]');
    // The Rule C advisory carries the interpretive markers the action flag does NOT
    expect(adv.getAttribute('data-advisory-kind')).toBe('cross_layer_interpretive');
    // ...and does NOT render an uppercase Critical severity badge of the action-flag kind
    expect(within(adv).queryByText('Critical')).toBeNull();
    // The teaching caption is present, explicitly separating the two
    expect(screen.getByText(/hypotheses, not action items/i)).toBeInTheDocument();
  });

  it('side-by-side architecture↔outcome row always renders even when advisory is null (good score)', () => {
    const rec = fullRecord(
      { 'IH-08': { state: 'measured', value: '4' } },    // score 4 = good → no advisory
      { 'L0-it-ot-boundary': { state: L0_STATE.MISSING } }
    );
    const cross = crossOf(rec);
    const { container } = render(
      <CrossIndicatorPanel interpretivePairs={cross.interpretivePairs}
        architectureAdvisories={cross.architectureAdvisories} membersWithData={['IH-08']} />
    );
    // The rows exist (side-by-side shown for each related outcome) but no advisory box
    expect(screen.getAllByText(/Controlled IT\/OT boundary separation:/i).length).toBeGreaterThanOrEqual(1);
    expect(container.querySelector('[data-advisory="ruleC"]')).toBeNull();
  });

  it('blank assessment → whole-panel quiet line (no architecture rows, no findings)', () => {
    const rec = fullRecord({});
    const cross = crossOf(rec);
    const { container } = render(
      <CrossIndicatorPanel interpretivePairs={cross.interpretivePairs}
        architectureAdvisories={cross.architectureAdvisories} membersWithData={[]} pairFindings={[]} />
    );
    expect(container.querySelector('[data-cross-empty]')).not.toBeNull();
    expect(screen.getByText(/No cross-indicator findings for this assessment/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// Rule D — BC plan hints inline, never auto-filling
// ===========================================================================

describe('Rule D — BC plan hints', () => {
  it('renders the hint inline next to BC-08 and does NOT change the select value', () => {
    const rec = fullRecord({}, { 'L0-bc-plan-doc': { state: L0_STATE.MISSING } });
    const cross = crossOf(rec);
    const dHint = cross.bcPlanHints.find(h => h.targetIndicatorId === 'BC-08');

    const { container } = render(
      <IndicatorInput indicatorId="BC-08"
        input={{ state: null, numerator: '', denominator: '' }}   // assessor has NOT selected anything
        result={{ score: null }} onChange={noop} aNotes={[]} dHint={dHint} />
    );

    const hint = container.querySelector('[data-advisory="ruleD-hint"]');
    expect(hint).not.toBeNull();
    expect(hint.textContent).toMatch(/No RTO defined/i);
    expect(hint.textContent).toMatch(/You still choose/i);

    // The select is NOT auto-selected — still on the placeholder
    const select = container.querySelector('select');
    expect(select.value).toBe('');
  });

  it('plan Present → no hint rendered', () => {
    const rec = fullRecord({}, { 'L0-bc-plan-doc': { state: L0_STATE.PRESENT } });
    const cross = crossOf(rec);
    const dHint = cross.bcPlanHints.find(h => h.targetIndicatorId === 'BC-09');
    const { container } = render(
      <IndicatorInput indicatorId="BC-09" input={{ state: null, numerator: '', denominator: '' }}
        result={{ score: null }} onChange={noop} aNotes={[]} dHint={dHint} />
    );
    expect(container.querySelector('[data-advisory="ruleD-hint"]')).toBeNull();
  });

  it('hint severity grades with plan state (incomplete → softer)', () => {
    const rec = fullRecord({}, { 'L0-bc-plan-doc': { state: L0_STATE.INCOMPLETE_OUTDATED } });
    const cross = crossOf(rec);
    const dHint = cross.bcPlanHints.find(h => h.targetIndicatorId === 'BC-08');
    const { container } = render(
      <IndicatorInput indicatorId="BC-08" input={{ state: null, numerator: '', denominator: '' }}
        result={{ score: null }} onChange={noop} aNotes={[]} dHint={dHint} />
    );
    const hint = container.querySelector('[data-advisory="ruleD-hint"]');
    expect(hint.getAttribute('data-hint-severity')).toBe('softer');
  });
});
