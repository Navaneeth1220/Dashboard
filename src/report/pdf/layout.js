/**
 * PDF layout (docs/ai-report-spec.md, Step 6): the report document placed on
 * A4 pages as positioned text runs and rules.
 *
 * Pure: the font's widths come from `measure(text, style)` (millimetres),
 * so the layout is tested without a PDF library. renderPdf.js replays the
 * result. Coordinates are millimetres from the top left; a text run's y is
 * its baseline.
 */

import { NARRATIVE_WORDING as W } from '../../data/reportWording.js';

/** Millimetres per point. */
export const PT_MM = 25.4 / 72;

export const PAGE = {
  width: 210,
  height: 297,
  margin: 20,         // left, right and top
  contentBottom: 272, // no content baseline below this
  footerY: 285,       // baseline of the page footer
};

/** font: 'regular' | 'bold'; color: 'text' | 'muted'. */
export const STYLES = {
  title:     { font: 'bold',    size: 18,   color: 'text' },
  meta:      { font: 'regular', size: 10,   color: 'muted' },
  partTitle: { font: 'bold',    size: 12,   color: 'text' },
  label:     { font: 'regular', size: 8,    color: 'muted' },
  body:      { font: 'regular', size: 10.5, color: 'text' },
  head:      { font: 'bold',    size: 10,   color: 'text' },
  cell:      { font: 'regular', size: 10,   color: 'text' },
  closing:   { font: 'regular', size: 8.5,  color: 'muted' },
  footer:    { font: 'regular', size: 8,    color: 'muted' },
};

export const lineHeight = style => STYLES[style].size * PT_MM * 1.4;

const CONTENT_WIDTH = PAGE.width - 2 * PAGE.margin;
const LABEL_GAP = 3;       // between a title and its label
const PART_GAP = 5;        // before each part
const BLOCK_GAP = 6;       // after the header and the scores table
const SCORE_COLUMN_X = 95; // from the left margin
const KEEP_LINES = 2;      // body lines kept with their part title

/** Break a word wider than `width` into pieces that fit. */
function breakWord(word, width, measure) {
  const pieces = [];
  let piece = '';
  for (const ch of word) {
    if (piece && measure(piece + ch) > width) {
      pieces.push(piece);
      piece = '';
    }
    piece += ch;
  }
  return [...pieces, piece];
}

/** One paragraph (no line breaks) → lines no wider than `width`. `measure(text)` → width. */
export function wrapText(text, width, measure) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= width) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    if (measure(word) <= width) {
      line = word;
    } else {
      const pieces = breakWord(word, width, measure);
      lines.push(...pieces.slice(0, -1));
      line = pieces.at(-1);
    }
  }
  return [...lines, line];
}

/**
 * layoutReport(doc, measure) → [{ ops }] per page.
 * op: { kind: 'text', text, x, y, style, role, part? } | { kind: 'rule', x1, y1, x2, y2 }
 * role: title, meta, scoresTitle, label, head, cell, partTitle, body, closing, footerModel, pageNumber.
 */
