/**
 * Manual check of AI narrative generation against the real model
 * (docs/ai-report-spec.md, Step 4 "Manual check").
 *
 *   npm run check:narrative          5 runs on the Westmaas baseline, 60 s apart
 *   RUNS=1 npm run check:narrative   fewer runs (COOLDOWN_MS overrides the pause)
 *
 * Talks to Ollama directly (OLLAMA_URL, default http://localhost:11434), not
 * through the Vite proxy. The real provider is wrapped to record every raw
 * response, so rejected drafts can be reviewed here without the app ever
 * returning them. Appends a dated run set to docs/ai-report-manual-check.md;
 * the Review part is filled in by hand.
 */

import { readFileSync, existsSync, writeFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseAndValidateImport } from '../src/engine/persistence.js';
import { generateNarrative, DEFAULT_MODEL, RETRY_TEMPERATURE } from '../src/report/generate.js';
import { callOllama, OLLAMA_OPTIONS, PROMPT_TOKEN_WARNING, DEFAULT_TIMEOUT_MS } from '../src/report/providers/ollama.js';
import { SECTION_KEYS } from '../src/report/schema.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const RUNS = Number(process.env.RUNS ?? 5);
// The laptop GPU throttles under sustained load (first manual check: 14.8 → 3.0 tokens/s).
const COOLDOWN_MS = Number(process.env.COOLDOWN_MS ?? 60_000);
const MODEL = process.env.MODEL ?? DEFAULT_MODEL;
const SCENARIO = 'scenarios/Westmaas_2026-01-01_assessment.json';
const LOG = 'docs/ai-report-manual-check.md';

const REVIEW_POINTS = [
  'Invariant breaks the validator missed',
  'Validator errors that look wrong',
  'Paraphrased item names (alias candidates)',
  'Prompt conformance (one-sentence headline, 2–4 sentences per section, no bullets, cited facts fit each section)',
  'Items named without their fact cited',
  'Band ranges read as the band the value falls in, not a missed target',
];

