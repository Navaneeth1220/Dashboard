import ScoreBadge from './ScoreBadge.jsx';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import { INDICATORS } from '../data/indicatorDefinitions.js';
import { formatScore } from '../data/displayNames.js';

// Primary dimension score — IH and BC are the headline outputs.
function DimensionSummary({ label, result }) {
  const { score, incomplete } = result;
  return (
    <div data-score-role="primary" style={{
      flex: 1,
      padding: '18px',
      border: '2px solid #1e3a5f',
      borderRadius: '8px',
      textAlign: 'center',
      backgroundColor: '#f8fafc',
    }}>
      <div style={{ fontSize: '13px', color: '#1e3a5f', marginBottom: '10px', fontWeight: 700 }}>
        {label}
      </div>
      <ScoreBadge score={score} size="lg" />
      {incomplete && (
        <div style={{ fontSize: '10px', color: '#b45309', marginTop: '6px' }}>
          Incomplete
        </div>
      )}
      {score !== null && (
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f2d52', marginTop: '8px' }}>
          {formatScore(score)} <span style={{ fontSize: '12px', fontWeight: 400, color: '#6b7280' }}>/ 4.00</span>
        </div>
      )}
    </div>
  );
}

export default function OverallPanel({ ih, bc, overall, indicatorResults }) {
  // Build radar data from all 8 scored indicators
  const radarData = Object.values(INDICATORS).map(def => ({
    subject: def.shortName,
    score: indicatorResults[def.id]?.score ?? 0,
    fullMark: 4,
  }));

  const hasAnyScore = Object.values(indicatorResults).some(r => r.score !== null);

  return (
    <div style={{
      border: '1px solid #d1d5db',
      borderRadius: '8px',
      backgroundColor: '#fff',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      overflow: 'hidden',
    }}>
      {/* Header — the dimension scores are the headline; Overall is a roll-up */}
      <div style={{ padding: '14px 16px', backgroundColor: '#0f2d52', color: '#fff' }}>
        <div style={{ fontWeight: 700, fontSize: '16px' }}>Effectiveness Scores</div>
        <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>
          Incident Handling and Business Continuity are the primary outputs; Overall is a secondary summary.
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {/* IH + BC dimension row — PRIMARY */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
          <DimensionSummary label="Incident Handling (IH)" result={ih} />
          <DimensionSummary label="Business Continuity (BC)" result={bc} />
        </div>

        {/* Overall — SECONDARY, demoted and explicitly labelled */}
        <div data-score-role="secondary" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          padding: '8px 12px', marginBottom: '18px',
          backgroundColor: '#f3f4f6', border: '1px dashed #d1d5db', borderRadius: '6px',
        }}>
          <span style={{ fontSize: '11px', color: '#6b7280' }}>
            Overall — secondary summary of IH and BC
          </span>
          <ScoreBadge score={overall.score} size="sm" />
          {overall.incomplete
            ? <span style={{ fontSize: '10px', color: '#b45309' }}>incomplete</span>
            : overall.score !== null && (
              <span style={{ fontSize: '12px', color: '#6b7280' }}>{formatScore(overall.score)} / 4.00</span>
            )}
        </div>

        {/* Radar chart */}
        {hasAnyScore && (
          <div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', fontWeight: 600 }}>
              Indicator profile
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fontSize: 11, fill: '#374151' }}
                />
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke="#1e3a5f"
                  fill="#1e3a5f"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
                <Tooltip
                  formatter={(v) => [`${v} / 4`, 'Score']}
                  contentStyle={{ fontSize: '12px' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
