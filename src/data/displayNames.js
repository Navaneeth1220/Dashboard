/**
 * Centralised internal-ID → full descriptive name map (display layer only).
 *
 * Internal IDs (IH-06, BC-08, RM-04, L0-bc-plan-doc, …) stay unchanged in the
 * data model, engines, and tests. This is the single source the UI uses so no
 * ID code ever appears on screen — same pattern as the state-label maps.
 */

import { INDICATORS } from './indicatorDefinitions.js';
import { LAYER0_ITEMS } from './layer0Definitions.js';

export function displayName(id) {
  if (id === 'BC') return 'Business Continuity score';
  return INDICATORS[id]?.name ?? LAYER0_ITEMS[id]?.name ?? id;
}

/** Format a score for display: always exactly two decimals (3.00, 2.50, 2.33).
 *  Display layer only — engines keep full precision. */
export function formatScore(score) {
  if (score === null || score === undefined || Number.isNaN(score)) return null;
  return Number(score).toFixed(2);
}
