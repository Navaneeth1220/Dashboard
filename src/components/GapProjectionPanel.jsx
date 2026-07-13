/**
 * Gap Analysis + Projection UI — Stage 4-ii (design-logic §8).
 *
 * Pure rendering of computeGapAnalysis + computeProjection output, plus the
 * target-selection interaction. No projection math here — the UI only collects
 * target choices (lifted to App.jsx) and renders the engine result.
 *
 * The three dimension-completeness cases branch on WHICH FIELD EXISTS
 * (`score` vs `subsetScore` vs neither) — never a re-derived guess — so a
 * partial planning scenario is structurally incapable of rendering in the
 * complete-score slot.
 */

import { INDICATORS, STATE_PRIORITY_LABELS } from '../data/indicatorDefinitions.js';
import { displayName, formatScore } from '../data/displayNames.js';

const SCORE_BADGE = { 4: '#1a7f4b', 3: '#2e7d32', 2: '#f59e0b', 1: '#dc2626', 0: '#7f1d1d' };

const name = displayName;

// Reason → display text (state-named reasons reuse the centralised label map)
function excludedReasonText(reason) {
  switch (reason) {
    case 'not_measurable':           return STATE_PRIORITY_LABELS.not_measurable.chip;
    case 'no_qualifying_event':      return STATE_PRIORITY_LABELS.no_qualifying_event.chip;
    case 'no_qualifying_disruption': return STATE_PRIORITY_LABELS.no_qualifying_disruption.chip;
    case 'invalid_input':            return 'Invalid value entered';
    case 'unset':                    return 'Not yet assessed';
    default:                         return reason;
  }
}

function projectionBlockMessage(reason) {
  switch (reason) {
    case 'not_measurable':
    case 'no_qualifying_event':
    case 'no_qualifying_disruption': return 'Resolve the evidence state first';
    case 'invalid_input':            return 'Invalid value — correct it';
    case 'unset':                    return 'Not yet assessed';
    default:                         return 'Not projectable';
  }
}

function rejectReasonText(reason) {
  switch (reason) {
    case 'resolve_evidence_state_first': return 'resolve the evidence state first';
    case 'invalid_target':               return 'target out of range';
    case 'not_assessed':                 return 'not yet assessed';
    case 'invalid_input':                return 'invalid input';
    default:                             return reason;
  }
}

function sectionStyle() {
  return {
    border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: '14px',
  };
}

function ScoreChip({ score }) {
  return (
    <span style={{
      minWidth: '36px', height: '22px', borderRadius: '4px', padding: '0 6px',
      backgroundColor: SCORE_BADGE[Math.round(score)] ?? '#6b7280', color: '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: '11px',
    }}>{formatScore(score)}</span>
  );
}

function CapTag() {
  return (
    <span data-cap-tag style={{
      fontSize: '10px', fontWeight: 600, color: '#5b21b6',
      backgroundColor: '#ede9fe', border: '1px solid #c4b5fd',
      borderRadius: '3px', padding: '1px 6px', whiteSpace: 'nowrap',
    }}>assumes capability established</span>
  );
}

// ── Gap analysis ─────────────────────────────────────────────────────────────

