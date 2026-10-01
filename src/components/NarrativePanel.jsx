/**
 * Narrative report panel (docs/ai-report-spec.md, Step 5).
 *
 * Pure renderer of useNarrative's state and generateNarrative's result. It
 * computes nothing: no scores, states or wording decisions. Its own state is
 * only the user's edits and the Copy and PDF status, all dropped when a new
 * result arrives. Which parts are shown, their text and label come from
 * reportParts (shared with Copy and the PDF, Step 6). On `failed` and `unavailable` only the generated sections are
 * shown; model text never reaches this panel then (the result carries none).
 * Where to start (Step 9) has its own status: a failed or unavailable Where
 * to start gets a notice where the part would be, never its text.
 */

import { useState, useRef, useLayoutEffect } from 'react';
import { reportParts, provenanceLines } from '../report/reportParts.js';
import { downloadReportPdf } from '../report/pdf/download.js';
import { SECTION_TITLES, NARRATIVE_WORDING as W, WHERE_TO_START_WORDING as WTS } from '../data/reportWording.js';

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

/** The text Copy writes: each part under its title, then the provenance lines. */
function copyText(parts, model) {
  return [
    ...parts.flatMap(p => [p.title, p.text, '']),
    '---',
    ...provenanceLines(parts, model),
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

/**
 * Sizes a text box to its content, so no part scrolls inside the panel:
 * after every change of the text, and when the window width changes the
 * wrapping. Height is reset first so the box can also shrink.
 */
function useAutoHeight(text) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const fit = () => {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [text]);
  return ref;
}

function Part({ part, facts, onChange }) {
  const { key, title, text } = part;
  const boxRef = useAutoHeight(text);
  const cited = part.factIds.map(id => facts.find(f => f.id === id)).filter(Boolean);
  return (
    <div data-testid={`narrative-part-${key}`} style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
        <div style={{ fontWeight: 700, fontSize: '13px', color: '#111827' }}>{title}</div>
        <Label kind={part.label} />
      </div>
      <textarea
        ref={boxRef}
        aria-label={title}
        value={text}
        onChange={e => onChange(key, e.target.value)}
        rows={1}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: '13px', lineHeight: 1.5,
          fontFamily: 'inherit', border: '1px solid #d1d5db', borderRadius: '4px', resize: 'none', overflowY: 'hidden',
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

/**
 * Where to start failed or unavailable (Step 9): a notice in its place. Not
 * shown when the whole report is unavailable (that notice covers it).
 */
function WhereToStartNotice({ result }) {
  const own = result.whereToStart;
  if (result.status === 'unavailable' || !own || !['failed', 'unavailable'].includes(own.status)) return null;
  const neutral = { fontSize: '13px', color: '#6b7280', marginBottom: '14px' };
  const alert = { fontSize: '13px', color: '#7f1d1d', backgroundColor: '#fef2f2', border: '1px solid #fecaca',
    borderRadius: '6px', padding: '10px 12px', marginBottom: '14px' };
  if (own.status === 'unavailable' && own.reason === 'cancelled') {
    return <div data-testid="where-to-start-notice" style={neutral}>{WTS.cancelled}</div>;
  }
  if (own.status === 'unavailable') {
    return <div data-testid="where-to-start-notice" role="alert" style={alert}>{WTS.unavailable(own.message)}</div>;
  }
  return (
    <div data-testid="where-to-start-notice" role="alert" style={alert}>
      <div style={{ fontWeight: 700 }}>{WTS.failed}</div>
      <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
        {own.errors.map((e, i) => (
          <li key={i} data-testid="narrative-error">{e.title ? `${e.title}: ` : ''}{e.detail}</li>
        ))}
      </ul>
    </div>
  );
}

export default function NarrativePanel({
  phase, attempt, maxAttempts, attemptPart = null, result, generatedAt, model, stale, onGenerate, onCancel,
}) {
  // Edits and the Copy and PDF status belong to one result; a new result drops them.
  const [local, setLocal] = useState({ source: null, texts: {}, copy: null, pdf: null });
  const own = local.source === result ? local : { source: result, texts: {}, copy: null, pdf: null };
  const update = change => setLocal(l => ({ ...(l.source === result ? l : own), ...change }));

  const running = phase === 'running';
  const shown = phase === 'done' ? result : null;
  const parts = reportParts(shown, own.texts);
  const preparing = own.pdf === 'preparing';
  // A failed or unavailable Where to start: its notice goes where the part would be.
  const noticeAt = parts.findIndex(p => p.key === 'overview') + 1;

  const onChange = (key, value) => setLocal({ ...own, texts: { ...own.texts, [key]: value }, copy: null, pdf: null });
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText(parts, shown.model ?? model));
      update({ copy: 'copied' });
    } catch {
      update({ copy: 'failed' });
    }
  };
  const onDownload = async () => {
    update({ pdf: 'preparing' });
    try {
      await downloadReportPdf({ result: shown, edits: own.texts, generatedAt, model });
      update({ pdf: null });
    } catch {
      update({ pdf: 'failed' });
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
            {attempt === 0 ? W.generating
              : attemptPart === 'whereToStart' ? WTS.attempt(attempt, maxAttempts) : W.attempt(attempt, maxAttempts)}
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

            {parts.map((part, i) => (
              <div key={part.key}>
                {i === noticeAt && <WhereToStartNotice result={shown} />}
                <Part part={part} facts={shown.facts} onChange={onChange} />
              </div>
            ))}

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button type="button" onClick={onCopy} style={buttonStyle(false)}>{W.copy}</button>
              <button type="button" onClick={onDownload} disabled={stale || preparing} style={buttonStyle(stale || preparing)}>
                {W.downloadPdf}
              </button>
              {stale && <span style={{ fontSize: '12px', color: '#92400e' }}>{W.regenerateFirst}</span>}
              {preparing && <span style={{ fontSize: '12px', color: '#374151' }}>{W.preparingPdf}</span>}
              {own.pdf === 'failed' && <span role="alert" style={{ fontSize: '12px', color: '#991b1b' }}>{W.pdfFailed}</span>}
              {own.copy === 'copied' && <span style={{ fontSize: '12px', color: '#166534' }}>{W.copied}</span>}
              {own.copy === 'failed' && <span style={{ fontSize: '12px', color: '#991b1b' }}>{W.copyFailed}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
