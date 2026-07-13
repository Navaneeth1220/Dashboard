/**
 * Cross-Indicator Panel — Rule B (interpretive pairs) + Rule C (architecture
 * advisories). Display layer only; recomputes no score.
 *
 * Rule B (Change 1): the three convertible pairs render real relative-comparison
 * findings (computed in the display layer from engine outputs, see pairFindings.js):
 * hidden when roughly equal, a finding when meaningfully different, a fallback
 * line when one side is unscored. The fourth pair (Mean Time to Contain ↔ BC)
 * keeps its engine-driven auto-sentence unchanged.
 *
 * No ID codes are rendered (Change 2); names come from displayName.
 */

import { INDICATORS } from '../data/indicatorDefinitions.js';
import { LAYER0_ITEMS } from '../data/layer0Definitions.js';
import { displayName } from '../data/displayNames.js';

function memberName(memberId) {
  return displayName(memberId);
}

function panelSection() {
  return {
    border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: '14px',
  };
}

// ── Rule B — the IH-08↔BC affordance (unchanged behaviour) ───────────────────

function Ih08BcAffordance({ pair, autoSentence }) {
  return (
    <div data-advisory="ruleB-pair" style={{ marginBottom: '8px' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        fontSize: '12px', color: '#374151',
        backgroundColor: '#f3f4f6', borderRadius: '4px', padding: '4px 10px',
      }}>
        <span>{memberName(pair[0])}</span>
        <span style={{ color: '#6b7280', fontWeight: 700 }}>⇄</span>
        <span>{memberName(pair[1])}</span>
        <span style={{ fontSize: '10px', color: '#9ca3af', marginLeft: '4px' }}>read together</span>
      </div>
      {autoSentence && (
        <div data-advisory="ruleB-sentence" style={{
          marginTop: '5px', fontSize: '12px', color: '#1e3a5f',
          backgroundColor: '#eef2ff', borderLeft: '3px solid #4f46e5',
          borderRadius: '0 4px 4px 0', padding: '7px 10px',
        }}>
          <strong>💡 Analytical finding:</strong> {autoSentence.message ?? autoSentence}
        </div>
      )}
    </div>
  );
}

// ── Rule B — relative-comparison findings for the three convertible pairs ────

function PairFinding({ verdict }) {
  if (verdict.status === 'fallback') {
    return (
      <div data-advisory="ruleB-fallback" data-pair={verdict.pairKey} style={{
        marginBottom: '8px', fontSize: '12px', color: '#6b7280', fontStyle: 'italic',
        backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '6px 10px',
      }}>
        Can't interpret together — {displayName(verdict.unscoredId)} isn't scored this period.
      </div>
    );
  }

  // status === 'finding'
  const [m0, m1] = verdict.members;
  const higherName = displayName(verdict.higherId);
  return (
    <div data-advisory="ruleB-finding" data-pair={verdict.pairKey} style={{
      marginBottom: '8px', fontSize: '12px',
      backgroundColor: '#eef2ff', borderLeft: '3px solid #4f46e5',
      borderRadius: '0 4px 4px 0', padding: '7px 10px',
    }}>
      <div style={{ color: '#374151', marginBottom: '3px' }}>
        <strong>{displayName(m0.id)}</strong> {m0.valueText}
        <span style={{ color: '#6b7280', margin: '0 6px', fontWeight: 700 }}>vs</span>
        <strong>{displayName(m1.id)}</strong> {m1.valueText}
        <span style={{ marginLeft: '6px', color: '#4338ca', fontWeight: 600 }}>
          ↑ {higherName} higher
        </span>
      </div>
      <div style={{ color: '#1e3a5f' }}>{verdict.text}</div>
    </div>
  );
}

// ── Rule C — architecture advisories ─────────────────────────────────────────

const VARIANT_LABEL = {
  strong: 'strong', bypass: 'segmentation bypass', softer: 'review when interpreting',
  caution: 'evidence caution', readiness: 'measurement readiness',
};

