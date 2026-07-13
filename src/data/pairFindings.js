/**
 * Interpretive-pair relative-comparison findings (Change 1) — DISPLAY LAYER ONLY.
 *
 * Reads the OUTPUTS of the existing engines (computeAssessment results,
 * computeLayer0 result, plus the raw assessment for un-derived values). Does NOT
 * modify any engine. Produces a finding / fallback / hidden verdict for the three
 * convertible interpretive pairs. The fourth pair (Mean Time to Contain ↔ BC)
 * keeps its engine-driven auto-sentence and is NOT handled here.
 *
 * Findings text is centralised (keyed by pair + the id of the higher member),
 * same single-source pattern as the state-label maps.
 */

import { INDICATORS } from './indicatorDefinitions.js';
import { LAYER0_ITEMS } from './layer0Definitions.js';

// Percentage-point gap above which a %-pair finding fires (10.0 → not fired, 10.1 → fired)
export const PERCENT_GAP_THRESHOLD = 10;

export const PAIR_FINDINGS_TEXT = {
  // RTO Achievement (BC-08) ↔ RPO Achievement (BC-09)
  BC08_BC09: {
    'BC-08': 'Recovery is fast but data is staler than recovery speed suggests — points to a backup-currency lag, not a speed problem.',
    'BC-09': 'Data is current but recovery is slow — a recovery-speed problem, not a data-currency one.',
  },
  // Network Operability (BC-01) ↔ Zone Availability (BC-02)
  BC01_BC02: {
    'BC-01': 'Communication held up better than the process did — the network stayed usable but zone function did not.',
    'BC-02': 'Local operation continued while network monitoring or control degraded.',
  },
  // Vulnerability Remediation Rate (RM-04) ↔ Mean Time to Remediate (RM-05)
  RM04_RM05: {
    'RM-04': 'Most vulnerabilities get treated, but slowly — broad coverage, long exposure window.',
    'RM-05': 'The treated ones are closed fast, but only a subset gets treated — quick but narrow.',
  },
};

// ── Member readers (from engine outputs) ─────────────────────────────────────

function l1Member(id, results, assessment) {
  const r = results?.indicators?.[id];
  const score = r?.score ?? null;
  let pct = null;
  if (score !== null) {
    if (INDICATORS[id].inputType === 'ratio') {
      pct = r.derivedPct ?? null;
    } else {
      const v = parseFloat(assessment?.indicators?.[id]?.value);
      pct = isFinite(v) ? v : null;
    }
  }
  return { id, score, pct };
}

function l0Member(id, layer0Result, assessment) {
  const it = layer0Result?.items?.[id];
  const score = it?.processScore ?? null;
  let pct = null;
  let days = null;
  if (score !== null) {
    if (LAYER0_ITEMS[id].inputType === 'ratio') {
      pct = it.derivedPct ?? null;
    } else {
      const v = parseFloat(assessment?.layer0?.[id]?.value);
      days = isFinite(v) ? v : null;
    }
  }
  return { id, score, pct, days };
}

// ── Pair verdicts ────────────────────────────────────────────────────────────

function percentPair(pairKey, a, b) {
  // A %-comparison needs a measured PERCENTAGE on each side. A programme-gap
  // zero (No RTO/RPO defined) carries a score (0) but NO measured percentage
  // (pct === null), so it is not comparable here — key off pct, not score.
  const aHas = a.pct != null, bHas = b.pct != null;
  // Neither has a value → nothing to interpret (hide); exactly one → fallback.
  if (!aHas && !bHas) return { pairKey, status: 'hidden' };
  if (!aHas || !bHas) return { pairKey, status: 'fallback', unscoredId: !aHas ? a.id : b.id };
  const gap = Math.abs(a.pct - b.pct);
  if (gap <= PERCENT_GAP_THRESHOLD) return { pairKey, status: 'hidden' };
  const higherId = a.pct >= b.pct ? a.id : b.id;
  return {
    pairKey, status: 'finding', higherId,
    members: [
      { id: a.id, valueText: `${a.pct.toFixed(0)}%` },
      { id: b.id, valueText: `${b.pct.toFixed(0)}%` },
    ],
    text: PAIR_FINDINGS_TEXT[pairKey][higherId],
  };
}

function rmPair(a, b) {
  const pairKey = 'RM04_RM05';
  const aNull = a.score === null, bNull = b.score === null;
  if (aNull && bNull) return { pairKey, status: 'hidden' };
  if (aNull || bNull) return { pairKey, status: 'fallback', unscoredId: aNull ? a.id : b.id };
  // Different units / opposite directions → compare by score band, not a % gap
  if (a.score === b.score) return { pairKey, status: 'hidden' };
  const higherId = a.score > b.score ? a.id : b.id;
  return {
    pairKey, status: 'finding', higherId,
    members: [
      { id: 'RM-04', valueText: a.pct != null ? `${a.pct.toFixed(0)}% (band ${a.score})` : `band ${a.score}` },
      { id: 'RM-05', valueText: b.days != null ? `${b.days} days (band ${b.score})` : `band ${b.score}` },
    ],
    text: PAIR_FINDINGS_TEXT[pairKey][higherId],
  };
}

/**
 * computePairFindings(results, layer0Result, assessment) →
 *   [ verdict_RM04_RM05, verdict_BC01_BC02, verdict_BC08_BC09 ]
 * Each verdict: { pairKey, status: 'finding'|'fallback'|'hidden', ... }
 */
export function computePairFindings(results, layer0Result, assessment) {
  const rm04 = l0Member('RM-04', layer0Result, assessment);
  const rm05 = l0Member('RM-05', layer0Result, assessment);
  const bc01 = l1Member('BC-01', results, assessment);
  const bc02 = l1Member('BC-02', results, assessment);
  const bc08 = l1Member('BC-08', results, assessment);
  const bc09 = l1Member('BC-09', results, assessment);

  return [
    rmPair(rm04, rm05),
    percentPair('BC01_BC02', bc01, bc02),
    percentPair('BC08_BC09', bc08, bc09),
  ];
}
