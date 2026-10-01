/**
 * Manual check of AI narrative generation against the real model
 * (docs/ai-report-spec.md, Step 4 "Manual check").
 *
 *   npm run check:narrative          5 runs on the Westmaas baseline, 60 s apart
 *   RUNS=1 npm run check:narrative   fewer runs (COOLDOWN_MS overrides the pause)
 *   npm run check:narrative -- --scenario scenarios/<file>.json
 *                                    any exported assessment file (path relative
 *                                    to the working directory, or absolute)
 *
 * Talks to Ollama directly (OLLAMA_URL, default http://localhost:11434), not
 * through the Vite proxy. The real provider is wrapped to record every raw
 * response, so rejected drafts can be reviewed here without the app ever
 * returning them. Appends a dated run set to docs/ai-report-manual-check.md;
 * the Review part is filled in by hand.
 *
 * Where to start (Step 9) is recorded like the headline and overview: every
 * call and raw reply, the picks and reasons of each run, and a summary of
 * the pick sets.
 *
 * The generated sections (templates, no model) are built once up front and
 * printed once per run set. Every run asserts that its generated sections
 * are identical to that copy and pass the validator; a failed assertion is
 * logged with the run and makes the script exit non-zero.
 */

import { readFileSync, existsSync, writeFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { parseAndValidateImport } from '../src/engine/persistence.js';
import { buildAssessmentFacts } from '../src/report/facts.js';
import { buildGeneratedSections } from '../src/report/templates.js';
import { matchAssessmentActions } from '../src/engine/actions.js';
import { validateNarrative } from '../src/report/validator.js';
import { generateNarrative, DEFAULT_MODEL, RETRY_TEMPERATURE } from '../src/report/generate.js';
import { callOllama, OLLAMA_OPTIONS, PROMPT_TOKEN_WARNING, DEFAULT_TIMEOUT_MS } from '../src/report/providers/ollama.js';
import { MODEL_PARTS, GENERATED_KEYS, FACT_SECTION_KEYS, WHERE_TO_START_KEY } from '../src/report/schema.js';
import { ACTION_CATALOGUE } from '../src/data/actionCatalogue.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const RUNS = Number(process.env.RUNS ?? 5);
// The laptop GPU throttles under sustained load (first manual check: 14.8 → 3.0 tokens/s).
const COOLDOWN_MS = Number(process.env.COOLDOWN_MS ?? 60_000);
const MODEL = process.env.MODEL ?? DEFAULT_MODEL;
const DEFAULT_SCENARIO = 'scenarios/Westmaas_2026-01-01_assessment.json';
const args = (() => {
  try {
    return parseArgs({ options: { scenario: { type: 'string' } } }).values;
  } catch (error) {
    console.error(`${error.message}\nUsage: npm run check:narrative -- [--scenario <assessment file>]`);
    process.exit(1);
  }
})();
const SCENARIO_PATH = resolve(args.scenario ?? join(ROOT, DEFAULT_SCENARIO));
// As logged: relative to the repository, with forward slashes.
const SCENARIO = relative(ROOT, SCENARIO_PATH).split('\\').join('/');
const LOG = 'docs/ai-report-manual-check.md';

const REVIEW_POINTS = [
  'Invariant breaks the validator missed',
  'Validator errors that look wrong',
  'Paraphrased item names (alias candidates)',
  'Prompt conformance (one-sentence headline, 2–4 sentences per section, no bullets, cited facts fit each section)',
  'Items named without their fact cited',
  'Band ranges read as the band the value falls in, not a missed target',
  'Where to start: plausible picks; each reason grounded in its own facts, no urgency or consequence',
];

const titleOf = id => ACTION_CATALOGUE.find(e => e.id === id)?.title ?? id;
const isPicksCall = a => a.section === WHERE_TO_START_KEY;
const summaryAttempts = result => result.attempts.filter(a => !isPicksCall(a));
const picksAttempts = result => result.attempts.filter(isPicksCall);
const callLabel = a => (isPicksCall(a) ? (a.pick ? `repair of Where to start ${a.pick}` : 'Where to start picks')
  : a.section === null ? 'whole narrative' : `repair of ${a.section}`);
const errorLine = e => `- \`${e.rule}\` ${e.section ?? 'narrative'}${e.pick ? ` ${e.pick}` : ''}${e.sentence ? `, "${e.sentence}"` : ''}: ${e.detail}`;
const pickSetOf = result => (result.whereToStart?.status === 'ok' ? result.whereToStart.picks.map(p => p.actionId).join(', ') : '—');

/** Accepted picks: title (ID), facts, reason. */
function renderPicks(picks) {
  return picks.flatMap(p => [`- **${p.title}** (${p.actionId}; ${p.factIds.join(', ')}): ${p.reason}`]);
}

function loadAssessment() {
  if (!existsSync(SCENARIO_PATH)) {
    console.error(`Scenario file not found: ${SCENARIO_PATH}`);
    process.exit(1);
  }
  const res = parseAndValidateImport(readFileSync(SCENARIO_PATH, 'utf8'));
  if (!res.ok) {
    console.error(`${SCENARIO} is not a valid assessment file: ${res.error}`);
    process.exit(1);
  }
  const { clientId, assessmentDate, indicators, layer0 } = res.data;
  return { meta: { clientId, assessmentDate }, indicators, layer0 };
}

async function getJson(path) {
  try {
    const response = await fetch(`${OLLAMA_URL}${path}`);
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

const gb = bytes => `${(bytes / 1e9).toFixed(2)} GB`;
const seconds = ms => `${(ms / 1000).toFixed(1)} s`;

/** Generation speed from Ollama's eval_duration (excludes prompt processing and model load). */
function tokensPerSecond(record) {
  if (!record?.evalCount || !record?.evalDurationMs) return null;
  return record.evalCount / (record.evalDurationMs / 1000);
}
const tps = value => (value === null ? '?' : value.toFixed(1));

function psRows(label, ps) {
  const models = ps?.models ?? [];
  if (models.length === 0) return [`| ${label} | (no model loaded) | | | | |`];
  return models.map(m => {
    const gpu = m.size > 0 ? Math.round((m.size_vram / m.size) * 100) : 0;
    return `| ${label} | ${m.name} | ${gb(m.size)} | ${gb(m.size_vram)} | ${100 - gpu}%/${gpu}% | ${m.context_length ?? '?'} |`;
  });
}

function countByRule(errors) {
  const counts = {};
  for (const e of errors) counts[e.rule] = (counts[e.rule] ?? 0) + 1;
  return Object.entries(counts).map(([rule, n]) => `${rule} ×${n}`).join(', ') || '—';
}

function renderPart(key, part) {
  return [`**${key}** (${(part?.factIds ?? []).join(', ')}): ${part?.text}`, ''];
}

/** The model's parts: { headline, overview } as replied, or those of the accepted narrative. */
function renderModelParts(draft) {
  const parts = MODEL_PARTS.map(k => [k, draft?.[k] ?? draft?.sections?.[k]]);
  if (parts.some(([, p]) => typeof p?.text !== 'string')) return ['```json', JSON.stringify(draft, null, 2), '```'];
  return parts.flatMap(([key, p]) => renderPart(key, p));
}

/**
 * One run's generated sections against the reference copy: identical, and
 * the fact-based ones passing the validator (Recommended actions is catalogue
 * text the validator skips, Step 8). → failure lines (empty when both hold).
 */
function checkGenerated(generated, facts, reference) {
  const failures = [];
  if (!isDeepStrictEqual(generated, reference)) failures.push('the generated sections differ from the reference copy');
  const { errors } = validateNarrative({ sections: generated }, facts, { parts: FACT_SECTION_KEYS });
  for (const e of errors) {
    failures.push(`validator \`${e.rule}\` ${e.section ?? 'narrative'}${e.sentence ? `, "${e.sentence}"` : ''}: ${e.detail}`);
  }
  return failures;
}

/** A raw reply: the model parts (section null), one repaired part, or Where to start picks or a reason. */
function renderReply(content, section, pick = null) {
  let reply;
  try {
    reply = JSON.parse(content);
  } catch {
    return ['```text', content, '```'];
  }
  if (section === WHERE_TO_START_KEY) {
    if (pick && typeof reply?.reason === 'string') return [`- ${pick}: ${reply.reason}`, ''];
    if (!pick && Array.isArray(reply?.picks) && reply.picks.every(p => typeof p?.reason === 'string')) {
      return [...reply.picks.map(p => `- ${p.actionId}: ${p.reason}`), ''];
    }
    return ['```json', JSON.stringify(reply, null, 2), '```'];
  }
  if (section === null) return renderModelParts(reply);
  return typeof reply?.text === 'string' ? renderPart(section, reply) : ['```json', JSON.stringify(reply, null, 2), '```'];
}

const roundsOf = result => Math.max(0, ...summaryAttempts(result).map(a => a.attempt));
const pickRoundsOf = result => Math.max(0, ...picksAttempts(result).map(a => a.attempt));

function renderRun({ n, result, raw, wallMs, generatedFailures }) {
  const wts = result.whereToStart;
  const lines = [
    `#### Run ${n}: ${result.status} (${roundsOf(result)} attempt(s), ${summaryAttempts(result).length} call(s)); ` +
      `Where to start ${wts.status} (${pickRoundsOf(result)} attempt(s), ${picksAttempts(result).length} call(s)); ${seconds(wallMs)}`,
    '',
  ];
  if (result.status === 'unavailable') lines.push(`Unavailable: \`${result.reason}\`: ${result.message}`, '');
  if (wts.status === 'unavailable' && result.status !== 'unavailable') lines.push(`Where to start unavailable: \`${wts.reason}\`: ${wts.message}`, '');
  if (generatedFailures.length === 0) {
    lines.push('Generated sections: identical to the reference copy, pass the validator.', '');
  } else {
    lines.push('Generated sections: **assertion failed**', '', ...generatedFailures.map(f => `- ${f}`), '');
  }

  result.attempts.forEach((a, i) => {
    const what = callLabel(a);
    lines.push(`Attempt ${a.attempt}, ${what}: prompt_eval_count ${a.promptEvalCount}, eval_count ${a.evalCount}, ${tps(tokensPerSecond(raw[i]))} tokens/s, done_reason ${a.doneReason}, ${seconds(a.durationMs)}`);
    if (a.errors.length === 0) lines.push('- no validator errors');
    for (const e of a.errors) lines.push(errorLine(e));
    lines.push('', `<details><summary>Attempt ${a.attempt} reply (${what})</summary>`, '');
    lines.push(...renderReply(raw[i]?.content ?? '', a.section, a.pick ?? null), '</details>', '');
  });

  if (result.status === 'ok') {
    lines.push('<details><summary>Final model parts (accepted)</summary>', '', ...renderModelParts(result.narrative), '</details>', '');
  }
  if (wts.status === 'ok') lines.push('Where to start (accepted, catalogue order):', '', ...renderPicks(wts.picks), '');
  return lines;
}

function renderRunSet({ version, before, after, factCount, reference, referenceFailures, runs, actions }) {
  const attempts = runs.flatMap(r => r.result.attempts);
  const promptCounts = attempts.map(a => a.promptEvalCount).filter(n => n !== null);
  const speeds = runs.flatMap(r => r.raw.map(tokensPerSecond)).filter(v => v !== null);
  const speedSummary = speeds.length
    ? `first ${tps(speeds[0])}, last ${tps(speeds.at(-1))}, min ${tps(Math.min(...speeds))}, max ${tps(Math.max(...speeds))}`
    : '?';

  const lines = [
    `## Run set ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC: ${SCENARIO.split('/').pop()}`,
    '',
    `- Model: ${MODEL} · Ollama ${version} · options \`${JSON.stringify(OLLAMA_OPTIONS)}\``,
    `- Timeout ${seconds(DEFAULT_TIMEOUT_MS)} per call · ${seconds(COOLDOWN_MS)} cooldown between runs · retries at temperature ${RETRY_TEMPERATURE}, repairing failing sections only`,
    `- Scenario: ${SCENARIO} (${factCount} facts)`,
    `- Where to start candidates (${actions.length}): ${actions.map(a => `${a.id} ${titleOf(a.id)}`).join('; ') || 'none'}`,
    '',
    '| `/api/ps` | Model | Size | In VRAM | CPU/GPU | Context |',
    '|---|---|---|---|---|---|',
    ...psRows('before', before),
    ...psRows('after', after),
    '',
    '### Summary',
    '',
    '| Measure | Value |',
    '|---|---|',
    `| ok | ${runs.filter(r => r.result.status === 'ok').length} of ${runs.length} |`,
    `| generated sections identical and valid | ${runs.filter(r => r.generatedFailures.length === 0).length} of ${runs.length} |`,
    `| attempts per run (calls) | ${runs.map(r => `${roundsOf(r.result)} (${summaryAttempts(r.result).length})`).join(', ')} |`,
    `| Where to start ok | ${runs.filter(r => r.result.whereToStart.status === 'ok').length} of ${runs.length} |`,
    `| Where to start attempts per run (calls) | ${runs.map(r => `${pickRoundsOf(r.result)} (${picksAttempts(r.result).length})`).join(', ')} |`,
    `| Where to start picks per run | ${runs.map(r => `${r.n}: ${pickSetOf(r.result)}`).join('; ')} |`,
    `| errors by rule (headline/overview) | ${countByRule(attempts.filter(a => !isPicksCall(a)).flatMap(a => a.errors))} |`,
    `| errors by rule (Where to start) | ${countByRule(attempts.filter(isPicksCall).flatMap(a => a.errors))} |`,
    `| max prompt_eval_count | ${promptCounts.length ? Math.max(...promptCounts) : '?'} (warning above ${PROMPT_TOKEN_WARNING}) |`,
    `| generation speed (tokens/s, eval_duration) | ${speedSummary} |`,
    '',
    '### Generated sections',
    '',
    'Built from the facts by templates (no model); every run asserts it gets exactly this.',
    '',
    ...(referenceFailures.length === 0
      ? ['The reference copy passes the validator.']
      : ['The reference copy fails the validator: **assertion failed**', '', ...referenceFailures.map(f => `- ${f}`)]),
    '',
    ...GENERATED_KEYS.flatMap(key => renderPart(key, reference[key])),
    '### Runs',
    '',
    '| Run | Status | Attempt | Call | Time | prompt_eval_count | eval_count | tokens/s | done_reason | Errors |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...runs.flatMap(r => r.result.attempts.map((a, i) =>
      `| ${r.n} | ${isPicksCall(a) ? r.result.whereToStart.status : r.result.status} | ${a.attempt} | ${isPicksCall(a) ? `whereToStart ${a.pick ?? 'whole'}` : a.section ?? 'whole'} | ${seconds(a.durationMs)} | ${a.promptEvalCount} | ${a.evalCount} | ${tps(tokensPerSecond(r.raw[i]))} | ${a.doneReason} | ${countByRule(a.errors)} |`)),
    '',
    ...runs.flatMap(renderRun),
    '### Review',
    '',
    ...REVIEW_POINTS.map((point, i) => `${i + 1}. ${point}: _to be filled in_`),
    '',
    '',   // blank line before the next appended run set's heading
  ];
  return lines.join('\n');
}

async function main() {
  const assessment = loadAssessment();
  const version = (await getJson('/api/version'))?.version;
  if (!version) {
    console.error(`Ollama is not reachable at ${OLLAMA_URL}. Start it (ollama serve) and try again.`);
    process.exit(1);
  }

  const referenceFacts = buildAssessmentFacts(assessment);
  const actions = matchAssessmentActions(assessment);
  const reference = buildGeneratedSections(referenceFacts, actions);
  const referenceFailures = checkGenerated(reference, referenceFacts, reference);
  for (const f of referenceFailures) console.error(`generated sections (reference): ${f}`);
  const before = await getJson('/api/ps');
  const runs = [];

  for (let n = 1; n <= RUNS; n++) {
    if (n > 1 && COOLDOWN_MS > 0) {
      console.log(`cooling down ${seconds(COOLDOWN_MS)}…`);
      await new Promise(resolve => setTimeout(resolve, COOLDOWN_MS));
    }
    const raw = [];
    const provider = async args => {
      try {
        const response = await callOllama({ ...args, baseUrl: OLLAMA_URL });
        raw.push({ content: response.content, evalCount: response.evalCount, evalDurationMs: response.evalDurationMs });
        console.log(`  ${response.evalCount} tokens, ${tps(tokensPerSecond(raw.at(-1)))} tokens/s, ${seconds(response.durationMs)}`);
        return response;
      } catch (error) {
        raw.push({ error: `${error.reason ?? 'error'}: ${error.message}` });
        throw error;
      }
    };
    const started = Date.now();
    const result = await generateNarrative(assessment, {
      provider,
      model: MODEL,
      onAttempt: ({ attempt, maxAttempts, part }) => console.log(`run ${n}/${RUNS}, ${part}, attempt ${attempt}/${maxAttempts}…`),
      keepSentences: true,   // the review needs the rejected sentences; the app never sets this
    });
    const wallMs = Date.now() - started;
    console.log(`run ${n}: ${result.status} after ${roundsOf(result)} attempt(s); Where to start ${result.whereToStart.status} (${pickSetOf(result)}); ${result.attempts.length} call(s), ${seconds(wallMs)}`);
    const generatedFailures = checkGenerated(result.generated, result.facts, reference);
    for (const f of generatedFailures) console.error(`run ${n}, generated sections: ${f}`);
    runs.push({ n, result, raw, wallMs, generatedFailures });
  }

  const after = await getJson('/api/ps');
  const section = renderRunSet({
    version, before, after, factCount: referenceFacts.length, reference, referenceFailures, runs, actions,
  });

  const logPath = join(ROOT, LOG);
  if (!existsSync(logPath)) {
    writeFileSync(logPath, [
      '# AI narrative: manual check log',
      '',
      'Results of `npm run check:narrative` (docs/ai-report-spec.md, Step 4',
      '"Manual check"). The script appends each run set; the Review part is',
      'filled in by hand.',
      '',
      '',
    ].join('\n'));
  }
  appendFileSync(logPath, section);
  console.log(`\nAppended to ${LOG}.`);

  if (referenceFailures.length > 0 || runs.some(r => r.generatedFailures.length > 0)) {
    console.error('Generated sections assertion failed; see the log.');
    process.exitCode = 1;
  }
}

main();
