# Measurement system and invariants

The rules of the two-layer measurement system the dashboard implements, and
the invariants every change must preserve. The assessment report
(`ai-report-spec.md`) applies them to generated text exactly as the
dashboard applies them to the UI; the automated test suite enforces them.

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
