/**
 * UI tests — light, as specified.
 * Covers only the four listed behaviours:
 *   1. Selecting a state shows/hides the correct input fields.
 *   2. Each indicator's dropdown offers only its allowed states.
 *   3. Displayed IH/BC/Overall match the engine output for the same inputs.
 *   4. Incomplete dimensions render as "Incomplete," not a number or blank.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import IndicatorInput from './IndicatorInput.jsx';
import MeasureCard from './MeasureCard.jsx';
import { INDICATORS, STATE, STATE_LABELS, IH_INDICATOR_IDS } from '../data/indicatorDefinitions.js';
import { computeAssessment, createBlankAssessment } from '../engine/scoring.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function noop() {}

function renderIndicator(id, input = { state: null }, result = { score: null, derivedPct: null }) {
  return render(
    <IndicatorInput
      indicatorId={id}
      input={input}
      result={result}
      onChange={noop}
    />
  );
}

// ─── 1. State selector shows/hides value input fields ─────────────────────────

describe('state selector shows/hides value fields', () => {
  it('no state selected → no value input visible', () => {
    renderIndicator('IH-06', { state: null, value: '' });
    expect(screen.queryByPlaceholderText(/e\.g\./i)).toBeNull();
    expect(screen.queryByLabelText(/value/i)).toBeNull();
  });

  it('state = measured (single-value indicator) → value field appears', () => {
    renderIndicator('IH-06', { state: STATE.MEASURED, value: '' });
    expect(screen.getByPlaceholderText(/e\.g\. 4\.5/i)).toBeInTheDocument();
  });

  it('state = measured (ratio indicator) → numerator and denominator fields appear', () => {
    renderIndicator('BC-04', {
      state: STATE.MEASURED, numerator: '', denominator: '',
    });
    expect(screen.getByPlaceholderText('numerator')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('denominator')).toBeInTheDocument();
  });

  it('state = not_measurable → value field hidden', () => {
    renderIndicator('IH-06', { state: STATE.NOT_MEASURABLE, value: '' });
    expect(screen.queryByPlaceholderText(/e\.g\./i)).toBeNull();
  });

  it('state = capability_absent → value field hidden', () => {
    renderIndicator('IH-07', { state: STATE.CAPABILITY_ABSENT, value: '' });
    expect(screen.queryByPlaceholderText(/e\.g\./i)).toBeNull();
  });

  it('state switches from measured to no_qualifying_event → value field disappears', () => {
    const { rerender } = renderIndicator('IH-08', { state: STATE.MEASURED, value: '5' });
    expect(screen.getByPlaceholderText(/e\.g\. 5/i)).toBeInTheDocument();
    rerender(
      <IndicatorInput
        indicatorId="IH-08"
        input={{ state: STATE.NO_QUALIFYING_EVENT, value: '' }}
        result={{ score: null, derivedPct: null }}
        onChange={noop}
      />
    );
    expect(screen.queryByPlaceholderText(/e\.g\./i)).toBeNull();
  });
});

// ─── 2. Dropdown offers only allowed states ───────────────────────────────────

describe('dropdown offers only allowed states per indicator', () => {
  it('IH-06 dropdown includes capability_absent and not no_thresholds_defined', () => {
    renderIndicator('IH-06', { state: null, value: '' });
    const select = screen.getByRole('combobox');
    const options = Array.from(select.options).map(o => o.value).filter(Boolean);
    expect(options).toContain(STATE.CAPABILITY_ABSENT);
    expect(options).not.toContain(STATE.NO_THRESHOLDS_DEFINED);
    expect(options).not.toContain(STATE.NO_RTO_DEFINED);
  });

  it('BC-04 dropdown includes no_thresholds_defined and not capability_absent', () => {
    renderIndicator('BC-04', { state: null, numerator: '', denominator: '' });
    const select = screen.getByRole('combobox');
    const options = Array.from(select.options).map(o => o.value).filter(Boolean);
    expect(options).toContain(STATE.NO_THRESHOLDS_DEFINED);
    expect(options).not.toContain(STATE.CAPABILITY_ABSENT);
  });

  it('BC-08 dropdown includes no_rto_defined and not capability_absent', () => {
    renderIndicator('BC-08', { state: null, numerator: '', denominator: '' });
    const select = screen.getByRole('combobox');
    const options = Array.from(select.options).map(o => o.value).filter(Boolean);
    expect(options).toContain(STATE.NO_RTO_DEFINED);
    expect(options).not.toContain(STATE.CAPABILITY_ABSENT);
  });

  it('BC-01 dropdown has exactly measured/no_qualifying_disruption/not_measurable', () => {
    renderIndicator('BC-01', { state: null, value: '' });
    const select = screen.getByRole('combobox');
    const options = Array.from(select.options).map(o => o.value).filter(Boolean);
    expect(options).toHaveLength(3);
    expect(options).toContain(STATE.MEASURED);
    expect(options).toContain(STATE.NO_QUALIFYING_DISRUPTION);
    expect(options).toContain(STATE.NOT_MEASURABLE);
    expect(options).not.toContain(STATE.CAPABILITY_ABSENT);
  });

  it('all indicators: dropdown option count matches allowedStates length', () => {
    const ALL_IDS = [...IH_INDICATOR_IDS, 'BC-01', 'BC-02', 'BC-04', 'BC-08', 'BC-09'];
    for (const id of ALL_IDS) {
      const def = INDICATORS[id];
      const input = def.inputType === 'ratio'
        ? { state: null, numerator: '', denominator: '' }
        : { state: null, value: '' };
      const { unmount } = renderIndicator(id, input);
      const select = screen.getByRole('combobox');
      // options include the placeholder "— select —" (value=""), so subtract 1
      const realOptions = Array.from(select.options).filter(o => o.value !== '');
      expect(realOptions).toHaveLength(def.allowedStates.length);
      unmount();
    }
  });
});

// ─── 3. Displayed scores match engine output ──────────────────────────────────

describe('displayed scores match engine output', () => {
  it('IH measure card shows engine IH score', () => {
    const assessment = createBlankAssessment();
    const indicators = {
      ...assessment.indicators,
      'IH-06': { state: STATE.MEASURED, value: '4' },   // score 4
      'IH-07': { state: STATE.MEASURED, value: '12' },  // score 3
      'IH-08': { state: STATE.MEASURED, value: '96' },  // score 2
    };
    const record = { ...assessment, indicators };
    const results = computeAssessment(record);

    // Verify engine result first (not a UI assertion — pinning the contract)
    expect(results.ih.score).toBeCloseTo(3, 10);
    expect(results.ih.incomplete).toBe(false);

    const { container } = render(
      <MeasureCard
        title="Incident Handling"
        subtitle=""
        indicatorIds={IH_INDICATOR_IDS}
        inputs={indicators}
        results={results.indicators}
        dimensionResult={results.ih}
        onIndicatorChange={noop}
      />
    );

    // The dimension score badge is in the header (first child). Scope within it
    // so we don't confuse it with per-indicator score badges (which can also show "3").
    const header = container.firstChild.firstChild;  // header div
    // Scores now render with exactly 2 decimals (Change 3): 3.00, not 3.
    const headerText = within(header).getAllByText('3.00');
    expect(headerText.length).toBeGreaterThanOrEqual(1);
    // The "Good" level label should also be present in the header
    expect(within(header).getByText('Good')).toBeInTheDocument();
  });
});

// ─── 4. Incomplete dimensions render as "Incomplete" ──────────────────────────

describe('incomplete dimension rendering', () => {
  it('incomplete IH dimension shows "Incomplete" text, not a number', () => {
    const assessment = createBlankAssessment();
    const indicators = {
      ...assessment.indicators,
      'IH-06': { state: STATE.MEASURED, value: '4' },
      'IH-07': { state: STATE.NOT_MEASURABLE },
      'IH-08': { state: STATE.MEASURED, value: '4' },
    };
    const record = { ...assessment, indicators };
    const results = computeAssessment(record);

    expect(results.ih.incomplete).toBe(true);

    render(
      <MeasureCard
        title="Incident Handling"
        subtitle=""
        indicatorIds={IH_INDICATOR_IDS}
        inputs={indicators}
        results={results.indicators}
        dimensionResult={results.ih}
        onIndicatorChange={noop}
      />
    );

    // "Incomplete — one or more indicators unscored" is rendered in the header
    expect(screen.getByText(/incomplete/i)).toBeInTheDocument();
    // ScoreBadge for a null score renders "N/A"; getAllByText because per-indicator
    // unset slots also render N/A
    expect(screen.getAllByText('N/A').length).toBeGreaterThanOrEqual(1);
    // No computed dimension score should appear as a decimal
    expect(screen.queryByText('2.67')).toBeNull();
    expect(screen.queryByText('2.6')).toBeNull();
  });
});
