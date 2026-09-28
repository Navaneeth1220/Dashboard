# CLAUDE.md

React dashboard implementing a two-layer measurement system for the
effectiveness of NIS2-related cybersecurity measures in OT environments.
Originally an MSc thesis artifact (tag `v1.0-thesis`, never modify or retag it).
Now a hobby project, developed on feature branches.

## Commands

- `npm run dev`: dev server (Vite)
- `npm test`: full test suite (Vitest). Must stay green; currently 580 tests.
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

## Current work

AI-drafted narrative reports via a local Ollama model:
see `docs/ai-report-spec.md`. Branch: `feature/ai-reports`.
