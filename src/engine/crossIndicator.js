/**
 * Cross-Indicator Logic — Stage 3a (design-logic §5).
 *
 * Four advisory-generating pure functions: Rules A, B, C, D.
 * Every output here is ADVISORY ONLY. Nothing in this module recomputes,
 * mutates, or feeds back into any Layer 1 score or Layer 0 state. These
 * functions read the OUTPUTS of computeAssessment (Layer 1) and computeLayer0
 * (Layer 0); they never touch the engines that produced them.
 *
 * Input model:
 *   The Layer 1 result object (computeAssessment) carries per-indicator SCORE
 *   but not STATE (state lives in the assessment record). buildLayer1View()
 *   merges the two into { [id]: { state, score } } so the rules can read both
 *   without modifying the locked Stage 1 engine.
 *
 * No-score handling (load-bearing, §3.2 "missing evidence is never a
 * performance judgement"): a no-score indicator has score === null. All numeric
 * threshold comparisons guard `score !== null` FIRST, because in JS `null < 3`
 * coerces to `0 < 3 === true` — which would wrongly fire a rule on a no-score
 * state. Capability-absent carries score 0 (a real score), so it DOES satisfy
 * `< 3`; that is intentional.
 */

import { STATE } from '../data/indicatorDefinitions.js';
import { INDICATORS } from '../data/indicatorDefinitions.js';
import { LAYER0_ITEMS, L0_STATE } from '../data/layer0Definitions.js';
import { displayName, DIMENSION_NAMES } from '../data/displayNames.js';

// ---------------------------------------------------------------------------
// Threshold constants (single source of truth — documented in §5)
// ---------------------------------------------------------------------------

/** Rule A hard: IH-06 (MTTD) score strictly below this → notes on IH-07 & IH-08. */
export const IH06_HARD_THRESHOLD = 3;
/** Rule A soft: IH-07 (MTTR) score strictly below this → softer note on IH-08. */
export const IH07_SOFT_THRESHOLD = 2;
/** Rule B: IH-08 (MTTC) "high" containment score is ≥ this. */
export const IH08_HIGH_THRESHOLD = 3;
/** Rule B: BC dimension "low" score is strictly below this. */
export const BC_LOW_THRESHOLD = 2;

// Architecture items evaluated by Rule C, and the three Layer 1 outcomes they support.
export const ARCHITECTURE_ITEM_IDS = ['L0-it-ot-boundary', 'L0-multi-homed'];
export const ARCHITECTURE_RELATED_OUTCOMES = ['IH-08', 'BC-01', 'BC-02'];

// ---------------------------------------------------------------------------
// Layer 1 view builder
// ---------------------------------------------------------------------------

/**
 * buildLayer1View(assessment, layer1Results) → { [indicatorId]: { state, score } }
 * Read-only merge of input state + computed score. Does not mutate either input.
 */
export function buildLayer1View(assessment, layer1Results) {
  const view = {};
  const inputs = assessment?.indicators ?? {};
  const results = layer1Results?.indicators ?? {};
  for (const id of Object.keys(INDICATORS)) {
    view[id] = {
      state: inputs[id]?.state ?? null,
      score: results[id]?.score ?? null,
    };
  }
  return view;
}

// ---------------------------------------------------------------------------
// Rule A — IH dependency chain (hard, score-gated; advisory output only)
// ---------------------------------------------------------------------------

/**
 * generateIHDependencyNotes(l1) → Note[]
 *
 * Note shape: { rule:'A', target, source, severity:'hard'|'soft', message }
 *
 * Score-gated but never alters a score or promotes a priority tier.
 * No-score IH-06/IH-07 (score === null) does NOT fire (null is not "< threshold").
 * Capability-absent (score 0) DOES fire.
 */
export function generateIHDependencyNotes(l1) {
  const notes = [];
  const ih06 = l1['IH-06']?.score ?? null;
  const ih07 = l1['IH-07']?.score ?? null;

  // Hard rule: IH-06 score < 3 → notes on IH-07 and IH-08
  if (ih06 !== null && ih06 < IH06_HARD_THRESHOLD) {
    notes.push({
      rule: 'A', target: 'IH-07', source: 'IH-06', severity: 'hard',
      message: `Detection is slow (${displayName('IH-06')} score ${ih06} < ${IH06_HARD_THRESHOLD}). Improving response speed (${displayName('IH-07')}) has limited value while detection remains slow.`,
    });
    notes.push({
      rule: 'A', target: 'IH-08', source: 'IH-06', severity: 'hard',
      message: `Detection is slow (${displayName('IH-06')} score ${ih06} < ${IH06_HARD_THRESHOLD}). Improving containment speed (${displayName('IH-08')}) has limited value while detection remains slow.`,
    });
  }

  // Soft rule: IH-07 score < 2 → softer note on IH-08
  if (ih07 !== null && ih07 < IH07_SOFT_THRESHOLD) {
    notes.push({
      rule: 'A', target: 'IH-08', source: 'IH-07', severity: 'soft',
      message: `Response is slow (${displayName('IH-07')} score ${ih07} < ${IH07_SOFT_THRESHOLD}). Verify that containment timing (${displayName('IH-08')}) is interpreted correctly given the slow response.`,
    });
  }

  return notes;
}

