/**
 * Timeline report — pure render of computeTimeline output.
 *   Part 1: N−1 consecutive-pair comparison blocks (existing ComparisonReport verbatim).
 *   Part 2: per-indicator trajectory across all N points, honouring no-score vs score-0.
 * Full names (displayName), 2-decimal scores (formatScore), no IDs.
 */

import { INDICATORS, STATE_PRIORITY_LABELS, ALL_INDICATOR_IDS } from '../data/indicatorDefinitions.js';
import { displayName, formatScore } from '../data/displayNames.js';
import ComparisonReport from './ComparisonReport.jsx';

function formatRaw(v) {
  return String(parseFloat(Number(v).toFixed(2)));
}
function rawValueLabel(id, v) {
  return INDICATORS[id]?.unit === 'hours' ? `${formatRaw(v)}h` : `${formatRaw(v)}%`;
}
function stateLabel(state) {
  return STATE_PRIORITY_LABELS[state]?.chip ?? state ?? 'not entered';
}

const card = {
  border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: '#fff',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: '14px',
};

// ── One trajectory point (value chunk + score chunk) ─────────────────────────

function valueChunkText(id, p) {
  if (p.kind === 'measured') return rawValueLabel(id, p.value);
  if (p.kind === 'gap_zero') return `0 (${stateLabel(p.state)})`;   // score 0 is a real value
  return stateLabel(p.state);                                       // no_score → NO number
}
function scoreChunkText(p) {
  if (p.kind === 'no_score') return '—';                            // no score
  return formatScore(p.score);                                     // measured / gap_zero (0.00)
}

function TrajectoryRow({ id, points }) {
  return (
    <div data-traj-indicator={id} style={{
      padding: '8px 12px', borderRadius: '6px', backgroundColor: '#f9fafb',
      border: '1px solid #e5e7eb', marginBottom: '6px',
    }}>
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', marginBottom: '3px' }}>
        {displayName(id)}
      </div>
      {/* Value sequence */}
      <div data-traj-values style={{ fontSize: '12px', color: '#374151' }}>
        {points.map((p, i) => (
          <span key={i}>
            {i > 0 && <span style={{ color: '#9ca3af', margin: '0 5px' }}>→</span>}
            <span
              data-traj-point
              data-point-kind={p.kind}
              data-step={i}
              style={{
                color: p.kind === 'no_score' ? '#6b7280' : p.kind === 'gap_zero' ? '#b45309' : '#111827',
                fontStyle: p.kind === 'no_score' ? 'italic' : 'normal',
              }}
            >
              {valueChunkText(id, p)}
            </span>
          </span>
        ))}
      </div>
      {/* Score sequence */}
      <div data-traj-scores style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
        score:{' '}
        {points.map((p, i) => (
          <span key={i}>
            {i > 0 && <span style={{ margin: '0 5px' }}>→</span>}
            <span data-traj-score-point data-step={i}>{scoreChunkText(p)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function TimelineReport({ timeline }) {
  const { steps, blocks, trajectory, clientMismatch } = timeline;

  return (
    <div>
      {/* Header + step order */}
      <div style={card}>
        <div style={{ padding: '14px 16px', backgroundColor: '#0f2d52', color: '#fff' }}>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>Timeline — {steps.length} assessments</div>
          <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '4px' }}>
            {steps.map((s, i) => (
              <span key={i} data-timeline-step={i}>
                {i > 0 && <span style={{ opacity: 0.6 }}> → </span>}
                {s.label}
              </span>
            ))}
          </div>
        </div>
        {clientMismatch && (
          <div data-timeline-mismatch style={{
            padding: '8px 16px', backgroundColor: '#fffbeb', color: '#b45309',
            fontSize: '12px', borderTop: '1px solid #fde68a',
          }}>
            ⚠ These assessments are for different clients — a timeline across different clients may not be meaningful.
          </div>
        )}
      </div>

      {/* Part 2 — trajectory (at-a-glance sequence) */}
      <div style={card}>
        <div style={{ padding: '12px 16px', backgroundColor: '#1e3a5f', color: '#fff' }}>
          <div style={{ fontWeight: 700, fontSize: '14px' }}>Per-indicator trajectory</div>
          <div style={{ fontSize: '11px', opacity: 0.75, marginTop: '2px' }}>
            Each point reflects that assessment's state — a missing measurement is never shown as a number.
          </div>
        </div>
        <div style={{ padding: '12px 16px' }}>
          {ALL_INDICATOR_IDS.map(id => (
            <TrajectoryRow key={id} id={id} points={trajectory[id]} />
          ))}
        </div>
      </div>

      {/* Part 1 — consecutive-pair comparison blocks */}
      {blocks.map((b, i) => (
        <div key={i} data-timeline-block={i} style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f2d52', margin: '4px 0 8px' }}>
            Step {b.fromIndex + 1} → {b.toIndex + 1}: {b.fromLabel} → {b.toLabel}
          </div>
          <ComparisonReport comparison={b.comparison} />
        </div>
      ))}
    </div>
  );
}
