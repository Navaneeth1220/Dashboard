import { INDICATORS, STATE_LABELS } from '../data/indicatorDefinitions.js';
import { INDICATOR_INFO } from '../data/indicatorInfo.js';
import ScoreBadge from './ScoreBadge.jsx';
import InfoIcon from './InfoIcon.jsx';

const inputStyle = {
  padding: '6px 10px',
  border: '1px solid #d1d5db',
  borderRadius: '4px',
  fontSize: '13px',
  width: '100%',
  boxSizing: 'border-box',
  backgroundColor: '#fff',
};

const selectStyle = {
  ...inputStyle,
  cursor: 'pointer',
};

const labelStyle = {
  fontSize: '11px',
  color: '#6b7280',
  marginBottom: '3px',
  display: 'block',
};

export default function IndicatorInput({ indicatorId, input, onChange, result, aNotes = [], dHint = null }) {
  const def = INDICATORS[indicatorId];
  const state = input?.state ?? null;
  const isMeasured = state === 'measured';

  function handleStateChange(e) {
    const newState = e.target.value || null;
    // Reset value fields when state changes away from measured
    if (def.inputType === 'ratio') {
      onChange({ state: newState, numerator: '', denominator: '' });
    } else {
      onChange({ state: newState, value: '' });
    }
  }

  function handleValueChange(field, val) {
    onChange({ ...input, [field]: val });
  }

  const score = result?.score ?? null;
  const derivedPct = result?.derivedPct ?? null;
  const isInvalidInput = result?.invalidInput === true;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '10px 12px',
      backgroundColor: '#f9fafb',
      borderRadius: '6px',
      border: '1px solid #e5e7eb',
    }}>
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr auto',
      gap: '10px',
      alignItems: 'end',
    }}>
      {/* Indicator label — full descriptive name, no ID code */}
      <div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
          {def.name}
          <InfoIcon text={INDICATOR_INFO[def.id]} />
        </div>
        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>
          {def.unit} · {def.direction === 'lower_is_better' ? '↓ lower better' : '↑ higher better'}
        </div>
      </div>

      {/* State selector */}
      <div>
        <label style={labelStyle}>State</label>
        <select
          value={state ?? ''}
          onChange={handleStateChange}
          style={selectStyle}
        >
          <option value="">— select —</option>
          {def.allowedStates.map(s => (
            <option key={s} value={s}>{STATE_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Value input(s) — only active when measured */}
      <div>
        {isMeasured && def.inputType === 'single_value' && (
          <>
            <label style={labelStyle}>Value ({def.unit})</label>
            <input
              type="number"
              min="0"
              step="any"
              placeholder={def.valuePlaceholder}
              value={input?.value ?? ''}
              onChange={e => handleValueChange('value', e.target.value)}
              style={{ ...inputStyle, borderColor: isInvalidInput ? '#dc2626' : '#d1d5db' }}
            />
            {isInvalidInput && (
              <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 500, marginTop: '2px' }}>
                Invalid input — please check value
              </div>
            )}
          </>
        )}
        {isMeasured && def.inputType === 'ratio' && (
          <div style={{ display: 'flex', gap: '6px', flexDirection: 'column' }}>
            <div>
              <label style={labelStyle}>{def.numeratorLabel}</label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="numerator"
                value={input?.numerator ?? ''}
                onChange={e => handleValueChange('numerator', e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>{def.denominatorLabel}</label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="denominator"
                value={input?.denominator ?? ''}
                onChange={e => handleValueChange('denominator', e.target.value)}
                style={inputStyle}
              />
            </div>
            {derivedPct !== null && !isInvalidInput && (
              <div style={{ fontSize: '11px', color: '#6b7280' }}>
                = {derivedPct.toFixed(1)} %
              </div>
            )}
            {isInvalidInput && (
              <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 500, marginTop: '2px' }}>
                Invalid input — please check value
              </div>
            )}
          </div>
        )}
        {!isMeasured && (
          <div style={{ color: '#9ca3af', fontSize: '12px', paddingTop: '20px', textAlign: 'center' }}>
            {state ? 'No value required' : ''}
          </div>
        )}
      </div>

      {/* Score badge */}
      <div style={{ textAlign: 'right' }}>
        {state !== null && <ScoreBadge score={score} size="sm" />}
      </div>
    </div>

    {/* Rule D — BC plan hint (guidance for the assessor's choice; never auto-fills) */}
    {dHint && dHint.hint && (
      <div
        data-advisory="ruleD-hint"
        data-hint-severity={dHint.hint.severity}
        style={{
          fontSize: '11px',
          color: '#1d4ed8',
          fontStyle: 'italic',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '4px',
          padding: '5px 8px',
        }}
      >
        <strong style={{ fontStyle: 'normal' }}>ℹ Hint:</strong> {dHint.hint.message}{' '}
        <span style={{ color: '#6b7280' }}>You still choose the state.</span>
      </div>
    )}

    {/* Rule A — IH dependency notes (interpretive caveats, not alarms) */}
    {aNotes.length > 0 && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {aNotes.map((note, i) => (
          <div
            key={i}
            data-advisory="ruleA-note"
            data-note-severity={note.severity}
            style={{
              fontSize: '11px',
              color: note.severity === 'hard' ? '#374151' : '#6b7280',
              fontWeight: note.severity === 'hard' ? 600 : 400,
              fontStyle: 'italic',
              borderLeft: `3px solid ${note.severity === 'hard' ? '#94a3b8' : '#cbd5e1'}`,
              paddingLeft: '8px',
            }}
          >
            ℹ {note.message}
          </div>
        ))}
      </div>
    )}
    </div>
  );
}
