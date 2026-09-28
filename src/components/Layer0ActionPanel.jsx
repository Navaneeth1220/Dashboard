import { L0_SEVERITY, L0_SEVERITY_LABELS } from '../data/layer0Definitions.js';

const SEVERITY_CONFIG = {
  [L0_SEVERITY.CRITICAL]:    { label: L0_SEVERITY_LABELS[L0_SEVERITY.CRITICAL],    bg: '#7f1d1d', text: '#fff' },
  [L0_SEVERITY.HIGH]:        { label: L0_SEVERITY_LABELS[L0_SEVERITY.HIGH],        bg: '#9a3412', text: '#fff' },
  [L0_SEVERITY.MEDIUM_NOTE]: { label: L0_SEVERITY_LABELS[L0_SEVERITY.MEDIUM_NOTE], bg: '#92400e', text: '#fff' },
};

function SeverityBadge({ severity }) {
  const cfg = SEVERITY_CONFIG[severity];
  if (!cfg) return null;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '10px',
      fontWeight: 700,
      backgroundColor: cfg.bg,
      color: cfg.text,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

function TagChip({ tag }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 6px',
      borderRadius: '3px',
      fontSize: '10px',
      backgroundColor: '#e5e7eb',
      color: '#374151',
      fontFamily: 'monospace',
      whiteSpace: 'nowrap',
    }}>
      [{tag}]
    </span>
  );
}

function FlagRow({ flag }) {
  const leftBorderColor = {
    [L0_SEVERITY.CRITICAL]:    '#7f1d1d',
    [L0_SEVERITY.HIGH]:        '#9a3412',
    [L0_SEVERITY.MEDIUM_NOTE]: '#92400e',
  }[flag.severity] ?? '#d1d5db';

  return (
    <div style={{
      padding: '10px 12px',
      borderLeft: `4px solid ${leftBorderColor}`,
      backgroundColor: '#fafafa',
      borderRadius: '0 4px 4px 0',
      marginBottom: '6px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
        <SeverityBadge severity={flag.severity} />
        <TagChip tag={flag.tag} />
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>{flag.itemName}</span>
        {flag.isSkippedAction && (
          <span style={{ fontSize: '10px', color: '#6b7280', fontStyle: 'italic' }}>scheduled action not performed</span>
        )}
      </div>
      {flag.message && (
        <div style={{ fontSize: '12px', color: '#374151', marginBottom: flag.contextualNote ? '4px' : 0 }}>
          {flag.message}
        </div>
      )}
      {flag.contextualNote && (
        <div style={{
          fontSize: '11px',
          color: '#1d4ed8',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '4px',
          marginTop: '3px',
        }}>
          <span>ℹ</span>
          <span>{flag.contextualNote}</span>
        </div>
      )}
    </div>
  );
}

export default function Layer0ActionPanel({ actionFlags }) {
  return (
    <div style={{
      border: '1px solid #d1d5db',
      borderRadius: '8px',
      backgroundColor: '#fff',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px',
        backgroundColor: '#0f2d52',
        color: '#fff',
      }}>
        <div style={{ fontWeight: 700, fontSize: '15px' }}>Layer 0 — Action Flags</div>
        <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>
          What needs attention? Ranked by severity — no action sequence implied.
        </div>
      </div>

      <div style={{ padding: '12px 16px' }}>
        {actionFlags.length === 0 ? (
          <div style={{ fontSize: '13px', color: '#14532d', padding: '8px', textAlign: 'center' }}>
            All Layer 0 items are in good standing.
          </div>
        ) : (
          actionFlags.map(flag => <FlagRow key={flag.itemId} flag={flag} />)
        )}
      </div>
    </div>
  );
}
