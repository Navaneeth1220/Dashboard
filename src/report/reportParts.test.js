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
const ALL_KEYS = ['headline', 'overview', 'whereToStart', ...GENERATED_KEYS];

describe('reportParts', () => {
  it('no result: no parts', () => {
    expect(reportParts(null)).toEqual([]);
  });

  it('ok: every part in reading order (Where to start after the overview), with title, text, origin and label', async () => {
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

  it('Recommended actions carries its blocks while unedited, and none once edited (Step 8)', async () => {
    const result = await S.ok();
    const blocksOf = edits => reportParts(result, edits).find(p => p.key === 'recommendedActions').blocks;
    expect(blocksOf({})).toEqual(result.generated.recommendedActions.blocks);
    expect(blocksOf({ recommendedActions: result.generated.recommendedActions.text })).toEqual(result.generated.recommendedActions.blocks);
    expect(blocksOf({ recommendedActions: 'Edited actions.' })).toBeNull();
    expect(reportParts(result).filter(p => p.blocks).map(p => p.key)).toEqual(['whereToStart', 'recommendedActions']);
  });

  it.each([
    ['failed', () => S.failed()],
    ['unavailable', () => S.unavailable('not_running', 'Ollama is not reachable.')],
  ])('%s: only the generated sections, even with edits for the model parts', async (_, make) => {
    const result = await make();
    const parts = reportParts(result, { headline: S.MARKER, overview: S.MARKER, whereToStart: S.MARKER });
    expect(parts.map(p => p.key)).toEqual(GENERATED_KEYS);
    expect(JSON.stringify(parts)).not.toContain(S.MARKER);
    expect(parts.every(p => p.origin === 'generated')).toBe(true);
  });
});

describe('Where to start (Step 9)', () => {
  it('ok: its text, factIds and blocks from the result; AI-drafted; blocks dropped once edited', async () => {
    const result = await S.ok();
    const part = reportParts(result).find(p => p.key === 'whereToStart');
    expect(part).toMatchObject({
      title: 'Where to start', origin: 'ai', label: 'ai', edited: false,
      text: result.whereToStart.part.text, factIds: result.whereToStart.part.factIds, blocks: result.whereToStart.part.blocks,
    });
    const edited = reportParts(result, { whereToStart: 'My own start.' }).find(p => p.key === 'whereToStart');
    expect(edited).toMatchObject({ text: 'My own start.', label: 'edited', blocks: null });
  });

  it('shown first when the headline/overview failed but it passed', async () => {
    const result = await S.failedWithPicks();
    const parts = reportParts(result, { headline: S.MARKER, overview: S.MARKER });
    expect(parts.map(p => p.key)).toEqual(['whereToStart', ...GENERATED_KEYS]);
    expect(JSON.stringify(parts)).not.toContain(S.MARKER);
    expect(provenanceLines(parts, DEFAULT_MODEL)[0]).toBe(`AI-drafted with ${DEFAULT_MODEL}, review before use: Where to start.`);
  });

  it.each([
    ['failed', () => S.picksFailed()],
    ['unavailable', () => S.picksUnavailable('timeout', 'No response.')],
  ])('its own status %s: not shown, even with an edit for it; the rest is', async (_, make) => {
    const result = await make();
    const parts = reportParts(result, { whereToStart: S.MARKER });
    expect(parts.map(p => p.key)).toEqual(['headline', 'overview', ...GENERATED_KEYS]);
    expect(JSON.stringify(parts)).not.toContain(S.MARKER);
  });
});

describe('provenanceLines', () => {
  it('AI-drafted, generated and edited parts, as Copy writes them', async () => {
    const parts = reportParts(await S.ok(), { overview: 'x' });
    expect(provenanceLines(parts, DEFAULT_MODEL)).toEqual([
      `AI-drafted with ${DEFAULT_MODEL}, review before use: Headline, Overview, Where to start.`,
      'Generated from the assessment: Measured performance, Gaps and missing evidence, Foundations and flags, Priorities, Targets, Recommended actions.',
      'Edited after generation: Overview.',
    ]);
  });

  it('extra generated titles come first in the generated line', async () => {
    const parts = reportParts(await S.failed());
    expect(provenanceLines(parts, DEFAULT_MODEL, ['Scores at a glance'])).toEqual([
      'Generated from the assessment: Scores at a glance, Measured performance, Gaps and missing evidence, Foundations and flags, Priorities, Targets, Recommended actions.',
    ]);
  });
});
