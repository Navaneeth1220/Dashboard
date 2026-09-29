/**
 * Narrative report panel (docs/ai-report-spec.md, Step 5).
 *
 * Pure renderer of useNarrative's state and generateNarrative's result. It
 * computes nothing: no scores, states or wording decisions. Its own state is
 * only the user's edits and the Copy status, both dropped when a new result
 * arrives. On `failed` and `unavailable` only the generated sections are
 * shown; model text never reaches this panel then (the result carries none).
 */

import { useState } from 'react';
import { SECTION_KEYS, GENERATED_KEYS } from '../report/schema.js';
import { SECTION_TITLES, NARRATIVE_WORDING as W } from '../data/reportWording.js';

const LABEL_STYLE = {
  ai:        { backgroundColor: '#fef3c7', color: '#92400e' },
  generated: { backgroundColor: '#e5e7eb', color: '#374151' },
  edited:    { backgroundColor: '#dbeafe', color: '#1e40af' },
};

function sectionStyle() {
  return {
    border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: '14px',
  };
}

const buttonStyle = disabled => ({
  padding: '6px 14px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '12px', fontWeight: 600,
  backgroundColor: disabled ? '#e5e7eb' : '#fff', color: disabled ? '#9ca3af' : '#111827',
  cursor: disabled ? 'default' : 'pointer',
});

const codeStyle = { fontFamily: 'monospace', backgroundColor: '#f3f4f6', padding: '1px 5px', borderRadius: '3px' };

/** The parts shown for a result: all six on `ok`, the four generated sections otherwise. */
function partsOf(result) {
  if (!result) return [];
  if (result.status === 'ok') {
    return ['headline', ...SECTION_KEYS].map(key => [key, key === 'headline' ? result.narrative.headline : result.narrative.sections[key]]);
  }
  return GENERATED_KEYS.map(key => [key, result.generated[key]]);
}

/** The text Copy writes: each part under its title, then the footer. */
function copyText(parts, textOf, isEdited, origin, model) {
  const titlesWhere = test => parts.filter(([key]) => test(key)).map(([key]) => SECTION_TITLES[key]);
  const ai = titlesWhere(key => origin[key] === 'ai');
  const generated = titlesWhere(key => origin[key] === 'generated');
  const edited = titlesWhere(isEdited);
  return [
    ...parts.flatMap(([key]) => [SECTION_TITLES[key], textOf(key), '']),
    '---',
    ...(ai.length > 0 ? [W.footer.ai(model, ai)] : []),
    ...(generated.length > 0 ? [W.footer.generated(generated)] : []),
    ...(edited.length > 0 ? [W.footer.edited(edited)] : []),
  ].join('\n');
}

function Label({ kind }) {
  return (
    <span data-testid="narrative-label" style={{
      ...LABEL_STYLE[kind], fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
    }}>
      {W.label[kind]}
    </span>
  );
}

function Part({ partKey, part, text, edited, origin, facts, onChange }) {
  const title = SECTION_TITLES[partKey];
  const cited = (part.factIds ?? []).map(id => facts.find(f => f.id === id)).filter(Boolean);
  return (
    <div data-testid={`narrative-part-${partKey}`} style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
        <div style={{ fontWeight: 700, fontSize: '13px', color: '#111827' }}>{title}</div>
        <Label kind={edited ? 'edited' : origin} />
      </div>
      <textarea
        aria-label={title}
        value={text}
        onChange={e => onChange(partKey, e.target.value)}
        rows={partKey === 'headline' ? 2 : 5}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: '13px', lineHeight: 1.5,
          fontFamily: 'inherit', border: '1px solid #d1d5db', borderRadius: '4px', resize: 'vertical',
        }}
      />
      <details style={{ marginTop: '4px', fontSize: '11px', color: '#6b7280' }}>
        <summary style={{ cursor: 'pointer' }}>{W.basedOnFacts}</summary>
        <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
          {cited.map(f => <li key={f.id} data-testid="narrative-fact" style={{ marginBottom: '3px' }}>{f.text}</li>)}
        </ul>
      </details>
    </div>
  );
}

