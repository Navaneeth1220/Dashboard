/**
 * PDF layout (docs/ai-report-spec.md, Step 6). A fixed-width `measure` keeps
 * the tests independent of the font: every character is half its font size
 * wide.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { layoutReport, wrapText, PAGE, STYLES, lineHeight, PT_MM } from './layout.js';

const measure = (text, style) => [...text].length * STYLES[style].size * PT_MM * 0.5;
const CONTENT_WIDTH = PAGE.width - 2 * PAGE.margin;

function docWith(parts, extra = {}) {
  return {
    filename: 'x.pdf',
    title: 'Assessment report',
    meta: [{ label: 'Client', value: 'Westmaas' }, { label: 'Assessment date', value: '2026-01-01' }, { label: 'Generated', value: '2026-01-02 09:05' }],
    scores: {
      title: 'Scores at a glance', label: 'Generated from the assessment', columns: ['Dimension', 'Score (0–4, 4 = best)'],
      rows: [{ name: 'Incident Handling', value: '2.33' }, { name: 'Business Continuity', value: 'no score (incomplete)' }, { name: 'Overall score', value: 'no score (incomplete)' }],
    },
    parts: parts.map((text, i) => ({ key: `p${i}`, title: `Part ${i}`, label: 'Generated from the assessment', text })),
    closing: ['Generated from the assessment: Scores at a glance, Part 0.'],
    footerModel: 'Model: qwen2.5:7b',
    ...extra,
  };
}

const textOps = pages => pages.flatMap((p, page) => p.ops.filter(o => o.kind === 'text').map(o => ({ ...o, page })));
const squash = s => s.replace(/\s+/g, '');
const paragraph = n => Array.from({ length: n }, (_, i) => `Sentence number ${i} about recovery objectives.`).join(' ');

describe('wrapText', () => {
  it('wraps at the width and keeps every word in order', () => {
    const lines = wrapText(paragraph(20), 60, t => t.length);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(60);
    expect(lines.join(' ')).toBe(paragraph(20));
  });

  it('a word wider than the line is broken by characters', () => {
    const lines = wrapText('a'.repeat(25), 10, t => t.length);
    expect(lines).toEqual(['a'.repeat(10), 'a'.repeat(10), 'a'.repeat(5)]);
  });

  it('empty text is one empty line', () => {
    expect(wrapText('', 10, t => t.length)).toEqual(['']);
  });
});

describe('layoutReport', () => {
  it('a short report fits one page: header, scores, parts, closing, footer', () => {
    const pages = layoutReport(docWith(['Short text.']), measure);
    expect(pages).toHaveLength(1);
    const ops = textOps(pages);
    const roles = ops.map(o => o.role);
    expect(roles.indexOf('title')).toBeLessThan(roles.indexOf('meta'));
    expect(roles.indexOf('scoresTitle')).toBeLessThan(roles.indexOf('partTitle'));
    expect(roles.indexOf('body')).toBeLessThan(roles.indexOf('closing'));
    expect(ops.filter(o => o.role === 'meta').map(o => o.text)).toEqual(['Client: Westmaas', 'Assessment date: 2026-01-01', 'Generated: 2026-01-02 09:05']);
    expect(ops.filter(o => o.role === 'cell').map(o => o.text)).toContain('no score (incomplete)');
    expect(ops.find(o => o.role === 'pageNumber').text).toBe('Page 1 of 1');
    expect(ops.find(o => o.role === 'footerModel').text).toBe('Model: qwen2.5:7b');
  });

  it('many pages: "Page N of M" right-aligned on every page', () => {
    const pages = layoutReport(docWith(Array.from({ length: 8 }, () => paragraph(30))), measure);
    expect(pages.length).toBeGreaterThan(2);
    pages.forEach((p, i) => {
      const num = p.ops.filter(o => o.role === 'pageNumber');
      expect(num).toHaveLength(1);
      expect(num[0].text).toBe(`Page ${i + 1} of ${pages.length}`);
      expect(num[0].x + measure(num[0].text, 'footer')).toBeCloseTo(PAGE.width - PAGE.margin, 6);
      expect(p.ops.filter(o => o.role === 'footerModel')).toHaveLength(1);
    });
  });

  it('no model footer when the document has none', () => {
    const pages = layoutReport(docWith([paragraph(3)], { footerModel: null }), measure);
    expect(textOps(pages).some(o => o.role === 'footerModel')).toBe(false);
  });

  it('a part title is never last on its page: it moves with its label and first two lines', () => {
    // Fill the first page so that the second part's title would land near the bottom.
    for (let n = 1; n <= 60; n++) {
      const pages = layoutReport(docWith([paragraph(n), paragraph(6)]), measure);
      const ops = textOps(pages);
      const title = ops.find(o => o.role === 'partTitle' && o.part === 1);
      const label = ops.find(o => o.role === 'label' && o.part === 1);
      const body = ops.filter(o => o.role === 'body' && o.part === 1);
      expect(label.page).toBe(title.page);
      expect(body[0].page).toBe(title.page);
      expect(body[1].page).toBe(title.page);
    }
  });

  it('the label goes under a title too long to share its line', () => {
    const doc = docWith(['x']);
    doc.parts[0].title = 'T'.repeat(70);
    const ops = textOps(layoutReport(doc, measure));
    const title = ops.find(o => o.role === 'partTitle');
    const label = ops.find(o => o.role === 'label' && o.part === 0);
    expect(label.x).toBe(PAGE.margin);
    expect(label.y).toBeGreaterThan(title.y);
  });

  it('the scores table and the closing are never split across pages', () => {
    for (let n = 1; n <= 60; n++) {
      const pages = layoutReport(docWith([paragraph(n)]), measure);
      const ops = textOps(pages);
      const table = ops.filter(o => ['scoresTitle', 'head', 'cell'].includes(o.role) || (o.role === 'label' && o.part === undefined));
      expect(new Set(table.map(o => o.page)).size).toBe(1);
      expect(new Set(ops.filter(o => o.role === 'closing').map(o => o.page)).size).toBe(1);
    }
  });

  it('line breaks in an edit are kept; an empty line keeps its space', () => {
    const ops = textOps(layoutReport(docWith(['First line.\n\nThird line.']), measure));
    const body = ops.filter(o => o.role === 'body');
    expect(body.map(o => o.text)).toEqual(['First line.', 'Third line.']);
    expect(body[1].y - body[0].y).toBeCloseTo(2 * lineHeight('body'), 6);
  });

  it('property: every character of every part appears once, in order; every line fits; nothing enters the footer area', () => {
    const word = fc.stringMatching(/^[A-Za-z0-9≤≥→–—…]{1,40}$/);
    const text = fc.array(fc.oneof(word, fc.constantFrom('\n', ' ', '\n\n')), { maxLength: 400 }).map(ws => ws.join(' '));
    fc.assert(fc.property(fc.array(text, { minLength: 1, maxLength: 6 }), parts => {
      const pages = layoutReport(docWith(parts), measure);
      const ops = textOps(pages);
      parts.forEach((t, i) => {
        expect(ops.filter(o => o.role === 'body' && o.part === i).map(o => o.text).join('').replace(/\s+/g, '')).toBe(squash(t));
      });
      for (const o of ops) {
        expect(o.x).toBeGreaterThanOrEqual(PAGE.margin);
        expect(o.x + measure(o.text, o.style)).toBeLessThanOrEqual(PAGE.width - PAGE.margin + 1e-9);
        if (o.role === 'pageNumber' || o.role === 'footerModel') expect(o.y).toBe(PAGE.footerY);
        else expect(o.y).toBeLessThanOrEqual(PAGE.contentBottom);
      }
      expect(CONTENT_WIDTH).toBe(170);
    }), { numRuns: 60 });
  });
});

// ─── Recommended actions formatting (Step 8) ──────────────────────────────────

const ACTION = (title, n = 1) => ({
  kind: 'action', title,
  lines: [
    { label: null, text: `Do the thing called ${title}.` },
    { label: 'Steps: ', text: paragraph(n) },
    { label: 'Why it matters: ', text: 'Because it matters.' },
    { label: 'Who: ', text: 'OT engineering' },
    { label: 'NIS2 Article 21(2): ', text: '(c) business continuity' },
  ],
});
const BLOCKS = [
  { kind: 'text', text: 'Each action comes from the catalogue.' },
  { kind: 'heading', text: 'Incident Handling' },
  ACTION('Shorten response time', 8),
  { kind: 'heading', text: 'Business Continuity' },
  ACTION('Improve zone availability'),
];
const textOfBlocks = blocks => blocks.map(b => (b.kind === 'action'
  ? [b.title, ...b.lines.map(l => `${l.label ?? ''}${l.text}`)].join('\n') : b.text)).join('\n\n');
function docWithBlocks(before, blocks) {
  const doc = docWith([...before, textOfBlocks(blocks)]);
  doc.parts.at(-1).blocks = blocks;
  return doc;
}

describe('structured part (Recommended actions)', () => {
  it('styles: area headings bold and larger than body; titles and labels bold at body size', () => {
    expect(STYLES.areaHeading.font).toBe('bold');
    expect(STYLES.areaHeading.size).toBeGreaterThan(STYLES.body.size);
    expect(STYLES.actionTitle).toEqual({ ...STYLES.body, font: 'bold' });
    expect(STYLES.fieldLabel).toEqual({ ...STYLES.body, font: 'bold' });
  });

  it('headings, titles and labels get their styles; the text after a label is regular, on its baseline, right after it', () => {
    const ops = textOps(layoutReport(docWithBlocks([], BLOCKS), measure)).filter(o => o.part === 0);
    expect(ops.filter(o => o.role === 'areaHeading').map(o => [o.text, o.style])).toEqual([
      ['Incident Handling', 'areaHeading'], ['Business Continuity', 'areaHeading'],
    ]);
    expect(ops.filter(o => o.role === 'actionTitle').map(o => [o.text, o.style])).toEqual([
      ['Shorten response time', 'actionTitle'], ['Improve zone availability', 'actionTitle'],
    ]);
    const labels = ops.filter(o => o.role === 'fieldLabel');
    const perAction = ['Steps: ', 'Why it matters: ', 'Who: ', 'NIS2 Article 21(2): '];
    expect(labels.map(o => o.text)).toEqual([...perAction, ...perAction]);
    for (const label of labels) {
      expect(label.style).toBe('fieldLabel');
      expect(label.x).toBe(PAGE.margin);
      const after = ops.find(o => o.role === 'body' && o.y === label.y && o.page === label.page);
      expect(after.x).toBeCloseTo(label.x + measure(label.text, 'fieldLabel'), 9);
      expect(after.style).toBe('body');
    }
    // The action sentence and the lead-in are plain body text.
    expect(ops.find(o => o.text === 'Do the thing called Shorten response time.').role).toBe('body');
    expect(ops.find(o => o.text.startsWith('Each action')).role).toBe('body');
  });

  it('a wrapped labelled line continues at the margin in the regular font', () => {
    const ops = textOps(layoutReport(docWithBlocks([], BLOCKS), measure)).filter(o => o.part === 0);
    const steps = ops.filter(o => o.block === 2 && o.row >= 2 && o.row <= 5);
    expect(steps.filter(o => o.role === 'fieldLabel')).toHaveLength(1);
    const continuation = steps.filter(o => o.row > steps[0].row);
    expect(continuation.length).toBeGreaterThan(0);
    for (const o of continuation.filter(o => o.row < 5)) expect(o).toMatchObject({ x: PAGE.margin, role: 'body' });
  });

  it('an edited section (no blocks) is plain body text', () => {
    const doc = docWith([textOfBlocks(BLOCKS)]);
    const roles = new Set(textOps(layoutReport(doc, measure)).filter(o => o.part === 0).map(o => o.role));
    expect(roles).toEqual(new Set(['partTitle', 'label', 'body']));
  });

  it('a heading stays with the next title and its first two lines; a title with its first two lines', () => {
    for (let n = 1; n <= 70; n++) {
      const ops = textOps(layoutReport(docWithBlocks([paragraph(n)], BLOCKS), measure)).filter(o => o.part === 1);
      const rowsOf = block => [...new Set(ops.filter(o => o.block === block).map(o => o.row))].sort((a, b) => a - b);
      const pageOf = (block, row) => ops.find(o => o.block === block && o.row === row).page;
      BLOCKS.forEach((b, j) => {
        if (b.kind === 'heading') {
          // The next action's title (row 0) and its first two lines.
          for (const row of rowsOf(j + 1).slice(0, 3)) expect(pageOf(j + 1, row), `n=${n} heading ${j}`).toBe(pageOf(j, 0));
        }
        if (b.kind === 'action') {
          const rows = rowsOf(j);
          expect(pageOf(j, rows[1]), `n=${n} action ${j}`).toBe(pageOf(j, rows[0]));
          expect(pageOf(j, rows[2])).toBe(pageOf(j, rows[0]));
        }
      });
      const title = ops.find(o => o.role === 'partTitle');
      expect(ops.find(o => o.block === 0).page).toBe(title.page);
    }
  });

  it('property: every character of the blocks appears once, in order; every line fits', () => {
    const words = fc.array(fc.stringMatching(/^[A-Za-z0-9≤–]{1,30}$/), { minLength: 1, maxLength: 60 }).map(ws => ws.join(' '));
    const block = fc.oneof(
      words.map(text => ({ kind: 'text', text })),
      words.map(text => ({ kind: 'heading', text })),
      fc.record({
        title: words,
        lines: fc.array(fc.record({ label: fc.option(fc.constantFrom('Steps: ', 'Why it matters: ', 'NIS2 Article 21(2): '), { nil: null }), text: words }), { minLength: 1, maxLength: 5 }),
      }).map(a => ({ kind: 'action', ...a })),
    );
    fc.assert(fc.property(fc.array(block, { minLength: 1, maxLength: 8 }), blocks => {
      const ops = textOps(layoutReport(docWithBlocks([], blocks), measure));
      const part = ops.filter(o => o.part === 0 && o.role !== 'partTitle' && o.role !== 'label');
      expect(squash(part.map(o => o.text).join(''))).toBe(squash(textOfBlocks(blocks)));
      for (const o of ops) {
        expect(o.x).toBeGreaterThanOrEqual(PAGE.margin);
        expect(o.x + measure(o.text, o.style)).toBeLessThanOrEqual(PAGE.width - PAGE.margin + 1e-9);
        if (o.role !== 'pageNumber' && o.role !== 'footerModel') expect(o.y).toBeLessThanOrEqual(PAGE.contentBottom);
      }
    }), { numRuns: 80 });
  });
});
