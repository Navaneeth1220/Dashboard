/**
 * Generation tests — docs/ai-report-spec.md, Step 4. The provider is mocked.
 *
 * VALID is the facts' own text (always passes the validator); INVALID adds
 * one known violation to its overview. Attempt 1 writes the whole narrative;
 * attempts 2 and 3 repair only the failing sections (whole-narrative retry
 * only when there is no usable draft).
 */

import { describe, it, expect, vi } from 'vitest';
import baselineJson from '../../scenarios/Westmaas_2026-01-01_assessment.json?raw';
import { generateNarrative, DEFAULT_MODEL, MAX_RETRY_ERRORS, RETRY_TEMPERATURE } from './generate.js';
import { ProviderUnavailableError } from './providers/ollama.js';
import { buildAssessmentFacts } from './facts.js';
import { SYSTEM_PROMPT, buildUserMessage } from './prompt.js';
import { buildOutputSchema, buildSectionSchema } from './schema.js';
import { loadScenario, echoNarrative } from './testSupport.js';

const ASSESSMENT = loadScenario(baselineJson);
const FACTS = buildAssessmentFacts(ASSESSMENT);
const BASE_MESSAGE = buildUserMessage(FACTS);

const VALID = echoNarrative(FACTS);

const clone = value => JSON.parse(JSON.stringify(value));

function withText(narrative, key, extra) {
  const n = clone(narrative);
  const part = key === 'headline' ? n.headline : n.sections[key];
  part.text += ` ${extra}`;
  return n;
}

const POOR = 'Mean Time to Contain is poor.';
const POOR_ERROR_LINE = `- "${POOR}": Mean Time to Contain has no score; do not describe it as "poor".`;
const INVALID = withText(VALID, 'overview', POOR);
const OVERVIEW_FACTS = FACTS.filter(f => INVALID.sections.overview.factIds.includes(f.id));

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

describe('ok', () => {
  it('valid on the first try: one whole-narrative call at temperature 0.2', async () => {
    const provider = scripted(reply(VALID));
    const result = await generateNarrative(ASSESSMENT, { provider });

    expect(result).toEqual({
      status: 'ok',
      narrative: VALID,
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
      schema: buildOutputSchema(FACTS.map(f => f.id)),
      temperature: 0.2,
      timeoutMs: undefined,
      signal: undefined,
    });
  });

  it('invalid overview: only the overview is repaired, with its own facts, schema, errors and description', async () => {
    const provider = scripted(reply(INVALID), reply(VALID.sections.overview));
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
      'Write only the overview part: what was assessed and the dimension results.',
      'Your previous version broke these rules:',
      POOR_ERROR_LINE,
      'Write this part again from the facts above, following every rule.',
    ].join('\n'));
    expect(result.attempts).toEqual([
      { attempt: 1, section: null, errors: [expect.objectContaining({ section: 'overview', rule: 'noScoreWording' })], ...counts },
      { attempt: 2, section: 'overview', errors: [], ...counts },
    ]);
  });

  it('passed sections are kept exactly as they were', async () => {
    const provider = scripted(reply(INVALID), reply(VALID.sections.overview));
    const result = await generateNarrative(ASSESSMENT, { provider });
    const { overview, ...otherSections } = result.narrative.sections;
    const { overview: _, ...invalidOthers } = INVALID.sections;
    expect(result.narrative.headline).toEqual(INVALID.headline);
    expect(otherSections).toEqual(invalidOthers);
    expect(overview).toEqual(VALID.sections.overview);
  });

  it('several failing sections are repaired in order within one attempt', async () => {
    const draft = withText(withText(VALID, 'priorities', POOR), 'headline', POOR);
    const provider = scripted(reply(draft), reply(VALID.headline), reply(VALID.sections.priorities));
    const onAttempt = vi.fn();
    const result = await generateNarrative(ASSESSMENT, { provider, onAttempt });

    expect(result.status).toBe('ok');
    expect(provider).toHaveBeenCalledTimes(3);
    expect(provider.mock.calls[1][0].user).toContain('Write only the headline part: one sentence with the most important point.');
    expect(provider.mock.calls[2][0].user).toContain('Write only the priorities part: the lowest results, as the priority fact lists them.');
    expect(result.attempts.map(a => [a.attempt, a.section])).toEqual([[1, null], [2, 'headline'], [2, 'priorities']]);
    expect(onAttempt).toHaveBeenCalledTimes(2);
  });

  it('passes model, timeoutMs and signal through to every call', async () => {
    const provider = scripted(reply(INVALID), reply(VALID.sections.overview));
    const signal = new AbortController().signal;
    const result = await generateNarrative(ASSESSMENT, { provider, model: 'llama3.1:8b', timeoutMs: 5000, signal });
    for (const [args] of provider.mock.calls) {
      expect(args).toMatchObject({ model: 'llama3.1:8b', timeoutMs: 5000, signal });
    }
    expect(result.model).toBe('llama3.1:8b');
  });
});

