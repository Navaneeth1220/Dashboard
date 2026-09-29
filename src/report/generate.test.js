/**
 * Generation tests — docs/ai-report-spec.md, Step 4 (hybrid report). The
 * provider is mocked.
 *
 * The model writes only the headline and the overview, from the reduced fact
 * set; the four generated sections come from the templates. VALID is the
 * model facts' own text (always passes the validator); INVALID adds one known
 * violation to its overview.
 */

import { describe, it, expect, vi } from 'vitest';
import baselineJson from '../../scenarios/Westmaas_2026-01-01_assessment.json?raw';
import { generateNarrative, DEFAULT_MODEL, MAX_RETRY_ERRORS, RETRY_TEMPERATURE } from './generate.js';
import { ProviderUnavailableError } from './providers/ollama.js';
import { buildAssessmentFacts } from './facts.js';
import { buildGeneratedSections } from './templates.js';
import { SYSTEM_PROMPT, buildUserMessage, selectModelFacts } from './prompt.js';
import { buildOutputSchema, buildSectionSchema } from './schema.js';
import { loadScenario } from './testSupport.js';

const ASSESSMENT = loadScenario(baselineJson);
const FACTS = buildAssessmentFacts(ASSESSMENT);
const MODEL_FACTS = selectModelFacts(FACTS);
const BASE_MESSAGE = buildUserMessage(MODEL_FACTS);
const GENERATED = buildGeneratedSections(FACTS);
const ORIGIN = {
  headline: 'ai', overview: 'ai',
  measuredPerformance: 'generated', gapsAndMissingEvidence: 'generated', foundationsAndFlags: 'generated', priorities: 'generated',
  targets: 'generated',
};

const clone = value => JSON.parse(JSON.stringify(value));
const asSentence = t => (/[.!?]$/.test(t) ? t : `${t}.`);
const partOf = facts => ({ factIds: facts.map(f => f.id), text: facts.map(f => asSentence(f.text)).join(' ') });

/** Both model parts from the model facts' own text; the headline cites a finding (F2), not only context (check 12). */
const HEADLINE_FACTS = MODEL_FACTS.filter(f => f.id === 'F2');
const VALID = {
  // One sentence (check 18): F2's first sentence.
  headline: { factIds: ['F2'], text: HEADLINE_FACTS[0].text.split('. ')[0] + '.' },
  overview: partOf(MODEL_FACTS.filter(f => !HEADLINE_FACTS.includes(f))),
};

function withText(reply, key, extra) {
  const r = clone(reply);
  r[key].text += ` ${extra}`;
  return r;
}

const POOR = 'Mean Time to Contain is poor.';
const POOR_ERROR_LINE = `- "${POOR}": Mean Time to Contain has no score; do not describe it as "poor".`;
const INVALID = withText(VALID, 'overview', POOR);
const OVERVIEW_FACTS = MODEL_FACTS.filter(f => INVALID.overview.factIds.includes(f.id));

const reply = (value, overrides = {}) => ({
  content: typeof value === 'string' ? value : JSON.stringify(value),
  promptEvalCount: 1300, evalCount: 600, doneReason: 'stop', durationMs: 1000,
  ...overrides,
});

/** A provider that returns (or throws) the given replies in order, repeating the last. */
function scripted(...replies) {
  let i = 0;
  return vi.fn(async () => {
    const next = replies[Math.min(i++, replies.length - 1)];
    if (next instanceof Error) throw next;
    return next;
  });
}

const shapeError = { section: null, sentence: null, rule: 'shape', detail: 'The response was cut off or was not valid JSON.' };
const counts = { promptEvalCount: 1300, evalCount: 600, doneReason: 'stop', durationMs: 1000 };
const assembled = parts => ({ headline: parts.headline, sections: { overview: parts.overview, ...GENERATED } });

