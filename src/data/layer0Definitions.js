/**
 * Layer 0 item definitions — 9 items, per-item state lists, severity maps, bands for RM-04/05.
 *
 * Sub-classification (§3.3):
 *   0A — Prerequisites (6): foundations that must exist for assessment to be meaningful.
 *   0B — Process evidence (3): evidence that a supporting process is being performed.
 *
 * Layer 0 items are NEVER aggregated into any Layer 1 score.
 * Layer 0 engine (layer0.js) and Layer 1 engine (scoring.js) share no function calls.
 *
 * Per-item state vocabularies (§3.3.1):
 *   Standard 0A:   Present / Missing / Incomplete or outdated / Not verifiable
 *   Multi-homed:   Requirement satisfied / Uncontrolled multi-homing found /
 *                  Incomplete or outdated evidence / Not verifiable
 *   BC plan tested: Qualifying test performed / No qualifying test /
 *                  Incomplete or outdated / Not verifiable
 *   RM-04/05:      Measured / Not measurable / Process absent / context-only non-event
 *     The context-only non-event state is distinct from "not measurable" (evidence failure).
 *     "No qualifying vulnerability/remediation" is a neutral non-event — not flagged (§6,
 *     "missing evidence is never a performance judgement").
 *
 * Tags (§6.2):
 *   '0A prerequisite', '0B process evidence', 'Architecture', 'Evidence validation'
 *   Tag never controls ordering; severity is the sole primary ordering principle.
 *
 * Not verifiable tag/displayGroup override (§9):
 *   Any item in 'not_verifiable' state → tag: 'Evidence validation', displayGroup: 5.
 *   Derived by the same two functions (deriveTag, deriveDisplayGroup) to prevent conflict.
 *
 * RM-04/05 bands from Scoring_Design.pdf (contiguous intervals, same structure as Layer 1):
 *   RM-04 (%, higher_is_better): [90,+∞)→4 · [70,90)→3 · [50,70)→2 · [1,50)→1 · [0,1)→0
 *   RM-05 (days, lower_is_better): (−∞,30]→4 · (30,90]→3 · (90,180]→2 · (180,365]→1 · (365,+∞)→0
 */

// ---------------------------------------------------------------------------
// State constants
// ---------------------------------------------------------------------------
export const L0_STATE = {
  // Standard 0A vocabulary
  PRESENT:                         'present',
  MISSING:                         'missing',
  INCOMPLETE_OUTDATED:             'incomplete_outdated',
  NOT_VERIFIABLE:                  'not_verifiable',
  // Multi-homed devices (item-specific)
  REQUIREMENT_SATISFIED:           'requirement_satisfied',
  UNCONTROLLED_MULTI_HOMING_FOUND: 'uncontrolled_multi_homing_found',
  INCOMPLETE_OUTDATED_EVIDENCE:    'incomplete_outdated_evidence',
  // BC plan tested (item-specific)
  QUALIFYING_TEST_PERFORMED:       'qualifying_test_performed',
  NO_QUALIFYING_TEST:              'no_qualifying_test',
  // RM-04/05 quantitative states
  MEASURED:                        'measured',
  NOT_MEASURABLE:                  'not_measurable',
  PROCESS_ABSENT:                  'process_absent',
  // RM-04/05 context-only non-events (NOT flagged — neutral non-events)
  NO_QUALIFYING_VULNERABILITY:     'no_qualifying_vulnerability',
  NO_REMEDIATED_VULNERABILITIES:   'no_remediated_vulnerabilities',
};

// Context-only non-event states — produce no flag, must not be treated as evidence failures
export const L0_CONTEXT_ONLY_STATES = new Set([
  L0_STATE.NO_QUALIFYING_VULNERABILITY,
  L0_STATE.NO_REMEDIATED_VULNERABILITIES,
]);

// ---------------------------------------------------------------------------
// Tag constants
// ---------------------------------------------------------------------------
export const L0_TAG = {
  PREREQUISITE:       '0A prerequisite',
  PROCESS_EVIDENCE:   '0B process evidence',
  ARCHITECTURE:       'Architecture',
  EVIDENCE_VALIDATION:'Evidence validation',
};

