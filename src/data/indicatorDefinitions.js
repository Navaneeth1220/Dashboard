/**
 * Indicator definitions: per-indicator state lists, band thresholds, direction, and units.
 *
 * ─── BAND STRUCTURE ─────────────────────────────────────────────────────────
 *
 * Each band is an explicit, contiguous half-open interval. There are NO gaps
 * between adjacent bands; every possible measured value maps unambiguously to
 * exactly one score without relying on sequential-fallthrough inference.
 *
 * lower_is_better bands use { score, gt, lte }:
 *   Interval: gt < value ≤ lte  (gt = exclusive lower; lte = inclusive upper)
 *   gt: null  means no lower bound (matches any value ≤ lte).
 *   Values above the highest lte fall through to score 0.
 *
 * higher_is_better bands use { score, gte, lt }:
 *   Interval: gte ≤ value < lt  (gte = inclusive lower; lt = exclusive upper)
 *   lt: null  means no upper bound (matches any value ≥ gte).
 *   Values below the lowest gte fall through to score 0.
 *
 * Boundary convention (Scoring_Design.pdf §IH-06 … §BC-09):
 *   The spec uses "≤" notation for lower-is-better upper bounds and "≥" for
 *   higher-is-better lower bounds. Both edges are INCLUSIVE at the
 *   score-improving side. A value exactly at a boundary belongs to the
 *   HIGHER score — e.g., IH-06 exactly 6 h → score 4, not score 3;
 *   BC-01 exactly 90 % → score 4, not score 3.
 *
 * Contiguous intervals for thesis documentation:
 *
 *   IH-06 / IH-08  (hours, lower_is_better):
 *     Score 4: (−∞,  6]   Score 3: (6,  24]   Score 2: (24, 168]
 *     Score 1: (168, 720]  Score 0: (720, +∞)
 *
 *   IH-07  (hours, lower_is_better):
 *     Score 4: (−∞,  4]   Score 3: (4,  24]   Score 2: (24,  72]
 *     Score 1: (72, 168]   Score 0: (168, +∞)
 *
 *   BC-01 / BC-02  (%, higher_is_better):
 *     Score 4: [90, +∞)   Score 3: [70, 90)   Score 2: [30, 70)
 *     Score 1: [1, 30)     Score 0: [0, 1)
 *
 *   BC-04  (%, lower_is_better — see reverse-scoring note below):
 *     Score 4: [0, 0]    Score 3: (0,  5]    Score 2: (5, 20]
 *     Score 1: (20, 50]   Score 0: (50, +∞)
 *
 *   BC-08 / BC-09  (%, higher_is_better):
 *     Score 4: [90, +∞)   Score 3: [75, 90)   Score 2: [50, 75)
 *     Score 1: [1, 50)     Score 0: [0, 1)
 *
 * ─── BC-04 REVERSE-SCORING NOTE ─────────────────────────────────────────────
 *
 *   BC-04 is lower_is_better (lower violation rate = better outcome).
 *   Its band table maps 0 % violations → score 4 and >50 % → score 0,
 *   placing the score on the same "4 = best" scale as all other indicators.
 *   The spec's "reverse-scored before aggregation" requirement is fully
 *   satisfied by the band table itself. NO additional arithmetic reversal is
 *   applied during aggregation — doing so would double-invert BC-04 and
 *   silently corrupt the BC score.
 *
 * ─── IH TIME UNITS ──────────────────────────────────────────────────────────
 *
 *   All IH time values are stored and compared in HOURS.
 *   Scoring_Design.pdf day-based boundaries converted exactly:
 *     1 day = 24 h   3 days = 72 h   7 days = 168 h   30 days = 720 h
 */

// ---------------------------------------------------------------------------
// State constant keys
// ---------------------------------------------------------------------------
export const STATE = {
  MEASURED:                   'measured',
  NO_QUALIFYING_EVENT:        'no_qualifying_event',
  NO_QUALIFYING_DISRUPTION:   'no_qualifying_disruption',
  NOT_MEASURABLE:             'not_measurable',
  CAPABILITY_ABSENT:          'capability_absent',
  NO_THRESHOLDS_DEFINED:      'no_thresholds_defined',
  NO_RTO_DEFINED:             'no_rto_defined',
  NO_RPO_DEFINED:             'no_rpo_defined',
};

