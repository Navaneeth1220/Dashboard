/**
 * reportParts and provenanceLines (docs/ai-report-spec.md, Step 6): the parts
 * the panel, Copy and the PDF show, and the provenance lines they end with.
 */

import { describe, it, expect } from 'vitest';
import baselineJson from '../../scenarios/Westmaas_2026-01-01_assessment.json?raw';
import { reportParts, provenanceLines } from './reportParts.js';
import { loadScenario, scriptedResults } from './testSupport.js';
import { GENERATED_KEYS } from './schema.js';
import { DEFAULT_MODEL } from './generate.js';
import { SECTION_TITLES } from '../data/reportWording.js';

const S = scriptedResults(loadScenario(baselineJson));
const ALL_KEYS = ['headline', 'overview', ...GENERATED_KEYS];

describe('reportParts', () => {
  it('no result: no parts', () => {
    expect(reportParts(null)).toEqual([]);
  });

  it('ok: all six parts in reading order, with title, text, origin and label', async () => {
    const result = await S.ok();
    const parts = reportParts(result);
    expect(parts.map(p => p.key)).toEqual(ALL_KEYS);
    for (const p of parts) {
      expect(p.title).toBe(SECTION_TITLES[p.key]);
      expect(p.origin).toBe(result.origin[p.key]);
      expect(p.label).toBe(p.origin);
      expect(p.edited).toBe(false);
      expect(p.text).toBe(p.generatedText);
    }
    expect(parts[0].text).toBe(S.VALID.headline.text);
    expect(parts[1].factIds).toEqual(S.VALID.overview.factIds);
  });

  it('an edit changes the text and makes the label "edited"; the same text as generated is no edit', async () => {
    const result = await S.ok();
    const parts = reportParts(result, { overview: 'New overview.', priorities: result.generated.priorities.text });
    const byKey = Object.fromEntries(parts.map(p => [p.key, p]));
    expect(byKey.overview).toMatchObject({ text: 'New overview.', edited: true, label: 'edited', origin: 'ai' });
    expect(byKey.priorities).toMatchObject({ edited: false, label: 'generated' });
  });

  it.each([
    ['failed', () => S.failed()],
    ['unavailable', () => S.unavailable('not_running', 'Ollama is not reachable.')],
  ])('%s: only the four generated sections, even with edits for the model parts', async (_, make) => {
    const result = await make();
    const parts = reportParts(result, { headline: S.MARKER, overview: S.MARKER });
    expect(parts.map(p => p.key)).toEqual(GENERATED_KEYS);
    expect(JSON.stringify(parts)).not.toContain(S.MARKER);
    expect(parts.every(p => p.origin === 'generated')).toBe(true);
  });
});

describe('provenanceLines', () => {
  it('AI-drafted, generated and edited parts, as Copy writes them', async () => {
    const parts = reportParts(await S.ok(), { overview: 'x' });
    expect(provenanceLines(parts, DEFAULT_MODEL)).toEqual([
      `AI-drafted with ${DEFAULT_MODEL}, review before use: Headline, Overview.`,
      'Generated from the assessment: Measured performance, Gaps and missing evidence, Foundations and flags, Priorities.',
      'Edited after generation: Overview.',
    ]);
  });

  it('extra generated titles come first in the generated line', async () => {
    const parts = reportParts(await S.failed());
    expect(provenanceLines(parts, DEFAULT_MODEL, ['Scores at a glance'])).toEqual([
      'Generated from the assessment: Scores at a glance, Measured performance, Gaps and missing evidence, Foundations and flags, Priorities.',
    ]);
  });
});
