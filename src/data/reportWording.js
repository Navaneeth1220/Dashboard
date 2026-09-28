/**
 * Shared wording for the dashboard and the generated report sections
 * (docs/ai-report-spec.md, Step 3b). Phrases used in both places live here,
 * so the report and the dashboard cannot drift apart.
 *
 * Level and state labels stay in their own modules (SCORE_LEVEL_LABELS,
 * STATE_PRIORITY_LABELS, L0_SEVERITY_LABELS); this module holds the phrases
 * built around them.
 */

import { STATE } from './indicatorDefinitions.js';
import { L0_STATE } from './layer0Definitions.js';

// ---------------------------------------------------------------------------
// Shared with the dashboard (PriorityView)
// ---------------------------------------------------------------------------

/** After a non-event detail: the indicator had nothing to assess. */
export const NOTHING_TO_ASSESS = 'Nothing occurred to assess this indicator.';

/** An indicator or Layer 0 item with no state recorded. */
export const NOT_YET_ASSESSED = 'not yet assessed';

// ---------------------------------------------------------------------------
// Programme gaps: the objective or capability does not exist yet
// ---------------------------------------------------------------------------

export const PROGRAMME_GAP_WORDING = {
  [STATE.CAPABILITY_ABSENT]:     name => `No identifiable pathway exists for ${name}`,
  [STATE.NO_THRESHOLDS_DEFINED]: name => `No operational thresholds have been established for ${name}`,
  [STATE.NO_RTO_DEFINED]:        name => `No recovery time objective has been established for ${name}`,
  [STATE.NO_RPO_DEFINED]:        name => `No recovery point objective has been established for ${name}`,
};

// ---------------------------------------------------------------------------
// Architecture advisories (Rule C), rendered from structured data
// ---------------------------------------------------------------------------

/**
 * Per architecture item and weak state: the weakness as a noun phrase, the
 * matching measurement-readiness action, and why the two may be related to
 * an outcome. "may be related" is the only relation the report claims.
 */
export const ARCHITECTURE_WORDING = {
  'L0-it-ot-boundary': {
    weakness: {
      [L0_STATE.MISSING]:             'the missing IT/OT boundary separation',
      [L0_STATE.INCOMPLETE_OUTDATED]: 'the incomplete or outdated IT/OT boundary separation controls',
      [L0_STATE.NOT_VERIFIABLE]:      'the unverified IT/OT boundary separation',
    },
    readinessAction: {
      [L0_STATE.MISSING]:             'Establishing controlled IT/OT boundary separation',
      [L0_STATE.INCOMPLETE_OUTDATED]: 'Bringing the IT/OT boundary separation controls up to date',
      [L0_STATE.NOT_VERIFIABLE]:      'Verifying the IT/OT boundary separation',
    },
    mechanism: outcome => `a weak boundary control can affect ${outcome}`,
  },
  'L0-multi-homed': {
    weakness: {
      [L0_STATE.UNCONTROLLED_MULTI_HOMING_FOUND]: 'the uncontrolled multi-homed devices',
      [L0_STATE.INCOMPLETE_OUTDATED_EVIDENCE]:    'the incomplete or outdated evidence for multi-homed device controls',
      [L0_STATE.NOT_VERIFIABLE]:                  'the unverified multi-homed device controls',
    },
    readinessAction: {
      [L0_STATE.UNCONTROLLED_MULTI_HOMING_FOUND]: 'Removing the multi-homed devices',
      [L0_STATE.INCOMPLETE_OUTDATED_EVIDENCE]:    'Bringing the evidence for multi-homed device controls up to date',
      [L0_STATE.NOT_VERIFIABLE]:                  'Verifying the multi-homed device controls',
    },
    mechanism: outcome => `a segmentation bypass can affect ${outcome}`,
  },
};

/** The outcome each related indicator stands for, in advisory sentences. */
export const OUTCOME_WORDING = {
  'IH-08': 'containment',
  'BC-01': 'network operability',
  'BC-02': 'zone availability',
};

// ---------------------------------------------------------------------------
// Lead-ins of the generated sections
// ---------------------------------------------------------------------------

export const LEAD_IN = {
  inPlace:    'In place: ',
  flags:      'The following issues were flagged (listed by severity; this is not an order of action).',
  process:    'Process evidence is reported without a score.',
  advisories: 'Read together (advisory only; no scores change): ',
  priorities: 'Ranked by score, where a lower score is more urgent: ',
};
