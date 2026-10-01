# CLAUDE.md

React dashboard implementing a two-layer measurement system for the
effectiveness of NIS2-related cybersecurity measures in OT environments.
Originally an MSc thesis artifact (tag `v1.0-thesis`, never modify or retag it).
Now a hobby project, developed on feature branches.

## Commands

- `npm run dev`: dev server (Vite)
- `npm test`: full test suite (Vitest). Must stay green.
- `npm run lint`: oxlint

## Architecture

- `src/engine/`: pure logic, no React, no side effects. Single source of truth
  for every score, state, transition, and advisory.
  `scoring.js` (Layer 1), `layer0.js`, `comparison.js`, `crossIndicator.js`,
  `priorityView.js`, `projection.js`, `timeline.js`, `persistence.js`.
- `src/data/`: definitions and labels. `indicatorDefinitions.js` (bands,
  states, `STATE_PRIORITY_LABELS`), `layer0Definitions.js`,
  `displayNames.js` (ID → descriptive name, `formatScore`).
- `src/components/`: pure renderers. They recompute nothing.
- `scenarios/`: fictional Westmaas Water Treatment assessment files.

## The system (do not change without explicit agreement)

- Layer 1: 8 scored indicators, 0–4, 4 = best. Incident Handling (IH) = mean
  of 3; Business Continuity (BC) = mean of 5; Overall = mean(IH, BC), secondary.
- Layer 0: 9 unscored items (6 prerequisites + 3 process evidence).
  Risk management lives entirely in Layer 0 and has NO score anywhere
  user-facing, even though `layer0.js` computes an internal `processScore`.
- Incomplete dimension: if any indicator in a dimension has no score, the
  dimension has no score. Never reduce the denominator.

## Invariants (every change must preserve these)

1. Score 0 (capability absent / objective not defined, a programme gap) is
   not the same as no score (evidence absent). Keep them distinct in logic,
   wording, and UI.
2. Missing evidence never becomes a performance judgement.
3. A state change is never a score change. Deltas exist only for the three
   score-to-score transition types in `comparison.js`.
4. Operational Threshold Violation Rate has direction-inverted bands: they
   already map to 4 = best. Never apply a second reversal.
5. Engines decide; renderers (and any AI layer) only present.

## Conventions

- Discuss → agree → build. Propose a plan and wait for approval before
  writing code for any non-trivial change.
- Descriptive names in all user-facing text, never internal IDs
  (use `displayName()`). Say "direction-inverted", never "reverse-scored".
- New engine logic gets tests, including property tests (fast-check) where
  an invariant is involved.
- Inline styles in components; no Tailwind.
- Never invent numeric values. Values come from engine output or the user.
- On Windows PowerShell 5.1, commit messages containing quotes must use
  `git commit -F <file>`; inline `-m` splits them into separate arguments.

## Current work

The assessment report (AI-drafted headline and overview via a local Ollama
model, five generated sections; `src/report/`, `NarrativePanel.jsx`) is
merged into `main` (tag `v1.1`). Its design, validator checks and known
limitations are in `docs/ai-report-spec.md`; manual-check runs are logged
in `docs/ai-report-manual-check.md` (`npm run check:narrative -- --scenario
<file>`). Any change to the prompt, facts or validator follows the spec's
rule: spec first, tests first, replay the logged drafts, re-run the check.

PDF export (spec Step 6) is merged into `main` (tag `v1.2`): "Download PDF"
in the report panel. `src/report/reportParts.js` decides the shown parts,
text and labels for the panel, Copy and the PDF; `src/report/pdf/` holds
the pure builder (`reportDocument.js`), the pure layout (`layout.js`) and
the jsPDF renderer, loaded with `import()` on first click together with
the bundled Liberation Sans. Header values come from the result's context
fact (the generation snapshot), never live App state; the button is
disabled while the draft is stale.

Targets (spec Step 7) is merged into `main` (tag `v1.3`): a fifth generated
section, last, with the value each measured indicator below 4 needs for its
next score level, from `computeGapAnalysis` (`projection.js`). Each
`scored` fact below 4 ends with a "Next level: …" sentence
(`TARGET_WORDING.nextLevelPrefix`); outside the Targets section the
validator reads scored facts without it (checks 2 and 8, verbatim
exemption), so a target score can never pass as a current score.

Recommended actions (spec Step 8) is merged into `main` (tag `v1.4`): a sixth
generated section after Targets with the catalogue entries that match the
assessment. `src/data/actionCatalogue.js` is the catalogue in code (entry IDs
`ACT-…`, stable, never shown; a test keeps it identical to
`docs/action-catalogue.md`); `matchActions` (`src/engine/actions.js`)
decides the matches from engine output. The section is catalogue text
(`CATALOGUE_KEYS`): the validator skips it; the matching and the catalogue
text have their own tests. `result.actions` carries the matched IDs. In the
PDF the section is formatted from its structured `blocks` (unless edited).

Where to start (spec Step 9, step C) is on `feature/report-where-to-start`,
awaiting approval before merging: a second AI-drafted part after the
overview, with its own call, prompt, schema and loop
(`WHERE_TO_START_PROMPT`, `buildPicksSchema`, `validatePicks`). The model
picks min(3, n) of `result.actions` by ID (schema enum) and writes one
reason each, checked against that action's trigger facts (`triggerFacts`);
a CRITICAL flag's action must be picked. It runs whatever the
headline/overview gave and fails or goes unavailable on its own
(`result.whereToStart`); Recommended actions stays complete.

Also open: the "Cleanup backlog" section at the end of `docs/ai-report-spec.md`
(`SCORE_LEVEL` duplicate in `Layer0ItemCard`, "poor" vs "Developing" in the
cross-indicator advisories, 18 pre-existing lint warnings), on `main` or a
short-lived branch from it.