// ---------------------------------------------------------------------------
// Rule B — interpretive pairs (side-by-side; one auto-sentence)
// ---------------------------------------------------------------------------

// The four pairs flagged "read together". Only IH-08↔BC may auto-generate text.
const INTERPRETIVE_PAIRS = [
  { pair: ['RM-04', 'RM-05'], autoSentenceEligible: false },
  { pair: ['BC-01', 'BC-02'], autoSentenceEligible: false },
  { pair: ['BC-08', 'BC-09'], autoSentenceEligible: false },
  { pair: ['IH-08', 'BC'],    autoSentenceEligible: true  },
];

/**
 * generateInterpretivePairs(l1, bcAggregate) → Pair[]
 *
 * Pair shape: { rule:'B', pair:[a,b], displaySideBySide:true, autoSentence: null | {severity,message} }
 *
 * Only the IH-08↔BC pair can carry an autoSentence, and only when:
 *   IH-08 score ≥ 3 (high containment)  AND  BC dimension score < 2 (low),
 * with BC COMPLETE as a hard precondition — an incomplete BC dimension is never
 * classified as "low" (you cannot call an unscoreable dimension low).
 * The other three pairs always have autoSentence: null.
 */
export function generateInterpretivePairs(l1, bcAggregate) {
  return INTERPRETIVE_PAIRS.map(({ pair, autoSentenceEligible }) => {
    let autoSentence = null;

    if (autoSentenceEligible) {
      const ih08 = l1['IH-08']?.score ?? null;
      const bcComplete = bcAggregate && bcAggregate.incomplete === false && bcAggregate.score !== null;
      const ih08High = ih08 !== null && ih08 >= IH08_HIGH_THRESHOLD;
      const bcLow = bcComplete && bcAggregate.score < BC_LOW_THRESHOLD;

      if (ih08High && bcLow) {
        autoSentence = {
          severity: 'interpretive',
          message: `Containment was fast (${displayName('IH-08')} score ${ih08} ≥ ${IH08_HIGH_THRESHOLD}) but Business Continuity is low (${DIMENSION_NAMES.BC} score ${bcAggregate.score.toFixed(2)} < ${BC_LOW_THRESHOLD}). In OT, rapid containment can itself cause operational disruption: the incident was stopped quickly, but the containment action appears to have been operationally costly.`,
        };
      }
    }

    return { rule: 'B', pair: [...pair], displaySideBySide: true, autoSentence };
  });
}

// ---------------------------------------------------------------------------
// Rule C — architecture advisories
// ---------------------------------------------------------------------------

// Architecture state classification. Healthy → never advisory. Weak → variant.
const ARCH_HEALTHY_STATES = new Set([L0_STATE.PRESENT, L0_STATE.REQUIREMENT_SATISFIED]);

// Weak-state → advisory variant (when related result is "poor").
const ARCH_WEAK_VARIANT = {
  [L0_STATE.MISSING]:                         'strong',   // boundary missing
  [L0_STATE.UNCONTROLLED_MULTI_HOMING_FOUND]: 'bypass',   // segmentation bypass
  [L0_STATE.INCOMPLETE_OUTDATED]:             'softer',
  [L0_STATE.INCOMPLETE_OUTDATED_EVIDENCE]:    'softer',
  [L0_STATE.NOT_VERIFIABLE]:                  'caution',
};

const VARIANT_SEVERITY = {
  strong:    'strong',
  bypass:    'strong',
  softer:    'softer',
  caution:   'caution',
  readiness: 'readiness',
};

/**
 * Classify a related Layer 1 outcome for Rule C.
 * Returns: 'good' | 'poor' | 'not_measurable' | 'non_event' | 'unset'
 *
 * capability_absent (score 0) → 'poor' (substantive poor finding, §3.2).
 * non_event (no qualifying event/disruption) → silent, no advisory.
 * not_measurable → fires the readiness advisory (Table 3 last row).
 */
