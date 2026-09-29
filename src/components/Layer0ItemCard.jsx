import { LAYER0_ITEMS, L0_SEVERITY, L0_SEVERITY_LABELS } from '../data/layer0Definitions.js';
import { INDICATOR_INFO } from '../data/indicatorInfo.js';
import InfoIcon from './InfoIcon.jsx';

const SEVERITY_COLORS = {
  [L0_SEVERITY.CRITICAL]:    { bg: '#7f1d1d', text: '#fff', label: L0_SEVERITY_LABELS[L0_SEVERITY.CRITICAL] },
  [L0_SEVERITY.HIGH]:        { bg: '#9a3412', text: '#fff', label: L0_SEVERITY_LABELS[L0_SEVERITY.HIGH] },
  [L0_SEVERITY.MEDIUM_NOTE]: { bg: '#92400e', text: '#fff', label: L0_SEVERITY_LABELS[L0_SEVERITY.MEDIUM_NOTE] },
  [L0_SEVERITY.MONITOR]:     { bg: '#1e40af', text: '#fff', label: L0_SEVERITY_LABELS[L0_SEVERITY.MONITOR] },
};
const HEALTHY_COLOR = { bg: '#14532d', text: '#fff', label: 'OK' };

const SCORE_LEVEL = { 4: 'Excellent', 3: 'Good', 2: 'Developing', 1: 'Initial', 0: 'None' };

const inputStyle = {
  padding: '5px 8px',
  border: '1px solid #d1d5db',
  borderRadius: '4px',
  fontSize: '12px',
  width: '100%',
  boxSizing: 'border-box',
  backgroundColor: '#fff',
};

const labelStyle = { fontSize: '10px', color: '#6b7280', display: 'block', marginBottom: '2px' };

export default function Layer0ItemCard({ itemId, input, result, onChange }) {
  const def = LAYER0_ITEMS[itemId];
  const state = input?.state ?? null;
  const isMeasured = state === 'measured';

  const color = result.severity ? (SEVERITY_COLORS[result.severity] ?? HEALTHY_COLOR) : HEALTHY_COLOR;

  function handleState(e) {
    const s = e.target.value || null;
    if (def.inputType === 'ratio') onChange({ state: s, numerator: '', denominator: '' });
    else if (def.inputType === 'single_value') onChange({ state: s, value: '' });
    else onChange({ state: s });
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 140px auto',
      gap: '8px',
      alignItems: 'start',
      padding: '8px 10px',
      backgroundColor: '#f9fafb',
      borderRadius: '6px',
      border: '1px solid #e5e7eb',
    }}>
      {/* Label */}
      <div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>
          {def.name}
          <InfoIcon text={INDICATOR_INFO[def.id]} />
        </div>
        {result.processScore !== null && (
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
            Process score: {result.processScore}/4 — {SCORE_LEVEL[result.processScore]}
          </div>
        )}
        {result.derivedPct !== null && !result.invalidInput && (
          <div style={{ fontSize: '10px', color: '#9ca3af' }}>= {result.derivedPct.toFixed(1)} %</div>
        )}
        {result.invalidInput && (
          <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: 500 }}>Invalid input</div>
        )}
      </div>

      {/* State + value inputs */}
      <div>
        <label style={labelStyle}>State</label>
        <select value={state ?? ''} onChange={handleState} style={{ ...inputStyle, cursor: 'pointer' }}>
          <option value="">— select —</option>
          {def.allowedStates.map(s => (
            <option key={s} value={s}>{LAYER0_ITEMS[itemId].stateMap[s]?.label ?? s}</option>
          ))}
        </select>

        {isMeasured && def.inputType === 'ratio' && (
          <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div>
              <label style={labelStyle}>{def.numeratorLabel}</label>
              <input type="number" min="0" step="any" placeholder="numerator"
                value={input?.numerator ?? ''} onChange={e => onChange({ ...input, numerator: e.target.value })}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>{def.denominatorLabel}</label>
              <input type="number" min="0" step="any" placeholder="denominator"
                value={input?.denominator ?? ''} onChange={e => onChange({ ...input, denominator: e.target.value })}
                style={inputStyle} />
            </div>
          </div>
        )}

        {isMeasured && def.inputType === 'single_value' && (
          <div style={{ marginTop: '4px' }}>
            <label style={labelStyle}>Value ({def.valueUnit})</label>
            <input type="number" min="0" step="any" placeholder={def.valuePlaceholder}
              value={input?.value ?? ''} onChange={e => onChange({ ...input, value: e.target.value })}
              style={inputStyle} />
          </div>
        )}
      </div>

      {/* Severity badge */}
      <div style={{ textAlign: 'right', paddingTop: '14px' }}>
        {state !== null && (
          <span style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 600,
            backgroundColor: color.bg,
            color: color.text,
            whiteSpace: 'nowrap',
          }}>
            {color.label}
          </span>
        )}
      </div>
    </div>
  );
}
