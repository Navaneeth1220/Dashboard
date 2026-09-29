/**
 * PDF content builder (docs/ai-report-spec.md, Step 6). Every result comes
 * from generateNarrative with a scripted provider, never a hand-made object.
 */

import { describe, it, expect } from 'vitest';
import baselineJson from '../../../scenarios/Westmaas_2026-01-01_assessment.json?raw';
import { buildReportDocument, reportFilename, formatGeneratedAt } from './reportDocument.js';
import { loadScenario, scriptedResults } from '../testSupport.js';
import { reportParts, provenanceLines } from '../reportParts.js';
import { GENERATED_KEYS } from '../schema.js';
import { DEFAULT_MODEL } from '../generate.js';
import { computeAssessment } from '../../engine/scoring.js';
import { IH_INDICATOR_IDS } from '../../data/indicatorDefinitions.js';
import { formatScore, DIMENSION_NAMES } from '../../data/displayNames.js';
import { SECTION_TITLES, NARRATIVE_WORDING as W } from '../../data/reportWording.js';

const ASSESSMENT = loadScenario(baselineJson);
const S = scriptedResults(ASSESSMENT);
const GENERATED_AT = new Date(2026, 0, 2, 9, 5).toISOString();
const ID_PATTERN = /\b(?:IH|BC|RM)-\d|\bL0-[a-z]/;

const build = (result, extra = {}) =>
  buildReportDocument({ result, edits: {}, generatedAt: GENERATED_AT, model: DEFAULT_MODEL, ...extra });

describe('header', () => {
  it('title, client and assessment date from the result, and the generation time', async () => {
    const doc = build(await S.ok());
    expect(doc.title).toBe(W.title);
    expect(doc.meta).toEqual([
      { label: W.pdf.client, value: 'Westmaas' },
      { label: W.pdf.assessmentDate, value: '2026-01-01' },
      { label: W.pdf.generated, value: '2026-01-02 09:05' },
    ]);
    expect(doc.filename).toBe('Westmaas_2026-01-01_report.pdf');
  });

  it('client and date come from the snapshot the result was generated from, never from the caller', async () => {
    const result = await scriptedResults({ ...ASSESSMENT, meta: { clientId: 'Oudendijk', assessmentDate: '2026-03-01' } }).ok();
    const doc = build(result, { clientId: 'Westmaas', assessmentDate: '2026-01-01', meta: { clientId: 'Westmaas' } });
    expect(doc.meta[0].value).toBe('Oudendijk');
    expect(doc.meta[1].value).toBe('2026-03-01');
    expect(doc.filename).toBe('Oudendijk_2026-03-01_report.pdf');
  });

  it('empty values print "not recorded"', async () => {
    const result = await scriptedResults({ ...ASSESSMENT, meta: { clientId: '', assessmentDate: '' } }).ok();
    const doc = build(result, { generatedAt: null });
    expect(doc.meta.map(m => m.value)).toEqual([W.pdf.notRecorded, W.pdf.notRecorded, W.pdf.notRecorded]);
    expect(doc.filename).toBe('assessment_report.pdf');
  });
});

describe('reportFilename and formatGeneratedAt', () => {
  it.each([
    ['Westmaas', '2026-01-01', 'Westmaas_2026-01-01_report.pdf'],
    ['Westmaas Water  Treatment', '2026-01-01', 'Westmaas_Water_Treatment_2026-01-01_report.pdf'],
    ['a/b\\c:d*e?f"g<h>i|j', '2026-01-01', 'a_b_c_d_e_f_g_h_i_j_2026-01-01_report.pdf'],
    ['  ..Client.. ', '', 'Client_report.pdf'],
    ['', '2026-01-01', 'assessment_2026-01-01_report.pdf'],
    [null, null, 'assessment_report.pdf'],
    ['///', '', 'assessment_report.pdf'],
  ])('%j, %j → %s', (client, date, expected) => {
    expect(reportFilename(client, date)).toBe(expected);
  });

  it('local date and time to the minute; invalid or missing → null', () => {
    expect(formatGeneratedAt(new Date(2026, 8, 29, 14, 3, 59).toISOString())).toBe('2026-09-29 14:03');
    expect(formatGeneratedAt('not a date')).toBeNull();
    expect(formatGeneratedAt(null)).toBeNull();
  });
});

