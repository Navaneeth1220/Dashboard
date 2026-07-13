/**
 * Comparison view — Stage 5-ii-UI. Owns the two comparison slots and the file
 * loading, reusing the pure parseAndValidateImport. Renders ComparisonReport
 * only once BOTH slots are filled.
 */

import { useState, useMemo } from 'react';
import { parseAndValidateImport } from '../engine/persistence.js';
import { computeComparison } from '../engine/comparison.js';
import ComparisonReport from './ComparisonReport.jsx';

function SlotLoader({ which, label, record, error, onFile }) {
  const btn = {
    padding: '6px 14px', fontSize: '12px', backgroundColor: '#1e3a5f', color: '#fff',
    border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'inline-block',
  };
  return (
    <div data-slot={which} style={{
      flex: 1, padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: '#fff',
    }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e3a5f', marginBottom: '6px' }}>{label}</div>
      <label style={btn}>
        Load file
        <input
          type="file" accept=".json,application/json"
          onChange={onFile} style={{ display: 'none' }}
        />
      </label>
      {record && (
        <div data-slot-loaded={which} style={{ fontSize: '12px', color: '#14532d', marginTop: '8px' }}>
          Loaded: <strong>{record.clientId || '—'}</strong> {record.assessmentDate || ''}
        </div>
      )}
      {error && (
        <div data-slot-error={which} style={{ fontSize: '12px', color: '#dc2626', marginTop: '8px' }}>
          {error}
        </div>
      )}
    </div>
  );
}

export default function ComparisonView() {
  const [slotA, setSlotA] = useState(null);
  const [slotB, setSlotB] = useState(null);
  const [errorA, setErrorA] = useState(null);
  const [errorB, setErrorB] = useState(null);

  async function handleFile(e, setSlot, setError) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let text;
    try {
      text = await file.text();
    } catch {
      setError('Could not read the file.');
      return;
    }
    const res = parseAndValidateImport(text);
    if (!res.ok) {
      setSlot(null);              // do not half-load
      setError(res.error);
      return;
    }
    setError(null);
    setSlot(res.data);
  }

  const comparison = useMemo(
    () => (slotA && slotB ? computeComparison(slotA, slotB) : null),
    [slotA, slotB]
  );

  return (
    <div>
      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f2d52', marginBottom: '10px' }}>
        Compare two assessments (before / after)
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <SlotLoader which="A" label="A — Before" record={slotA} error={errorA}
          onFile={e => handleFile(e, setSlotA, setErrorA)} />
        <SlotLoader which="B" label="B — After" record={slotB} error={errorB}
          onFile={e => handleFile(e, setSlotB, setErrorB)} />
      </div>

      {comparison
        ? <ComparisonReport comparison={comparison} />
        : (
          <div data-compare-prompt style={{
            padding: '20px', textAlign: 'center', color: '#6b7280', fontSize: '13px',
            border: '1px dashed #d1d5db', borderRadius: '8px', backgroundColor: '#fff',
          }}>
            Load two assessments (A = before, B = after) to compare.
          </div>
        )}
    </div>
  );
}