function classifyRelated({ state, score }) {
  if (state === STATE.CAPABILITY_ABSENT) return 'poor';
  if (state === STATE.NOT_MEASURABLE) return 'not_measurable';
  if (state === STATE.NO_QUALIFYING_EVENT || state === STATE.NO_QUALIFYING_DISRUPTION) return 'non_event';
  if (state === STATE.MEASURED) {
    if (score === null) return 'unset';        // measured-but-invalid-input edge
    return score >= 3 ? 'good' : 'poor';        // 3–4 good; 0,1,2 poor
  }
  return 'unset';
}

function archStateLabel(archItemId, state) {
  return LAYER0_ITEMS[archItemId]?.stateMap?.[state]?.label ?? state;
}

function buildArchitectureMessage(variant, archItemId, relatedId, relatedClass, archState, relatedScore) {
  const archName = LAYER0_ITEMS[archItemId].name;
  const relatedName = INDICATORS[relatedId].name;

  if (relatedClass === 'not_measurable') {
    return `${archName} is in a weak state (${archStateLabel(archItemId, archState)}) and ${relatedName} is not measurable. Establishing the architecture foundation and the evidence needed to measure ${relatedName} are both measurement-readiness actions — address them together.`;
  }

  // relatedClass === 'poor'
  const scoreText = `score ${relatedScore}`;
  switch (variant) {
    case 'strong':
      return `Controlled IT/OT boundary separation is missing while ${relatedName} is poor (${scoreText}). A missing boundary control can directly enable the conditions behind this outcome — these may be related; review them together.`;
    case 'bypass':
      return `Uncontrolled multi-homed devices were found while ${relatedName} is poor (${scoreText}). A segmentation bypass of this kind can be directly implicated in this outcome — these may be related; review them together.`;
    case 'softer':
      return `${archName} is incomplete or outdated while ${relatedName} is poor (${scoreText}). Review this architecture weakness when interpreting the outcome — they may be related.`;
    case 'caution':
      return `${archName} could not be verified while ${relatedName} is poor (${scoreText}). Treat the architecture foundation as unconfirmed and interpret the outcome with caution — they may be related.`;
    default:
      return `${archName} weakness coincides with a poor ${relatedName} outcome — they may be related.`;
  }
}

/**
 * generateArchitectureAdvisories(l1, layer0Result) → Advisory[]  (6 pairings)
 *
 * Advisory shape (cross-layer interpretive identity — distinct from a Stage 2
 * Layer 0 action flag):
 * {
 *   rule: 'C',
 *   kind: 'cross_layer_interpretive',   // NOT a Layer 0 action flag
 *   crossLayer: true,
 *   archItemId, archState,
 *   relatedId, relatedState, relatedScore, relatedClass,
 *   displaySideBySide: true,            // architecture status is ALWAYS side-by-side
 *   advisory: null | { variant, severity, framing:'may_be_related', message },
 * }
 *
 * DISTINCTION FROM STAGE 2 (for 3b):
 *   A Stage 2 Layer 0 action flag says "boundary missing — fix it" (a Layer 0
 *   gap, single-layer, imperative). A Rule C advisory says "boundary missing
 *   AND containment poor — these may be related" (cross-layer, interpretive,
 *   non-imperative). They share an underlying Layer 0 state but answer different
 *   questions. The fields rule:'C', crossLayer:true, relatedId, and
 *   advisory.framing:'may_be_related' let 3b present them side-by-side WITHOUT
 *   merging or duplicating the Stage 2 action flag.
 *
 * Advisory fires ONLY when architecture is weak AND related result is 'poor'
 * (wording by arch state) or 'not_measurable' (uniform readiness wording).
 * Healthy arch, good related score (3–4), non-event, and unset → advisory: null
 * (side-by-side only). A good related score never gets a manufactured causal
 * note — the Layer 0 item already raises its own Stage 2 action flag.
 */
