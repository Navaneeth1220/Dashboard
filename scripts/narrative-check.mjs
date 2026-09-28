/**
 * Manual check of AI narrative generation against the real model
 * (docs/ai-report-spec.md, Step 4 "Manual check").
 *
 *   npm run check:narrative          5 runs on the Westmaas baseline
 *   RUNS=1 npm run check:narrative   fewer runs
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
import { generateNarrative, DEFAULT_MODEL } from '../src/report/generate.js';
import { callOllama, OLLAMA_OPTIONS, PROMPT_TOKEN_WARNING } from '../src/report/providers/ollama.js';
import { SECTION_KEYS } from '../src/report/schema.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const RUNS = Number(process.env.RUNS ?? 5);
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

function renderDraft(content) {
  let draft;
  try {
    draft = JSON.parse(content);
  } catch {
    return ['```text', content, '```'];
  }
  const parts = [['headline', draft?.headline], ...SECTION_KEYS.map(k => [k, draft?.sections?.[k]])];
  if (parts.some(([, p]) => typeof p?.text !== 'string')) return ['```json', JSON.stringify(draft, null, 2), '```'];
  return parts.flatMap(([key, p]) => [`**${key}** (${(p.factIds ?? []).join(', ')}): ${p.text}`, '']);
}

function renderRun({ n, result, raw, wallMs }) {
  const lines = [`#### Run ${n}: ${result.status} (${result.attempts.length} attempt(s), ${seconds(wallMs)})`, ''];
  if (result.status === 'unavailable') lines.push(`Unavailable: \`${result.reason}\`: ${result.message}`, '');

  result.attempts.forEach((a, i) => {
    lines.push(`Attempt ${a.attempt}: prompt_eval_count ${a.promptEvalCount}, eval_count ${a.evalCount}, done_reason ${a.doneReason}, ${seconds(a.durationMs)}`);
    if (a.errors.length === 0) lines.push('- no validator errors');
    for (const e of a.errors) {
      lines.push(`- \`${e.rule}\` ${e.section ?? 'narrative'}${e.sentence ? `, "${e.sentence}"` : ''}: ${e.detail}`);
    }
    const accepted = result.status === 'ok' && i === result.attempts.length - 1;
    lines.push('', `<details><summary>Attempt ${a.attempt} draft (${accepted ? 'accepted' : 'rejected'})</summary>`, '');
    lines.push(...renderDraft(raw[i]?.content ?? ''), '</details>', '');
  });
  return lines;
}

function renderRunSet({ version, before, after, factCount, runs }) {
  const attempts = runs.flatMap(r => r.result.attempts);
  const promptCounts = attempts.map(a => a.promptEvalCount).filter(n => n !== null);
  const speeds = attempts.filter(a => a.evalCount && a.durationMs).map(a => a.evalCount / (a.durationMs / 1000));
  const meanSpeed = speeds.length ? (speeds.reduce((s, v) => s + v, 0) / speeds.length).toFixed(1) : '?';

  const lines = [
    `## Run set ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`,
    '',
    `- Model: ${MODEL} · Ollama ${version} · options \`${JSON.stringify(OLLAMA_OPTIONS)}\``,
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
    `| attempts per run | ${runs.map(r => r.result.attempts.length).join(', ')} |`,
    `| errors by rule (all attempts) | ${countByRule(attempts.flatMap(a => a.errors))} |`,
    `| max prompt_eval_count | ${promptCounts.length ? Math.max(...promptCounts) : '?'} (warning above ${PROMPT_TOKEN_WARNING}) |`,
    `| output speed, end to end | ${meanSpeed} tokens/s (eval_count / attempt time; run 1 includes model load) |`,
    '',
    '### Runs',
    '',
    '| Run | Status | Attempt | Time | prompt_eval_count | eval_count | done_reason | Errors |',
    '|---|---|---|---|---|---|---|---|',
    ...runs.flatMap(r => r.result.attempts.map(a =>
      `| ${r.n} | ${r.result.status} | ${a.attempt} | ${seconds(a.durationMs)} | ${a.promptEvalCount} | ${a.evalCount} | ${a.doneReason} | ${countByRule(a.errors)} |`)),
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
    const raw = [];
    const provider = async args => {
      try {
        const response = await callOllama({ ...args, baseUrl: OLLAMA_URL });
        raw.push({ content: response.content });
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
    console.log(`run ${n}: ${result.status} after ${result.attempts.length} attempt(s), ${seconds(wallMs)}`);
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