describe('failed', () => {
  it('always invalid: failed after 3 attempts, no narrative, last errors', async () => {
    const provider = scripted(reply(INVALID), reply(INVALID.sections.overview));
    const result = await generateNarrative(ASSESSMENT, { provider });

    expect(provider).toHaveBeenCalledTimes(3);
    expect(result.status).toBe('failed');
    expect(result.narrative).toBeNull();
    expect(result.errors).toEqual(result.attempts[2].errors);
    expect(result.attempts.map(a => [a.attempt, a.section])).toEqual([[1, null], [2, 'overview'], [3, 'overview']]);
  });

  it('never carries the draft text', async () => {
    const marker = 'This sentence only exists in the rejected draft.';
    const provider = scripted(reply(withText(INVALID, 'overview', marker)), reply(withText(INVALID, 'overview', marker).sections.overview));
    const result = await generateNarrative(ASSESSMENT, { provider });
    expect(result.status).toBe('failed');
    expect(JSON.stringify(result)).not.toContain(marker);
    for (const a of result.attempts) {
      expect(Object.keys(a).sort()).toEqual(['attempt', 'doneReason', 'durationMs', 'errors', 'evalCount', 'promptEvalCount', 'section']);
    }
  });

  it('respects maxAttempts', async () => {
    const provider = scripted(reply(INVALID));
    const result = await generateNarrative(ASSESSMENT, { provider, maxAttempts: 1 });
    expect(provider).toHaveBeenCalledOnce();
    expect(result.status).toBe('failed');
  });
});

describe('unusable output', () => {
  it('content that is not JSON: whole-narrative retry at temperature 0.5, message pinned', async () => {
    const provider = scripted(reply('{"headline": {"factIds": ["C1"'), reply(VALID));
    const result = await generateNarrative(ASSESSMENT, { provider });

    expect(result.status).toBe('ok');
    expect(result.attempts[0]).toEqual({ attempt: 1, section: null, errors: [shapeError], ...counts });
    const retry = provider.mock.calls[1][0];
    expect(retry.temperature).toBe(0.5);
    expect(retry.schema).toEqual(buildOutputSchema(FACTS.map(f => f.id)));
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
    expect(provider.mock.calls[1][0].schema).toEqual(buildOutputSchema(FACTS.map(f => f.id)));
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
  });

  it('an unusable section reply keeps the section as it was, with the shape error', async () => {
    const provider = scripted(reply(INVALID), reply('not json'), reply(VALID.sections.overview));
    const result = await generateNarrative(ASSESSMENT, { provider });

    expect(result.status).toBe('ok');
    expect(result.attempts[1]).toMatchObject({
      attempt: 2,
      section: 'overview',
      errors: [
        { ...shapeError, section: 'overview' },
        expect.objectContaining({ section: 'overview', rule: 'noScoreWording' }),
      ],
    });
    const third = provider.mock.calls[2][0].user;
    expect(third).toContain('- The response was cut off or was not valid JSON.');
    expect(third).toContain(POOR_ERROR_LINE);
  });
});

describe('retry messages', () => {
  it(`a section repair lists at most ${MAX_RETRY_ERRORS} errors, then "…and N more"`, async () => {
    const numbers = Array.from({ length: 12 }, (_, i) => `The value is ${101 + i}.`).join(' ');
    const provider = scripted(reply(withText(VALID, 'overview', numbers)), reply(VALID.sections.overview));
    const result = await generateNarrative(ASSESSMENT, { provider });

    expect(result.attempts[0].errors).toHaveLength(12);
    const listed = provider.mock.calls[1][0].user.split('\n').filter(line => line.startsWith('- '));
    expect(listed).toHaveLength(MAX_RETRY_ERRORS + 1);
    expect(listed.at(-1)).toBe('- …and 2 more.');
  });

  it('uses only the latest attempt\'s errors', async () => {
    const provider = scripted(
      reply(INVALID),
      reply(withText(VALID, 'overview', 'The value is 999.').sections.overview),
      reply(VALID.sections.overview),
    );
    await generateNarrative(ASSESSMENT, { provider });
    const third = provider.mock.calls[2][0].user;
    expect(third).toContain('"999"');
    expect(third).not.toContain(POOR);
  });
});

describe('unavailable', () => {
  for (const reason of ['not_running', 'model_missing', 'timeout', 'cancelled', 'provider_error']) {
    it(`${reason}: no retry, reason and message returned`, async () => {
      const provider = scripted(new ProviderUnavailableError(reason, `message for ${reason}`));
      const result = await generateNarrative(ASSESSMENT, { provider });

      expect(provider).toHaveBeenCalledOnce();
      expect(result).toEqual({
        status: 'unavailable', reason, message: `message for ${reason}`,
        narrative: null, errors: [], facts: FACTS, attempts: [], model: DEFAULT_MODEL,
      });
    });
  }

  it('network error thrown as a plain error → provider_error', async () => {
    const result = await generateNarrative(ASSESSMENT, { provider: scripted(new TypeError('fetch failed')) });
    expect(result).toMatchObject({ status: 'unavailable', reason: 'provider_error', message: 'fetch failed' });
  });

  it('unavailable during a section repair discards the draft', async () => {
    const provider = scripted(reply(INVALID), new ProviderUnavailableError('timeout', 'No response.'));
    const result = await generateNarrative(ASSESSMENT, { provider });
    expect(result).toMatchObject({ status: 'unavailable', reason: 'timeout', narrative: null });
    expect(result.attempts).toHaveLength(1);
  });
});

describe('progress', () => {
  it('onAttempt reports each attempt once', async () => {
    const onAttempt = vi.fn();
    await generateNarrative(ASSESSMENT, { provider: scripted(reply(INVALID), reply(INVALID.sections.overview)), onAttempt });
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
