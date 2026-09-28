# AI-drafted narrative reports: spec

Status: design agreed, not yet implemented. Work through the steps in order;
stop after each step for review before starting the next.

## Goal

A "Generate narrative" button that produces a short management summary of an
assessment, written by a local LLM (Ollama), shown next to the existing
deterministic views as an editable, clearly labelled AI draft.

## Core principle

The engines decide everything; the model only narrates.

The model never sees raw inputs. It receives a list of pre-worded,
pre-rounded facts built from engine output, and may only rephrase and connect
them. A validator checks the output before it is shown. All invariants in
`CLAUDE.md` apply to generated text exactly as they apply to the UI.

## Scope and order

1. Single-assessment report (this spec).
2. Comparison report: later, reuses the single-assessment facts for each side
   and adds transition facts. Not in this spec.
3. Timeline report: maybe, later.

Out of scope: gap projection (hypothetical values must never be narrated as
results), recommendations beyond what engine messages already say, any
cloud provider.

## File layout

```
src/report/facts.js            buildAssessmentFacts(assessment) → facts
src/report/prompt.js           SYSTEM_PROMPT, buildUserMessage(facts)
src/report/schema.js           buildOutputSchema(factIds)
src/report/validator.js        validateNarrative(narrative, facts) → { ok, errors }
src/report/providers/ollama.js callOllama({ model, system, user, schema })
src/report/generate.js         generateNarrative(assessment, options)
src/components/NarrativePanel.jsx
```

All of `src/report/` except the provider is pure and fully unit-testable
without a model.

---

## Step 0: Housekeeping

- Branch `feature/ai-reports` from `main`.
- `scenarios/Westmaas_2026-06-01_assessment.json`: `assessmentDate` is
  `"2026-01-06"`; should be `"2026-06-01"` (day/month swapped).
- Both scenario files: `clientId` is `"Watermaas"`; should be `"Westmaas"`.
- README: analysis script is referenced as `sensitivity_analysis_v3.py` but
  the file is `analysis/sensitivity_analysis.py` (rename the file to `_v3`);
  the demo path `scenario/Watermaas_2026-01-01_assessment` should be
  `scenarios/Westmaas_2026-01-01_assessment.json`.

Acceptance: `npm test` still green.

---

## Step 1: Fact builder (`facts.js`)

`buildAssessmentFacts(assessment)` runs the existing engines
(`computeAssessment`, `computeLayer0`, `computeCrossIndicator`,
`computePriorityView`). It never re-implements scoring. It returns:

```js
[{ id: 'F1', kind: 'dim_incomplete', text: '...', refs: ['IH-08'] }, ...]
```

`refs` holds the internal IDs the fact is about (validator use only; never
shown to the model). Dimension facts use the pseudo-IDs `IH`, `BC`, `OVERALL`
plus the indicators involved. IDs are assigned in a stable order: C-facts,
then dimensions, indicators (canonical order), Layer 0 (`l0_ok`, `l0_flag`,
`process`, `l0_unset`), advisories, priority.

### Fact kinds

| kind | meaning |
|---|---|
| `context` | assessment metadata and how to read scores |
| `dim_complete` | dimension with a score |
| `dim_incomplete` | dimension with no score (incl. Overall) |
| `scored` | Layer 1 indicator, measured, with a score |
| `gap_zero` | programme gap: score 0 because objective/capability absent |
| `no_score` | not measurable / no qualifying event / unset: no score |
| `l0_ok` | Layer 0 items in a satisfactory state (one grouped fact) |
| `l0_flag` | Layer 0 action flag, with severity (excludes the two process-evidence items) |
| `process` | process evidence (vulnerability remediation etc.): value + message, never a score; severity prefix when the engine raises an action flag for it |
| `l0_unset` | Layer 0 items with no state recorded (one grouped fact) |
| `advisory` | cross-indicator advisory with a non-null message: Rules A, B (auto-sentence only) and C. Rule D (BC plan hints) is excluded: it is data-entry guidance, not a finding |
| `priority` | Layer 1 results scored below 3 ("Good"), by score tier, from the priority view. Always exactly one fact, with fallback text when nothing is below 3 or nothing is scored |

### Wording rules

- Names via `displayName()`, state labels via `STATE_PRIORITY_LABELS` /
  `L0_STATE_LABELS`. Never output internal IDs or raw enums.