export function layoutReport(doc, measure) {
  const pages = [{ ops: [] }];
  let top = PAGE.margin;   // top of the next line

  const ops = () => pages.at(-1).ops;
  const newPage = () => { pages.push({ ops: [] }); top = PAGE.margin; };
  const fits = height => top + height <= PAGE.contentBottom;
  /** Start a new page unless `height` fits (or the page is still empty). */
  const keep = height => { if (!fits(height) && top > PAGE.margin) newPage(); };
  const baseline = style => top + STYLES[style].size * PT_MM;
  const wrap = (text, style, width = CONTENT_WIDTH) => wrapText(text, width, t => measure(t, style));
  const text = (t, x, style, role, extra = {}) => ops().push({ kind: 'text', text: t, x, y: baseline(style), style, role, ...extra });
  const rule = () => ops().push({ kind: 'rule', x1: PAGE.margin, y1: top, x2: PAGE.width - PAGE.margin, y2: top });
  const line = (t, style, role, extra) => { text(t, PAGE.margin, style, role, extra); top += lineHeight(style); };

  /** A title with its label beside it, or under it when both do not fit one line. */
  const titled = (title, label, titleStyle, role, extra = {}) => {
    const lines = wrap(title, titleStyle);
    const lastWidth = measure(lines.at(-1), titleStyle);
    const beside = lastWidth + LABEL_GAP + measure(label, 'label') <= CONTENT_WIDTH;
    lines.forEach((l, i) => {
      text(l, PAGE.margin, titleStyle, role, extra);
      if (i === lines.length - 1 && beside) {
        // The label sits on the title's baseline.
        ops().push({ kind: 'text', text: label, x: PAGE.margin + lastWidth + LABEL_GAP, y: baseline(titleStyle), style: 'label', role: 'label', ...extra });
      }
      top += lineHeight(titleStyle);
    });
    if (!beside) line(label, 'label', 'label', extra);
  };
  const titledHeight = (title, label, titleStyle) => {
    const lines = wrap(title, titleStyle);
    const beside = measure(lines.at(-1), titleStyle) + LABEL_GAP + measure(label, 'label') <= CONTENT_WIDTH;
    return lines.length * lineHeight(titleStyle) + (beside ? 0 : lineHeight('label'));
  };

  // Header
  for (const l of wrap(doc.title, 'title')) line(l, 'title', 'title');
  top += 1;
  for (const { label, value } of doc.meta) {
    for (const l of wrap(`${label}: ${value}`, 'meta')) line(l, 'meta', 'meta');
  }
  top += 2;
  rule();
  top += BLOCK_GAP;

  // Scores at a glance, never split
  const { scores } = doc;
  keep(titledHeight(scores.title, scores.label, 'partTitle') + 2 + (1 + scores.rows.length) * lineHeight('cell') + 2);
  titled(scores.title, scores.label, 'partTitle', 'scoresTitle');
  top += 2;
  text(scores.columns[0], PAGE.margin, 'head', 'head');
  text(scores.columns[1], PAGE.margin + SCORE_COLUMN_X, 'head', 'head');
  top += lineHeight('head');
  for (const row of scores.rows) {
    text(row.name, PAGE.margin, 'cell', 'cell');
    text(row.value, PAGE.margin + SCORE_COLUMN_X, 'cell', 'cell');
    top += lineHeight('cell');
  }
  top += BLOCK_GAP - PART_GAP;

  // Parts
  doc.parts.forEach((part, i) => {
    const bodyLines = part.text.split('\n').flatMap(p => wrap(p, 'body'));
    const kept = Math.min(KEEP_LINES, bodyLines.length);
    top += PART_GAP;
    keep(titledHeight(part.title, part.label, 'partTitle') + 1.5 + kept * lineHeight('body'));
    titled(part.title, part.label, 'partTitle', 'partTitle', { part: i });
    top += 1.5;
    for (const l of bodyLines) {
      if (!fits(lineHeight('body'))) newPage();
      if (l) text(l, PAGE.margin, 'body', 'body', { part: i });
      top += lineHeight('body');
    }
  });

  // Closing, never split
  const closingLines = doc.closing.flatMap(c => wrap(c, 'closing'));
  top += BLOCK_GAP;
  keep(3 + closingLines.length * lineHeight('closing'));
  rule();
  top += 3;
  for (const l of closingLines) line(l, 'closing', 'closing');

  // Footer, once the page count is known
  pages.forEach((page, i) => {
    const y = PAGE.footerY;
    if (doc.footerModel) page.ops.push({ kind: 'text', text: doc.footerModel, x: PAGE.margin, y, style: 'footer', role: 'footerModel' });
    const number = W.pdf.page(i + 1, pages.length);
    page.ops.push({ kind: 'text', text: number, x: PAGE.width - PAGE.margin - measure(number, 'footer'), y, style: 'footer', role: 'pageNumber' });
  });

  return pages;
}