export function generateArchitectureAdvisories(l1, layer0Result) {
  const advisories = [];
  const items = layer0Result?.items ?? {};

  for (const archItemId of ARCHITECTURE_ITEM_IDS) {
    const archState = items[archItemId]?.state ?? null;
    const archHealthy = ARCH_HEALTHY_STATES.has(archState);
    const weakVariant = ARCH_WEAK_VARIANT[archState] ?? null;   // null if healthy/unset

    for (const relatedId of ARCHITECTURE_RELATED_OUTCOMES) {
      const related = l1[relatedId] ?? { state: null, score: null };
      const relatedClass = classifyRelated(related);

      let advisory = null;

      // Advisory only when architecture is in a weak state with a known variant.
      if (!archHealthy && weakVariant !== null) {
        if (relatedClass === 'poor') {
          advisory = {
            variant: weakVariant,
            severity: VARIANT_SEVERITY[weakVariant],
            framing: 'may_be_related',
            message: buildArchitectureMessage(weakVariant, archItemId, relatedId, 'poor', archState, related.score),
          };
        } else if (relatedClass === 'not_measurable') {
          advisory = {
            variant: 'readiness',
            severity: VARIANT_SEVERITY.readiness,
            framing: 'may_be_related',
            message: buildArchitectureMessage('readiness', archItemId, relatedId, 'not_measurable', archState, related.score),
          };
        }
        // 'good' / 'non_event' / 'unset' → advisory stays null (side-by-side only)
      }

      advisories.push({
        rule: 'C',
        kind: 'cross_layer_interpretive',
        crossLayer: true,
        archItemId,
        archState,
        relatedId,
        relatedState: related.state,
        relatedScore: related.score,
        relatedClass,
        displaySideBySide: true,
        advisory,
      });
    }
  }

  return advisories;
}

// ---------------------------------------------------------------------------
// Rule D — BC plan state → BC-08/BC-09 hint (hint only, never auto-fill)
// ---------------------------------------------------------------------------

const BC_PLAN_HINT_TARGETS = [
  { targetIndicatorId: 'BC-08', objective: 'RTO' },
  { targetIndicatorId: 'BC-09', objective: 'RPO' },
];

function buildBCPlanHint(planState, targetIndicatorId, objective) {
  switch (planState) {
    case L0_STATE.MISSING:
      return {
        severity: 'strong',
        message: `BC plan is missing. If no separate ${objective} evidence exists, the assessor may select "No ${objective} defined" for ${displayName(targetIndicatorId)} — but this is a hint only; confirm explicitly, because a missing plan does not by itself prove a missing objective.`,
      };
    case L0_STATE.INCOMPLETE_OUTDATED:
      return {
        severity: 'softer',
        message: `BC plan is incomplete or outdated. Verify whether the relevant ${objective} is defined and current before scoring ${displayName(targetIndicatorId)}.`,
      };
    case L0_STATE.NOT_VERIFIABLE:
      return {
        severity: 'evidence',
        message: `BC plan status could not be verified. Confirm ${objective} status from available evidence before scoring ${displayName(targetIndicatorId)}.`,
      };
    default:
      // Present, unset, or any other state → no hint
      return null;
  }
}

/**
 * generateBCPlanHints(layer0Result) → Hint[]  (one per BC-08, BC-09)
 *
 * Hint shape: { rule:'D', targetIndicatorId, planState, hint: null | {severity, message} }
 *
 * HINT ONLY. This function never reads or sets BC-08/BC-09 state, and the hint
 * object contains no indicator-state field — it cannot auto-fill or auto-select.
 * The assessor always explicitly selects the BC-08/BC-09 state (Measured /
 * No qualifying event / Not measurable / No RTO|RPO defined). BC-04 has NO Rule D
 * wiring (its threshold check is internal to BC-04, Stage 1).
 */
export function generateBCPlanHints(layer0Result) {
  const planState = layer0Result?.items?.['L0-bc-plan-doc']?.state ?? null;
  return BC_PLAN_HINT_TARGETS.map(({ targetIndicatorId, objective }) => ({
    rule: 'D',
    targetIndicatorId,
    planState,
    hint: buildBCPlanHint(planState, targetIndicatorId, objective),
  }));
}

// ---------------------------------------------------------------------------
// Top-level entry point
// ---------------------------------------------------------------------------

/**
 * computeCrossIndicator(assessment, layer1Results, layer0Result) → {
 *   ihDependencyNotes, interpretivePairs, architectureAdvisories, bcPlanHints
 * }
 *
 * Pure. Reads the outputs of computeAssessment and computeLayer0 (plus the
 * assessment record for Layer 1 states). Mutates nothing; alters no score.
 */
export function computeCrossIndicator(assessment, layer1Results, layer0Result) {
  const l1 = buildLayer1View(assessment, layer1Results);
  return {
    ihDependencyNotes:      generateIHDependencyNotes(l1),
    interpretivePairs:      generateInterpretivePairs(l1, layer1Results?.bc),
    architectureAdvisories: generateArchitectureAdvisories(l1, layer0Result),
    bcPlanHints:            generateBCPlanHints(layer0Result),
  };
}