function Unavailable({ result, model }) {
  if (result.reason === 'cancelled') {
    return <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '14px' }}>{W.unavailable.cancelled}</div>;
  }
  const box = { fontSize: '13px', color: '#7f1d1d', backgroundColor: '#fef2f2', border: '1px solid #fecaca',
    borderRadius: '6px', padding: '10px 12px', marginBottom: '14px' };
  if (result.reason === 'not_running') {
    return (
      <div role="alert" style={box}>
        <div>{W.unavailable.notRunning}</div>
        <div style={{ marginTop: '4px' }}>{W.unavailable.startWith} <code style={codeStyle}>{W.unavailable.startCommand}</code></div>
      </div>
    );
  }
  if (result.reason === 'model_missing') {
    return (
      <div role="alert" style={box}>
        <div>{result.message}</div>
        <div style={{ marginTop: '4px' }}>{W.unavailable.pullWith} <code style={codeStyle}>{W.unavailable.pullCommand(model)}</code></div>
      </div>
    );
  }
  return <div role="alert" style={box}>{result.message}</div>;
}

function Failed({ errors }) {
  return (
    <div role="alert" style={{ fontSize: '13px', color: '#7f1d1d', backgroundColor: '#fef2f2', border: '1px solid #fecaca',
      borderRadius: '6px', padding: '10px 12px', marginBottom: '14px' }}>
      <div style={{ fontWeight: 700 }}>{W.failed}</div>
      <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
        {errors.map((e, i) => (
          <li key={i} data-testid="narrative-error">{e.section ? (SECTION_TITLES[e.section] ?? e.section) : W.draft}: {e.detail}</li>
        ))}
      </ul>
    </div>
  );
}

export default function NarrativePanel({ phase, attempt, maxAttempts, result, model, stale, onGenerate, onCancel }) {
  // Edits and the Copy status belong to one result; a new result drops them.
  const [local, setLocal] = useState({ source: null, texts: {}, copy: null });
  const own = local.source === result ? local : { source: result, texts: {}, copy: null };

  const running = phase === 'running';
  const shown = phase === 'done' ? result : null;
  const parts = partsOf(shown);
  const original = Object.fromEntries(parts.map(([key, part]) => [key, part.text]));
  const textOf = key => own.texts[key] ?? original[key];
  const isEdited = key => own.texts[key] !== undefined && own.texts[key] !== original[key];

  const onChange = (key, value) => setLocal({ ...own, texts: { ...own.texts, [key]: value }, copy: null });
  const onCopy = async () => {
    const text = copyText(parts, textOf, isEdited, shown.origin, shown.model ?? model);
    try {
      await navigator.clipboard.writeText(text);
      setLocal(l => ({ ...(l.source === result ? l : own), copy: 'copied' }));
    } catch {
      setLocal(l => ({ ...(l.source === result ? l : own), copy: 'failed' }));
    }
  };

  return (
    <div style={sectionStyle()}>
      <div style={{
        padding: '12px 16px', backgroundColor: '#1f2937', color: '#fff',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>{W.title}</div>
          <div style={{ fontSize: '11px', opacity: 0.75, marginTop: '2px' }}>Model: {model}</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {running && <button type="button" onClick={onCancel} style={buttonStyle(false)}>{W.cancel}</button>}
          <button type="button" onClick={onGenerate} disabled={running} style={buttonStyle(running)}>{W.generate}</button>
        </div>
      </div>

      <div style={{ padding: '14px 16px' }}>
        {running && (
          <div style={{ fontSize: '13px', color: '#374151' }}>
            {attempt > 0 ? W.attempt(attempt, maxAttempts) : W.generating}
          </div>
        )}

        {shown && (
          <>
            {stale && (
              <div style={{ fontSize: '12px', color: '#92400e', backgroundColor: '#fffbeb', border: '1px solid #fde68a',
                borderRadius: '6px', padding: '8px 12px', marginBottom: '14px' }}>
                {W.stale}
              </div>
            )}
            {shown.status === 'failed' && <Failed errors={shown.errors} />}
            {shown.status === 'unavailable' && <Unavailable result={shown} model={model} />}

            {parts.map(([key, part]) => (
              <Part key={key} partKey={key} part={part} text={textOf(key)} edited={isEdited(key)}
                origin={shown.origin[key]} facts={shown.facts} onChange={onChange} />
            ))}

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button type="button" onClick={onCopy} style={buttonStyle(false)}>{W.copy}</button>
              {own.copy === 'copied' && <span style={{ fontSize: '12px', color: '#166534' }}>{W.copied}</span>}
              {own.copy === 'failed' && <span style={{ fontSize: '12px', color: '#991b1b' }}>{W.copyFailed}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