function GapRow({ gap }) {
  const unit = gap.unit === '%' ? '%' : ` ${gap.unit}`;
  const verb = gap.action === 'increase' ? 'Increase' : 'Reduce';

  return (
    <div data-gap-row={gap.indicatorId} style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '6px',
      border: '1px solid #e5e7eb', marginBottom: '6px',
    }}>
      <ScoreChip score={gap.currentScore} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 600 }}>
          {name(gap.indicatorId)}
          {gap.assumesCapabilityEstablished && <span style={{ marginLeft: '8px' }}><CapTag /></span>}
        </div>
        {gap.atMaximum ? (
          <div data-gap-text style={{ fontSize: '12px', color: '#14532d', marginTop: '2px' }}>
            At maximum (score 4)
          </div>
        ) : (
          <div data-gap-text style={{ fontSize: '12px', color: '#374151', marginTop: '2px' }}>
            {verb} to <strong>{gap.nextBand.thresholdValue}{unit}</strong> for score {gap.nextBand.targetScore}
            {gap.nextBand.targetScore !== 4 && (
              <> · {verb.toLowerCase()} to <strong>{gap.toFour.thresholdValue}{unit}</strong> for score 4</>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GapAnalysisSection({ gapResult }) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e3a5f', marginBottom: '8px' }}>
        Gap analysis <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '11px' }}>— what each score needs to improve</span>
      </div>
      {gapResult.gaps.length === 0
        ? <div style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>No scored indicators yet.</div>
        : gapResult.gaps.map(g => <GapRow key={g.indicatorId} gap={g} />)}

      {gapResult.excluded.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          {gapResult.excluded.map(e => (
            <div key={e.indicatorId} data-gap-excluded={e.indicatorId}
              style={{ fontSize: '11px', color: '#9ca3af', padding: '2px 0' }}>
              {name(e.indicatorId)} — no gap, not scored ({excludedReasonText(e.reason)})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Projection ───────────────────────────────────────────────────────────────

function TargetRow({ indicatorId, ind, onTargetChange }) {
  if (!ind.projectable) {
    return (
      <div data-proj-row={indicatorId} data-projectable="false" style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '6px',
        border: '1px dashed #d1d5db', marginBottom: '6px',
      }}>
        <div style={{ flex: 1, fontSize: '13px', fontWeight: 600 }}>
          {name(indicatorId)}
        </div>
        <div data-proj-block style={{ fontSize: '11px', color: '#b45309', fontStyle: 'italic' }}>
          {projectionBlockMessage(ind.excludedReason)}
        </div>
      </div>
    );
  }

  const selectValue = ind.targetApplied ? String(ind.projectedScore) : '';

  return (
    <div data-proj-row={indicatorId} data-projectable="true" style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '6px',
      border: '1px solid #e5e7eb', marginBottom: '6px',
    }}>
      <ScoreChip score={ind.currentScore} />
      <div style={{ flex: 1, fontSize: '13px', fontWeight: 600 }}>
        {name(indicatorId)}
      </div>

      <label style={{ fontSize: '11px', color: '#6b7280' }}>Target</label>
      <select
        data-proj-target={indicatorId}
        value={selectValue}
        onChange={e => onTargetChange(indicatorId, e.target.value === '' ? null : Number(e.target.value))}
        style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }}
      >
        <option value="">Baseline ({ind.currentScore})</option>
        {[0, 1, 2, 3, 4].map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      <span style={{ fontSize: '11px', color: '#6b7280' }}>→</span>
      <span data-proj-projected={indicatorId}><ScoreChip score={ind.projectedScore} /></span>
      {ind.assumesCapabilityEstablished && <CapTag />}
    </div>
  );
}

function DimensionProjection({ label, dim }) {
  const hasScore = Object.prototype.hasOwnProperty.call(dim, 'score');
  const hasSubset = Object.prototype.hasOwnProperty.call(dim, 'subsetScore');
  const capList = dim.assumesCapabilityIndicators ?? [];

  const CapNote = capList.length > 0 ? (
    <div data-cap-note style={{ fontSize: '11px', color: '#5b21b6', marginTop: '3px' }}>
      Includes capability-assumed gains: {capList.map(displayName).join(', ')}
    </div>
  ) : null;

  if (hasScore) {
    return (
      <div data-proj-dim={label} data-proj-kind="complete" style={{
        flex: 1, padding: '12px', borderRadius: '6px', backgroundColor: '#f0fdf4',
        border: '1px solid #bbf7d0', textAlign: 'center',
      }}>
        <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>Projected {label}</div>
        <div style={{ fontSize: '24px', fontWeight: 700, color: '#14532d', marginTop: '4px' }}>
          {dim.score.toFixed(2)}
        </div>
        {CapNote}
      </div>
    );
  }

  if (hasSubset) {
    return (
      <div data-proj-dim={label} data-proj-kind="partial" style={{
        flex: 1, padding: '12px', borderRadius: '6px', backgroundColor: '#fffbeb',
        border: '1px dashed #f59e0b', textAlign: 'center',
      }}>
        <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 700 }}>
          {label} — Planning scenario
        </div>
        <div style={{ fontSize: '11px', color: '#92400e', marginTop: '2px' }}>
          {dim.coverage
            ? `Projected average of ${dim.coverage.scored} of ${dim.coverage.total} ${label} indicators — not a complete ${label} score`
            : `Partial — based on a planning scenario in ${(dim.partialDimensions ?? []).join(', ')} — not a complete ${label} score`}
        </div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#92400e', marginTop: '4px' }}>
          {dim.subsetScore.toFixed(2)}
        </div>
        {dim.exclusions && dim.exclusions.length > 0 && (
          <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>
            Excluded: {dim.exclusions.map(displayName).join(', ')}
          </div>
        )}
        {CapNote}
      </div>
    );
  }

  // Unscoreable — no number at all
  return (
    <div data-proj-dim={label} data-proj-kind="unscoreable" style={{
      flex: 1, padding: '12px', borderRadius: '6px', backgroundColor: '#f3f4f6',
      border: '1px solid #d1d5db', textAlign: 'center',
    }}>
      <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 700 }}>Cannot project {label}</div>
      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
        Resolve first: {(dim.blockers ?? []).map(displayName).join(', ')}
      </div>
    </div>
  );
}

