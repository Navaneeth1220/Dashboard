import Layer0ItemCard from './Layer0ItemCard.jsx';

function Group({ title, subtitle, items, inputs, onItemChange }) {
  return (
    <div>
      <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e3a5f', marginBottom: '6px' }}>
        {title}
        <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '11px', marginLeft: '8px' }}>{subtitle}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {items.map(item => (
          <Layer0ItemCard
            key={item.id}
            itemId={item.id}
            input={inputs[item.id]}
            result={item}
            onChange={val => onItemChange(item.id, val)}
          />
        ))}
      </div>
    </div>
  );
}

export default function Layer0ReferenceView({ layer0Result, inputs, onItemChange }) {
  const { groups } = layer0Result;

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
        backgroundColor: '#1e3a5f',
        color: '#fff',
      }}>
        <div style={{ fontWeight: 700, fontSize: '15px' }}>Layer 0 — Foundation Status</div>
        <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>
          What kind of foundation and process evidence exists?
        </div>
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Group
          title="Layer 0A — Prerequisites"
          subtitle="6 items"
          items={groups['0A']}
          inputs={inputs}
          onItemChange={onItemChange}
        />
        <Group
          title="Layer 0B — Process evidence"
          subtitle="3 items"
          items={groups['0B']}
          inputs={inputs}
          onItemChange={onItemChange}
        />
      </div>
    </div>
  );
}
