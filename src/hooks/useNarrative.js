/**
 * useNarrative (docs/ai-report-spec.md, Step 5): the only stateful part of
 * the narrative UI. It calls generateNarrative and keeps the phase, the
 * attempt counter, the result and the JSON of the assessment snapshot the
 * result was generated from (so the caller can tell when it is stale).
 * NarrativePanel renders what it returns and computes nothing.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { generateNarrative } from '../report/generate.js';

const IDLE = { phase: 'idle', attempt: 0, maxAttempts: 0, result: null, snapshot: null, generatedAt: null };

/**
 * useNarrative({ provider? }) →
 *   { phase: 'idle' | 'running' | 'done', attempt, maxAttempts, result, snapshot, generatedAt, generate, cancel }
 *
 * generatedAt: ISO time the result arrived (the PDF's "Generated", Step 6).
 *
 * provider exists only for tests; the app uses generateNarrative's default.
 */
export function useNarrative({ provider } = {}) {
  const [state, setState] = useState(IDLE);
  const controller = useRef(null);   // the running call's AbortController, or null
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);

  const generate = useCallback(async snapshot => {
    if (controller.current) return;   // one call at a time
    const ctrl = new AbortController();
    controller.current = ctrl;
    const json = JSON.stringify(snapshot);
    setState(s => ({ ...s, phase: 'running', attempt: 0, maxAttempts: 0 }));

    const result = await generateNarrative(snapshot, {
      ...(provider ? { provider } : {}),
      signal: ctrl.signal,
      onAttempt: ({ attempt, maxAttempts }) => {
        if (mounted.current) setState(s => ({ ...s, attempt, maxAttempts }));
      },
    });

    controller.current = null;
    if (mounted.current) setState({ phase: 'done', attempt: 0, maxAttempts: 0, result, snapshot: json, generatedAt: new Date().toISOString() });
  }, [provider]);

  const cancel = useCallback(() => controller.current?.abort(), []);

  return { ...state, generate, cancel };
}