describe('ok', () => {
  it('valid on the first try: the model gets only its facts; the report assembles the generated sections', async () => {
    const provider = scripted(reply(VALID));
    const result = await generateNarrative(ASSESSMENT, { provider });

    expect(result).toEqual({
      status: 'ok',
      narrative: assembled(VALID),
      generated: GENERATED,
      origin: ORIGIN,
      errors: [],
      facts: FACTS,
      attempts: [{ attempt: 1, section: null, errors: [], ...counts }],
      model: DEFAULT_MODEL,
    });
    expect(provider).toHaveBeenCalledOnce();
    expect(provider).toHaveBeenCalledWith({
      model: 'qwen2.5:7b',
      system: SYSTEM_PROMPT,
      user: BASE_MESSAGE,
      schema: buildOutputSchema(MODEL_FACTS.map(f => f.id)),
      temperature: 0.2,
      timeoutMs: undefined,
      signal: undefined,
    });
  });

  it('invalid overview: only the overview is repaired, with its own facts, schema, errors and description', async () => {
    const provider = scripted(reply(INVALID), reply(VALID.overview));
    const result = await generateNarrative(ASSESSMENT, { provider });

    expect(result.status).toBe('ok');
    expect(provider).toHaveBeenCalledTimes(2);
    const repair = provider.mock.calls[1][0];
    expect(repair.temperature).toBe(RETRY_TEMPERATURE);
    expect(RETRY_TEMPERATURE).toBe(0.5);
    expect(repair.schema).toEqual(buildSectionSchema(OVERVIEW_FACTS.map(f => f.id)));
    expect(repair.user).toBe([
      buildUserMessage(OVERVIEW_FACTS),
      '',
      'Write only the overview part: what was assessed, the dimension results, and the flags, each with the severity its fact states; mention every flag given.',
      'Your previous version broke these rules:',
      POOR_ERROR_LINE,
      'Write this part again from the facts above, following every rule.',
    ].join('\n'));
    expect(result.attempts).toEqual([
      { attempt: 1, section: null, errors: [expect.objectContaining({ section: 'overview', rule: 'noScoreWording' })], ...counts },
      { attempt: 2, section: 'overview', errors: [], ...counts },
    ]);
  });

  it('a title-only headline (check 12) is repaired with all model facts, so it can cite a finding', async () => {
    const title = { factIds: ['C1'], text: 'OT Cybersecurity Assessment of Westmaas as of 2026-01-01.' };
    const provider = scripted(reply({ ...VALID, headline: title }), reply(VALID.headline));
    const result = await generateNarrative(ASSESSMENT, { provider });

    expect(result.attempts[0].errors).toEqual([expect.objectContaining({ section: 'headline', rule: 'headlineFacts' })]);
    const repair = provider.mock.calls[1][0];
    expect(repair.schema).toEqual(buildSectionSchema(MODEL_FACTS.map(f => f.id)));
    expect(repair.user.startsWith(`${BASE_MESSAGE}\n\nWrite only the headline part:`)).toBe(true);
    expect(result.status).toBe('ok');
    expect(result.narrative.headline).toEqual(VALID.headline);
  });

  it('a headline citing only context and scale facts is repaired with all model facts too', async () => {
    const title = { factIds: ['C1', 'C3'], text: 'OT Cybersecurity Assessment of Westmaas as of 2026-01-01.' };
    const provider = scripted(reply({ ...VALID, headline: title }), reply(VALID.headline));
    await generateNarrative(ASSESSMENT, { provider });
    expect(provider.mock.calls[1][0].schema).toEqual(buildSectionSchema(MODEL_FACTS.map(f => f.id)));
  });

  it('the part that passed is kept exactly as it was', async () => {
    const provider = scripted(reply(INVALID), reply(VALID.overview));
    const result = await generateNarrative(ASSESSMENT, { provider });
    expect(result.narrative.headline).toEqual(INVALID.headline);
    expect(result.narrative.sections.overview).toEqual(VALID.overview);
  });

  it('both parts are repaired in order within one attempt', async () => {
    const draft = withText(withText(VALID, 'overview', POOR), 'headline', POOR);
    const provider = scripted(reply(draft), reply(VALID.headline), reply(VALID.overview));
    const onAttempt = vi.fn();
    const result = await generateNarrative(ASSESSMENT, { provider, onAttempt });

    expect(result.status).toBe('ok');
    expect(provider).toHaveBeenCalledTimes(3);
    expect(provider.mock.calls[1][0].user).toContain(
      'Write only the headline part: one sentence stating the most important finding, not a title. Do not repeat the client name or date.');
    expect(provider.mock.calls[2][0].user).toContain('Write only the overview part:');
    expect(result.attempts.map(a => [a.attempt, a.section])).toEqual([[1, null], [2, 'headline'], [2, 'overview']]);
    expect(onAttempt).toHaveBeenCalledTimes(2);
  });

  it('passes model, timeoutMs and signal through to every call', async () => {
    const provider = scripted(reply(INVALID), reply(VALID.overview));
    const signal = new AbortController().signal;
    const result = await generateNarrative(ASSESSMENT, { provider, model: 'llama3.1:8b', timeoutMs: 5000, signal });
    for (const [args] of provider.mock.calls) {
      expect(args).toMatchObject({ model: 'llama3.1:8b', timeoutMs: 5000, signal });
    }
    expect(result.model).toBe('llama3.1:8b');
  });
});

