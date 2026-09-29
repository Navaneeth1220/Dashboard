/**
 * jsPDF renderer and font coverage (docs/ai-report-spec.md, Step 6).
 * Runs in Node: the fonts are read from disk (createPdf.js fetches them in
 * the browser).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { jsPDF } from 'jspdf';
import { drawReport, renderReportPdf, FONT_FAMILY, addFonts } from './renderPdf.js';
import { buildReportDocument } from './reportDocument.js';
import { loadScenario, scriptedResults, assessmentArb } from '../testSupport.js';
import { buildAssessmentFacts } from '../facts.js';
import { buildGeneratedSections } from '../templates.js';
import { matchAssessmentActions } from '../../engine/actions.js';
import { DEFAULT_MODEL } from '../generate.js';
import * as reportWording from '../../data/reportWording.js';
import * as displayNames from '../../data/displayNames.js';
import * as actionCatalogue from '../../data/actionCatalogue.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const font = name => readFileSync(join(ROOT, 'src/assets/fonts', name)).toString('base64');
const FONTS = { regular: font('LiberationSans-Regular.ttf'), bold: font('LiberationSans-Bold.ttf') };

const SCENARIOS = readdirSync(join(ROOT, 'scenarios'))
  .filter(f => f.endsWith('.json'))
  .map(f => ({ file: f, assessment: loadScenario(readFileSync(join(ROOT, 'scenarios', f), 'utf8')) }));

const baseline = SCENARIOS.find(s => s.file.startsWith('Westmaas_2026-01-01')).assessment;

describe('renderReportPdf', () => {
  it('a PDF whose pages are the layout\'s pages', async () => {
    const result = await scriptedResults(baseline).ok();
    const doc = buildReportDocument({ result, edits: {}, generatedAt: new Date().toISOString(), model: DEFAULT_MODEL });
    const { pdf, pages } = drawReport(doc, FONTS);
    expect(pdf.getNumberOfPages()).toBe(pages.length);

    const blob = renderReportPdf(doc, FONTS);
    expect(blob.type).toBe('application/pdf');
    const text = Buffer.from(await blob.arrayBuffer()).toString('latin1');
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text.match(/\/Type \/Page\b/g)).toHaveLength(pages.length);
    expect(text).toContain(`/Title (${doc.title})`);
  });

  it('a long edited report runs over several pages', async () => {
    const result = await scriptedResults(baseline).ok();
    const long = Array.from({ length: 120 }, (_, i) => `Line ${i} of a long edited overview.`).join('\n');
    const doc = buildReportDocument({ result, edits: { overview: long }, generatedAt: null, model: DEFAULT_MODEL });
    const { pdf, pages } = drawReport(doc, FONTS);
    expect(pages.length).toBeGreaterThan(2);
    expect(pdf.getNumberOfPages()).toBe(pages.length);
  });
});

describe('font coverage', () => {
  let covered;
  beforeAll(() => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    addFonts(pdf, FONTS);
    const maps = ['normal', 'bold'].map(style => pdf.getFont(FONT_FAMILY, style).metadata.cmap.unicode.codeMap);
    covered = ch => maps.every(m => m[ch.codePointAt(0)] !== undefined);
  });

  const missing = texts => [...new Set(texts.join('').replace(/\s/g, ''))].filter(ch => !covered(ch));

  /** Every string in a module, with functions called on sample arguments. */
  function stringsOf(value) {
    if (typeof value === 'string') return [value];
    if (typeof value === 'function') {
      const target = { score: 3, level: 'Good', value: '75%', bound: 'min' };
      for (const args of [['Sample name 1.5', ['Title A', 'Title B'], 3], [['Title A', 'Title B']], ['Sample name', 'Other name'],
        [target], ['Sample name', '50%', '2, Developing', target]]) {
        try { return stringsOf(value(...args)); } catch { /* try the next signature */ }
      }
      throw new Error(`no sample arguments for ${value}`);
    }
    if (Array.isArray(value)) return value.flatMap(stringsOf);
    if (value && typeof value === 'object') return Object.values(value).flatMap(stringsOf);
    return [];
  }

  const reportTexts = assessment => {
    const facts = buildAssessmentFacts(assessment);
    return [...facts.map(f => f.text), ...Object.values(buildGeneratedSections(facts, matchAssessmentActions(assessment))).map(s => s.text)];
  };

  it('the wording modules', () => {
    expect(missing([...stringsOf(reportWording), ...stringsOf(displayNames)])).toEqual([]);
  });

  it('the action catalogue', () => {
    expect(missing(stringsOf(actionCatalogue))).toEqual([]);
  });

  it.each(SCENARIOS.map(s => [s.file, s.assessment]))('the facts and generated sections of %s', (_, assessment) => {
    expect(missing(reportTexts(assessment))).toEqual([]);
  });

  it('the facts and generated sections of random assessments', () => {
    fc.assert(fc.property(assessmentArb, a => {
      expect(missing(reportTexts(a))).toEqual([]);
    }), { numRuns: 50 });
  });

  it('detects a character the font lacks (so the check cannot pass vacuously)', () => {
    expect(missing(['ok ✓ 😀'])).toEqual(['✓', '😀']);
  });
});