function ProjectionSection({ projectionResult, onTargetChange }) {
  const ids = Object.keys(projectionResult.indicators);
  const ihIds = ids.filter(id => INDICATORS[id].measure === 'IH');
  const bcIds = ids.filter(id => INDICATORS[id].measure === 'BC');
  const noTargets = !ids.some(id => projectionResult.indicators[id].targetApplied);

  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e3a5f', marginBottom: '4px' }}>
        Projection <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '11px' }}>— set target bands to see projected scores</span>
      </div>
      {noTargets && (
        <div data-proj-baseline style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic', marginBottom: '8px' }}>
          Baseline — no targets set yet; projected scores equal current scores.
        </div>
      )}

      {/* Rejected targets — surfaced, never swallowed */}
      {projectionResult.rejectedTargets.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          {projectionResult.rejectedTargets.map(r => (
            <div key={r.indicatorId} data-proj-rejected={r.indicatorId}
              style={{ fontSize: '11px', color: '#dc2626', fontWeight: 500 }}>
              ⚠ Target for {name(r.indicatorId)} rejected — {rejectReasonText(r.reason)}.
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, margin: '4px 0' }}>Incident Handling</div>
      {ihIds.map(id => (
        <TargetRow key={id} indicatorId={id} ind={projectionResult.indicators[id]} onTargetChange={onTargetChange} />
      ))}
      <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, margin: '8px 0 4px' }}>Business Continuity</div>
      {bcIds.map(id => (
        <TargetRow key={id} indicatorId={id} ind={projectionResult.indicators[id]} onTargetChange={onTargetChange} />
      ))}

      {/* Projected dimension scores */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
        <DimensionProjection label="IH" dim={projectionResult.ih} />
        <DimensionProjection label="BC" dim={projectionResult.bc} />
        <DimensionProjection label="Overall" dim={projectionResult.overall} />
      </div>
    </div>
  );
}

// ── Top-level ────────────────────────────────────────────────────────────────

export default function GapProjectionPanel({ gapResult, projectionResult, onTargetChange }) {
  return (
    <div style={sectionStyle()}>
      <div style={{ padding: '12px 16px', backgroundColor: '#0f2d52', color: '#fff' }}>
        <div style={{ fontWeight: 700, fontSize: '15px' }}>Gap Analysis & Projection</div>
        <div style={{ fontSize: '11px', opacity: 0.75, marginTop: '2px' }}>
          Planning view — projections are scenarios, not current scores.
        </div>
      </div>
      <GapAnalysisSection gapResult={gapResult} />
      <ProjectionSection projectionResult={projectionResult} onTargetChange={onTargetChange} />
    </div>
  );
}
