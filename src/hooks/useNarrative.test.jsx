/**
 * useNarrative (docs/ai-report-spec.md, Step 5): the only stateful part of
 * the narrative UI.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import baselineJson from '../../scenarios/Westmaas_2026-01-01_assessment.json?raw';
import { useNarrative } from './useNarrative.js';
import { ProviderUnavailableError } from '../report/providers/ollama.js';
import { loadScenario } from '../report/testSupport.js';

const ASSESSMENT = loadScenario(baselineJson);

/** A provider whose single call waits until released, and honours abort like callOllama. */
function heldProvider() {
  let release;
  const provider = vi.fn(({ signal }) => new Promise((resolve, reject) => {
    release = () => resolve({ content: '{}', promptEvalCount: 1, evalCount: 1, doneReason: 'stop', durationMs: 1 });
    signal?.addEventListener('abort', () => reject(new ProviderUnavailableError('cancelled', 'Generation was cancelled.')));
  }));
  return { provider, release: () => release() };
}

describe('useNarrative', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useNarrative({ provider: vi.fn() }));
    expect(result.current).toMatchObject({ phase: 'idle', attempt: 0, result: null, snapshot: null });
  });

  it('generate: running with the attempt counter, then done with the result and the snapshot it came from', async () => {
    const { provider, release } = heldProvider();
    const { result } = renderHook(() => useNarrative({ provider }));

    let done;
    act(() => { done = result.current.generate(ASSESSMENT); });
    expect(result.current.phase).toBe('running');
    await vi.waitFor(() => expect(result.current.attempt).toBe(1));
    expect(result.current.maxAttempts).toBe(3);

    // The held call gets '{}' (unusable), so later attempts follow; answer them all.
    provider.mockImplementation(async () => { throw new ProviderUnavailableError('timeout', 'No response.'); });
    await act(async () => { release(); await done; });

    expect(result.current.phase).toBe('done');
    expect(result.current.result).toMatchObject({ status: 'unavailable', reason: 'timeout' });
    expect(result.current.snapshot).toBe(JSON.stringify(ASSESSMENT));
  });

  it('generatedAt: null until a result arrives, then the time it arrived', async () => {
    const provider = vi.fn(async () => { throw new ProviderUnavailableError('not_running', 'Ollama is not reachable.'); });
    const { result } = renderHook(() => useNarrative({ provider }));
    expect(result.current.generatedAt).toBeNull();
    const before = Date.now();
    await act(async () => { await result.current.generate(ASSESSMENT); });
    const at = Date.parse(result.current.generatedAt);
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(Date.now());
  });

  it('cancel aborts the call: the result is unavailable/cancelled', async () => {
    const { provider } = heldProvider();
    const { result } = renderHook(() => useNarrative({ provider }));
    let done;
    act(() => { done = result.current.generate(ASSESSMENT); });
    await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(1));
    await act(async () => { result.current.cancel(); await done; });
    expect(result.current.phase).toBe('done');
    expect(result.current.result).toMatchObject({ status: 'unavailable', reason: 'cancelled' });
  });

  it('a second generate while running is ignored', async () => {
    const { provider } = heldProvider();
    const { result } = renderHook(() => useNarrative({ provider }));
    let done;
    act(() => { done = result.current.generate(ASSESSMENT); });
    act(() => { result.current.generate(ASSESSMENT); });
    await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(1));
    await act(async () => { result.current.cancel(); await done; });
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('unmounting aborts a running call', async () => {
    const { provider } = heldProvider();
    const { result, unmount } = renderHook(() => useNarrative({ provider }));
    act(() => { result.current.generate(ASSESSMENT); });
    await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(1));
    const { signal } = provider.mock.calls[0][0];
    unmount();
    expect(signal.aborted).toBe(true);
  });
});