function loadAssessment() {
  const res = parseAndValidateImport(readFileSync(join(ROOT, SCENARIO), 'utf8'));
  if (!res.ok) throw new Error(res.error);
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

function renderNarrative(draft) {
  const parts = [['headline', draft?.headline], ...SECTION_KEYS.map(k => [k, draft?.sections?.[k]])];
  if (parts.some(([, p]) => typeof p?.text !== 'string')) return ['```json', JSON.stringify(draft, null, 2), '```'];
  return parts.flatMap(([key, p]) => renderPart(key, p));
}

/** A raw reply: the whole narrative (section null) or one repaired section. */
function renderReply(content, section) {
  let reply;
  try {
    reply = JSON.parse(content);
  } catch {
    return ['```text', content, '```'];
  }
  if (section === null) return renderNarrative(reply);
  return typeof reply?.text === 'string' ? renderPart(section, reply) : ['```json', JSON.stringify(reply, null, 2), '```'];
}

const roundsOf = result => Math.max(0, ...result.attempts.map(a => a.attempt));

function renderRun({ n, result, raw, wallMs }) {
  const lines = [`#### Run ${n}: ${result.status} (${roundsOf(result)} attempt(s), ${result.attempts.length} call(s), ${seconds(wallMs)})`, ''];
  if (result.status === 'unavailable') lines.push(`Unavailable: \`${result.reason}\`: ${result.message}`, '');

  result.attempts.forEach((a, i) => {
    const what = a.section === null ? 'whole narrative' : `repair of ${a.section}`;
    lines.push(`Attempt ${a.attempt}, ${what}: prompt_eval_count ${a.promptEvalCount}, eval_count ${a.evalCount}, ${tps(tokensPerSecond(raw[i]))} tokens/s, done_reason ${a.doneReason}, ${seconds(a.durationMs)}`);
    if (a.errors.length === 0) lines.push('- no validator errors');
    for (const e of a.errors) {
      lines.push(`- \`${e.rule}\` ${e.section ?? 'narrative'}${e.sentence ? `, "${e.sentence}"` : ''}: ${e.detail}`);
    }
    lines.push('', `<details><summary>Attempt ${a.attempt} reply (${what})</summary>`, '');
    lines.push(...renderReply(raw[i]?.content ?? '', a.section), '</details>', '');
  });

  if (result.status === 'ok') {
    lines.push('<details><summary>Final narrative (accepted)</summary>', '', ...renderNarrative(result.narrative), '</details>', '');
  }
  return lines;
}

function renderRunSet({ version, before, after, factCount, runs }) {
  const attempts = runs.flatMap(r => r.result.attempts);
  const promptCounts = attempts.map(a => a.promptEvalCount).filter(n => n !== null);
  const speeds = runs.flatMap(r => r.raw.map(tokensPerSecond)).filter(v => v !== null);
  const speedSummary = speeds.length
    ? `first ${tps(speeds[0])}, last ${tps(speeds.at(-1))}, min ${tps(Math.min(...speeds))}, max ${tps(Math.max(...speeds))}`
    : '?';

  const lines = [
    `## Run set ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`,
    '',
    `- Model: ${MODEL} · Ollama ${version} · options \`${JSON.stringify(OLLAMA_OPTIONS)}\``,
    `- Timeout ${seconds(DEFAULT_TIMEOUT_MS)} per call · ${seconds(COOLDOWN_MS)} cooldown between runs · retries at temperature ${RETRY_TEMPERATURE}, repairing failing sections only`,
    `- Scenario: ${SCENARIO} (${factCount} facts)`,
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
    `| attempts per run (calls) | ${runs.map(r => `${roundsOf(r.result)} (${r.result.attempts.length})`).join(', ')} |`,
    `| errors by rule (all attempts) | ${countByRule(attempts.flatMap(a => a.errors))} |`,
    `| max prompt_eval_count | ${promptCounts.length ? Math.max(...promptCounts) : '?'} (warning above ${PROMPT_TOKEN_WARNING}) |`,
    `| generation speed (tokens/s, eval_duration) | ${speedSummary} |`,
    '',
    '### Runs',
    '',
    '| Run | Status | Attempt | Call | Time | prompt_eval_count | eval_count | tokens/s | done_reason | Errors |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...runs.flatMap(r => r.result.attempts.map((a, i) =>
      `| ${r.n} | ${r.result.status} | ${a.attempt} | ${a.section ?? 'whole'} | ${seconds(a.durationMs)} | ${a.promptEvalCount} | ${a.evalCount} | ${tps(tokensPerSecond(r.raw[i]))} | ${a.doneReason} | ${countByRule(a.errors)} |`)),
    '',
    ...runs.flatMap(renderRun),
    '### Review',
    '',
    ...REVIEW_POINTS.map((point, i) => `${i + 1}. ${point}: _to be filled in_`),
    '',
  ];
  return lines.join('\n');
}

async function main() {
  const version = (await getJson('/api/version'))?.version;
  if (!version) {
    console.error(`Ollama is not reachable at ${OLLAMA_URL}. Start it (ollama serve) and try again.`);
    process.exit(1);
  }

  const assessment = loadAssessment();
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
      onAttempt: ({ attempt, maxAttempts }) => console.log(`run ${n}/${RUNS}, attempt ${attempt}/${maxAttempts}…`),
    });
    const wallMs = Date.now() - started;
    console.log(`run ${n}: ${result.status} after ${roundsOf(result)} attempt(s), ${result.attempts.length} call(s), ${seconds(wallMs)}`);
    runs.push({ n, result, raw, wallMs });
  }

  const after = await getJson('/api/ps');
  const section = renderRunSet({ version, before, after, factCount: runs[0]?.result.facts.length ?? 0, runs });

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
}

main();
