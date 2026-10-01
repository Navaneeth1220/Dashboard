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
import sparseJson from '../../scenarios/Oudendijk_2026-03-01_assessment.json?raw';
import { generateNarrative, DEFAULT_MODEL, MAX_RETRY_ERRORS, RETRY_TEMPERATURE } from './generate.js';
import { ProviderUnavailableError } from './providers/ollama.js';
import { buildAssessmentFacts } from './facts.js';
import { buildGeneratedSections } from './templates.js';
import { matchAssessmentActions } from '../engine/actions.js';
import {
  SYSTEM_PROMPT, buildUserMessage, selectModelFacts, WHERE_TO_START_PROMPT, buildWhereToStartMessage, buildPickMessage,
} from './prompt.js';
import { buildOutputSchema, buildSectionSchema, buildPicksSchema, buildReasonSchema } from './schema.js';
import { buildWhereToStartPart } from './templates.js';
import { loadScenario, WESTMAAS_PICKS } from './testSupport.js';
import { ALL_INDICATOR_IDS } from '../data/indicatorDefinitions.js';
import { LAYER0_ALL_IDS } from '../data/layer0Definitions.js';

const ASSESSMENT = loadScenario(baselineJson);
const FACTS = buildAssessmentFacts(ASSESSMENT);
const MODEL_FACTS = selectModelFacts(FACTS);
const BASE_MESSAGE = buildUserMessage(MODEL_FACTS);
const ACTIONS = matchAssessmentActions(ASSESSMENT);
const GENERATED = buildGeneratedSections(FACTS, ACTIONS);
const ORIGIN = {
  headline: 'ai', overview: 'ai',
  measuredPerformance: 'generated', gapsAndMissingEvidence: 'generated', foundationsAndFlags: 'generated', priorities: 'generated',
  targets: 'generated', recommendedActions: 'generated', whereToStart: 'ai',
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

/**
 * A provider routed by system prompt: the headline/overview calls get
 * `summary` and the Where to start calls get `picks` (Step 9), each in order,
 * repeating the last; an Error is thrown.
 */
function routed(summary, picks) {
  const next = { summary: 0, picks: 0 };
  return vi.fn(async ({ system }) => {
    const key = system === WHERE_TO_START_PROMPT ? 'picks' : 'summary';
    const list = key === 'picks' ? picks : summary;
    const value = list[Math.min(next[key]++, list.length - 1)];
    if (value instanceof Error) throw value;
    return value;
  });
}

/** The headline/overview replies in order; Where to start gets the valid Westmaas picks. */
function scripted(...replies) {
  return routed(replies, [reply(WESTMAAS_PICKS)]);
}

const summaryCalls = provider => provider.mock.calls.filter(([args]) => args.system === SYSTEM_PROMPT);
const picksCalls = provider => provider.mock.calls.filter(([args]) => args.system === WHERE_TO_START_PROMPT);
const summaryAttempts = result => result.attempts.filter(a => a.section !== 'whereToStart');
const picksAttempts = result => result.attempts.filter(a => a.section === 'whereToStart');

const shapeError = { section: null, sentence: null, rule: 'shape', detail: 'The response was cut off or was not valid JSON.' };
const counts = { promptEvalCount: 1300, evalCount: 600, doneReason: 'stop', durationMs: 1000 };
const assembled = parts => ({ headline: parts.headline, sections: { overview: parts.overview, ...GENERATED } });

/** WESTMAAS_PICKS as the result carries them: catalogue order, catalogue titles, trigger facts (Step 9). */
const PICKS = [
  { actionId: 'ACT-BC-08', title: 'Define recovery point objectives', reason: WESTMAAS_PICKS.picks[1].reason, factIds: ['F11'] },
  { actionId: 'ACT-L0-05', title: 'Remove or control multi-homed devices', reason: WESTMAAS_PICKS.picks[0].reason, factIds: ['F13'] },
  { actionId: 'ACT-L0-08', title: 'Test the BC plan', reason: WESTMAAS_PICKS.picks[2].reason, factIds: ['F15'] },
];
const WHERE_TO_START_OK = { status: 'ok', picks: PICKS, part: buildWhereToStartPart(PICKS, FACTS), errors: [] };
const PICKS_RECORD = { attempt: 1, section: 'whereToStart', pick: null, errors: [], ...counts };

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
      actions: ACTIONS,
      attempts: [{ attempt: 1, section: null, errors: [], ...counts }, PICKS_RECORD],
      model: DEFAULT_MODEL,
      whereToStart: WHERE_TO_START_OK,
    });
    expect(summaryCalls(provider)).toHaveLength(1);
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
    expect(summaryCalls(provider)).toHaveLength(2);
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
    expect(summaryAttempts(result)).toEqual([
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
    expect(summaryCalls(provider)).toHaveLength(3);
    expect(provider.mock.calls[1][0].user).toContain(
      'Write only the headline part: one sentence stating the most important finding, not a title. Do not repeat the client name or date.');
    expect(provider.mock.calls[2][0].user).toContain('Write only the overview part:');
    expect(summaryAttempts(result).map(a => [a.attempt, a.section])).toEqual([[1, null], [2, 'headline'], [2, 'overview']]);
    expect(onAttempt.mock.calls.filter(([a]) => a.part === 'summary')).toHaveLength(2);
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

    expect(summaryCalls(provider)).toHaveLength(3);
    expect(result.status).toBe('failed');
    expect(result.narrative).toBeNull();
    expect(result.generated).toEqual(GENERATED);
    expect(result.origin).toEqual(ORIGIN);
    expect(result.errors).toEqual(summaryAttempts(result)[2].errors);
    expect(summaryAttempts(result).map(a => [a.attempt, a.section])).toEqual([[1, null], [2, 'overview'], [3, 'overview']]);
  });

  it('never carries the model text', async () => {
    const marker = 'This sentence only exists in the rejected draft.';
    const draft = withText(INVALID, 'overview', marker);
    const provider = scripted(reply(draft), reply(draft.overview));
    const result = await generateNarrative(ASSESSMENT, { provider });
    expect(result.status).toBe('failed');
    expect(JSON.stringify(result)).not.toContain(marker);
    for (const a of summaryAttempts(result)) {
      expect(Object.keys(a).sort()).toEqual(['attempt', 'doneReason', 'durationMs', 'errors', 'evalCount', 'promptEvalCount', 'section']);
    }
    for (const a of picksAttempts(result)) {
      expect(Object.keys(a).sort()).toEqual(['attempt', 'doneReason', 'durationMs', 'errors', 'evalCount', 'pick', 'promptEvalCount', 'section']);
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
    expect(summaryCalls(provider)).toHaveLength(1);
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
        errors: [], facts: FACTS, actions: ACTIONS, attempts: [], model: DEFAULT_MODEL,
        whereToStart: { status: 'unavailable', reason, message: `message for ${reason}`, picks: null, part: null, errors: [] },
      });
      expect(picksCalls(provider)).toHaveLength(0);
    });
  }

  it('provider_error on the very first call: repeated once, then ok (the llama-server load crash)', async () => {
    const onAttempt = vi.fn();
    const provider = scripted(new ProviderUnavailableError('provider_error', 'llama-server process has terminated'), reply(VALID));
    const result = await generateNarrative(ASSESSMENT, { provider, onAttempt });
    expect(result.status).toBe('ok');
    expect(summaryCalls(provider)).toHaveLength(2);
    expect(provider.mock.calls[1][0]).toEqual(provider.mock.calls[0][0]);
    expect(summaryAttempts(result)).toHaveLength(1);
    expect(onAttempt.mock.calls.filter(([a]) => a.part === 'summary')).toHaveLength(1);
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
      { attempt: 1, maxAttempts: 3, part: 'summary' }, { attempt: 2, maxAttempts: 3, part: 'summary' },
      { attempt: 3, maxAttempts: 3, part: 'summary' }, { attempt: 1, maxAttempts: 3, part: 'whereToStart' },
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

// ─── Step 9: Where to start ───────────────────────────────────────────────────

describe('Where to start (Step 9)', () => {
  const PICKS_MESSAGE = buildWhereToStartMessage(FACTS, ACTIONS);
  const PICKS_SCHEMA = buildPicksSchema(ACTIONS.map(a => a.id));
  const BC08 = ACTIONS.find(a => a.id === 'ACT-BC-08');
  const L005 = ACTIONS.find(a => a.id === 'ACT-L0-05');
  const GAP_FAILED = 'RPO Achievement Rate failed.';
  const GAP_FAILED_DETAIL = 'RPO Achievement Rate is a programme gap, not a measured failure; do not describe it as "failed".';
  const MARKER = 'This reason only exists in the rejected picks.';

  /** WESTMAAS_PICKS with the reason of one pick replaced. */
  function withReason(actionId, reason, draft = WESTMAAS_PICKS) {
    return { picks: draft.picks.map(p => (p.actionId === actionId ? { ...p, reason } : p)) };
  }
  /** WESTMAAS_PICKS with one action replaced by another. */
  function withAction(replacing, actionId, reason) {
    return { picks: WESTMAAS_PICKS.picks.map(p => (p.actionId === replacing ? { actionId, reason } : p)) };
  }
  const NO_CRITICAL = withAction('ACT-L0-05', 'ACT-L0-03', 'Asset interdependency documentation is incomplete or outdated.');

  it('valid on the first try: its own prompt, message and schema; picks in catalogue order with titles and facts', async () => {
    const provider = scripted(reply(VALID));
    const result = await generateNarrative(ASSESSMENT, { provider });

    expect(picksCalls(provider)).toEqual([[{
      model: 'qwen2.5:7b',
      system: WHERE_TO_START_PROMPT,
      user: PICKS_MESSAGE,
      schema: PICKS_SCHEMA,
      temperature: 0.2,
      timeoutMs: undefined,
      signal: undefined,
    }]]);
    expect(result.whereToStart).toEqual(WHERE_TO_START_OK);
    expect(picksAttempts(result)).toEqual([PICKS_RECORD]);
    // The headline/overview call comes first and is unchanged.
    expect(provider.mock.calls[0][0].system).toBe(SYSTEM_PROMPT);
  });

  it('no matched action: no call, status none', async () => {
    const empty = {
      meta: { clientId: 'Empty', assessmentDate: '2026-01-01' },
      indicators: Object.fromEntries(ALL_INDICATOR_IDS.map(id => [id, { state: null }])),
      layer0: Object.fromEntries(LAYER0_ALL_IDS.map(id => [id, { state: null }])),
    };
    const provider = scripted(reply(VALID));
    const result = await generateNarrative(empty, { provider });
    expect(result.actions).toEqual([]);
    expect(picksCalls(provider)).toHaveLength(0);
    expect(picksAttempts(result)).toEqual([]);
    expect(result.whereToStart).toEqual({ status: 'none', picks: null, part: null, errors: [] });
  });

  it('Oudendijk: one candidate, one pick', async () => {
    const sparse = loadScenario(sparseJson);
    const reason = 'Asset interdependency documentation is incomplete or outdated, which is a HIGH flag.';
    const provider = routed([reply(VALID)], [reply({ picks: [{ actionId: 'ACT-L0-03', reason }] })]);
    const result = await generateNarrative(sparse, { provider });
    expect(picksCalls(provider)[0][0].schema.properties.picks).toMatchObject({ minItems: 1, maxItems: 1 });
    expect(result.whereToStart.status).toBe('ok');
    expect(result.whereToStart.picks).toEqual([
      { actionId: 'ACT-L0-03', title: 'Document asset interdependencies', reason, factIds: ['F13'] },
    ]);
  });

  it('a set-level error: whole retry at 0.5 with the errors, never the draft', async () => {
    const provider = routed([reply(VALID)], [reply(NO_CRITICAL), reply(WESTMAAS_PICKS)]);
    const result = await generateNarrative(ASSESSMENT, { provider });

    const [, retry] = picksCalls(provider).map(c => c[0]);
    expect(retry.temperature).toBe(0.5);
    expect(retry.schema).toEqual(PICKS_SCHEMA);
    expect(retry.user).toBe([
      PICKS_MESSAGE,
      '',
      'Your previous picks broke these rules:',
      '- picks: "Remove or control multi-homed devices" addresses a CRITICAL flag and must be among the picks.',
      'Pick again and write every reason again from the facts above, following every rule.',
    ].join('\n'));
    expect(result.whereToStart).toEqual(WHERE_TO_START_OK);
    expect(picksAttempts(result).map(a => [a.attempt, a.pick, a.errors.map(e => e.rule)])).toEqual([
      [1, null, ['criticalPick']], [2, null, []],
    ]);
  });

  it('a set-level error together with a reason error: whole retry, listing both', async () => {
    const draft = withReason('ACT-BC-08', GAP_FAILED, NO_CRITICAL);
    const provider = routed([reply(VALID)], [reply(draft), reply(WESTMAAS_PICKS)]);
    await generateNarrative(ASSESSMENT, { provider });
    const retry = picksCalls(provider)[1][0];
    expect(retry.schema).toEqual(PICKS_SCHEMA);
    expect(retry.user).toContain(`- ACT-BC-08, "${GAP_FAILED}": ${GAP_FAILED_DETAIL}`);
    expect(retry.user).toContain('- picks: "Remove or control multi-homed devices" addresses a CRITICAL flag');
  });

  it('a reply that is not JSON: whole retry', async () => {
    const provider = routed([reply(VALID)], [reply('{"picks": ['), reply(WESTMAAS_PICKS)]);
    const result = await generateNarrative(ASSESSMENT, { provider });
    expect(picksCalls(provider)[1][0].user).toContain('- picks: The response was cut off or was not valid JSON.');
    expect(picksAttempts(result)[0].errors).toEqual([
      { section: 'whereToStart', pick: null, sentence: null, rule: 'shape', detail: 'The response was cut off or was not valid JSON.' },
    ]);
    expect(result.whereToStart.status).toBe('ok');
  });

  it('a failing reason: only that pick is repaired, with its facts, its errors and the reason schema', async () => {
    const provider = routed([reply(VALID)],
      [reply(withReason('ACT-BC-08', GAP_FAILED)), reply({ reason: WESTMAAS_PICKS.picks[1].reason })]);
    const result = await generateNarrative(ASSESSMENT, { provider });

    const repair = picksCalls(provider)[1][0];
    expect(repair.temperature).toBe(0.5);
    expect(repair.schema).toEqual(buildReasonSchema());
    expect(repair.user).toBe([
      buildPickMessage(FACTS, BC08),
      '',
      'Write only the reason for this action: one sentence stating the finding in its facts that the action addresses.',
      'Your previous reason broke these rules:',
      `- "${GAP_FAILED}": ${GAP_FAILED_DETAIL}`,
      'Write the reason again from the facts above, following every rule.',
    ].join('\n'));
    expect(result.whereToStart).toEqual(WHERE_TO_START_OK);
    expect(picksAttempts(result)).toEqual([
      { ...PICKS_RECORD, errors: [expect.objectContaining({ pick: 'ACT-BC-08', rule: 'programmeGap', sentence: null })] },
      { ...PICKS_RECORD, attempt: 2, pick: 'ACT-BC-08' },
    ]);
  });

  it('the picks that passed are kept exactly; two failing reasons are repaired in catalogue order', async () => {
    const draft = withReason('ACT-L0-05', 'Uncontrolled multi-homed devices need urgent removal.', withReason('ACT-BC-08', GAP_FAILED));
    const fixed = 'Uncontrolled inter-zone multi-homed devices were identified.';
    const provider = routed([reply(VALID)], [reply(draft), reply({ reason: WESTMAAS_PICKS.picks[1].reason }), reply({ reason: fixed })]);
    const result = await generateNarrative(ASSESSMENT, { provider });

    expect(picksCalls(provider).slice(1).map(([args]) => args.user.split('\n').find(l => l.startsWith('ACT-'))))
      .toEqual([BC08, L005].map(a => buildPickMessage(FACTS, a).split('\n').find(l => l.startsWith('ACT-'))));
    expect(result.whereToStart.status).toBe('ok');
    expect(result.whereToStart.picks.map(p => p.reason)).toEqual([WESTMAAS_PICKS.picks[1].reason, fixed, WESTMAAS_PICKS.picks[2].reason]);
    expect(picksAttempts(result).map(a => [a.attempt, a.pick])).toEqual([[1, null], [2, 'ACT-BC-08'], [2, 'ACT-L0-05']]);
  });

  it('an unusable repair reply keeps the pick, with a shape error, for the next attempt', async () => {
    const provider = routed([reply(VALID)],
      [reply(withReason('ACT-BC-08', GAP_FAILED)), reply('not json'), reply({ reason: WESTMAAS_PICKS.picks[1].reason })]);
    const result = await generateNarrative(ASSESSMENT, { provider });
    expect(picksAttempts(result)[1]).toMatchObject({
      attempt: 2, pick: 'ACT-BC-08',
      errors: [
        { section: 'whereToStart', pick: 'ACT-BC-08', sentence: null, rule: 'shape', detail: 'The response was cut off or was not valid JSON.' },
        expect.objectContaining({ rule: 'programmeGap' }),
      ],
    });
    expect(picksCalls(provider)[2][0].user).toContain('- The response was cut off or was not valid JSON.');
    expect(result.whereToStart.status).toBe('ok');
  });

  it('always invalid: failed, no picks and no text; the headline and overview stay ok', async () => {
    const bad = withReason('ACT-BC-08', `${GAP_FAILED} ${MARKER}`);
    const provider = routed([reply(VALID)], [reply(bad), reply({ reason: `${GAP_FAILED} ${MARKER}` })]);
    const result = await generateNarrative(ASSESSMENT, { provider });

    expect(result.status).toBe('ok');
    expect(result.narrative).toEqual(assembled(VALID));
    expect(result.whereToStart).toMatchObject({ status: 'failed', picks: null, part: null });
    expect(result.whereToStart.errors).toEqual(picksAttempts(result).at(-1).errors);
    expect(result.whereToStart.errors).toContainEqual(expect.objectContaining({
      section: 'whereToStart', pick: 'ACT-BC-08', title: 'Define recovery point objectives', sentence: null, rule: 'programmeGap',
    }));
    expect(picksCalls(provider)).toHaveLength(3);
    expect(JSON.stringify(result)).not.toContain(MARKER);
    expect(JSON.stringify(result)).not.toContain(GAP_FAILED);
  });

  it('keepSentences keeps the rejected sentences (manual-check script only)', async () => {
    const provider = routed([reply(VALID)], [reply(withReason('ACT-BC-08', GAP_FAILED)), reply({ reason: GAP_FAILED })]);
    const result = await generateNarrative(ASSESSMENT, { provider, keepSentences: true });
    expect(result.whereToStart.errors).toEqual([expect.objectContaining({ sentence: GAP_FAILED })]);
  });

  it('the headline/overview failed: Where to start is still drafted, and can be ok', async () => {
    const provider = scripted(reply(INVALID), reply(INVALID.overview));
    const result = await generateNarrative(ASSESSMENT, { provider });
    expect(result.status).toBe('failed');
    expect(result.whereToStart).toEqual(WHERE_TO_START_OK);
  });

  it.each(['timeout', 'cancelled', 'provider_error', 'not_running'])(
    '%s during Where to start: only this part is unavailable; the headline and overview are kept', async reason => {
      const provider = routed([reply(VALID)], [new ProviderUnavailableError(reason, `message for ${reason}`)]);
      const result = await generateNarrative(ASSESSMENT, { provider });
      expect(result.status).toBe('ok');
      expect(result.narrative).toEqual(assembled(VALID));
      expect(result.whereToStart).toEqual({
        status: 'unavailable', reason, message: `message for ${reason}`, picks: null, part: null, errors: [],
      });
      // Not repeated, not even on provider_error: it is not the first call of the generation.
      expect(picksCalls(provider)).toHaveLength(1);
    });

  it('unavailable during a pick repair discards the picks', async () => {
    const provider = routed([reply(VALID)], [reply(withReason('ACT-BC-08', GAP_FAILED)), new ProviderUnavailableError('timeout', 'No response.')]);
    const result = await generateNarrative(ASSESSMENT, { provider });
    expect(result.status).toBe('ok');
    expect(result.whereToStart).toEqual({
      status: 'unavailable', reason: 'timeout', message: 'No response.', picks: null, part: null, errors: [],
    });
    expect(picksAttempts(result)).toHaveLength(1);
  });

  it('respects maxAttempts', async () => {
    const provider = routed([reply(VALID)], [reply(NO_CRITICAL)]);
    const result = await generateNarrative(ASSESSMENT, { provider, maxAttempts: 1 });
    expect(picksCalls(provider)).toHaveLength(1);
    expect(result.whereToStart.status).toBe('failed');
  });

  it('a malformed provider reply never throws', async () => {
    const result = await generateNarrative(ASSESSMENT, { provider: routed([reply(VALID)], [null]) });
    expect(result.status).toBe('ok');
    expect(result.whereToStart.status).toBe('failed');
  });
});
