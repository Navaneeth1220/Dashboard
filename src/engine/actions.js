/**
 * Recommended-action matching — pure functions only (docs/ai-report-spec.md,
 * Step 8).
 *
 * Decides which entries of the action catalogue (src/data/actionCatalogue.js)
 * apply to an assessment. It reads input states and engine output only and
 * recomputes nothing: the low-score rule reads the engine's score, so
 * Operational Threshold Violation Rate (direction-inverted bands, already
 * 4 = best) is never reversed again, and the process-evidence entries follow
 * the engine's own action flags, so the report never disagrees with the
 * dashboard's action panel.
 *
 * No entry for unset states, invalid values or states, non-events, scores 3
 * and 4, or satisfactory Layer 0 states: none of them has a condition.
 */

import { computeAssessment } from './scoring.js';
import { computeLayer0 } from './layer0.js';
import { STATE } from '../data/indicatorDefinitions.js';
import { L0_STATE } from '../data/layer0Definitions.js';
import { ACTION_CATALOGUE, LOW_SCORE_MAX } from '../data/actionCatalogue.js';

function holds(condition, id, { assessment, results, layer0 }) {
  switch (condition.kind) {
    case 'indicatorState':
      return condition.states.includes(assessment?.indicators?.[id]?.state);
    case 'lowScore': {
      const r = results.indicators[id];
      return assessment?.indicators?.[id]?.state === STATE.MEASURED
        && r.score !== null && !r.programmeGap && r.score <= LOW_SCORE_MAX;
    }
    case 'layer0State':
      return condition.states.includes(layer0.items[id].state);
    case 'processFlag':
      return layer0.items[id].state === L0_STATE.MEASURED && layer0.actionFlags.some(f => f.itemId === id);
    default:
      throw new Error(`Unknown action condition: ${condition.kind}`);
  }
}

/**
 * matchActions(assessment, results, layer0) → [{ id, triggers }]
 *
 * results: computeAssessment output; layer0: computeLayer0 output.
 * Catalogue order; each entry at most once (a shared entry lists every
 * indicator or item that triggered it, in the order the entry names them).
 */
export function matchActions(assessment, results, layer0) {
  const ctx = { assessment, results, layer0 };
  return ACTION_CATALOGUE.flatMap(entry => {
    const listed = [...new Set(entry.trigger.when.flatMap(c => c.ids))];
    const triggers = listed.filter(id => entry.trigger.when.some(c => c.ids.includes(id) && holds(c, id, ctx)));
    return triggers.length > 0 ? [{ id: entry.id, triggers }] : [];
  });
}

/** matchActions on a raw assessment record: runs the engines first. */
export function matchAssessmentActions(assessment) {
  return matchActions(assessment, computeAssessment(assessment), computeLayer0(assessment));
}
