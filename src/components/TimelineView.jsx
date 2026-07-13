/**
 * Timeline view — loads 2..6 assessments into slots (reusing the pure
 * parseAndValidateImport) and renders the sequential timeline. With exactly
 * 2 filled slots this is one comparison block + a 2-point trajectory (matches
 * the existing 2-way view). Orchestration only — computeComparison is untouched.
 */

import { useState, useMemo } from 'react';
import { parseAndValidateImport } from '../engine/persistence.js';
import { computeTimeline } from '../engine/timeline.js';
import TimelineReport from './TimelineReport.jsx';

const MIN_SLOTS = 2;
const MAX_SLOTS = 6;

function SlotLoader({ index, slot, onFile, onRemove, canRemove }) {
  const btn = {
    padding: '6px 14px', fontSize: '12px', backgroundColor: '#1e3a5f', color: '#fff',
    border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'inline-block',
  };
  return (
    <div data-slot={index} style={{
      flex: '1 1 220px', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: '#fff',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e3a5f' }}>Assessment {index + 1}</div>
        {canRemove && (
          <button data-remove-slot={index} onClick={onRemove}
            style={{ fontSize: '11px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>
            Remove
          </button>
        )}
      </div>
      <label style={btn}>
        Load file
        <input type="file" accept=".json,application/json" onChange={onFile} style={{ display: 'none' }} />
      </label>
      {slot.record && (
        <div data-slot-loaded={index} style={{ fontSize: '12px', color: '#14532d', marginTop: '8px' }}>
          Loaded: <strong>{slot.record.clientId || '—'}</strong> {slot.record.assessmentDate || '(undated)'}
        </div>
      )}
      {slot.error && (
        <div data-slot-error={index} style={{ fontSize: '12px', color: '#dc2626', marginTop: '8px' }}>
          {slot.error}
        </div>
      )}
    </div>
  );
}

export default function TimelineView() {
  const [slots, setSlots] = useState([{ record: null, error: null }, { record: null, error: null }]);

  function setSlot(index, patch) {
    setSlots(prev => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  async function handleFile(e, index) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let text;
    try {
      text = await file.text();
    } catch {
      setSlot(index, { error: 'Could not read the file.', record: null });
      return;
    }
    const res = parseAndValidateImport(text);
    if (!res.ok) {
      setSlot(index, { error: res.error, record: null });   // surface error, leave slot empty
      return;
    }
    setSlot(index, { error: null, record: res.data });
  }

  function addSlot() {
    setSlots(prev => (prev.length >= MAX_SLOTS ? prev : [...prev, { record: null, error: null }]));
  }
  function removeSlot(index) {
    setSlots(prev => (prev.length <= MIN_SLOTS ? prev : prev.filter((_, i) => i !== index)));
  }

  const records = slots.map(s => s.record).filter(Boolean);
  const timeline = useMemo(
    () => (records.length >= 2 ? computeTimeline(records) : null),
    [records],
  );

  return (
    <div>
      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f2d52', marginBottom: '10px' }}>
        Compare assessments over time (2–6, chronological)
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
        {slots.map((slot, i) => (
          <SlotLoader
            key={i}
            index={i}
            slot={slot}
            onFile={e => handleFile(e, i)}
            onRemove={() => removeSlot(i)}
            canRemove={slots.length > MIN_SLOTS}
          />
        ))}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <button
          data-add-slot
          onClick={addSlot}
          disabled={slots.length >= MAX_SLOTS}
          style={{
            padding: '6px 14px', fontSize: '12px', borderRadius: '4px', cursor: slots.length >= MAX_SLOTS ? 'not-allowed' : 'pointer',
            backgroundColor: slots.length >= MAX_SLOTS ? '#e5e7eb' : '#0f2d52',
            color: slots.length >= MAX_SLOTS ? '#9ca3af' : '#fff', border: 'none',
          }}
        >
          + Add assessment {slots.length >= MAX_SLOTS ? '(max 6)' : ''}
        </button>
      </div>

      {timeline
        ? <TimelineReport timeline={timeline} />
        : (
          <div data-compare-prompt style={{
            padding: '20px', textAlign: 'center', color: '#6b7280', fontSize: '13px',
            border: '1px dashed #d1d5db', borderRadius: '8px', backgroundColor: '#fff',
          }}>
            Load at least two assessments to compare (they will be ordered chronologically).
          </div>
        )}
    </div>
  );
}