// ---------------------------------------------------------------------------
// Severity constants
// ---------------------------------------------------------------------------
export const L0_SEVERITY = {
  CRITICAL:    'critical',
  HIGH:        'high',
  MEDIUM_NOTE: 'medium_note',
  MONITOR:     'monitor',   // not emitted in action flags; only shown in reference view
};

// ---------------------------------------------------------------------------
// Item definitions
// ---------------------------------------------------------------------------
export const LAYER0_ITEMS = {

  // ── Layer 0A — Prerequisites ─────────────────────────────────────────────

  'L0-asset-inventory': {
    id:             'L0-asset-inventory',
    name:           'Asset inventory maintained',
    subclass:       '0A',
    inputType:      'qualitative',
    baseTag:        L0_TAG.PREREQUISITE,
    baseDisplayGroup: 2,   // core scope-definition
    // The ONLY item with a contextual note (§6.2 no-auto-rank rule).
    // This is a per-item note, not a ranking rule.
    contextualNote: 'This foundation underpins most other Layer 0 items; consider addressing first.',
    allowedStates: [
      L0_STATE.PRESENT,
      L0_STATE.MISSING,
      L0_STATE.INCOMPLETE_OUTDATED,
      L0_STATE.NOT_VERIFIABLE,
    ],
    bands: null,
    stateMap: {
      [L0_STATE.PRESENT]:             { severity: null,               label: 'Present',               message: null },
      [L0_STATE.MISSING]:             { severity: L0_SEVERITY.CRITICAL, label: 'Missing',             message: 'Asset inventory is not maintained.' },
      [L0_STATE.INCOMPLETE_OUTDATED]: { severity: L0_SEVERITY.HIGH,    label: 'Incomplete or outdated', message: 'Asset inventory is incomplete or outdated.' },
      [L0_STATE.NOT_VERIFIABLE]:      { severity: L0_SEVERITY.HIGH,    label: 'Not verifiable',       message: 'Asset inventory status could not be verified from available evidence.' },
    },
  },

  'L0-risk-assessment': {
    id:             'L0-risk-assessment',
    name:           'Risk assessment per zone',
    subclass:       '0A',
    inputType:      'qualitative',
    baseTag:        L0_TAG.PREREQUISITE,
    baseDisplayGroup: 2,
    contextualNote: null,
    allowedStates: [
      L0_STATE.PRESENT,
      L0_STATE.MISSING,
      L0_STATE.INCOMPLETE_OUTDATED,
      L0_STATE.NOT_VERIFIABLE,
    ],
    bands: null,
    stateMap: {
      [L0_STATE.PRESENT]:             { severity: null,               label: 'Present',               message: null },
      [L0_STATE.MISSING]:             { severity: L0_SEVERITY.CRITICAL, label: 'Missing',             message: 'Risk assessment per zone is not documented.' },
      [L0_STATE.INCOMPLETE_OUTDATED]: { severity: L0_SEVERITY.HIGH,    label: 'Incomplete or outdated', message: 'Risk assessment per zone is incomplete or outdated.' },
      [L0_STATE.NOT_VERIFIABLE]:      { severity: L0_SEVERITY.HIGH,    label: 'Not verifiable',       message: 'Risk assessment per zone status could not be verified.' },
    },
  },

  'L0-interdependency': {
    id:             'L0-interdependency',
    name:           'Asset interdependency documentation',
    subclass:       '0A',
    inputType:      'qualitative',
    baseTag:        L0_TAG.PREREQUISITE,
    baseDisplayGroup: 2,
    contextualNote: null,
    allowedStates: [
      L0_STATE.PRESENT,
      L0_STATE.MISSING,
      L0_STATE.INCOMPLETE_OUTDATED,
      L0_STATE.NOT_VERIFIABLE,
    ],
    bands: null,
    stateMap: {
      [L0_STATE.PRESENT]:             { severity: null,               label: 'Present',               message: null },
      [L0_STATE.MISSING]:             { severity: L0_SEVERITY.CRITICAL, label: 'Missing',             message: 'Asset interdependency documentation is missing.' },
      [L0_STATE.INCOMPLETE_OUTDATED]: { severity: L0_SEVERITY.HIGH,    label: 'Incomplete or outdated', message: 'Asset interdependency documentation is incomplete or outdated.' },
      [L0_STATE.NOT_VERIFIABLE]:      { severity: L0_SEVERITY.HIGH,    label: 'Not verifiable',       message: 'Asset interdependency documentation status could not be verified.' },
    },
  },

  'L0-it-ot-boundary': {
    id:             'L0-it-ot-boundary',
    name:           'Controlled IT/OT boundary separation',
    subclass:       '0A',
    inputType:      'qualitative',
    baseTag:        L0_TAG.ARCHITECTURE,   // architecture item
    baseDisplayGroup: 1,                   // architecture/safety group
    contextualNote: null,
    allowedStates: [
      L0_STATE.PRESENT,
      L0_STATE.MISSING,
      L0_STATE.INCOMPLETE_OUTDATED,
      L0_STATE.NOT_VERIFIABLE,
    ],
    bands: null,
    stateMap: {
      [L0_STATE.PRESENT]:             { severity: null,               label: 'Present',               message: null },
      [L0_STATE.MISSING]:             { severity: L0_SEVERITY.CRITICAL, label: 'Missing',             message: 'Controlled IT/OT boundary separation is not in place.' },
      [L0_STATE.INCOMPLETE_OUTDATED]: { severity: L0_SEVERITY.HIGH,    label: 'Incomplete or outdated', message: 'IT/OT boundary separation controls are incomplete or outdated.' },
      [L0_STATE.NOT_VERIFIABLE]:      { severity: L0_SEVERITY.HIGH,    label: 'Not verifiable',       message: 'IT/OT boundary separation status could not be verified.' },
    },
  },

  'L0-multi-homed': {
    id:             'L0-multi-homed',
    name:           'Zero uncontrolled multi-homed devices',
    subclass:       '0A',
    inputType:      'qualitative',
    baseTag:        L0_TAG.ARCHITECTURE,
    baseDisplayGroup: 1,
    contextualNote: null,
    allowedStates: [
      L0_STATE.REQUIREMENT_SATISFIED,
      L0_STATE.UNCONTROLLED_MULTI_HOMING_FOUND,
      L0_STATE.INCOMPLETE_OUTDATED_EVIDENCE,
      L0_STATE.NOT_VERIFIABLE,
    ],
    bands: null,
    stateMap: {
      [L0_STATE.REQUIREMENT_SATISFIED]:           { severity: null,               label: 'Requirement satisfied',         message: null },
      [L0_STATE.UNCONTROLLED_MULTI_HOMING_FOUND]: { severity: L0_SEVERITY.CRITICAL, label: 'Uncontrolled multi-homing found', message: 'Uncontrolled inter-zone multi-homed devices were identified.' },
      [L0_STATE.INCOMPLETE_OUTDATED_EVIDENCE]:    { severity: L0_SEVERITY.HIGH,    label: 'Incomplete or outdated evidence', message: 'Evidence for multi-homed device controls is incomplete or outdated.' },
      [L0_STATE.NOT_VERIFIABLE]:                  { severity: L0_SEVERITY.HIGH,    label: 'Not verifiable',               message: 'Multi-homed device controls could not be verified from available evidence.' },
    },
  },

  'L0-bc-plan-doc': {
    id:             'L0-bc-plan-doc',
    name:           'BC plan documented for critical processes',
    subclass:       '0A',
    inputType:      'qualitative',
    baseTag:        L0_TAG.PREREQUISITE,
    baseDisplayGroup: 3,   // continuity foundation
    contextualNote: null,
    allowedStates: [
      L0_STATE.PRESENT,
      L0_STATE.MISSING,
      L0_STATE.INCOMPLETE_OUTDATED,
      L0_STATE.NOT_VERIFIABLE,
    ],
    bands: null,
    stateMap: {
      [L0_STATE.PRESENT]:             { severity: null,               label: 'Present',               message: null },
      [L0_STATE.MISSING]:             { severity: L0_SEVERITY.CRITICAL, label: 'Missing',             message: 'BC plan for critical processes is not documented.' },
      [L0_STATE.INCOMPLETE_OUTDATED]: { severity: L0_SEVERITY.HIGH,    label: 'Incomplete or outdated', message: 'BC plan is incomplete or outdated.' },
      [L0_STATE.NOT_VERIFIABLE]:      { severity: L0_SEVERITY.HIGH,    label: 'Not verifiable',       message: 'BC plan status could not be verified from available evidence.' },
    },
  },

  // ── Layer 0B — Process evidence ──────────────────────────────────────────

  'RM-04': {
    id:             'RM-04',
    name:           'Vulnerability Remediation Rate',
    subclass:       '0B',
    inputType:      'ratio',
    numeratorLabel: 'Vulnerabilities remediated (or compensating controls applied)',
    denominatorLabel:'Total critical/high vulnerabilities identified in period',
    baseTag:        L0_TAG.PROCESS_EVIDENCE,
    baseDisplayGroup: 4,   // process evidence
    contextualNote: null,
    allowedStates: [
      L0_STATE.MEASURED,
      L0_STATE.NOT_MEASURABLE,
      L0_STATE.PROCESS_ABSENT,
      L0_STATE.NO_QUALIFYING_VULNERABILITY,   // neutral non-event: no vulns identified
    ],
    direction: 'higher_is_better',
    // Contiguous bands (%, higher_is_better): [90,+∞)→4 · [70,90)→3 · [50,70)→2 · [1,50)→1 · [0,1)→0
    bands: [
      { score: 4, gte: 90, lt: null },
      { score: 3, gte: 70, lt: 90   },
      { score: 2, gte: 50, lt: 70   },
      { score: 1, gte: 1,  lt: 50   },
    ],
    processSeverityMap: {
      4: null,
      3: L0_SEVERITY.MONITOR,
      2: L0_SEVERITY.MEDIUM_NOTE,
      1: L0_SEVERITY.HIGH,
      0: L0_SEVERITY.CRITICAL,
    },
    processMessages: {
      0: 'Vulnerability remediation rate: 0% — no vulnerabilities are being addressed.',
      1: 'Vulnerability remediation rate is very low (< 50%) — remediation programme is largely ineffective.',
      2: 'Vulnerability remediation rate is below target (50–69%) — moderate programme improvement warranted.',
      3: 'Vulnerability remediation rate is satisfactory (70–89%) — continue monitoring.',
    },
    // stateMap covers the three non-measured states only
    stateMap: {
      [L0_STATE.NOT_MEASURABLE]: {
        severity: L0_SEVERITY.HIGH,
        label: 'Not measurable',
        message: 'Vulnerability remediation data is not available — evidence gap.',
      },
      [L0_STATE.PROCESS_ABSENT]: {
        severity: L0_SEVERITY.CRITICAL,
        label: 'Process absent',
        message: 'No vulnerability management programme or remediation tracking exists.',
        processGap: true,
      },
      [L0_STATE.NO_QUALIFYING_VULNERABILITY]: {
        severity: null,   // context-only: neutral non-event, not flagged
        label: 'No qualifying vulnerability',
        message: 'No qualifying vulnerabilities were identified this period.',
      },
    },
  },

  'RM-05': {
    id:             'RM-05',
    name:           'Mean Time to Remediate',
    subclass:       '0B',
    inputType:      'single_value',
    valuePlaceholder: 'e.g. 45',
    valueUnit:      'days',
    baseTag:        L0_TAG.PROCESS_EVIDENCE,
    baseDisplayGroup: 4,
    contextualNote: null,
    allowedStates: [
      L0_STATE.MEASURED,
      L0_STATE.NOT_MEASURABLE,
      L0_STATE.PROCESS_ABSENT,
      L0_STATE.NO_REMEDIATED_VULNERABILITIES,   // neutral non-event: nothing remediated this period
    ],
    direction: 'lower_is_better',
    // Contiguous bands (days, lower_is_better): (−∞,30]→4 · (30,90]→3 · (90,180]→2 · (180,365]→1 · (365,+∞)→0
    bands: [
      { score: 4, gt: null, lte: 30  },
      { score: 3, gt: 30,   lte: 90  },
      { score: 2, gt: 90,   lte: 180 },
      { score: 1, gt: 180,  lte: 365 },
    ],
    processSeverityMap: {
      4: null,
      3: L0_SEVERITY.MONITOR,
      2: L0_SEVERITY.MEDIUM_NOTE,
      1: L0_SEVERITY.HIGH,
      0: L0_SEVERITY.CRITICAL,
    },
    processMessages: {
      0: 'Mean time to remediate exceeds 1 year — vulnerabilities remain exposed for an unacceptably long period.',
      1: 'Mean time to remediate is very slow (181–365 days) — vulnerabilities remain exposed for an extended period.',
      2: 'Mean time to remediate is below target (91–180 days) — moderate improvement warranted.',
      3: 'Mean time to remediate is satisfactory (31–90 days) — continue monitoring.',
    },
    stateMap: {
      [L0_STATE.NOT_MEASURABLE]: {
        severity: L0_SEVERITY.HIGH,
        label: 'Not measurable',
        message: 'Remediation time data is not available — evidence gap.',
      },
      [L0_STATE.PROCESS_ABSENT]: {
        severity: L0_SEVERITY.CRITICAL,
        label: 'Process absent',
        message: 'No remediation tracking or timestamp records exist.',
        processGap: true,
      },
      [L0_STATE.NO_REMEDIATED_VULNERABILITIES]: {
        severity: null,   // context-only: neutral non-event, not flagged
        label: 'No remediated vulnerabilities',
        // Deliberately neutral; does not imply "all clear" — must be read alongside RM-04
        message: 'No vulnerabilities were remediated this period — interpret alongside RM-04.',
      },
    },
  },

  'L0-bc-plan-tested': {
    id:             'L0-bc-plan-tested',
    name:           'BC plan tested within defined period',
    subclass:       '0B',
    inputType:      'qualitative',
    baseTag:        L0_TAG.PROCESS_EVIDENCE,
    baseDisplayGroup: 4,
    contextualNote: null,
    allowedStates: [
      L0_STATE.QUALIFYING_TEST_PERFORMED,
      L0_STATE.NO_QUALIFYING_TEST,
      L0_STATE.INCOMPLETE_OUTDATED,
      L0_STATE.NOT_VERIFIABLE,
    ],
    bands: null,
    stateMap: {
      [L0_STATE.QUALIFYING_TEST_PERFORMED]: { severity: null,               label: 'Qualifying test performed', message: null },
      // Skipped action (§6): reads as a gap, not a neutral note
      [L0_STATE.NO_QUALIFYING_TEST]:        { severity: L0_SEVERITY.HIGH,    label: 'No qualifying test',       message: 'No BC plan test was performed during the assessment period — a scheduled action was not completed.', isSkippedAction: true },
      [L0_STATE.INCOMPLETE_OUTDATED]:       { severity: L0_SEVERITY.HIGH,    label: 'Incomplete or outdated',   message: 'BC plan testing evidence is incomplete or outdated.' },
      [L0_STATE.NOT_VERIFIABLE]:            { severity: L0_SEVERITY.HIGH,    label: 'Not verifiable',           message: 'BC plan testing status could not be verified from available evidence.' },
    },
  },
};

// Canonical item order — used for stable tertiary sort within same severity+displayGroup
export const LAYER0_0A_IDS = [
  'L0-asset-inventory',
  'L0-risk-assessment',
  'L0-interdependency',
  'L0-it-ot-boundary',
  'L0-multi-homed',
  'L0-bc-plan-doc',
];

export const LAYER0_0B_IDS = [
  'RM-04',
  'RM-05',
  'L0-bc-plan-tested',
];

export const LAYER0_ALL_IDS = [...LAYER0_0A_IDS, ...LAYER0_0B_IDS];

// Human-readable state labels (for UI, outside engine)
export const L0_STATE_LABELS = Object.fromEntries(
  LAYER0_ALL_IDS.flatMap(id =>
    LAYER0_ITEMS[id].allowedStates.map(s => [s, LAYER0_ITEMS[id].stateMap[s]?.label ?? s])
  )
);
