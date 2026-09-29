/**
 * Shared wording (docs/ai-report-spec.md, Step 3b): the dashboard and the
 * generated report sections take these strings from one place, so they
 * cannot drift apart. This test fails if a component hardcodes one of them.
 *
 * Checked strings:
 * - every top-level string export of reportWording.js (the phrases shared
 *   with the dashboard), matched case-insensitively anywhere in the code;
 * - every L0_SEVERITY_LABELS value, matched case-sensitively as a string
 *   literal or a JSX text node (the labels are short words, so a substring
 *   match would hit identifiers and state values).
 * Comments are ignored.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as reportWording from '../data/reportWording.js';
import { L0_SEVERITY_LABELS } from '../data/layer0Definitions.js';

const DIR = dirname(fileURLToPath(import.meta.url));

const COMPONENT_FILES = readdirSync(DIR)
  .filter(f => f.endsWith('.jsx') && !f.includes('.test.'))
  .sort();

/**
 * Hardcoded copies that are deliberately not the shared string, with the
 * reason. Each snippet is removed from its file before scanning, and must
 * still be present (a stale exception fails the test).
 */
const ALLOWED = [
  {
    file: 'PriorityView.jsx',
    snippet: "critical:   { bg: '#7f1d1d', text: '#fff', label: 'Critical' },",
    reason: 'Lane 2 count-based severity (priorityView.js), a Layer 1 scale; not the Layer 0 severity',
  },
  {
    file: 'PriorityView.jsx',
    snippet: "high:       { bg: '#9a3412', text: '#fff', label: 'High' },",
    reason: 'Lane 2 count-based severity (priorityView.js), a Layer 1 scale; not the Layer 0 severity',
  },
];

const PHRASES = Object.entries(reportWording)
  .filter(([, value]) => typeof value === 'string')
  .map(([name, value]) => ({ name, value }));

const LABELS = Object.values(L0_SEVERITY_LABELS);

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The shared strings a source hardcodes → [{ text, kind }]. */
function findHardcoded(source) {
  const code = stripComments(source);
  const lower = code.toLowerCase();
  const found = [];
  for (const { value } of PHRASES) {
    if (lower.includes(value.toLowerCase())) found.push({ text: value, kind: 'reportWording' });
  }
  for (const label of LABELS) {
    const e = escapeRegExp(label);
    const literal = new RegExp(`(['"\`])${e}\\1`);
    const jsxText = new RegExp(`>\\s*${e}\\s*<`);
    if (literal.test(code) || jsxText.test(code)) found.push({ text: label, kind: 'L0_SEVERITY_LABELS' });
  }
  return found;
}

function withoutAllowed(file, source) {
  let result = source;
  for (const { snippet } of ALLOWED.filter(a => a.file === file)) result = result.split(snippet).join('');
  return result;
}

describe('shared wording: components do not hardcode it', () => {
  it('has strings to check and components to check them in', () => {
    expect(PHRASES.map(p => p.name)).toEqual(expect.arrayContaining(['NOTHING_TO_ASSESS', 'NOT_YET_ASSESSED']));
    expect(LABELS).toEqual(['Critical', 'High', 'Medium note', 'Monitor']);
    expect(COMPONENT_FILES).toEqual(expect.arrayContaining([
      'PriorityView.jsx', 'Layer0ActionPanel.jsx', 'Layer0ItemCard.jsx', 'GapProjectionPanel.jsx',
    ]));
  });

  it('detects each kind of hardcoding (so the scan cannot pass vacuously)', () => {
    expect(findHardcoded("<span>Nothing occurred to assess this indicator.</span>")).toEqual([
      { text: reportWording.NOTHING_TO_ASSESS, kind: 'reportWording' },
    ]);
    expect(findHardcoded("return 'Not yet assessed';")).toEqual([
      { text: reportWording.NOT_YET_ASSESSED, kind: 'reportWording' },
    ]);
    expect(findHardcoded("{ label: 'Medium note' }")).toEqual([{ text: 'Medium note', kind: 'L0_SEVERITY_LABELS' }]);
    expect(findHardcoded('<b>\n  Critical\n</b>')).toEqual([{ text: 'Critical', kind: 'L0_SEVERITY_LABELS' }]);
    // Not hardcoding: comments, identifiers, state values, the constants themselves.
    expect(findHardcoded([
      '// not yet assessed',
      '/* Critical */',
      "const s = L0_SEVERITY.HIGH; const v = 'high'; const t = 'Highlight';",
      '{NOT_YET_ASSESSED} {L0_SEVERITY_LABELS[severity]}',
    ].join('\n'))).toEqual([]);
  });

  it.each(ALLOWED)('allowed exception still exists: $file ($reason)', ({ file, snippet }) => {
    expect(readFileSync(join(DIR, file), 'utf8')).toContain(snippet);
  });

  it.each(COMPONENT_FILES)('%s hardcodes no shared string', file => {
    const source = withoutAllowed(file, readFileSync(join(DIR, file), 'utf8'));
    expect(findHardcoded(source)).toEqual([]);
  });

  it('the PDF export wording (Step 6) is hardcoded in no component and no PDF module', () => {
    const W = reportWording.NARRATIVE_WORDING;
    const strings = [W.downloadPdf, W.preparingPdf, W.pdfFailed, W.regenerateFirst,
      ...Object.values(W.pdf).filter(v => typeof v === 'string'), 'Page ', 'Model: '];
    const pdfDir = join(DIR, '../report/pdf');
    const files = [
      ...COMPONENT_FILES.map(f => join(DIR, f)),
      ...readdirSync(pdfDir).filter(f => f.endsWith('.js') && !f.includes('.test.')).map(f => join(pdfDir, f)),
    ];
    expect(files.some(f => f.endsWith('layout.js'))).toBe(true);
    for (const file of files) {
      const code = stripComments(readFileSync(file, 'utf8'));
      for (const s of strings) expect(code, `${file}: "${s}"`).not.toContain(`'${s}`);
    }
  });

  it('the components that show these strings take them from the shared modules', () => {
    const read = file => readFileSync(join(DIR, file), 'utf8');
    expect(read('PriorityView.jsx')).toMatch(/\{NOTHING_TO_ASSESS\}/);
    expect(read('PriorityView.jsx')).toMatch(/\{NOT_YET_ASSESSED\}/);
    expect(read('GapProjectionPanel.jsx')).toMatch(/from '\.\.\/data\/reportWording\.js'/);
    expect(read('Layer0ActionPanel.jsx')).toMatch(/L0_SEVERITY_LABELS\[/);
    expect(read('Layer0ItemCard.jsx')).toMatch(/L0_SEVERITY_LABELS\[/);
  });
});