export const STATE_LABELS = {
  [STATE.MEASURED]:                 'Measured',
  [STATE.NO_QUALIFYING_EVENT]:      'No qualifying event',
  [STATE.NO_QUALIFYING_DISRUPTION]: 'No qualifying disruption',
  [STATE.NOT_MEASURABLE]:           'Not measurable',
  [STATE.CAPABILITY_ABSENT]:        'Capability absent',
  [STATE.NO_THRESHOLDS_DEFINED]:    'No operational thresholds defined',
  [STATE.NO_RTO_DEFINED]:           'No RTO defined',
  [STATE.NO_RPO_DEFINED]:           'No RPO defined',
};

/**
 * Priority-view chip labels keyed by state — the SINGLE SOURCE for the
 * human-readable strings used to distinguish kinds of result in the Layer 1
 * priority view (Stage 3b-ii), and reused by 3b-iii, Stage 4 projection, and
 * Stage 5 comparison. Do not hardcode these strings in components; import here
 * so the labels cannot drift across stages.
 *
 * `measured_zero` is a synthetic key for a performance failure (state measured,
 * score 0) — distinct from the programme-gap zeros below, which are structural
 * (the objective/capability does not exist).
 */
export const STATE_PRIORITY_LABELS = {
  [STATE.MEASURED]:                 { chip: 'Measured',            detail: 'Validated value within a scoring band' },
  measured_zero:                    { chip: 'Measured failure',   detail: 'Objective genuinely failed — measured score 0' },
  [STATE.CAPABILITY_ABSENT]:        { chip: 'Capability absent',  detail: 'No identifiable pathway exists for this outcome' },
  [STATE.NO_THRESHOLDS_DEFINED]:    { chip: 'No thresholds defined', detail: 'No operational thresholds established' },
  [STATE.NO_RTO_DEFINED]:           { chip: 'No RTO defined',      detail: 'Recovery time objective not established' },
  [STATE.NO_RPO_DEFINED]:           { chip: 'No RPO defined',      detail: 'Recovery point objective not established' },
  [STATE.NOT_MEASURABLE]:           { chip: 'Not measurable',      detail: 'Evidence to compute the value is absent or unreliable' },
  [STATE.NO_QUALIFYING_EVENT]:      { chip: 'No qualifying event', detail: 'No qualifying incident, exercise, or disruption occurred' },
  [STATE.NO_QUALIFYING_DISRUPTION]: { chip: 'No qualifying disruption', detail: 'No qualifying disruption occurred this period' },
};

// States that carry a programme-gap score of 0 (distinct from band-lookup 0)
export const SCORE_ZERO_STATES = new Set([
  STATE.CAPABILITY_ABSENT,
  STATE.NO_THRESHOLDS_DEFINED,
  STATE.NO_RTO_DEFINED,
  STATE.NO_RPO_DEFINED,
]);

// States that produce no score (evidence gap — must never be treated as 0)
export const NO_SCORE_STATES = new Set([
  STATE.NO_QUALIFYING_EVENT,
  STATE.NO_QUALIFYING_DISRUPTION,
  STATE.NOT_MEASURABLE,
]);

export const SCORE_LEVEL_LABELS = {
  4: 'Excellent',
  3: 'Good',
  2: 'Developing',
  1: 'Initial',
  0: 'None',
};

