import IndicatorInput from './IndicatorInput.jsx';
import ScoreBadge from './ScoreBadge.jsx';

export default function MeasureCard({
  title,
  subtitle,
  indicatorIds,
  inputs,
  results,
  dimensionResult,
  onIndicatorChange,
  aNotesByIndicator = {},
  dHintByIndicator = {},
}) {
  const { score, incomplete } = dimensionResult;

  return (
    <div style={{
      border: '1px solid #d1d5db',
      borderRadius: '8px',
      overflow: 'hidden',
      backgroundColor: '#fff',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        backgroundColor: '#1e3a5f',
        color: '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>{title}</div>
          <div style={{ fontSize: '11px', opacity: 0.75, marginTop: '2px' }}>{subtitle}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <ScoreBadge score={score} size="md" />
          {incomplete && (
            <div style={{ fontSize: '10px', color: '#fbbf24', marginTop: '4px' }}>
              Incomplete — one or more indicators unscored
            </div>
          )}
        </div>
      </div>

      {/* Indicator rows */}
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {indicatorIds.map(id => (
          <IndicatorInput
            key={id}
            indicatorId={id}
            input={inputs[id]}
            result={results[id]}
            onChange={val => onIndicatorChange(id, val)}
            aNotes={aNotesByIndicator[id] ?? []}
            dHint={dHintByIndicator[id] ?? null}
          />
        ))}
      </div>
    </div>
  );
}
