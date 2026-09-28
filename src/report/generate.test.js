/**
 * Generation tests — docs/ai-report-spec.md, Step 4. The provider is mocked.
 *
 * VALID is the facts' own text (always passes the validator); INVALID adds
 * one known violation to it.
 */

import { describe, it, expect, vi } from 'vitest';
import baselineJson from '../../scenarios/Westmaas_2026-01-01_assessment.json?raw';
import { generateNarrative, DEFAULT_MODEL, MAX_RETRY_ERRORS } from './generate.js';
import { ProviderUnavailableError } from './providers/ollama.js';
import { buildAssessmentFacts } from './facts.js';
import { SYSTEM_PROMPT, buildUserMessage } from './prompt.js';
import { buildOutputSchema } from './schema.js';
import { loadScenario, echoNarrative } from './testSupport.js';

const ASSESSMENT = loadScenario(baselineJson);
const FACTS = buildAssessmentFacts(ASSESSMENT);
const BASE_MESSAGE = buildUserMessage(FACTS);

const VALID = echoNarrative(FACTS);

function withOverview(narrative, extra) {
  const n = JSON.parse(JSON.stringify(narrative));
  n.sections.overview.text += ` ${extra}`;
  return n;
}

const INVALID = withOverview(VALID, 'Mean Time to Contain is poor.');