describe('failed', () => {
  it('always invalid: failed after 3 attempts, no narrative, generated sections still returned', async () => {
    const provider = scripted(reply(INVALID), reply(INVALID.overview));
    const result = await generateNarrative(ASSESSMENT, { provider });

    expect(provider).toHaveBeenCalledTimes(3);
    expect(result.status).toBe('failed');
    expect(result.narrative).toBeNull();
    expect(result.generated).toEqual(GENERATED);
    expect(result.origin).toEqual(ORIGIN);
    expect(result.errors).toEqual(result.attempts[2].errors);
    expect(result.attempts.map(a => [a.attempt, a.section])).toEqual([[1, null], [2, 'overview'], [3, 'overview']]);
  });

  it('never carries the model text', async () => {
    const marker = 'This sentence only exists in the rejected draft.';
    const draft = withText(INVALID, 'overview', marker);
    const provider = scripted(reply(draft), reply(draft.overview));
    const result = await generateNarrative(ASSESSMENT, { provider });
    expect(result.status).toBe('failed');
    expect(JSON.stringify(result)).not.toContain(marker);
    for (const a of result.attempts) {
      expect(Object.keys(a).sort()).toEqual(['attempt', 'doneReason', 'durationMs', 'errors', 'evalCount', 'promptEvalCount', 'section']);
    }
  });

  it('never carries a rejected sentence: failed errors and attempt records have sentence null', async () => {
    const provider = scripted(reply(INVALID), reply(INVALID.overview));
    const result = await generateNarrative(ASSESSMENT, { provider });
    expect(result.status).toBe('failed');
    expect(JSON.stringify(result)).not.toContain(POOR);
    expect(result.errors.length).toBeGreaterThan(0);
    for (const e of [...result.errors, ...result.attempts.flatMap(a => a.errors)]) {
      expect(e.sentence).toBeNull();
      expect(e.detail).toEqual(expect.any(String));
    }
  });

  it('ok after a repair: the attempt records carry no rejected sentence either', async () => {
    const provider = scripted(reply(INVALID), reply(VALID.overview));
    const result = await generateNarrative(ASSESSMENT, { provider });
    expect(result.status).toBe('ok');
    expect(result.attempts[0].errors).toEqual([expect.objectContaining({ rule: 'noScoreWording', sentence: null })]);
    expect(JSON.stringify(result)).not.toContain(POOR);
  });

  it('keepSentences (manual-check script only) keeps them', async () => {
    const provider = scripted(reply(INVALID), reply(INVALID.overview));
    const result = await generateNarrative(ASSESSMENT, { provider, keepSentences: true });
    expect(result.errors).toEqual([expect.objectContaining({ sentence: POOR })]);
    expect(result.attempts[0].errors).toEqual([expect.objectContaining({ sentence: POOR })]);
  });

  it('respects maxAttempts', async () => {
    const provider = scripted(reply(INVALID));
    const result = await generateNarrative(ASSESSMENT, { provider, maxAttempts: 1 });
    expect(provider).toHaveBeenCalledOnce();
    expect(result.status).toBe('failed');
  });
});