// ---------------------------------------------------------------------------
// Indicator definitions
// ---------------------------------------------------------------------------
export const INDICATORS = {

  // ── Incident Handling ────────────────────────────────────────────────────

  'IH-06': {
    id: 'IH-06',
    name: 'Mean Time to Detect',
    shortName: 'MTTD',
    measure: 'IH',
    direction: 'lower_is_better',
    unit: 'hours',
    inputType: 'single_value',
    valuePlaceholder: 'e.g. 4.5',
    allowedStates: [
      STATE.MEASURED,
      STATE.NO_QUALIFYING_EVENT,
      STATE.NOT_MEASURABLE,
      STATE.CAPABILITY_ABSENT,
    ],
    // Contiguous intervals: (−∞,6] · (6,24] · (24,168] · (168,720] · (720,+∞)→0
    bands: [
      { score: 4, gt: null, lte: 6   },   // ≤ 6 h
      { score: 3, gt: 6,   lte: 24  },   // 6 h < v ≤ 24 h
      { score: 2, gt: 24,  lte: 168 },   // 24 h < v ≤ 168 h  (1–7 d)
      { score: 1, gt: 168, lte: 720 },   // 168 h < v ≤ 720 h (7–30 d)
    ],
  },

  'IH-07': {
    id: 'IH-07',
    name: 'Mean Time to Respond',
    shortName: 'MTTR',
    measure: 'IH',
    direction: 'lower_is_better',
    unit: 'hours',
    inputType: 'single_value',
    valuePlaceholder: 'e.g. 2',
    allowedStates: [
      STATE.MEASURED,
      STATE.NO_QUALIFYING_EVENT,
      STATE.NOT_MEASURABLE,
      STATE.CAPABILITY_ABSENT,
    ],
    // Contiguous intervals: (−∞,4] · (4,24] · (24,72] · (72,168] · (168,+∞)→0
    bands: [
      { score: 4, gt: null, lte: 4   },   // ≤ 4 h
      { score: 3, gt: 4,   lte: 24  },   // 4 h < v ≤ 24 h
      { score: 2, gt: 24,  lte: 72  },   // 24 h < v ≤ 72 h  (1–3 d)
      { score: 1, gt: 72,  lte: 168 },   // 72 h < v ≤ 168 h (3–7 d)
    ],
  },

  'IH-08': {
    id: 'IH-08',
    name: 'Mean Time to Contain',
    shortName: 'MTTC',
    measure: 'IH',
    direction: 'lower_is_better',
    unit: 'hours',
    inputType: 'single_value',
    valuePlaceholder: 'e.g. 5',
    allowedStates: [
      STATE.MEASURED,
      STATE.NO_QUALIFYING_EVENT,
      STATE.NOT_MEASURABLE,
      STATE.CAPABILITY_ABSENT,
    ],
    // Contiguous intervals: (−∞,6] · (6,24] · (24,168] · (168,720] · (720,+∞)→0
    bands: [
      { score: 4, gt: null, lte: 6   },
      { score: 3, gt: 6,   lte: 24  },
      { score: 2, gt: 24,  lte: 168 },
      { score: 1, gt: 168, lte: 720 },
    ],
  },

  // ── Business Continuity ──────────────────────────────────────────────────

  'BC-01': {
    id: 'BC-01',
    name: 'Network Operability Under Disruption',
    shortName: 'Network Operability',
    measure: 'BC',
    direction: 'higher_is_better',
    unit: '%',
    inputType: 'single_value',
    valuePlaceholder: 'e.g. 85',
    // No named programme-gap state. Score 0 arises only from band lookup
    // (observed complete failure = 0 % measured during a qualifying disruption).
    allowedStates: [
      STATE.MEASURED,
      STATE.NO_QUALIFYING_DISRUPTION,
      STATE.NOT_MEASURABLE,
    ],
    // Contiguous intervals: [90,+∞) · [70,90) · [30,70) · [1,30) · [0,1)→0
    bands: [
      { score: 4, gte: 90, lt: null },   // ≥ 90 %
      { score: 3, gte: 70, lt: 90   },   // 70 % ≤ v < 90 %
      { score: 2, gte: 30, lt: 70   },   // 30 % ≤ v < 70 %
      { score: 1, gte: 1,  lt: 30   },   // 1 % ≤ v < 30 %
    ],
  },

  'BC-02': {
    id: 'BC-02',
    name: 'Zone Availability Rate',
    shortName: 'Zone Availability',
    measure: 'BC',
    direction: 'higher_is_better',
    unit: '%',
    // Direct percentage entered by the consultant (multi-event aggregation is
    // done upstream by the consultant, not computed here) — same as BC-01.
    inputType: 'single_value',
    valuePlaceholder: 'e.g. 85',
    allowedStates: [
      STATE.MEASURED,
      STATE.NO_QUALIFYING_DISRUPTION,
      STATE.NOT_MEASURABLE,
    ],
    // Contiguous intervals: same as BC-01
    bands: [
      { score: 4, gte: 90, lt: null },
      { score: 3, gte: 70, lt: 90   },
      { score: 2, gte: 30, lt: 70   },
      { score: 1, gte: 1,  lt: 30   },
    ],
  },

  'BC-04': {
    id: 'BC-04',
    name: 'Operational Threshold Violation Rate',
    shortName: 'Threshold Violation Rate',
    measure: 'BC',
    direction: 'lower_is_better',
    unit: '%',
    inputType: 'ratio',
    numeratorLabel: 'Parameters with confirmed violation',
    denominatorLabel: 'Total critical parameters with defined thresholds',
    // "No operational thresholds defined" is a DISTINCT programme-gap state,
    // separate from capability_absent. Score 0 via this state (programme gap)
    // must remain distinguishable from score 0 via band fallthrough (>50 %
    // performance failure), because Stage 2/3 action-flag logic keys off the
    // difference. The engine sets programmeGap: true only for SCORE_ZERO_STATES.
    allowedStates: [
      STATE.MEASURED,
      STATE.NO_QUALIFYING_DISRUPTION,
      STATE.NOT_MEASURABLE,
      STATE.NO_THRESHOLDS_DEFINED,
    ],
    // BC-04 reverse-scoring — DO NOT add a second flip (see file header).
    // Contiguous intervals: [0,0] · (0,5] · (5,20] · (20,50] · (50,+∞)→0
    bands: [
      { score: 4, gt: null, lte: 0  },   // = 0 % (no violations at all)
      { score: 3, gt: 0,   lte: 5  },   // 0 % < v ≤ 5 %
      { score: 2, gt: 5,   lte: 20 },   // 5 % < v ≤ 20 %
      { score: 1, gt: 20,  lte: 50 },   // 20 % < v ≤ 50 %
    ],
  },

  'BC-08': {
    id: 'BC-08',
    name: 'RTO Achievement Rate',
    shortName: 'RTO Achievement',
    measure: 'BC',
    direction: 'higher_is_better',
    unit: '%',
    inputType: 'ratio',
    numeratorLabel: 'Recovery events meeting RTO',
    denominatorLabel: 'Total qualifying recovery events',
    allowedStates: [
      STATE.MEASURED,
      STATE.NO_QUALIFYING_EVENT,
      STATE.NOT_MEASURABLE,
      STATE.NO_RTO_DEFINED,
    ],
    // Contiguous intervals: [90,+∞) · [75,90) · [50,75) · [1,50) · [0,1)→0
    bands: [
      { score: 4, gte: 90, lt: null },
      { score: 3, gte: 75, lt: 90   },
      { score: 2, gte: 50, lt: 75   },
      { score: 1, gte: 1,  lt: 50   },
    ],
  },

  'BC-09': {
    id: 'BC-09',
    name: 'RPO Achievement Rate',
    shortName: 'RPO Achievement',
    measure: 'BC',
    direction: 'higher_is_better',
    unit: '%',
    inputType: 'ratio',
    numeratorLabel: 'Restored RPO-bearing items within RPO',
    denominatorLabel: 'Total RPO-bearing items restored',
    allowedStates: [
      STATE.MEASURED,
      STATE.NO_QUALIFYING_EVENT,
      STATE.NOT_MEASURABLE,
      STATE.NO_RPO_DEFINED,
    ],
    // Contiguous intervals: same as BC-08
    bands: [
      { score: 4, gte: 90, lt: null },
      { score: 3, gte: 75, lt: 90   },
      { score: 2, gte: 50, lt: 75   },
      { score: 1, gte: 1,  lt: 50   },
    ],
  },
};

export const IH_INDICATOR_IDS = ['IH-06', 'IH-07', 'IH-08'];
export const BC_INDICATOR_IDS = ['BC-01', 'BC-02', 'BC-04', 'BC-08', 'BC-09'];
export const ALL_INDICATOR_IDS = [...IH_INDICATOR_IDS, ...BC_INDICATOR_IDS];
