/**
 * Lightweight info-icon with a hover/tap tooltip. Display only — no scoring,
 * no modal, no new page. Shows plain-language help text next to an item name.
 */

import { useState } from 'react';

export default function InfoIcon({ text }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;

  return (
    <span
      style={{ position: 'relative', display: 'inline-block', marginLeft: '5px', verticalAlign: 'middle' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        role="button"
        tabIndex={0}
        aria-label="More information"
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); } }}
        style={{
          cursor: 'help', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '14px', height: '14px', borderRadius: '50%',
          border: '1px solid #9ca3af', color: '#6b7280',
          fontSize: '10px', fontWeight: 700, fontStyle: 'italic', lineHeight: 1,
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        i
      </span>
      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute', zIndex: 30, left: '20px', top: '-4px',
            width: '230px', backgroundColor: '#0f2d52', color: '#fff',
            fontSize: '11px', fontWeight: 400, fontStyle: 'normal', lineHeight: 1.35,
            padding: '7px 9px', borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)', whiteSpace: 'normal',
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