- Units from the definitions (`hours`, `%`, `days`), never hardcoded.
- Dimension scores: two decimals via `formatScore` (1.80). Indicator scores:
  integers ("score 3"). No unrounded floats anywhere.
- Layer 0 and advisory messages: copy the engine's `message` string
  verbatim. Do not paraphrase.
- Process evidence: include the value and the engine message; never
  `processScore`.
- `dim_complete` for BC must state when a programme-gap 0 is included in the
  mean.
- `priority`: items with equal scores are marked as equal priority, listed in
  catalogue order.
- No layer jargon. Use "effectiveness indicators" for Layer 1 and
  "foundational controls and process evidence" for Layer 0.
- Engine messages that contain internal IDs (Rule A/B advisories, "interpret
  alongside RM-04") are copied verbatim except that exact internal IDs are
  replaced by `displayName()`. A bare dimension code followed by a number
  ("BC 1.80") becomes "Business Continuity score 1.80".
- Assessor free-text reasons (not-measurable `reason.text`) are included
  verbatim (whitespace collapsed) at the end of the fact as
  `Assessor note: "…"`. The quoted span is exempt from the text checks (IDs,
  enums, decimals). A reason linked to a Layer 0 item is stated by the item's
  name.
- The asset-inventory contextual note is not included (layer jargon and
  ordering advice).
- Dimension names come from `DIMENSION_NAMES` (`displayNames.js`), severity
  labels from `L0_SEVERITY_LABELS` (`layer0Definitions.js`), the Vulnerability
  Remediation Rate unit from its `valueUnit`. Nothing is hardcoded in
  `facts.js`.
- Every `lower_is_better` indicator is marked "(lower is better)".

### Test fixture: Westmaas baseline (2026-01-01)

Verified against engine output. After the Step 0 fix the client name reads
"Westmaas". Exact text may differ slightly; the content, kinds and numbers
must match.

```
C1  context         Assessment of "Westmaas", dated 2026-01-01.
C2  context         Eight effectiveness indicators are scored 0–4, where 4 is
                    best. A dimension score is the mean of its indicators. If
                    any indicator in a dimension has no score, the dimension
                    is incomplete and has no score.
F1  dim_incomplete  Incident Handling: incomplete. Mean Time to Contain has
                    no score, so no Incident Handling score is available.
F2  dim_complete    Business Continuity: complete, score 1.80 out of 4 (5
                    indicators). This includes the programme-gap 0 for RPO
                    Achievement Rate.
F3  dim_incomplete  Overall score: not available, because Incident Handling
                    is incomplete.
F4  scored          Mean Time to Detect: measured at 18 hours (lower is
                    better); score 3.
F5  scored          Mean Time to Respond: measured at 30 hours (lower is
                    better); score 2.
F6  no_score        Mean Time to Contain: not measurable. The evidence needed
                    to compute it is absent or unreliable. No score. This says
                    nothing about how Mean Time to Contain performs. No reason
                    was recorded.
F7  scored          Network Operability Under Disruption: measured at 85%;
                    score 3.
F8  scored          Zone Availability Rate: measured at 40%; score 2.
F9  scored          Operational Threshold Violation Rate: measured at 12.5%
                    (lower is better); score 2.
F10 scored          RTO Achievement Rate: measured at 50%; score 2.
F11 gap_zero        RPO Achievement Rate: no recovery point objective defined.
                    Scored 0 as a programme gap: the objective does not exist
                    yet. Not a measured failure.
F12 l0_ok           In place: Asset inventory maintained; Risk assessment per
                    zone; Controlled IT/OT boundary separation; BC plan
                    documented for critical processes.
F13 l0_flag         CRITICAL. Uncontrolled inter-zone multi-homed devices
                    were identified.
F14 l0_flag         HIGH. Asset interdependency documentation is incomplete
                    or outdated.
F15 l0_flag         HIGH. No BC plan test was performed during the assessment
                    period — a scheduled action was not completed.
F16 process         MEDIUM NOTE. Vulnerability Remediation Rate: 60%.
                    Vulnerability remediation rate is below target (50–69%) —
                    moderate programme improvement warranted. Process
                    evidence, not scored.
F17 process         Mean Time to Remediate: 75 days. Mean time to remediate
                    is satisfactory (31–90 days) — continue monitoring.
                    Process evidence, not scored.
F18 advisory        Uncontrolled multi-homed devices were found while Zone
                    Availability Rate is poor (score 2). A segmentation bypass
                    of this kind can be directly implicated in this outcome —
                    these may be related; review them together.
F19 advisory        Zero uncontrolled multi-homed devices is in a weak state
                    (Uncontrolled multi-homing found) and Mean Time to Contain
                    is not measurable. Establishing the architecture
                    foundation and the evidence needed to measure Mean Time to
                    Contain are both measurement-readiness actions — address
                    them together.
F20 priority        Lowest effectiveness results: RPO Achievement Rate
                    (programme gap, 0); then, at score 2 and of equal
                    priority, listed in catalogue order: Mean Time to Respond,
                    Zone Availability Rate, Operational Threshold Violation
                    Rate, RTO Achievement Rate.
```

Engine ordering note: `computeCrossIndicator` currently returns the bypass
advisory after the readiness advisory; the order above (F18/F19) is
illustrative. Use the engine's order.

Tests (Step 1):
- Westmaas baseline produces the facts above (kinds, numbers, refs).
- Outside an assessor note, no fact text contains an internal ID
  (`/\b(IH|BC|RM)-\d+\b|L0-/`), a raw enum (`/_/` in a word), or "Layer 0/1".
- Outside an assessor note, no fact text contains a number with more than 2
  decimals.
- An assessor note containing an internal ID and a number is included
  verbatim inside `Assessor note: "…"`, and the text checks still pass.
- Property test: for random valid assessments, every `no_score` indicator
  appears in exactly one `no_score` fact and in no `scored` fact; `process`
  facts never contain the word "score" followed by a digit.

---

## Step 2: Prompt and schema (`prompt.js`, `schema.js`)

### System prompt

```
You write a short management summary of an OT cybersecurity assessment,
for a manager who does not know the scoring system.
You will receive a numbered list of facts. They are complete and correct.

Rules:
1. Use only the facts given. Add no information, causes, or recommendations
   that are not in a fact.
2. Every number you write, in digits or words, must appear in a fact you
   cite. Never calculate, count, average, round, or estimate.
3. "Not measurable" means evidence is missing. Never describe it as good,
   poor, weak, or failing. Say what evidence is missing.
4. A programme gap (score 0 because an objective is not defined) is not a
   measured failure. Say the objective does not exist yet.
5. An incomplete dimension has no score. Never give it one or estimate one.
6. Process evidence items are not scored. Never give them a score.
7. When a fact says "may be related", keep that wording. Never claim one
   thing caused another.
8. Items listed with equal priority are not ranked against each other.
9. First choose the facts for each section in factIds, then write the text
   from those facts only. Never write fact IDs in the text.
10. Plain, professional English. 2–4 short sentences per section.
    No bullet points.
```

User message: the fact list as `ID: text` lines, one per line. Kinds and
refs are not sent.

### Output schema

JSON Schema passed to Ollama's `format` field. `factIds` is an enum of the
actual fact IDs for this assessment, so invented IDs are impossible.
`factIds` comes BEFORE `text` in every object (the model generates in field
order: it selects facts first, then writes).

```json
{
  "headline": { "factIds": [], "text": "one sentence" },
  "sections": {
    "overview":               { "factIds": [], "text": "" },
    "measuredPerformance":    { "factIds": [], "text": "" },
    "gapsAndMissingEvidence": { "factIds": [], "text": "" },
    "foundationsAndFlags":    { "factIds": [], "text": "" },
    "priorities":             { "factIds": [], "text": "" }
  }
}
```

All fields required; `factIds` `minItems: 1`.

Tests: schema enum equals the fact IDs; field order is `factIds`, `text`;
user message contains no kinds, refs or internal IDs.

---

## Step 3: Validator (`validator.js`)

`validateNarrative(narrative, facts)` → `{ ok, errors: [{ section, sentence, rule, detail }] }`.
Pure, no model needed. Checks, per section (headline included):

1. **Fact IDs**: every cited ID exists (defence in depth; the schema enum
   should already guarantee this).
2. **Numbers**: every number in the text appears in at least one cited
   fact. Extraction handles digits (`12.5`, `1.80`, `85%`), number words
   `one`–`twenty`, and ISO dates as a single token. Normalise before
   comparing (`1.80` = `1.8`, `3.00` = `3`).
3. **No leaked IDs**: no `F\d+`/`C\d+` fact IDs, internal IDs, or raw enums in
   text.
4. **No-score wording**: split text into sentences, then clauses (on `,` `;`
   `—` and ` and `). A clause fails if it names a `no_score` item AND
   contains a performance word (`poor`, `weak`, `bad`, `failing`, `failed`,
   `good`, `strong`, `underperform*`, `low`, `high`), UNLESS the clause
   appears verbatim in a cited fact.
   Known case this exemption exists for: F19 contains "weak" (about the
   multi-homing item) in the same sentence as Mean Time to Contain.
5. **No score for unscored things**: a clause fails if it names a
   `dim_incomplete` dimension, a `process` item, or a `no_score` item
   together with "score" + number or "scored" + number, unless verbatim in a
   cited fact.
6. **Programme gap**: a clause naming a `gap_zero` item fails if it contains
   `fail*`, `missed` or `poor`, unless verbatim in a cited fact.
7. **Causal overclaim**: if a cited fact contains "may be related", the
   section text must not contain `caused`, `causes`, `because of`,
   `due to`, `led to`, `results from`, `resulted in`.

Tests: hand-written good narrative for the Westmaas baseline passes; each
rule has at least one failing example (e.g. "Mean Time to Contain is poor",
"Incident Handling scored 2.50", "two of the five indicators" with no fact
containing "two", "the multi-homing caused the low availability"); the F19
verbatim case passes.

---

## Step 4: Ollama provider and generation (`ollama.js`, `generate.js`)

### Setup (local machine)

```
ollama pull qwen2.5:7b        # alternative: llama3.1:8b
```

Vite dev proxy in `vite.config.js`, so the browser never hits CORS:

```js
server: {
  proxy: {
    '/ollama': {
      target: 'http://localhost:11434',
      changeOrigin: true,
      rewrite: p => p.replace(/^\/ollama/, ''),
    },
  },
},
```

The proxy only exists under `npm run dev`. That is fine for this project.

### Provider

`POST /ollama/api/chat` with
`{ model, messages: [system, user], format: schema, stream: false, options: { temperature: 0.2, num_ctx: 8192 } }`.
`num_ctx` is set explicitly because Ollama's default context window can
silently truncate the system prompt when the fact list is long.
Parse `message.content` as JSON. Keep the provider behind one function so a
different backend can be added later without touching anything else.

### `generateNarrative(assessment, { model })`

1. `facts = buildAssessmentFacts(assessment)`
2. Call the provider; parse; validate.
3. On validation failure: retry up to 2 more times, appending the validator
   errors to the user message ("Your previous draft broke these rules: ...").
4. Returns `{ status: 'ok' | 'failed' | 'unavailable', narrative, errors, facts, attempts }`.
   `failed` = still invalid after 3 attempts: never show that text as a report.
   `unavailable` = Ollama not reachable.

Tests: mock the provider (valid first try; invalid then valid; always
invalid; network error).

Manual check: generate for the Westmaas baseline 5 times; note every
validator failure. If one rule keeps failing, adjust the prompt, not the
validator.

---

## Step 5: UI (`NarrativePanel.jsx`)

- Placed in the dashboard view (`view === 'dashboard'` in `App.jsx`), below
  the existing panels.
- "Generate narrative" button, a loading state, and a model name shown.
- On `ok`: headline + five sections in an editable text area, a visible
  label "AI-drafted — review before use", and a copy button.
- Collapsible "Based on facts" list showing each section's cited facts.
- On `failed`: no narrative text; show "The draft did not pass validation"
  and the error list.
- On `unavailable`: "Ollama is not running at localhost:11434" plus the
  start command.
- The panel is a pure renderer of `generateNarrative` output; it computes
  nothing.

Tests: renders each status; the label is always present on `ok`; no text is
shown on `failed`.

---

## Done when

- All steps merged on `feature/ai-reports`, full suite green.
- Westmaas baseline generates a validated narrative in most attempts.
- No invariant in `CLAUDE.md` can be broken by generated text without the
  validator catching it.
