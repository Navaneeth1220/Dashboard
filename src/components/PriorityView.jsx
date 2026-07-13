/**
 * Layer 1 Priority View UI — Stage 3b-ii (design-logic §7).
 *
 * Pure rendering of computePriorityView()'s resolved output. Recomputes nothing.
 * Renders ONLY the F priority view (three lanes + unassigned); the Stage 3a
 * cross-indicator advisories are rendered separately in 3b-iii.
 *
 * Preserves the six engine distinctions visually:
 *   1. programme-gap zero (amber) vs performance zero (red) in Lane 1
 *   2. Lane 2 (evidence failure, serious) vs Lane 3 (non-event, neutral)
 *   3. Lane 2 layer0_link vs self_created vs ungrouped_no_reason
 *   4. linkedFlagExists:false surfaced as an inconsistency, not a dead link
 *   5. invalid_input (prominent) vs unset (low-key)
 *   6. grouped multi-indicator entries as one card with children
 */

import { INDICATORS, STATE, STATE_PRIORITY_LABELS } from '../data/indicatorDefinitions.js';
import { LAYER0_ITEMS } from '../data/layer0Definitions.js';
import { displayName, formatScore } from '../data/displayNames.js';

// ── Palette ──────────────────────────────────────────────────────────────────
const COLORS = {
  critical:   { bg: '#7f1d1d', text: '#fff', label: 'Critical' },
  high:       { bg: '#9a3412', text: '#fff', label: 'High' },
  programme:  '#b45309',   // amber — structural / programme gap
  failure:    '#dc2626',   // red — measured failure / invalid input
  neutral:    '#6b7280',   // grey — non-events, unset
  link:       '#1d4ed8',   // blue — layer0 link reference
};

const SCORE_BADGE = {
  4: '#1a7f4b', 3: '#2e7d32', 2: '#f59e0b', 1: '#dc2626', 0: '#7f1d1d',
};

const indicatorName = displayName;

function sectionStyle() {
  return {
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    backgroundColor: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    overflow: 'hidden',
    marginBottom: '14px',
  };
}

function Header({ bg, title, subtitle, right }) {
  return (
    <div style={{
      padding: '12px 16px', backgroundColor: bg, color: '#fff',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: '15px' }}>{title}</div>
        {subtitle && <div style={{ fontSize: '11px', opacity: 0.75, marginTop: '2px' }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

function EmptyState({ tone, children }) {
  const color = tone === 'positive' ? '#14532d' : '#6b7280';
  const bg = tone === 'positive' ? '#f0fdf4' : '#f9fafb';
  return (
    <div style={{
      fontSize: '13px', color, backgroundColor: bg,
      padding: '14px 16px', textAlign: 'center', borderRadius: '6px',
    }}>
      {children}
    </div>
  );
}

// ── Lane 1 — Performance priorities ──────────────────────────────────────────

function Lane1Entry({ entry }) {
  const { indicatorId, score, state, programmeGap } = entry;

  // Determine the chip kind: programme-gap zero (amber) vs performance zero (red)
  // vs ordinary scored result (score badge only).
  let chip = null;
  if (programmeGap) {
    const lbl = STATE_PRIORITY_LABELS[state] ?? { chip: state, detail: '' };
    chip = { color: COLORS.programme, label: lbl.chip, detail: lbl.detail, kind: 'programme-gap' };
  } else if (state === STATE.MEASURED && score === 0) {
    const lbl = STATE_PRIORITY_LABELS.measured_zero;
    chip = { color: COLORS.failure, label: lbl.chip, detail: lbl.detail, kind: 'performance-failure' };
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '8px 12px', borderRadius: '6px', backgroundColor: '#f9fafb',
      border: '1px solid #e5e7eb', marginBottom: '6px',
    }}>
      <span style={{
        minWidth: '40px', height: '26px', borderRadius: '4px', padding: '0 6px',
        backgroundColor: SCORE_BADGE[Math.round(score)] ?? '#6b7280', color: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: '13px',
      }}>{formatScore(score)}</span>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
          {indicatorName(indicatorId)}
        </div>
        {chip && (
          <div style={{ fontSize: '11px', color: chip.color, marginTop: '2px' }} data-zero-kind={chip.kind}>
            <strong>{chip.label}</strong> — {chip.detail}
          </div>
        )}
      </div>
    </div>
  );
}

function Lane1({ lane1 }) {
  return (
    <div style={sectionStyle()}>
      <Header bg="#1e3a5f" title="Lane 1 — Performance priorities"
        subtitle="Where did observed effectiveness perform poorly? (lower score = more urgent)" />
      <div style={{ padding: '12px 16px' }}>
        {lane1.entries.length === 0
          ? <EmptyState tone="neutral">No performance priorities — no scored indicators to rank.</EmptyState>
          : lane1.entries.map(e => <Lane1Entry key={e.indicatorId} entry={e} />)}
      </div>
    </div>
  );
}

// ── Lane 2 — Unverifiable effectiveness areas ────────────────────────────────

function SeverityBadge({ severity }) {
  if (!severity) return null;
  const c = COLORS[severity];
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '4px',
      fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.04em', backgroundColor: c.bg, color: c.text, marginLeft: '6px',
    }}>{c.label}</span>
  );
}

