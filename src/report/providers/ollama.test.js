/**
 * Ollama provider tests — docs/ai-report-spec.md, Step 4. fetch is mocked.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  callOllama, OLLAMA_OPTIONS, PROMPT_TOKEN_WARNING, ProviderUnavailableError,
} from './ollama.js';

const ARGS = { model: 'qwen2.5:7b', system: 'SYSTEM', user: 'USER', schema: { type: 'object' } };

/** A minimal fetch Response: status and a text body. */
function fakeResponse(status, body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return { ok: status >= 200 && status < 300, status, text: async () => text };
}

const respondWith = (status, body) => vi.fn(async () => fakeResponse(status, body));

function okBody(overrides = {}) {
  return {
    model: 'qwen2.5:7b',
    message: { role: 'assistant', content: '{"headline":{}}' },
    done: true,
    done_reason: 'stop',
    prompt_eval_count: 1234,
    eval_count: 567,
    ...overrides,
  };
}

/** A fetch that never answers but rejects when its signal aborts (at once if already aborted, like fetch). */
const hangingFetch = () => vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
  const abortError = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
  if (signal.aborted) abortError();
  else signal.addEventListener('abort', abortError);
}));

async function reasonOf(promise) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ProviderUnavailableError);
    return error.reason;
  }
  throw new Error('expected ProviderUnavailableError');
}

describe('request', () => {
  it('POSTs the agreed body to /ollama/api/chat', async () => {
    const fetchImpl = respondWith(200, okBody());
    await callOllama({ ...ARGS, fetchImpl, warn: vi.fn() });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('/ollama/api/chat');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({
      model: 'qwen2.5:7b',
      messages: [{ role: 'system', content: 'SYSTEM' }, { role: 'user', content: 'USER' }],
      format: { type: 'object' },
      stream: false,
      options: { temperature: 0.2, num_ctx: 4096, num_predict: 1024 },
    });
    expect(OLLAMA_OPTIONS).toEqual({ temperature: 0.2, num_ctx: 4096, num_predict: 1024 });
  });

  it('uses baseUrl (the manual check talks to Ollama directly)', async () => {
    const fetchImpl = respondWith(200, okBody());
    await callOllama({ ...ARGS, baseUrl: 'http://localhost:11434', fetchImpl, warn: vi.fn() });
    expect(fetchImpl.mock.calls[0][0]).toBe('http://localhost:11434/api/chat');
  });
});

describe('response', () => {
  it('returns content, token counts, done reason and duration', async () => {
    const result = await callOllama({ ...ARGS, fetchImpl: respondWith(200, okBody()), warn: vi.fn() });
    expect(result).toEqual({
      content: '{"headline":{}}', promptEvalCount: 1234, evalCount: 567, doneReason: 'stop', durationMs: expect.any(Number),
    });
  });

  it('missing token counts become null (cached prompt)', async () => {
    const body = okBody();
    delete body.prompt_eval_count;
    delete body.eval_count;
    const result = await callOllama({ ...ARGS, fetchImpl: respondWith(200, body), warn: vi.fn() });
    expect(result.promptEvalCount).toBeNull();
    expect(result.evalCount).toBeNull();
  });

  it('content that is not JSON is returned as-is (generate.js decides)', async () => {
    const result = await callOllama({
      ...ARGS, fetchImpl: respondWith(200, okBody({ message: { content: 'not json' } })), warn: vi.fn(),
    });
    expect(result.content).toBe('not json');
  });
});

describe('warnings', () => {
  it(`warns above ${PROMPT_TOKEN_WARNING} prompt tokens, not at ${PROMPT_TOKEN_WARNING}`, async () => {
    const atLimit = vi.fn();
    await callOllama({ ...ARGS, fetchImpl: respondWith(200, okBody({ prompt_eval_count: 3000 })), warn: atLimit });
    expect(atLimit).not.toHaveBeenCalled();

    const over = vi.fn();
    await callOllama({ ...ARGS, fetchImpl: respondWith(200, okBody({ prompt_eval_count: 3001 })), warn: over });
    expect(over).toHaveBeenCalledOnce();
    expect(over.mock.calls[0][0]).toMatch(/3001 tokens.*raise num_ctx to 6144/);
  });

  it('warns when the output was cut off', async () => {
    const warn = vi.fn();
    const result = await callOllama({ ...ARGS, fetchImpl: respondWith(200, okBody({ done_reason: 'length' })), warn });
    expect(result.doneReason).toBe('length');
    expect(warn.mock.calls[0][0]).toMatch(/cut off/);
  });
});

describe('unavailable', () => {
  it('fetch rejects → not_running', async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError('fetch failed'); });
    expect(await reasonOf(callOllama({ ...ARGS, fetchImpl }))).toBe('not_running');
  });

  it('HTTP 502 with an empty body (Vite proxy) → not_running', async () => {
    expect(await reasonOf(callOllama({ ...ARGS, fetchImpl: respondWith(502, '') }))).toBe('not_running');
  });

  it('HTTP 404 with an Ollama error → model_missing, with its message', async () => {
    const error = 'model "qwen2.5:7b" not found, try pulling it first';
    const promise = callOllama({ ...ARGS, fetchImpl: respondWith(404, { error }) });
    await expect(promise).rejects.toMatchObject({ reason: 'model_missing', message: error });
  });

  it('other HTTP errors → provider_error with Ollama\'s text', async () => {
    const error = 'model requires more system memory';
    await expect(callOllama({ ...ARGS, fetchImpl: respondWith(500, { error }) }))
      .rejects.toMatchObject({ reason: 'provider_error', message: error });
    await expect(callOllama({ ...ARGS, fetchImpl: respondWith(404, 'Not Found') }))
      .rejects.toMatchObject({ reason: 'provider_error', message: 'Ollama returned HTTP 404.' });
  });

  it('a 2xx body without message content → provider_error', async () => {
    expect(await reasonOf(callOllama({ ...ARGS, fetchImpl: respondWith(200, { done: true }) }))).toBe('provider_error');
    expect(await reasonOf(callOllama({ ...ARGS, fetchImpl: respondWith(200, 'not json') }))).toBe('provider_error');
  });

  it('timeout → timeout', async () => {
    const promise = callOllama({ ...ARGS, fetchImpl: hangingFetch(), timeoutMs: 20 });
    await expect(promise).rejects.toMatchObject({ reason: 'timeout', message: expect.stringMatching(/^No response from Ollama within/) });
  });

  it('caller abort → cancelled (during the request and before it starts)', async () => {
    const controller = new AbortController();
    const promise = callOllama({ ...ARGS, fetchImpl: hangingFetch(), signal: controller.signal });
    controller.abort();
    expect(await reasonOf(promise)).toBe('cancelled');

    const aborted = new AbortController();
    aborted.abort();
    expect(await reasonOf(callOllama({ ...ARGS, fetchImpl: hangingFetch(), signal: aborted.signal }))).toBe('cancelled');
  });
});
