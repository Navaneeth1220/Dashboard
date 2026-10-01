/**
 * Comparison report — Stage 5-ii-UI (renders computeComparison output).
 *
 * Pure renderer. Recomputes nothing. Tonal honesty is the whole job: each
 * transition type is worded as what it actually is, driven off `transitionType`
 * (+ `fromClass`/`capabilityTag`), never re-derived. A signed delta renders ONLY
 * on the three genuine-delta types; the five no-delta types render explicit
 * state/evidence-transition language with no number.
 */

import { INDICATORS, STATE_PRIORITY_LABELS } from '../data/indicatorDefinitions.js';
import { LAYER0_ITEMS, L0_STATE_LABELS } from '../data/layer0Definitions.js';
import { formatScore, DIMENSION_NAMES } from '../data/displayNames.js';

// ── State label helpers (no raw enums ever) ──────────────────────────────────

function prettify(s) {
  return String(s).replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

function l1StateLabel(state) {
  if (state == null) return 'not entered';
  return STATE_PRIORITY_LABELS[state]?.chip ?? prettify(state);
}

function l0StateLabel(state) {
  if (state == null) return 'not entered';
  const lbl = L0_STATE_LABELS[state];
  // L0_STATE_LABELS falls back to the raw key for states not in a stateMap
  // (e.g. RM 'measured'); prettify so no underscore-enum ever renders.
  return lbl && lbl !== state ? lbl : prettify(state);
}

// ── Tone palette ─────────────────────────────────────────────────────────────

const TONES = {
  pos:      { color: '#14532d', bg: '#f0fdf4', border: '#bbf7d0' },
  neg:      { color: '#7f1d1d', bg: '#fef2f2', border: '#fecaca' },
  neutral:  { color: '#374151', bg: '#f9fafb', border: '#e5e7eb' },
  capPos:   { color: '#115e59', bg: '#f0fdfa', border: '#99f6e4' },   // teal — capability established
  evidence: { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },   // blue — measurability
  warn:     { color: '#b45309', bg: '#fffbeb', border: '#fde68a' },   // amber — evidence regression
  discover: { color: '#9a3412', bg: '#fff7ed', border: '#fed7aa' },   // amber-red — discovered problem
};

// ── Transition wording (driven off transitionType) ───────────────────────────

function describeTransition(t) {
  const A = l1StateLabel(t.fromState);
  const B = l1StateLabel(t.toState);

  switch (t.transitionType) {
    case 'performance_change': {
      const sign = t.delta > 0 ? `+${t.delta}` : `${t.delta}`;
      return {
        hasDelta: true,
        tone: t.direction === 'improved' ? 'pos' : t.direction === 'regressed' ? 'neg' : 'neutral',
        label: 'Performance',
        detail: `scored ${t.scoreA} → ${t.scoreB}`,
        deltaText: t.direction === 'unchanged' ? 'no change' : `${t.direction} ${sign}`,
      };
    }
    case 'capability_established':
      return {
        hasDelta: true, tone: 'capPos', label: 'Capability established',
        detail: `was ${A} (absent), now scores ${t.scoreB}`, deltaText: `+${t.delta}`,
      };
    case 'capability_lost':
      return {
        hasDelta: true, tone: 'neg', label: 'Capability lost',
        detail: `was scoring ${t.scoreA}, capability now absent (${B})`, deltaText: `${t.delta}`,
      };
    case 'became_measurable':
      return {
        hasDelta: false, tone: 'evidence', label: 'Now scoreable',
        detail: `now scoreable (was ${A}) — not a performance comparison`,
      };
    case 'became_unmeasurable':
      return t.fromClass === 'SCORED'
        ? { hasDelta: false, tone: 'warn', label: 'Lost a measurement',
            detail: `was scoring ${t.scoreA}, now ${B} (evidence regression — not a performance regression)` }
        : { hasDelta: false, tone: 'warn', label: 'Lost certainty about a programme gap',
            detail: `was a determined gap (${A}), now unassessable (${B})` };
    case 'both_unscored':
      return {
        hasDelta: false, tone: 'neutral', label: 'Not comparable',
        detail: `unscored in both (${A} → ${B})`,
      };
    case 'programme_gap_change':
      return {
        hasDelta: false, tone: 'neutral', label: 'Programme gap state changed',
        detail: `${A} → ${B} — no performance comparison`,
      };
    case 'gap_identified':
      return {
        hasDelta: false, tone: 'discover', label: 'Gap identified',
        detail: `previously unassessable, now determined absent (${A} → ${B})`,
      };
    default:
      return { hasDelta: false, tone: 'neutral', label: 'Transition', detail: `${A} → ${B}` };
  }
}

// ── Raw-value line (additive; shown only where raw fields exist) ─────────────

function formatRaw(v) {
  return String(parseFloat(Number(v).toFixed(2)));   // 18 → "18", 12.5 → "12.5"
}
function rawValueLabel(id, v) {
  return INDICATORS[id]?.unit === 'hours' ? `${formatRaw(v)}h` : `${formatRaw(v)}%`;
}
function rawDeltaLabel(id, d) {
  return INDICATORS[id]?.unit === 'hours' ? `${formatRaw(d)}h` : `${formatRaw(d)}pp`;
}

function RawLine({ t }) {
  if (t.transitionType === 'performance_change' && t.rawValueA !== undefined && t.rawValueB !== undefined) {
    const tone = t.rawDirection === 'improved' ? TONES.pos
      : t.rawDirection === 'regressed' ? TONES.neg : TONES.neutral;
    return (
      <div data-raw-line data-raw-direction={t.rawDirection}
        style={{ fontSize: '11px', color: tone.color, marginTop: '2px' }}>
        {rawValueLabel(t.indicatorId, t.rawValueA)} → {rawValueLabel(t.indicatorId, t.rawValueB)}
        {t.rawDirection === 'unchanged'
          ? ', no raw change'
          : `, ${t.rawDirection} ${rawDeltaLabel(t.indicatorId, t.rawDelta)}`}
      </div>
    );
  }
  if (t.transitionType === 'capability_established' && t.rawValueB !== undefined) {
    return (
      <div data-raw-line data-raw-direction="established"
        style={{ fontSize: '11px', color: '#115e59', marginTop: '2px' }}>
        now {rawValueLabel(t.indicatorId, t.rawValueB)}
      </div>
    );
  }
  return null;
}

function TransitionRow({ t }) {
  const d = describeTransition(t);
  const tone = TONES[d.tone] ?? TONES.neutral;
  return (
    <div
      data-transition-type={t.transitionType}
      data-indicator-id={t.indicatorId}
      data-has-delta={d.hasDelta ? 'true' : 'false'}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '8px 12px', borderRadius: '6px',
        backgroundColor: tone.bg, border: `1px solid ${tone.border}`, marginBottom: '6px',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
          {INDICATORS[t.indicatorId]?.name ?? t.indicatorId}
        </div>
        <div style={{ fontSize: '12px', color: tone.color, marginTop: '2px' }}>
          <strong>{d.label}</strong> — {d.detail}
        </div>
        <RawLine t={t} />
      </div>
      {d.hasDelta ? (
        <span data-delta-badge style={{
          fontSize: '12px', fontWeight: 700, color: '#fff', backgroundColor: tone.color,
          borderRadius: '4px', padding: '3px 9px', whiteSpace: 'nowrap',
        }}>{d.deltaText}</span>
      ) : (
        <span data-state-pill style={{
          fontSize: '10px', fontWeight: 600, color: tone.color, border: `1px solid ${tone.border}`,
          borderRadius: '10px', padding: '2px 9px', whiteSpace: 'nowrap',
        }}>state / evidence change</span>
      )}
    </div>
  );
}

// ── Dimension comparison ─────────────────────────────────────────────────────

function toneFor(dim) {
  return dim.direction === 'improved' ? TONES.pos : dim.direction === 'regressed' ? TONES.neg : TONES.neutral;
}
function deltaSign(delta) {
  return delta > 0 ? `+${formatScore(delta)}` : formatScore(delta);
}
function dimDeltaText(label, d) {
  if (!d.comparable) return `${label} not comparable`;
  if (d.delta === 0) return `${label} unchanged`;
  return `${label} ${d.direction} ${deltaSign(d.delta)}`;
}

// Incident Handling / Business Continuity — PRIMARY, visually dominant.
// `code` (IH / BC) is the data-dim hook; the label is the dimension's name.
function DimRow({ code, dim }) {
  const label = DIMENSION_NAMES[code];
  if (dim.comparable) {
    const tone = toneFor(dim);
    return (
      <div data-dim={code} data-score-role="primary" data-comparable="true" style={{
        flex: 1, padding: '14px', borderRadius: '8px', textAlign: 'center',
        backgroundColor: tone.bg, border: `2px solid ${tone.color}`,
      }}>
        <div style={{ fontSize: '12px', color: '#374151', fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: '20px', fontWeight: 800, color: tone.color, marginTop: '3px' }}>
          {formatScore(dim.scoreA)} → {formatScore(dim.scoreB)}
        </div>
        <div style={{ fontSize: '13px', color: tone.color, fontWeight: 700 }}>
          {dim.delta === 0 ? 'no change' : `${dim.direction} ${deltaSign(dim.delta)}`}
        </div>
      </div>
    );
  }
  return (
    <div data-dim={code} data-score-role="primary" data-comparable="false" style={{
      flex: 1, padding: '14px', borderRadius: '8px', textAlign: 'center',
      backgroundColor: '#f3f4f6', border: '2px solid #d1d5db',
    }}>
      <div style={{ fontSize: '12px', color: '#374151', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
        Not comparable at dimension level — incomplete in {dim.incompleteIn}. See the per-indicator breakdown above.
      </div>
    </div>
  );
}

// Overall — SECONDARY, demoted + labelled; carries the mixed-movement caveat.
function OverallDimRow({ dim, ih, bc }) {
  const movement = dim.movement;

  if (!dim.comparable) {
    return (
      <div data-dim="Overall" data-score-role="secondary" data-overall-movement={movement} data-comparable="false" style={{
        padding: '8px 12px', borderRadius: '6px', backgroundColor: '#f3f4f6', border: '1px dashed #d1d5db', marginTop: '8px',
      }}>
        <span style={{ fontSize: '11px', color: '#6b7280' }}>
          Overall — secondary summary of Incident Handling and Business Continuity · Not comparable — incomplete in {dim.incompleteIn}.
        </span>
      </div>
    );
  }

  if (movement === 'mixed') {
    // Lead with BOTH dimension deltas; the net Overall delta is clearly secondary.
    return (
      <div data-dim="Overall" data-score-role="secondary" data-overall-movement="mixed" data-comparable="true" style={{
        padding: '9px 12px', borderRadius: '6px', backgroundColor: '#fffbeb', border: '1px solid #f59e0b', marginTop: '8px',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#b45309' }}>
          Mixed — dimensions moved in opposite directions
        </div>
        <div data-mixed-dimensions style={{ fontSize: '12px', color: '#374151', marginTop: '3px' }}>
          <span style={{ color: toneFor(ih).color, fontWeight: 600 }}>{dimDeltaText(DIMENSION_NAMES.IH, ih)}</span>
          <span style={{ color: '#9ca3af', margin: '0 6px' }}>·</span>
          <span style={{ color: toneFor(bc).color, fontWeight: 600 }}>{dimDeltaText(DIMENSION_NAMES.BC, bc)}</span>
        </div>
        <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '3px' }}>
          Overall (secondary summary) {formatScore(dim.scoreA)} → {formatScore(dim.scoreB)}, net {deltaSign(dim.delta)} —
          a net figure can mask this divergence.
        </div>
      </div>
    );
  }

  // aligned / partial_move — quiet secondary line
  const note = movement === 'partial_move'
    ? `one dimension moved, the other unchanged`
    : (dim.delta === 0 ? 'no change' : `${dim.direction} ${deltaSign(dim.delta)}`);
  return (
    <div data-dim="Overall" data-score-role="secondary" data-overall-movement={movement} data-comparable="true" style={{
      display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
      padding: '8px 12px', borderRadius: '6px', backgroundColor: '#f3f4f6', border: '1px dashed #d1d5db', marginTop: '8px',
    }}>
      <span style={{ fontSize: '11px', color: '#6b7280' }}>Overall — secondary summary of Incident Handling and Business Continuity:</span>
      <span style={{ fontSize: '12px', color: '#374151', fontWeight: 600 }}>
        {formatScore(dim.scoreA)} → {formatScore(dim.scoreB)}, {note}
      </span>
      {movement === 'partial_move' && (
        <span data-mixed-dimensions style={{ fontSize: '11px', color: '#6b7280' }}>
          ({dimDeltaText(DIMENSION_NAMES.IH, ih)} · {dimDeltaText(DIMENSION_NAMES.BC, bc)})
        </span>
      )}
    </div>
  );
}

// ── Layer 0 transitions ──────────────────────────────────────────────────────

const L0_TRANSITION_TONE = {
  improved: TONES.pos, regressed: TONES.neg, unchanged: TONES.neutral, still_flagged: TONES.warn,
};
const L0_TRANSITION_LABEL = {
  improved: 'Improved', regressed: 'Regressed', unchanged: 'Unchanged', still_flagged: 'Still flagged',
};

function Layer0Row({ item }) {
  const tone = L0_TRANSITION_TONE[item.transition] ?? TONES.neutral;
  return (
    <div data-l0-item={item.itemId} data-l0-transition={item.transition} style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '7px 12px', borderRadius: '6px',
      backgroundColor: tone.bg, border: `1px solid ${tone.border}`, marginBottom: '5px',
    }}>
      <div style={{ flex: 1, fontSize: '12px' }}>
        <strong>{LAYER0_ITEMS[item.itemId]?.name ?? item.itemId}</strong>
        <span style={{ color: '#6b7280' }}> — {l0StateLabel(item.fromState)} → {l0StateLabel(item.toState)}</span>
      </div>
      <span style={{
        fontSize: '10px', fontWeight: 700, color: '#fff', backgroundColor: tone.color,
        borderRadius: '4px', padding: '2px 8px', whiteSpace: 'nowrap',
      }}>{L0_TRANSITION_LABEL[item.transition] ?? item.transition}</span>
    </div>
  );
}

// ── Top-level ────────────────────────────────────────────────────────────────

export default function ComparisonReport({ comparison }) {
  const { meta, indicators, dimensions, layer0 } = comparison;
  const ids = Object.keys(indicators);
  const layer0Ids = Object.keys(layer0);

  const card = {
    border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: '14px',
  };

  return (
    <div>
      {/* Header */}
      <div style={{ ...card }}>
        <div style={{ padding: '14px 16px', backgroundColor: '#0f2d52', color: '#fff' }}>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>Before / After Comparison</div>
          <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '4px' }}>
            Before: {meta.a.clientId || '—'} {meta.a.assessmentDate || ''} &nbsp;→&nbsp;
            After: {meta.b.clientId || '—'} {meta.b.assessmentDate || ''}
          </div>
        </div>
        {meta.clientMismatch && (
          <div data-client-mismatch style={{
            padding: '8px 16px', backgroundColor: '#fffbeb', color: '#b45309',
            fontSize: '12px', borderTop: '1px solid #fde68a',
          }}>
            ⚠ These assessments are for different clients — the comparison may not be meaningful.
          </div>
        )}
      </div>

      {/* Layer 1 transitions */}
      <div style={card}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e3a5f', marginBottom: '8px' }}>
            Layer 1 — Effectiveness transitions
          </div>
          {ids.map(id => <TransitionRow key={id} t={indicators[id]} />)}
        </div>

        {/* Dimension comparison — IH & BC primary; Overall a secondary summary */}
        <div style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', marginBottom: '8px' }}>
            Dimension deltas <span style={{ fontWeight: 400 }}>— Incident Handling and Business Continuity are the primary outputs; Overall is a secondary summary</span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <DimRow code="IH" dim={dimensions.ih} />
            <DimRow code="BC" dim={dimensions.bc} />
          </div>
          <OverallDimRow dim={dimensions.overall} ih={dimensions.ih} bc={dimensions.bc} />
        </div>
      </div>

      {/* Layer 0 transitions — separated foundation story */}
      <div style={card}>
        <div style={{ padding: '12px 16px', backgroundColor: '#1e3a5f', color: '#fff' }}>
          <div style={{ fontWeight: 700, fontSize: '14px' }}>Foundation (Layer 0) transitions</div>
          <div style={{ fontSize: '11px', opacity: 0.75, marginTop: '2px' }}>
            Qualitative state changes — no scores
          </div>
        </div>
        <div style={{ padding: '12px 16px' }}>
          {layer0Ids.map(id => <Layer0Row key={id} item={layer0[id]} />)}
        </div>
      </div>
    </div>
  );
}