function AffectedList({ ids }) {
  return (
    <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '12px', color: '#374151' }}>
      {ids.map(id => <li key={id}>{indicatorName(id)}</li>)}
    </ul>
  );
}

function Lane2Group({ group }) {
  if (group.kind === 'layer0_link') {
    const itemName = LAYER0_ITEMS[group.linkedLayer0ItemId]?.name ?? group.linkedLayer0ItemId;

    if (group.linkedFlagExists === false) {
      // Distinction (4): cited a Layer 0 item that is NOT currently flagged.
      return (
        <div style={{
          padding: '10px 12px', borderRadius: '6px', marginBottom: '8px',
          border: '1px dashed #b45309', backgroundColor: '#fffbeb',
        }} data-entry-kind="layer0_link_mismatch">
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#b45309' }}>
            ⚠ Inconsistency — cited cause is not currently flagged
          </div>
          <div style={{ fontSize: '12px', color: '#374151', marginTop: '3px' }}>
            Marked unverifiable because of <strong>{itemName}</strong>, but that Layer 0 item is not
            currently raising an action flag. Resolve this inconsistency (re-check the Layer 0 state or the reason).
          </div>
          <AffectedList ids={group.affectedIndicators} />
        </div>
      );
    }

    // Distinction (3a): reference to the Layer 0 action flag — not a copy.
    return (
      <div style={{
        padding: '10px 12px', borderRadius: '6px', marginBottom: '8px',
        border: '1px solid #bfdbfe', backgroundColor: '#eff6ff',
      }} data-entry-kind="layer0_link">
        <div style={{ fontSize: '12px', color: COLORS.link, fontWeight: 600 }}>
          ↗ Linked to Layer 0 action: {itemName}
          {group.linkedFlagSeverity && <SeverityBadge severity={group.linkedFlagSeverity} />}
        </div>
        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
          Root cause is a Layer 0 foundation item — see the Layer 0 Action Flags panel.
        </div>
        <AffectedList ids={group.affectedIndicators} />
      </div>
    );
  }

  if (group.kind === 'self_created') {
    // Distinction (3b): standalone consolidated evidence-infrastructure flag.
    return (
      <div style={{
        padding: '10px 12px', borderRadius: '6px', marginBottom: '8px',
        borderLeft: '4px solid #9a3412', backgroundColor: '#fafafa',
      }} data-entry-kind="self_created">
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>
          Evidence-infrastructure gap
        </div>
        {/* Reconstruct the message from reasonText + display names so no ID code
            from the engine's selfFlag.message reaches the screen (Change 2). */}
        <div style={{ fontSize: '12px', color: '#374151', marginTop: '3px' }}>{group.reasonText}</div>
        <AffectedList ids={group.affectedIndicators} />
      </div>
    );
  }

  // Distinction (3c): ungrouped, needs a reason.
  return (
    <div style={{
      padding: '10px 12px', borderRadius: '6px', marginBottom: '8px',
      border: '1px dashed #9ca3af', backgroundColor: '#f9fafb',
    }} data-entry-kind="ungrouped_no_reason">
      <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>
        Reason needed to group this evidence gap
      </div>
      <AffectedList ids={group.affectedIndicators} />
    </div>
  );
}

