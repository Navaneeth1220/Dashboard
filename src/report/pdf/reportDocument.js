/**
 * The PDF's content (docs/ai-report-spec.md, Step 6), before layout.
 *
 * Pure: no PDF library. Client and assessment date come from the result's
 * context fact, which generateNarrative built from the snapshot the report
 * was generated from; the caller's live state never reaches the PDF. The
 * parts come from reportParts, so on `failed` and `unavailable` only the
 * generated sections exist. The scores table reads the dimension facts'
 * data; nothing is recomputed.
 */

import { reportParts, provenanceLines } from '../reportParts.js';
import { NARRATIVE_WORDING as W } from '../../data/reportWording.js';

const DIMENSION_KINDS = new Set(['dim_complete', 'dim_incomplete']);

/** Characters Windows does not allow in filenames, control characters and whitespace. */
const unsafe = ch => '<>:"/\\|?*'.includes(ch) || ch.charCodeAt(0) < 32 || /\s/.test(ch);

function filenamePart(value) {
  return [...String(value ?? '')].map(ch => (unsafe(ch) ? '_' : ch)).join('')
    .replace(/_+/g, '_').replace(/^[_.]+|[_.]+$/g, '');
}

/** `<client>_<assessment date>_report.pdf`; no client → "assessment", no date → left out. */
export function reportFilename(clientId, assessmentDate) {
  const client = filenamePart(clientId) || W.pdf.filenameFallback;
  const date = filenamePart(assessmentDate);
  return `${[client, date].filter(Boolean).join('_')}_report.pdf`;
}

const pad = n => String(n).padStart(2, '0');

/** An ISO timestamp as local "YYYY-MM-DD HH:MM", or null. */
export function formatGeneratedAt(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * buildReportDocument({ result, edits, generatedAt, model }) →
 *   { filename, title, meta: [{ label, value }], scores: { title, label, columns, rows: [{ name, value }] },
 *     parts: [{ key, title, label, text }], closing: string[], footerModel: string | null }
 *
 * model: the panel's model name, used only when the result carries none.
 */
export function buildReportDocument({ result, edits = {}, generatedAt = null, model }) {
  const context = result.facts.find(f => f.kind === 'context' && 'clientId' in f.data)?.data ?? {};
  const shown = value => value || W.pdf.notRecorded;
  const parts = reportParts(result, edits);
  const modelName = result.model ?? model;
  const hasAi = parts.some(p => p.origin === 'ai');

  return {
    filename: reportFilename(context.clientId, context.assessmentDate),
    title: W.title,
    meta: [
      { label: W.pdf.client, value: shown(context.clientId) },
      { label: W.pdf.assessmentDate, value: shown(context.assessmentDate) },
      { label: W.pdf.generated, value: shown(formatGeneratedAt(generatedAt)) },
    ],
    scores: {
      title: W.pdf.scoresTitle,
      label: W.label.generated,
      columns: [W.pdf.dimensionColumn, W.pdf.scoreColumn],
      rows: result.facts
        .filter(f => DIMENSION_KINDS.has(f.kind))
        .map(f => ({ name: f.data.name, value: f.data.complete ? f.data.score : W.pdf.noScore })),
    },
    parts: parts.map(p => ({ key: p.key, title: p.title, label: W.label[p.label], text: p.text })),
    closing: provenanceLines(parts, modelName, [W.pdf.scoresTitle]),
    footerModel: hasAi ? W.pdf.model(modelName) : null,
  };
}
