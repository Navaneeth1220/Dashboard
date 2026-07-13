import { SCORE_LEVEL_LABELS } from '../data/indicatorDefinitions.js';
import { formatScore } from '../data/displayNames.js';

const SCORE_COLORS = {
  4: { bg: '#1a7f4b', text: '#ffffff' },
  3: { bg: '#2e7d32', text: '#ffffff' },
  2: { bg: '#f59e0b', text: '#1a1a1a' },
  1: { bg: '#dc2626', text: '#ffffff' },
  0: { bg: '#7f1d1d', text: '#ffffff' },
};

const NULL_COLOR = { bg: '#6b7280', text: '#ffffff' };

export default function ScoreBadge({ score, size = 'md' }) {
  const isNull = score === null || score === undefined;
  // Colour/level keyed by the nearest band; numeral always shows exactly 2 decimals.
  const bandKey = isNull ? null : Math.round(score);
  const color = isNull ? NULL_COLOR : (SCORE_COLORS[bandKey] ?? NULL_COLOR);
  const label = isNull ? '—' : (SCORE_LEVEL_LABELS[bandKey] ?? '');
  const numLabel = isNull ? 'N/A' : formatScore(score);

  const sizes = {
    sm: { padding: '2px 8px', fontSize: '11px', numSize: '13px' },
    md: { padding: '4px 12px', fontSize: '12px', numSize: '16px' },
    lg: { padding: '6px 18px', fontSize: '14px', numSize: '22px' },
  };
  const s = sizes[size] ?? sizes.md;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      backgroundColor: color.bg,
      color: color.text,
      padding: s.padding,
      borderRadius: '4px',
      fontWeight: 600,
      userSelect: 'none',
    }}>
      <span style={{ fontSize: s.numSize, lineHeight: 1 }}>{numLabel}</span>
      <span style={{ fontSize: s.fontSize, opacity: 0.9 }}>{label}</span>
    </span>
  );
}
