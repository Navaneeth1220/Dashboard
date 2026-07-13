/**
 * Layer 1 Priority View — Stage 3b-i (design-logic §7). Pure engine, no UI.
 *
 * Assigns the 8 Layer 1 indicators to three lanes, computes count-based severity
 * for the unverifiable lane, performs assessor-driven root-cause grouping, and
 * builds E↔F links to Stage 2 Layer 0 action flags. Reads the outputs of
 * computeAssessment / computeLayer0 (+ the assessment record for states and the
 * not-measurable `reason`). Mutates nothing; alters no score.
 *
 * Lane assignment (by state, then score):
 *   not_measurable                         → Lane 2 (unverifiable)
 *   no_qualifying_event/disruption         → Lane 3 (non-event, informational)
 *   score !== null                         → Lane 1 (Measured + all score-0
 *                                            programme-gap states)
 *   else                                   → unassigned (unset, or measured-with-
 *                                            invalid-input) — kept DISTINCT
 *
 * Lane 1 carries `state` AND `programmeGap` on every entry so 3b-ii can
 * distinguish a programme-gap zero (No RTO defined — structural) from a
 * performance zero (measured 0 — genuine failure), even though both sort to top.
 *
 * unassigned preserves WHY: 'invalid_input' (correctable error, surface
 * prominently) vs 'unset' (nothing entered, low-key). Never collapsed.
 */

import { INDICATORS, STATE, ALL_INDICATOR_IDS } from '../data/indicatorDefinitions.js';
import { LAYER0_ALL_IDS } from '../data/layer0Definitions.js';

const IH_IDS = ALL_INDICATOR_IDS.filter(id => INDICATORS[id].measure === 'IH');
const BC_IDS = ALL_INDICATOR_IDS.filter(id => INDICATORS[id].measure === 'BC');

// Canonical order index for deterministic tie-breaking
const CANON_INDEX = Object.fromEntries(ALL_INDICATOR_IDS.map((id, i) => [id, i]));

// ---------------------------------------------------------------------------
// Lane 2 count-based severity (mirrors the incomplete-dimension rule, §3.4)
// ---------------------------------------------------------------------------

/**
 * Critical is reserved for a TOTAL dimension blackout (every indicator in the
 * measure not-measurable). Fires on raw count, regardless of grouping.
 */
function countBasedSeverity(notMeasurableCount, measureSize) {
  if (notMeasurableCount === 0) return null;
  if (notMeasurableCount === measureSize) return 'critical';
  return 'high';
}

// ---------------------------------------------------------------------------
// Lane 2 root-cause grouping + E↔F linking
// ---------------------------------------------------------------------------

/**
 * Resolve the grouping key and link kind for one not-measurable indicator's reason.
 * reason = { layer0ItemId?: string|null, text?: string } | null
 */
function classifyReason(reason) {
  const layer0ItemId = reason?.layer0ItemId ?? null;
  const text = (reason?.text ?? '').trim();

  // (a) Root cause is one of the nine formal Layer 0 items → link
  if (layer0ItemId && LAYER0_ALL_IDS.includes(layer0ItemId)) {
    return { kind: 'layer0_link', groupKey: `layer0:${layer0ItemId}`, layer0ItemId, text };
  }

  // (b) Root cause described but not a formal Layer 0 item → self-created flag
  if (text.length > 0) {
    return { kind: 'self_created', groupKey: `text:${text.toLowerCase()}`, layer0ItemId: null, text };
  }

  // (c) No reason supplied → ungrouped standalone (needs a reason)
  return { kind: 'ungrouped_no_reason', groupKey: null, layer0ItemId: null, text: '' };
}

/**
 * Build Lane 2 grouped entries from the not-measurable indicators in a measure-
 * agnostic pool. Groups by matching reason; ungrouped-no-reason entries never merge.
 */