describe('unusable output', () => {
  it('content that is not JSON: retry of both parts at temperature 0.5, message pinned', async () => {
    const provider = scripted(reply('{"headline": {"factIds": ["C1"'), reply(VALID));
    const result = await generateNarrative(ASSESSMENT, { provider });

    expect(result.status).toBe('ok');
    expect(result.attempts[0]).toEqual({ attempt: 1, section: null, errors: [shapeError], ...counts });
    const retry = provider.mock.calls[1][0];
    expect(retry.temperature).toBe(0.5);
    expect(retry.schema).toEqual(buildOutputSchema(MODEL_FACTS.map(f => f.id)));
    expect(retry.user).toBe([
      BASE_MESSAGE,
      '',
      'Your previous draft broke these rules:',
      '- narrative: The response was cut off or was not valid JSON.',
      'Write the whole summary again from the facts above, following every rule.',
    ].join('\n'));
  });

  it('cut-off output (done_reason "length") is unusable even if it parses', async () => {
    const provider = scripted(reply(VALID, { doneReason: 'length' }), reply(VALID));
    const result = await generateNarrative(ASSESSMENT, { provider });
    expect(result.status).toBe('ok');
    expect(result.attempts[0]).toMatchObject({ section: null, errors: [shapeError], doneReason: 'length' });
  });

  it('JSON that is not an object is unusable', async () => {
    const provider = scripted(reply('42'), reply(VALID));
    const result = await generateNarrative(ASSESSMENT, { provider });
    expect(result.status).toBe('ok');
    expect(result.attempts[0].errors).toEqual([shapeError]);
  });

  it('a malformed provider reply never throws', async () => {
    const result = await generateNarrative(ASSESSMENT, { provider: scripted(null) });
    expect(result.status).toBe('failed');
    expect(result.errors).toEqual([shapeError]);
    expect(result.generated).toEqual(GENERATED);
  });

  it('an unusable part reply keeps the part as it was, with the shape error', async () => {
    const provider = scripted(reply(INVALID), reply('not json'), reply(VALID.overview));
    const result = await generateNarrative(ASSESSMENT, { provider });

    expect(result.status).toBe('ok');
    expect(result.attempts[1]).toMatchObject({
      attempt: 2,
      section: 'overview',
      errors: [{ ...shapeError, section: 'overview' }, expect.objectContaining({ section: 'overview', rule: 'noScoreWording' })],
    });
    const third = provider.mock.calls[2][0].user;
    expect(third).toContain('- The response was cut off or was not valid JSON.');
    expect(third).toContain(POOR_ERROR_LINE);
  });
});

describe('retry messages', () => {
  it(`a part repair lists at most ${MAX_RETRY_ERRORS} errors, then "…and N more"`, async () => {
    const numbers = Array.from({ length: 12 }, (_, i) => `The value is ${101 + i}.`).join(' ');
    const provider = scripted(reply(withText(VALID, 'overview', numbers)), reply(VALID.overview));
    const result = await generateNarrative(ASSESSMENT, { provider });

    expect(result.attempts[0].errors).toHaveLength(12);
    const listed = provider.mock.calls[1][0].user.split('\n').filter(line => line.startsWith('- '));
    expect(listed).toHaveLength(MAX_RETRY_ERRORS + 1);
    expect(listed.at(-1)).toBe('- …and 2 more.');
  });

  it('uses only the latest attempt\'s errors', async () => {
    const provider = scripted(reply(INVALID), reply(withText(VALID, 'overview', 'The value is 999.').overview), reply(VALID.overview));
    await generateNarrative(ASSESSMENT, { provider });
    const third = provider.mock.calls[2][0].user;
    expect(third).toContain('"999"');
    expect(third).not.toContain(POOR);
  });
});