describe('scores at a glance', () => {
  it('one row per dimension with the engine score, labelled as generated', async () => {
    const doc = build(await S.ok());
    const r = computeAssessment(ASSESSMENT);
    const value = agg => (agg.incomplete ? W.pdf.noScore : formatScore(agg.score));
    expect(doc.scores).toEqual({
      title: W.pdf.scoresTitle,
      label: W.label.generated,
      columns: [W.pdf.dimensionColumn, W.pdf.scoreColumn],
      rows: [
        { name: DIMENSION_NAMES.IH, value: value(r.ih) },
        { name: DIMENSION_NAMES.BC, value: value(r.bc) },
        { name: DIMENSION_NAMES.OVERALL, value: value(r.overall) },
      ],
    });
  });

  it('an incomplete dimension (and so Overall): "no score (incomplete)", never a number', async () => {
    const incomplete = { ...ASSESSMENT, indicators: { ...ASSESSMENT.indicators, [IH_INDICATOR_IDS[0]]: { state: null } } };
    const doc = build(await scriptedResults(incomplete).unavailable('not_running', 'Ollama is not reachable.'));
    const r = computeAssessment(incomplete);
    expect(r.ih.incomplete).toBe(true);
    expect(doc.scores.rows[0]).toEqual({ name: DIMENSION_NAMES.IH, value: W.pdf.noScore });
    expect(doc.scores.rows[2]).toEqual({ name: DIMENSION_NAMES.OVERALL, value: W.pdf.noScore });
    expect(doc.scores.rows[1].value).toBe(formatScore(r.bc.score));
  });
});

describe('parts, closing and footer', () => {
  it('ok: every part with its label, the model footer, and the closing lines', async () => {
    const result = await S.ok();
    const doc = build(result);
    expect(doc.parts.map(p => p.title)).toEqual(['headline', 'overview', ...GENERATED_KEYS].map(k => SECTION_TITLES[k]));
    expect(doc.parts.map(p => p.label)).toEqual([W.label.ai, W.label.ai, ...GENERATED_KEYS.map(() => W.label.generated)]);
    expect(doc.parts[0].text).toBe(S.VALID.headline.text);
    expect(doc.footerModel).toBe(W.pdf.model(DEFAULT_MODEL));
    expect(doc.closing).toEqual(provenanceLines(reportParts(result), DEFAULT_MODEL, [W.pdf.scoresTitle]));
    // Targets (Step 7) and Recommended actions (Step 8): generated, last, and named in the closing.
    expect(doc.parts.at(-2)).toMatchObject({ title: 'Targets', label: W.label.generated });
    expect(doc.parts.at(-1)).toMatchObject({ title: 'Recommended actions', label: W.label.generated });
    expect(doc.closing[1]).toContain('Priorities, Targets, Recommended actions.');
  });

  it('an edit: the edited text, the "Edited" label and the edited line in the closing', async () => {
    const doc = build(await S.ok(), { edits: { overview: 'Edited overview.\nSecond paragraph.' } });
    expect(doc.parts[1]).toMatchObject({ title: 'Overview', label: W.label.edited, text: 'Edited overview.\nSecond paragraph.' });
    expect(doc.closing.at(-1)).toBe(W.footer.edited(['Overview']));
  });

  it("the result's own model names the footer", async () => {
    const result = { ...(await S.ok()), model: 'other-model:1b' };
    expect(build(result).footerModel).toBe(W.pdf.model('other-model:1b'));
  });

  it.each([
    ['failed', () => S.failed()],
    ['not_running', () => S.unavailable('not_running', 'Ollama is not reachable.')],
    ['model_missing', () => S.unavailable('model_missing', 'model not found')],
    ['timeout', () => S.unavailable('timeout', 'No response.')],
    ['provider_error', () => S.unavailable('provider_error', 'HTTP 500.')],
    ['cancelled', () => S.unavailable('cancelled', 'Generation was cancelled.')],
  ])('%s: only the four generated sections, no model footer, no draft or status text', async (_, make) => {
    const result = await make();
    const doc = build(result, { edits: { headline: S.MARKER, overview: S.MARKER } });
    expect(doc.parts.map(p => p.title)).toEqual(GENERATED_KEYS.map(k => SECTION_TITLES[k]));
    expect(doc.footerModel).toBeNull();
    const all = JSON.stringify(doc);
    for (const text of [S.MARKER, S.POOR, S.VALID.headline.text, DEFAULT_MODEL]) expect(all).not.toContain(text);
    if (result.message) expect(all).not.toContain(result.message);
  });

  it('Recommended actions: structured blocks while unedited, plain text once edited (Step 8)', async () => {
    const result = await S.ok();
    const actions = doc => doc.parts.find(p => p.key === 'recommendedActions');
    expect(actions(build(result)).blocks).toEqual(result.generated.recommendedActions.blocks);
    expect(actions(build(await S.failed())).blocks).toEqual(result.generated.recommendedActions.blocks);
    const editedText = 'Edited.\nSteps: not a label here.';
    const edited = actions(build(result, { edits: { recommendedActions: editedText } }));
    expect(edited).toEqual({ key: 'recommendedActions', title: 'Recommended actions', label: W.label.edited, text: editedText });
    expect(build(result).parts.filter(p => 'blocks' in p).map(p => p.key)).toEqual(['recommendedActions']);
  });

  it('no internal ID anywhere', async () => {
    for (const result of [await S.ok(), await S.failed()]) {
      expect(JSON.stringify(build(result))).not.toMatch(ID_PATTERN);
    }
  });
});