const reply = (narrative, overrides = {}) => ({
  content: typeof narrative === 'string' ? narrative : JSON.stringify(narrative),
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

describe('ok', () => {
  it('valid on the first try', async () => {
    const provider = scripted(reply(VALID));
    const result = await generateNarrative(ASSESSMENT, { provider });

    expect(result).toEqual({
      status: 'ok',
      narrative: VALID,
      errors: [],
      facts: FACTS,
      attempts: [{ attempt: 1, errors: [], promptEvalCount: 1300, evalCount: 600, doneReason: 'stop', durationMs: 1000 }],
      model: DEFAULT_MODEL,
    });
    expect(provider).toHaveBeenCalledOnce();
    expect(provider).toHaveBeenCalledWith({
      model: 'qwen2.5:7b',
      system: SYSTEM_PROMPT,
      user: BASE_MESSAGE,
      schema: buildOutputSchema(FACTS.map(f => f.id)),
      timeoutMs: undefined,
      signal: undefined,
    });
  });

  it('invalid, then valid: the retry sends the fact list plus the errors, not the draft', async () => {
    const provider = scripted(reply(INVALID), reply(VALID));
    const result = await generateNarrative(ASSESSMENT, { provider });

    expect(result.status).toBe('ok');
    expect(result.attempts.map(a => a.errors.length)).toEqual([1, 0]);
    expect(provider.mock.calls[1][0].user).toBe([
      BASE_MESSAGE,
      '',
      'Your previous draft broke these rules:',
      '- overview, "Mean Time to Contain is poor.": Mean Time to Contain has no score; do not describe it as "poor".',
      'Write the whole summary again from the facts above, following every rule.',
    ].join('\n'));
  });

  it('passes model, timeoutMs and signal through', async () => {
    const provider = scripted(reply(VALID));
    const signal = new AbortController().signal;
    const result = await generateNarrative(ASSESSMENT, { provider, model: 'llama3.1:8b', timeoutMs: 5000, signal });
    expect(provider.mock.calls[0][0]).toMatchObject({ model: 'llama3.1:8b', timeoutMs: 5000, signal });
    expect(result.model).toBe('llama3.1:8b');
  });
});

describe('failed', () => {
  it('always invalid: failed after 3 attempts, no narrative, last errors', async () => {
    const provider = scripted(reply(INVALID));
    const result = await generateNarrative(ASSESSMENT, { provider });

    expect(provider).toHaveBeenCalledTimes(3);
    expect(result.status).toBe('failed');
    expect(result.narrative).toBeNull();
    expect(result.errors).toEqual(result.attempts[2].errors);
    expect(result.attempts.map(a => a.attempt)).toEqual([1, 2, 3]);
  });

  it('never carries the draft text', async () => {
    const marker = 'This sentence only exists in the rejected draft.';
    const provider = scripted(reply(withOverview(INVALID, marker)));
    const result = await generateNarrative(ASSESSMENT, { provider });
    expect(result.status).toBe('failed');
    expect(JSON.stringify(result)).not.toContain(marker);
    for (const a of result.attempts) {
      expect(Object.keys(a).sort()).toEqual(['attempt', 'doneReason', 'durationMs', 'errors', 'evalCount', 'promptEvalCount']);
    }
  });

  it('respects maxAttempts', async () => {
    const provider = scripted(reply(INVALID));
    const result = await generateNarrative(ASSESSMENT, { provider, maxAttempts: 1 });
    expect(provider).toHaveBeenCalledOnce();
    expect(result.status).toBe('failed');
  });
});

describe('unparseable output', () => {
  const shapeError = { section: null, sentence: null, rule: 'shape', detail: 'The response was cut off or was not valid JSON.' };

  it('content that is not JSON is a failed attempt, then retried', async () => {
    const provider = scripted(reply('{"headline": {"factIds": ["C1"'), reply(VALID));
    const result = await generateNarrative(ASSESSMENT, { provider });
    expect(result.status).toBe('ok');
    expect(result.attempts[0].errors).toEqual([shapeError]);
    expect(provider.mock.calls[1][0].user).toContain('- narrative: The response was cut off or was not valid JSON.');
  });

  it('cut-off output (done_reason "length") is a failed attempt even if it parses', async () => {
    const provider = scripted(reply(VALID, { doneReason: 'length' }), reply(VALID));
    const result = await generateNarrative(ASSESSMENT, { provider });
    expect(result.status).toBe('ok');
    expect(result.attempts[0]).toMatchObject({ errors: [shapeError], doneReason: 'length' });
  });

  it('a malformed provider reply never throws', async () => {
    const result = await generateNarrative(ASSESSMENT, { provider: scripted(null) });
    expect(result.status).toBe('failed');
    expect(result.errors).toEqual([shapeError]);
  });
});

describe('retry message', () => {
  it(`lists at most ${MAX_RETRY_ERRORS} errors, then "…and N more"`, async () => {
    const numbers = Array.from({ length: 12 }, (_, i) => `The value is ${101 + i}.`).join(' ');
    const provider = scripted(reply(withOverview(VALID, numbers)), reply(VALID));
    const result = await generateNarrative(ASSESSMENT, { provider });

    expect(result.attempts[0].errors).toHaveLength(12);
    const user = provider.mock.calls[1][0].user;
    const listed = user.split('\n').filter(line => line.startsWith('- '));
    expect(listed).toHaveLength(MAX_RETRY_ERRORS + 1);
    expect(listed.at(-1)).toBe('- …and 2 more.');
  });

  it('uses only the latest attempt\'s errors', async () => {
    const provider = scripted(reply(INVALID), reply(withOverview(VALID, 'The value is 999.')), reply(VALID));
    await generateNarrative(ASSESSMENT, { provider });
    const third = provider.mock.calls[2][0].user;
    expect(third).toContain('"999"');
    expect(third).not.toContain('Mean Time to Contain is poor.');
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

  it('unavailable on a retry discards the earlier draft', async () => {
    const provider = scripted(reply(INVALID), new ProviderUnavailableError('timeout', 'No response.'));
    const result = await generateNarrative(ASSESSMENT, { provider });
    expect(result).toMatchObject({ status: 'unavailable', reason: 'timeout', narrative: null });
    expect(result.attempts).toHaveLength(1);
  });
});

describe('progress', () => {
  it('onAttempt reports each attempt', async () => {
    const onAttempt = vi.fn();
    await generateNarrative(ASSESSMENT, { provider: scripted(reply(INVALID)), onAttempt });
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