function Lane2({ lane2 }) {
  const isEmpty = lane2.groups.length === 0;
  return (
    <div style={sectionStyle()}>
      <Header bg="#7f1d1d" title="Lane 2 — Unverifiable effectiveness areas"
        subtitle="The relevant NIS2 obligation cannot currently be demonstrated"
        right={
          <div style={{ textAlign: 'right', fontSize: '11px' }}>
            <div>IH <SeverityBadge severity={lane2.ih.severity} />{!lane2.ih.severity && <span style={{ opacity: 0.6 }}>—</span>}</div>
            <div style={{ marginTop: '2px' }}>BC <SeverityBadge severity={lane2.bc.severity} />{!lane2.bc.severity && <span style={{ opacity: 0.6 }}>—</span>}</div>
          </div>
        }
      />
      <div style={{ padding: '12px 16px' }}>
        {isEmpty
          ? <EmptyState tone="positive">All indicators could be evaluated — no unverifiable areas. Every assessed obligation can be demonstrated.</EmptyState>
          : lane2.groups.map((g, i) => <Lane2Group key={g.groupKey ?? i} group={g} />)}
      </div>
    </div>
  );
}

// ── Lane 3 — No assessment this period ───────────────────────────────────────

function Lane3({ lane3 }) {
  return (
    <div style={sectionStyle()}>
      <Header bg="#6b7280" title="Lane 3 — No assessment this period"
        subtitle="Informational only — nothing occurred to assess these indicators" />
      <div style={{ padding: '12px 16px' }}>
        {lane3.entries.length === 0
          ? <EmptyState tone="neutral">No non-events this period.</EmptyState>
          : lane3.entries.map(e => (
              <div key={e.indicatorId} style={{
                fontSize: '13px', color: '#374151', padding: '6px 12px',
                backgroundColor: '#f9fafb', borderRadius: '6px', marginBottom: '6px',
              }} data-lane="3">
                {indicatorName(e.indicatorId)}
                <span style={{ color: '#9ca3af', marginLeft: '8px', fontSize: '11px' }}>
                  Nothing occurred to assess this indicator.
                </span>
              </div>
            ))}
      </div>
    </div>
  );
}

// ── Unassigned ───────────────────────────────────────────────────────────────

function Unassigned({ unassigned }) {
  if (!unassigned || unassigned.length === 0) return null;   // render nothing when empty

  const invalid = unassigned.filter(u => u.reason === 'invalid_input');
  const unset = unassigned.filter(u => u.reason === 'unset');

  return (
    <div style={sectionStyle()}>
      <Header bg="#374151" title="Not yet in a lane" />
      <div style={{ padding: '12px 16px' }}>
        {/* Distinction (5a): invalid_input — prominent, correctable error */}
        {invalid.map(u => (
          <div key={u.indicatorId} style={{
            fontSize: '13px', color: '#fff', backgroundColor: COLORS.failure,
            padding: '8px 12px', borderRadius: '6px', marginBottom: '6px', fontWeight: 600,
          }} data-unassigned="invalid_input">
            ⚠ Invalid value entered for {indicatorName(u.indicatorId)} — correct it.
          </div>
        ))}
        {/* Distinction (5b): unset — low-key, not assessed */}
        {unset.map(u => (
          <div key={u.indicatorId} style={{
            fontSize: '12px', color: '#9ca3af',
            padding: '5px 12px', borderRadius: '6px', marginBottom: '4px',
          }} data-unassigned="unset">
            {indicatorName(u.indicatorId)} — not yet assessed.
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Top-level ────────────────────────────────────────────────────────────────

export default function PriorityView({ priorityResult }) {
  const { lane1, lane2, lane3, unassigned } = priorityResult;
  return (
    <div>
      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f2d52', marginBottom: '10px' }}>
        Layer 1 Priority View
      </div>
      <Lane1 lane1={lane1} />
      <Lane2 lane2={lane2} />
      <Lane3 lane3={lane3} />
      <Unassigned unassigned={unassigned} />
    </div>
  );
}
