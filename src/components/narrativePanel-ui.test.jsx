/**
 * Narrative panel rendering tests (docs/ai-report-spec.md, Step 5).
 *
 * Every result comes from generateNarrative for the Westmaas baseline with a
 * scripted provider, never a hand-made result object.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import baselineJson from '../../scenarios/Westmaas_2026-01-01_assessment.json?raw';
import NarrativePanel from './NarrativePanel.jsx';
import { DEFAULT_MODEL } from '../report/generate.js';
import { buildAssessmentFacts } from '../report/facts.js';
import { selectModelFacts } from '../report/prompt.js';
import { GENERATED_KEYS } from '../report/schema.js';
import { loadScenario, scriptedResults } from '../report/testSupport.js';
import { SECTION_TITLES, NARRATIVE_WORDING as W, WHERE_TO_START_WORDING as WTS } from '../data/reportWording.js';
import { downloadReportPdf } from '../report/pdf/download.js';
import { buildReportDocument } from '../report/pdf/reportDocument.js';

vi.mock('../report/pdf/download.js', () => ({ downloadReportPdf: vi.fn() }));

const ASSESSMENT = loadScenario(baselineJson);
const FACTS = buildAssessmentFacts(ASSESSMENT);
const MODEL_FACTS = selectModelFacts(FACTS);

const asSentence = t => (/[.!?]$/.test(t) ? t : `${t}.`);
const partOf = facts => ({ factIds: facts.map(f => f.id), text: facts.map(f => asSentence(f.text)).join(' ') });
const HEADLINE_FACTS = MODEL_FACTS.filter(f => f.id === 'F2');
const VALID = {
  // One sentence (check 18): F2's first sentence.
  headline: { factIds: ['F2'], text: HEADLINE_FACTS[0].text.split('. ')[0] + '.' },
  overview: partOf(MODEL_FACTS.filter(f => !HEADLINE_FACTS.includes(f))),
};
const POOR = 'Mean Time to Contain is poor.';
const MARKER = 'This sentence only exists in the rejected draft.';

// The same drafts as above; Where to start (Step 9) passes with `ok` and
// fails with `failed` (both parts fail), so `failed` still shows no AI part.
const S = scriptedResults(ASSESSMENT);
const okResult = () => S.ok();
const failedResult = () => S.failed();
const unavailableResult = (reason, message) => S.unavailable(reason, message);

const noop = () => {};
function renderPanel(props) {
  return render(
    <NarrativePanel phase="done" attempt={0} maxAttempts={0} result={null} model={DEFAULT_MODEL}
      stale={false} onGenerate={noop} onCancel={noop} {...props} />
  );
}

const partOfPanel = key => screen.getByTestId(`narrative-part-${key}`);
const labelOf = key => within(partOfPanel(key)).getByTestId('narrative-label').textContent;
const textOf = key => within(partOfPanel(key)).getByRole('textbox').value;

describe('idle and running', () => {
  it('the user-facing wording: "Assessment report" and "Generate report"', () => {
    renderPanel({ phase: 'idle' });
    expect(screen.getByText('Assessment report')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate report' })).toBeInTheDocument();
    expect(screen.queryByText(/narrative/i)).toBeNull();
  });

  it('idle: the generate button and the model name, no parts', () => {
    renderPanel({ phase: 'idle' });
    expect(screen.getByRole('button', { name: W.generate })).toBeEnabled();
    expect(screen.getByText(DEFAULT_MODEL, { exact: false })).toBeInTheDocument();
    expect(screen.queryByTestId('narrative-part-headline')).toBeNull();
  });

  it('running: the attempt counter, a disabled button, and Cancel calls onCancel', () => {
    const onCancel = vi.fn();
    renderPanel({ phase: 'running', attempt: 2, maxAttempts: 3, onCancel });
    expect(screen.getByText('Generating… attempt 2 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: W.generate })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: W.cancel }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('running before the first attempt is reported: "Generating…"', () => {
    renderPanel({ phase: 'running', attempt: 0, maxAttempts: 0 });
    expect(screen.getByText('Generating…')).toBeInTheDocument();
  });

  it('Generate calls onGenerate', () => {
    const onGenerate = vi.fn();
    renderPanel({ phase: 'idle', onGenerate });
    fireEvent.click(screen.getByRole('button', { name: W.generate }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });
});

describe('ok', () => {
  it('every part with its title, its text and the label from origin', async () => {
    const result = await okResult();
    expect(result.status).toBe('ok');
    renderPanel({ result });

    expect(textOf('headline')).toBe(VALID.headline.text);
    expect(textOf('overview')).toBe(VALID.overview.text);
    for (const key of ['headline', 'overview']) {
      expect(within(partOfPanel(key)).getByText(SECTION_TITLES[key])).toBeInTheDocument();
      expect(labelOf(key)).toBe(W.label.ai);
    }
    for (const key of GENERATED_KEYS) {
      expect(within(partOfPanel(key)).getByText(SECTION_TITLES[key])).toBeInTheDocument();
      expect(labelOf(key)).toBe(W.label.generated);
      expect(textOf(key)).toBe(result.generated[key].text);
    }
  });

  it('"Based on facts" lists the text of each cited fact', async () => {
    const result = await okResult();
    renderPanel({ result });
    const facts = within(partOfPanel('priorities')).getAllByTestId('narrative-fact').map(li => li.textContent);
    expect(facts).toEqual(result.generated.priorities.factIds.map(id => FACTS.find(f => f.id === id).text));
  });

  it('editing a part makes its label "Edited"; the others keep theirs', async () => {
    renderPanel({ result: await okResult() });
    fireEvent.change(within(partOfPanel('overview')).getByRole('textbox'), { target: { value: 'Edited overview text.' } });
    expect(labelOf('overview')).toBe(W.label.edited);
    expect(labelOf('headline')).toBe(W.label.ai);
    expect(labelOf('priorities')).toBe(W.label.generated);
  });

  it('changing a part back to what was generated restores its label', async () => {
    renderPanel({ result: await okResult() });
    const box = within(partOfPanel('overview')).getByRole('textbox');
    fireEvent.change(box, { target: { value: 'x' } });
    fireEvent.change(box, { target: { value: VALID.overview.text } });
    expect(labelOf('overview')).toBe(W.label.ai);
  });

  it('a new result drops the edits', async () => {
    const first = await okResult();
    const { rerender } = renderPanel({ result: first });
    fireEvent.change(within(partOfPanel('overview')).getByRole('textbox'), { target: { value: 'x' } });
    rerender(<NarrativePanel phase="done" attempt={0} maxAttempts={0} result={await okResult()} model={DEFAULT_MODEL}
      stale={false} onGenerate={noop} onCancel={noop} />);
    expect(textOf('overview')).toBe(VALID.overview.text);
    expect(labelOf('overview')).toBe(W.label.ai);
  });
});

describe('text boxes size to their content', () => {
  // jsdom has no layout: scrollHeight is stubbed as 20 px per line of the current value.
  const linesHeight = el => 20 * el.value.split('\n').length;
  beforeEach(() => {
    vi.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get').mockImplementation(function () { return linesHeight(this); });
    return () => vi.restoreAllMocks();
  });

  it('every part is as tall as its content, with no inner scrolling', async () => {
    const result = await okResult();
    renderPanel({ result });
    for (const key of ['headline', 'overview', ...GENERATED_KEYS]) {
      const box = within(partOfPanel(key)).getByRole('textbox');
      expect(box.style.height, key).toBe(`${linesHeight(box)}px`);
      expect(box.style.overflowY, key).toBe('hidden');
    }
    const actions = within(partOfPanel('recommendedActions')).getByRole('textbox');
    expect(parseInt(actions.style.height, 10)).toBeGreaterThan(parseInt(within(partOfPanel('headline')).getByRole('textbox').style.height, 10));
  });

  it('follows edits, and re-measures when the window is resized', async () => {
    renderPanel({ result: await okResult() });
    const box = within(partOfPanel('overview')).getByRole('textbox');
    fireEvent.change(box, { target: { value: 'one\ntwo\nthree\nfour' } });
    expect(box.style.height).toBe('80px');
    fireEvent.change(box, { target: { value: 'one' } });
    expect(box.style.height).toBe('20px');

    box.style.height = '999px';   // as if the wrapping changed with the width
    fireEvent(window, new Event('resize'));
    expect(box.style.height).toBe('20px');
  });
});

describe('Copy', () => {
  let writeText;
  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  });

  it('copies every part with its title, the edits, and a footer naming AI-drafted, generated and edited parts', async () => {
    const result = await okResult();
    renderPanel({ result });
    fireEvent.change(within(partOfPanel('overview')).getByRole('textbox'), { target: { value: 'Edited overview text.' } });
    fireEvent.click(screen.getByRole('button', { name: W.copy }));

    const g = result.generated;
    expect(writeText).toHaveBeenCalledWith([
      'Headline', VALID.headline.text, '',
      'Overview', 'Edited overview text.', '',
      'Where to start', result.whereToStart.part.text, '',
      'Measured performance', g.measuredPerformance.text, '',
      'Gaps and missing evidence', g.gapsAndMissingEvidence.text, '',
      'Foundations and flags', g.foundationsAndFlags.text, '',
      'Priorities', g.priorities.text, '',
      'Targets', g.targets.text, '',
      'Recommended actions', g.recommendedActions.text, '',
      '---',
      `AI-drafted with ${DEFAULT_MODEL}, review before use: Headline, Overview, Where to start.`,
      'Generated from the assessment: Measured performance, Gaps and missing evidence, Foundations and flags, Priorities, Targets, Recommended actions.',
      'Edited after generation: Overview.',
    ].join('\n'));
    await waitFor(() => expect(screen.getByText(W.copied)).toBeInTheDocument());
  });

  it('without edits and without AI-drafted parts (failed): only the generated line', async () => {
    renderPanel({ result: await failedResult() });
    fireEvent.click(screen.getByRole('button', { name: W.copy }));
    const text = writeText.mock.calls[0][0];
    expect(text.startsWith('Measured performance\n')).toBe(true);
    expect(text.endsWith('---\nGenerated from the assessment: Measured performance, Gaps and missing evidence, Foundations and flags, Priorities, Targets, Recommended actions.')).toBe(true);
  });

  it('a failing clipboard says so', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    renderPanel({ result: await okResult() });
    fireEvent.click(screen.getByRole('button', { name: W.copy }));
    await waitFor(() => expect(screen.getByText(W.copyFailed)).toBeInTheDocument());
  });
});

describe('failed', () => {
  it('the error list by part title, the generated sections, and no model text', async () => {
    const result = await failedResult();
    expect(result.status).toBe('failed');
    const { container } = renderPanel({ result });

    expect(screen.getByText(W.failed)).toBeInTheDocument();
    const errors = screen.getAllByTestId('narrative-error').map(li => li.textContent);
    expect(errors).toContain('Overview: Mean Time to Contain has no score; do not describe it as "poor".');
    for (const key of GENERATED_KEYS) expect(labelOf(key)).toBe(W.label.generated);
    expect(screen.queryByTestId('narrative-part-headline')).toBeNull();
    expect(screen.queryByTestId('narrative-part-overview')).toBeNull();

    const shown = container.textContent + [...container.querySelectorAll('textarea')].map(t => t.value).join(' ');
    expect(shown).not.toContain(MARKER);
    expect(shown).not.toContain(POOR);
    expect(shown).not.toContain(VALID.headline.text);
  });
});

describe('unavailable', () => {
  it.each([
    ['not_running', 'Ollama is not reachable through the dev server proxy.', [W.unavailable.notRunning, 'ollama serve']],
    ['model_missing', 'model "qwen2.5:7b" not found, try pulling it first', ['model "qwen2.5:7b" not found, try pulling it first', `ollama pull ${DEFAULT_MODEL}`]],
    ['timeout', 'No response from Ollama within 300 s.', ['No response from Ollama within 300 s.']],
    ['provider_error', 'Ollama returned HTTP 500.', ['Ollama returned HTTP 500.']],
    ['cancelled', 'Generation was cancelled.', [W.unavailable.cancelled]],
  ])('%s: its message (and command), plus the generated sections', async (reason, message, expected) => {
    renderPanel({ result: await unavailableResult(reason, message) });
    for (const text of expected) expect(screen.getByText(text, { exact: false })).toBeInTheDocument();
    for (const key of GENERATED_KEYS) expect(labelOf(key)).toBe(W.label.generated);
    expect(screen.queryByTestId('narrative-part-headline')).toBeNull();
  });

  it('cancelled is neutral, not an error', async () => {
    renderPanel({ result: await unavailableResult('cancelled', 'Generation was cancelled.') });
    expect(screen.getByText(W.unavailable.cancelled)).not.toHaveAttribute('role', 'alert');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('stale', () => {
  it('the notice above the parts; the draft stays', async () => {
    renderPanel({ result: await okResult(), stale: true });
    expect(screen.getByText(W.stale)).toBeInTheDocument();
    expect(textOf('headline')).toBe(VALID.headline.text);
  });

  it('no notice when not stale', async () => {
    renderPanel({ result: await okResult() });
    expect(screen.queryByText(W.stale)).toBeNull();
  });
});

describe('Download PDF (Step 6)', () => {
  const GENERATED_AT = '2026-01-02T09:05:00.000Z';
  const pdfButton = () => screen.getByRole('button', { name: W.downloadPdf });
  beforeEach(() => {
    downloadReportPdf.mockReset();
    downloadReportPdf.mockResolvedValue(undefined);
  });

  it('shown with the parts, not before', async () => {
    renderPanel({ phase: 'idle' });
    expect(screen.queryByRole('button', { name: W.downloadPdf })).toBeNull();
    renderPanel({ result: await okResult() });
    expect(pdfButton()).toBeEnabled();
  });

  it('passes the result, the edits, the generation time and the model; the PDF gets the edited text', async () => {
    const result = await okResult();
    renderPanel({ result, generatedAt: GENERATED_AT });
    fireEvent.change(within(partOfPanel('overview')).getByRole('textbox'), { target: { value: 'Edited overview text.' } });
    fireEvent.click(pdfButton());

    expect(downloadReportPdf).toHaveBeenCalledTimes(1);
    const input = downloadReportPdf.mock.calls[0][0];
    expect(input).toEqual({ result, edits: { overview: 'Edited overview text.' }, generatedAt: GENERATED_AT, model: DEFAULT_MODEL });
    const doc = buildReportDocument(input);
    expect(doc.parts[1]).toMatchObject({ text: 'Edited overview text.', label: W.label.edited });
    await waitFor(() => expect(pdfButton()).toBeEnabled());
  });

  it('failed: what the PDF is built from contains no draft text', async () => {
    renderPanel({ result: await failedResult(), generatedAt: GENERATED_AT });
    fireEvent.click(pdfButton());
    const doc = JSON.stringify(buildReportDocument(downloadReportPdf.mock.calls[0][0]));
    expect(doc).not.toContain(MARKER);
    expect(doc).not.toContain(POOR);
    expect(doc).not.toContain(VALID.headline.text);
  });

  it('stale: disabled, with the hint to regenerate first', async () => {
    renderPanel({ result: await okResult(), stale: true });
    expect(pdfButton()).toBeDisabled();
    expect(screen.getByText(W.regenerateFirst)).toBeInTheDocument();
    fireEvent.click(pdfButton());
    expect(downloadReportPdf).not.toHaveBeenCalled();
  });

  it('no hint when not stale', async () => {
    renderPanel({ result: await okResult() });
    expect(screen.queryByText(W.regenerateFirst)).toBeNull();
  });

  it('while the PDF is prepared: "Preparing PDF…" and a disabled button', async () => {
    let finish;
    downloadReportPdf.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    renderPanel({ result: await okResult() });
    fireEvent.click(pdfButton());
    expect(screen.getByText(W.preparingPdf)).toBeInTheDocument();
    expect(pdfButton()).toBeDisabled();
    finish();
    await waitFor(() => expect(screen.queryByText(W.preparingPdf)).toBeNull());
    expect(pdfButton()).toBeEnabled();
  });

  it('a failure says so', async () => {
    downloadReportPdf.mockRejectedValue(new Error('font not loaded'));
    renderPanel({ result: await okResult() });
    fireEvent.click(pdfButton());
    await waitFor(() => expect(screen.getByText(W.pdfFailed)).toBeInTheDocument());
    expect(pdfButton()).toBeEnabled();
  });
});

describe('Where to start (Step 9)', () => {
  const keysShown = () => screen.getAllByTestId(/^narrative-part-/).map(el => el.dataset.testid.replace('narrative-part-', ''));
  const shownText = container => container.textContent + [...container.querySelectorAll('textarea')].map(t => t.value).join(' ');

  it('ok: directly after the overview, AI-drafted, with the catalogue titles and reasons; facts are the trigger facts', async () => {
    const result = await okResult();
    expect(result.whereToStart.status).toBe('ok');
    renderPanel({ result });

    expect(keysShown()).toEqual(['headline', 'overview', 'whereToStart', ...GENERATED_KEYS]);
    expect(within(partOfPanel('whereToStart')).getByText('Where to start')).toBeInTheDocument();
    expect(labelOf('whereToStart')).toBe(W.label.ai);
    expect(textOf('whereToStart')).toBe(result.whereToStart.part.text);
    expect(textOf('whereToStart').startsWith(WTS.leadIn)).toBe(true);
    for (const pick of result.whereToStart.picks) {
      expect(textOf('whereToStart')).toContain(`${pick.title}\n${pick.reason}`);
    }
    const facts = within(partOfPanel('whereToStart')).getAllByTestId('narrative-fact').map(li => li.textContent);
    expect(facts).toEqual(result.whereToStart.part.factIds.map(id => FACTS.find(f => f.id === id).text));
  });

  it('editable: an edit makes its label "Edited"', async () => {
    renderPanel({ result: await okResult() });
    fireEvent.change(within(partOfPanel('whereToStart')).getByRole('textbox'), { target: { value: 'My own start.' } });
    expect(labelOf('whereToStart')).toBe(W.label.edited);
    expect(textOf('whereToStart')).toBe('My own start.');
  });

  it('the headline/overview failed but Where to start passed: it is shown first, with the error list for the others', async () => {
    const result = await S.failedWithPicks();
    expect(result.status).toBe('failed');
    const { container } = renderPanel({ result });
    expect(screen.getByText(W.failed)).toBeInTheDocument();
    expect(keysShown()).toEqual(['whereToStart', ...GENERATED_KEYS]);
    expect(labelOf('whereToStart')).toBe(W.label.ai);
    expect(shownText(container)).not.toContain(MARKER);
  });

  it('Where to start failed: a notice with its errors, no part and no rejected text; the rest is shown', async () => {
    const result = await S.picksFailed();
    expect(result.status).toBe('ok');
    expect(result.whereToStart.status).toBe('failed');
    const { container } = renderPanel({ result });

    expect(keysShown()).toEqual(['headline', 'overview', ...GENERATED_KEYS]);
    const notice = screen.getByTestId('where-to-start-notice');
    expect(notice).toHaveTextContent(WTS.failed);
    expect(within(notice).getAllByTestId('narrative-error')[0]).toHaveTextContent('Write the reason as exactly one sentence.');
    expect(screen.queryByText(W.failed)).toBeNull();
    expect(shownText(container)).not.toContain(MARKER);
    // The notice sits where the part would be: after the overview.
    expect(partOfPanel('overview').compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Where to start unavailable: its message; cancelled is neutral', async () => {
    renderPanel({ result: await S.picksUnavailable('timeout', 'No response from Ollama within 300 s.') });
    expect(screen.getByTestId('where-to-start-notice')).toHaveTextContent(WTS.unavailable('No response from Ollama within 300 s.'));
    expect(screen.queryByTestId('narrative-part-whereToStart')).toBeNull();
  });

  it('Where to start cancelled: neutral, not an error', async () => {
    renderPanel({ result: await S.picksUnavailable('cancelled', 'Generation was cancelled.') });
    expect(screen.getByTestId('where-to-start-notice')).toHaveTextContent(WTS.cancelled);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('the whole report unavailable: no separate Where to start notice', async () => {
    renderPanel({ result: await unavailableResult('timeout', 'No response.') });
    expect(screen.queryByTestId('where-to-start-notice')).toBeNull();
  });

  it('running Where to start: its own attempt counter', () => {
    renderPanel({ phase: 'running', attempt: 1, maxAttempts: 3, attemptPart: 'whereToStart' });
    expect(screen.getByText('Drafting Where to start… attempt 1 of 3')).toBeInTheDocument();
  });

  it('Copy leaves a failed Where to start out', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderPanel({ result: await S.picksFailed() });
    fireEvent.click(screen.getByRole('button', { name: W.copy }));
    const text = writeText.mock.calls[0][0];
    expect(text).not.toContain('Where to start');
    expect(text).not.toContain(MARKER);
    expect(text).toContain(`AI-drafted with ${DEFAULT_MODEL}, review before use: Headline, Overview.`);
  });
});