describe('unavailable', () => {
  for (const reason of ['not_running', 'model_missing', 'timeout', 'cancelled', 'provider_error']) {
    it(`${reason}: reason and message returned, generated sections still returned`, async () => {
      const provider = scripted(new ProviderUnavailableError(reason, `message for ${reason}`));
      const result = await generateNarrative(ASSESSMENT, { provider });

      // Only provider_error on the very first call is repeated, once.
      expect(provider).toHaveBeenCalledTimes(reason === 'provider_error' ? 2 : 1);
      expect(result).toEqual({
        status: 'unavailable', reason, message: `message for ${reason}`,
        narrative: null, generated: GENERATED, origin: ORIGIN,
        errors: [], facts: FACTS, attempts: [], model: DEFAULT_MODEL,
      });
    });
  }

  it('provider_error on the very first call: repeated once, then ok (the llama-server load crash)', async () => {
    const onAttempt = vi.fn();
    const provider = scripted(new ProviderUnavailableError('provider_error', 'llama-server process has terminated'), reply(VALID));
    const result = await generateNarrative(ASSESSMENT, { provider, onAttempt });
    expect(result.status).toBe('ok');
    expect(provider).toHaveBeenCalledTimes(2);
    expect(provider.mock.calls[1][0]).toEqual(provider.mock.calls[0][0]);
    expect(result.attempts).toHaveLength(1);
    expect(onAttempt).toHaveBeenCalledOnce();
  });

  it('provider_error on a later call (a repair) is not repeated', async () => {
    const provider = scripted(reply(INVALID), new ProviderUnavailableError('provider_error', 'boom'), reply(VALID.overview));
    const result = await generateNarrative(ASSESSMENT, { provider });
    expect(result).toMatchObject({ status: 'unavailable', reason: 'provider_error' });
    expect(provider).toHaveBeenCalledTimes(2);
  });

  it('network error thrown as a plain error → provider_error', async () => {
    const result = await generateNarrative(ASSESSMENT, { provider: scripted(new TypeError('fetch failed')) });
    expect(result).toMatchObject({ status: 'unavailable', reason: 'provider_error', message: 'fetch failed' });
  });

  it('unavailable during a part repair discards the draft', async () => {
    const provider = scripted(reply(INVALID), new ProviderUnavailableError('timeout', 'No response.'));
    const result = await generateNarrative(ASSESSMENT, { provider });
    expect(result).toMatchObject({ status: 'unavailable', reason: 'timeout', narrative: null, generated: GENERATED });
    expect(result.attempts).toHaveLength(1);
  });
});

describe('progress', () => {
  it('onAttempt reports each attempt once', async () => {
    const onAttempt = vi.fn();
    await generateNarrative(ASSESSMENT, { provider: scripted(reply(INVALID), reply(INVALID.overview)), onAttempt });
    expect(onAttempt.mock.calls.map(c => c[0])).toEqual([
      { attempt: 1, maxAttempts: 3 }, { attempt: 2, maxAttempts: 3 }, { attempt: 3, maxAttempts: 3 },
    ]);
  });

  it('a throwing onAttempt is logged and generation still returns ok', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const onAttempt = () => { throw new Error('UI went away'); };
      const result = await generateNarrative(ASSESSMENT, { provider: scripted(reply(VALID)), onAttempt });
      expect(result.status).toBe('ok');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('UI went away'));
    } finally {
      warn.mockRestore();
    }
  });
});