function ArchRow({ adv }) {
  const archName = LAYER0_ITEMS[adv.archItemId]?.name ?? adv.archItemId;
  const relName = INDICATORS[adv.relatedId]?.name ?? adv.relatedId;
  const archStateLabel = LAYER0_ITEMS[adv.archItemId]?.stateMap?.[adv.archState]?.label ?? (adv.archState ?? 'not assessed');

  return (
    <div style={{
      padding: '8px 10px', borderRadius: '6px', marginBottom: '8px',
      backgroundColor: '#f9fafb', border: '1px solid #e5e7eb',
    }}>
      <div style={{ display: 'flex', gap: '12px', fontSize: '12px', flexWrap: 'wrap' }}>
        <span><strong>{archName}:</strong> {archStateLabel}</span>
        <span style={{ color: '#9ca3af' }}>↔</span>
        <span><strong>{relName}:</strong> {
          adv.relatedScore !== null && adv.relatedScore !== undefined
            ? `score ${adv.relatedScore}`
            : (adv.relatedState ?? 'not assessed')
        }</span>
      </div>

      {adv.advisory && (
        <div
          data-advisory="ruleC"
          data-advisory-kind="cross_layer_interpretive"
          data-framing={adv.advisory.framing}
          data-cross-layer={adv.crossLayer ? 'true' : 'false'}
          style={{
            marginTop: '6px', fontSize: '12px', color: '#3730a3',
            backgroundColor: '#f5f3ff', border: '1px dashed #818cf8',
            borderRadius: '4px', padding: '6px 9px', fontStyle: 'italic',
          }}
        >
          <span style={{
            display: 'inline-block', fontStyle: 'normal', fontWeight: 700,
            fontSize: '10px', color: '#4338ca', backgroundColor: '#e0e7ff',
            borderRadius: '3px', padding: '1px 6px', marginRight: '6px',
          }}>May be related</span>
          <span style={{ fontSize: '10px', color: '#6b7280' }}>({VARIANT_LABEL[adv.advisory.variant] ?? adv.advisory.variant})</span>
          <div style={{ marginTop: '3px' }}>{adv.advisory.message}</div>
        </div>
      )}
    </div>
  );
}

// ── Top-level ────────────────────────────────────────────────────────────────

export default function CrossIndicatorPanel({
  interpretivePairs = [], architectureAdvisories = [], membersWithData = [], pairFindings = [],
}) {
  // Rule B content: visible findings (non-hidden) + the IH-08↔BC affordance (if it has data)
  const visibleFindings = pairFindings.filter(f => f.status !== 'hidden');
  const ih08BcPair = interpretivePairs.find(p => p.pair[0] === 'IH-08' && p.pair[1] === 'BC');
  const showIh08Bc = ih08BcPair && ih08BcPair.pair.some(m => membersWithData.includes(m));
  const hasInterpretive = visibleFindings.length > 0 || showIh08Bc;

  // Rule C content: rows where there is data to talk about
  const archRows = architectureAdvisories.filter(a => a.archState != null || a.relatedState != null);
  const hasArch = archRows.length > 0;

  return (
    <div style={panelSection()}>
      <div style={{ padding: '12px 16px', backgroundColor: '#312e81', color: '#fff' }}>
        <div style={{ fontWeight: 700, fontSize: '15px' }}>Cross-Indicator Interpretation</div>
        <div style={{ fontSize: '11px', opacity: 0.75, marginTop: '2px' }}>
          Advisory only — relationships that aid interpretation; no scores change.
        </div>
      </div>

      {!hasInterpretive && !hasArch && (
        <div data-cross-empty style={{ padding: '14px 16px', fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>
          No cross-indicator findings for this assessment.
        </div>
      )}

      {hasInterpretive && (
        <div style={{ padding: '12px 16px', borderBottom: hasArch ? '1px solid #f3f4f6' : 'none' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e3a5f', marginBottom: '8px' }}>
            Interpretive pairs <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '11px' }}>— read together</span>
          </div>
          {visibleFindings.map(v => <PairFinding key={v.pairKey} verdict={v} />)}
          {showIh08Bc && <Ih08BcAffordance pair={ih08BcPair.pair} autoSentence={ih08BcPair.autoSentence} />}
        </div>
      )}

      {hasArch && (
        <div style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e3a5f', marginBottom: '4px' }}>
            Architecture ↔ outcome
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px', fontStyle: 'italic' }}>
            Cross-layer interpretations — hypotheses, not action items. See the Layer 0 Action Flags
            panel for foundation actions to fix.
          </div>
          {archRows.map(a => <ArchRow key={`${a.archItemId}-${a.relatedId}`} adv={a} />)}
        </div>
      )}
    </div>
  );
}
