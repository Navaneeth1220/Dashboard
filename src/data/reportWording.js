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
    // Not "a weak boundary control": the sentence names a scored result, and
    // judgement words there fail validator check 16.
    mechanism: outcome => `boundary separation can affect ${outcome}`,
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
// Targets (docs/ai-report-spec.md, Step 7)
// ---------------------------------------------------------------------------

/** The capability a capability-absent indicator is missing. */
export const CAPABILITY_BY_INDICATOR = {
  'IH-06': 'detection',
  'IH-07': 'response',
  'IH-08': 'response',
};

const BOUND = { max: ' or less', min: ' or more', exact: '' };
const atValue = target => `at ${target.value}${BOUND[target.bound]}`;
const THEN_BANDS = 'the scoring bands apply once it exists.';

/**
 * target: { score, level, value, bound: 'max' | 'min' | 'exact' }, from the
 * engine's next band (lower is better → max; a maximum of 0 → exact).
 */
export const TARGET_WORDING = {
  /** Starts the target sentence of a scored fact; the validator strips from here (check 8). */
  nextLevelPrefix: 'Next level: ',
  nextLevel: target => `${TARGET_WORDING.nextLevelPrefix}score ${target.score} ${atValue(target)}.`,
  leadIn:    'Each target is the value an indicator needs for its next score level, taken from the scoring bands.',
  /** "<name>, now <value> (score <current>), reaches score M (<level>) at X or less."; current: "3, Good". */
  reaches:   (name, value, current, target) =>
    `${name}, now ${value} (score ${current}), reaches score ${target.score} (${target.level}) ${atValue(target)}.`,
  atHighest: (names, level) => `Already at the highest level (score 4, ${level}): ${names}.`,
  programmeGap: {
    [STATE.NO_RPO_DEFINED]: name =>
      `${name} has no numeric target yet: no recovery point objective has been established. Define the objective first; ${THEN_BANDS}`,
    [STATE.NO_RTO_DEFINED]: name =>
      `${name} has no numeric target yet: no recovery time objective has been established. Define the objective first; ${THEN_BANDS}`,
    [STATE.NO_THRESHOLDS_DEFINED]: name =>
      `${name} has no numeric target yet: no operational thresholds have been established. Define the thresholds first; ${THEN_BANDS}`,
  },
  capabilityAbsent: {
    detection: name => `${name} has no numeric target: no detection capability exists yet. Establish it first; ${THEN_BANDS}`,
    response:  name => `${name} has no numeric target: no response capability exists yet. Establish it first; ${THEN_BANDS}`,
  },
  noScore:   (names, count) => (count === 1
    ? `${names} has no score, so it has no target.`
    : `${names} have no score, so they have no target.`),
  noneBelowFour: 'No measured indicator is below score 4.',
  nothingScored: 'No indicator has a score, so there are no targets.',
};

// ---------------------------------------------------------------------------
// Recommended actions (docs/ai-report-spec.md, Step 8)
// ---------------------------------------------------------------------------

/**
 * The frame around the catalogue text; the entries' own text comes verbatim
 * from src/data/actionCatalogue.js. `nis2Label` takes NIS2_ARTICLE.
 */
export const ACTION_WORDING = {
  leadIn:
    "Each action comes from the dashboard's action catalogue and is matched to a result in this assessment. " +
    'Actions are grouped by area in catalogue order; this is not an order of action.',
  steps:       'Steps: ',
  why:         'Why it matters: ',
  who:         'Who: ',
  nis2Label:   article => `NIS2 ${article}: `,
  standard:    'Standard: ',
  notAssessed: 'Indicators and controls that are not yet assessed trigger no action, so their absence here says nothing about them.',
  noMatch:     'No action from the catalogue matches this assessment.',
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

// ---------------------------------------------------------------------------
// Narrative panel (docs/ai-report-spec.md, Step 5)
// ---------------------------------------------------------------------------

/** The title of each part of the report, in reading order. */
export const SECTION_TITLES = {
  headline:               'Headline',
  overview:               'Overview',
  measuredPerformance:    'Measured performance',
  gapsAndMissingEvidence: 'Gaps and missing evidence',
  foundationsAndFlags:    'Foundations and flags',
  priorities:             'Priorities',
  targets:                'Targets',
  recommendedActions:     'Recommended actions',
};

/** Fixed wording of the narrative panel and of its Copy footer. */
export const NARRATIVE_WORDING = {
  title:       'Assessment report',
  generate:    'Generate report',
  cancel:      'Cancel',
  copy:        'Copy',
  copied:      'Copied to the clipboard.',
  copyFailed:  'Copying failed; select the text and copy it by hand.',
  generating:  'Generating…',
  attempt:     (attempt, maxAttempts) => `Generating… attempt ${attempt} of ${maxAttempts}`,
  label: {
    ai:        'AI-drafted — review before use',
    generated: 'Generated from the assessment',
    edited:    'Edited',
  },
  basedOnFacts: 'Based on facts',
  failed:       'The draft did not pass validation',
  draft:        'Draft',   // title for an error that belongs to no part
  stale:        'The assessment has changed since this draft was generated. Generate again to update it.',
  unavailable: {
    notRunning:   'Ollama is not running at localhost:11434.',
    startWith:    'Start it with:',
    startCommand: 'ollama serve',
    pullWith:     'Download the model with:',
    pullCommand:  model => `ollama pull ${model}`,
    cancelled:    'Generation cancelled.',
  },
  footer: {
    ai:        (model, titles) => `AI-drafted with ${model}, review before use: ${titles.join(', ')}.`,
    generated: titles => `Generated from the assessment: ${titles.join(', ')}.`,
    edited:    titles => `Edited after generation: ${titles.join(', ')}.`,
  },
  // PDF export (docs/ai-report-spec.md, Step 6)
  downloadPdf:     'Download PDF',
  preparingPdf:    'Preparing PDF…',
  pdfFailed:       'Creating the PDF failed.',
  regenerateFirst: 'Regenerate the report first',
  pdf: {
    client:           'Client',
    assessmentDate:   'Assessment date',
    generated:        'Generated',
    notRecorded:      'not recorded',
    scoresTitle:      'Scores at a glance',
    dimensionColumn:  'Dimension',
    scoreColumn:      'Score (0–4, 4 = best)',
    noScore:          'no score (incomplete)',
    model:            model => `Model: ${model}`,
    page:             (page, pages) => `Page ${page} of ${pages}`,
    filenameFallback: 'assessment',
  },
};