function buildLane2Groups(notMeasurable, layer0Result) {
  const actionFlags = layer0Result?.actionFlags ?? [];
  const byKey = new Map();

  for (const { indicatorId, reason } of notMeasurable) {
    const cls = classifyReason(reason);
    // ungrouped-no-reason: unique key per indicator so they never merge
    const key = cls.groupKey ?? `none:${indicatorId}`;

    if (!byKey.has(key)) {
      byKey.set(key, { cls, affectedIndicators: [] });
    }
    byKey.get(key).affectedIndicators.push(indicatorId);
  }

  const groups = [];
  for (const [groupKey, { cls, affectedIndicators }] of byKey) {
    // Stable order of affected indicators
    affectedIndicators.sort((a, b) => CANON_INDEX[a] - CANON_INDEX[b]);

    if (cls.kind === 'layer0_link') {
      const flag = actionFlags.find(f => f.itemId === cls.layer0ItemId) ?? null;
      groups.push({
        kind: 'layer0_link',
        groupKey,
        affectedIndicators,
        reasonText: cls.text,
        linkedLayer0ItemId: cls.layer0ItemId,
        linkedFlagExists: flag !== null,
        linkedFlagSeverity: flag?.severity ?? null,   // reference only — not the message
      });
    } else if (cls.kind === 'self_created') {
      groups.push({
        kind: 'self_created',
        groupKey,
        affectedIndicators,
        reasonText: cls.text,
        selfFlag: {
          id: `evidence-infra:${groupKey}`,
          message: `Evidence-infrastructure gap: ${cls.text}. Affects ${affectedIndicators.join(', ')}.`,
        },
      });
    } else {
      groups.push({
        kind: 'ungrouped_no_reason',
        groupKey,
        affectedIndicators,
        needsReason: true,
      });
    }
  }

  // Deterministic group order: by kind, then by first affected indicator's canonical index
  const KIND_RANK = { layer0_link: 0, self_created: 1, ungrouped_no_reason: 2 };
  groups.sort((a, b) => {
    const k = KIND_RANK[a.kind] - KIND_RANK[b.kind];
    if (k !== 0) return k;
    return CANON_INDEX[a.affectedIndicators[0]] - CANON_INDEX[b.affectedIndicators[0]];
  });

  return groups;
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

/**
 * computePriorityView(assessment, layer1Results, layer0Result) → resolved 3-lane structure.
 * See file header for lane assignment and entry shapes.
 */
export function computePriorityView(assessment, layer1Results, layer0Result) {
  const inputs = assessment?.indicators ?? {};
  const results = layer1Results?.indicators ?? {};

  const lane1Entries = [];
  const lane3Entries = [];
  const unassigned = [];
  const notMeasurable = [];   // { indicatorId, reason } pool for Lane 2 grouping

  for (const id of ALL_INDICATOR_IDS) {
    const def = INDICATORS[id];
    const state = inputs[id]?.state ?? null;
    const result = results[id] ?? { score: null };
    const score = result.score ?? null;

    if (state === STATE.NOT_MEASURABLE) {
      notMeasurable.push({ indicatorId: id, reason: inputs[id]?.reason ?? null });
      continue;
    }

    if (state === STATE.NO_QUALIFYING_EVENT || state === STATE.NO_QUALIFYING_DISRUPTION) {
      lane3Entries.push({ indicatorId: id, measure: def.measure, state });
      continue;
    }

    if (score !== null) {
      // Measured (0–4) OR a score-0 programme-gap state. Carry state + programmeGap
      // so 3b-ii can label programme-gap zeros vs performance zeros.
      lane1Entries.push({
        indicatorId: id,
        measure: def.measure,
        state,
        score,
        programmeGap: result.programmeGap === true,
      });
      continue;
    }

    // score === null and not a Lane-2/3 state → unassigned, reason preserved DISTINCTLY
    if (state === STATE.MEASURED) {
      // Measured but unscoreable → invalid input typed by the assessor (correctable error)
      unassigned.push({ indicatorId: id, measure: def.measure, reason: 'invalid_input' });
    } else {
      // state === null → nothing entered yet
      unassigned.push({ indicatorId: id, measure: def.measure, reason: 'unset' });
    }
  }

  // Lane 1: rank by score ascending (lower = more urgent), canonical tie-break
  lane1Entries.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return CANON_INDEX[a.indicatorId] - CANON_INDEX[b.indicatorId];
  });

  // Lane 2 severity: count-based per measure (raw count, independent of grouping)
  const ihCount = notMeasurable.filter(n => INDICATORS[n.indicatorId].measure === 'IH').length;
  const bcCount = notMeasurable.filter(n => INDICATORS[n.indicatorId].measure === 'BC').length;

  return {
    lane1: { entries: lane1Entries },
    lane2: {
      ih: { count: ihCount, severity: countBasedSeverity(ihCount, IH_IDS.length) },
      bc: { count: bcCount, severity: countBasedSeverity(bcCount, BC_IDS.length) },
      groups: buildLane2Groups(notMeasurable, layer0Result),
    },
    lane3: { entries: lane3Entries },
    unassigned,
  };
}
