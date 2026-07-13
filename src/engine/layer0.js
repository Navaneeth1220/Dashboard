/**
 * Layer 0 engine — pure functions only.
 * No imports from scoring.js; no shared state. Layer 1 firewall is structural.
 * computeLayer0() reads only assessmentRecord.layer0 — never .indicators.
 */

import {
  LAYER0_ITEMS,
  LAYER0_0A_IDS,
  LAYER0_0B_IDS,
  LAYER0_ALL_IDS,
  L0_STATE,
  L0_TAG,
  L0_SEVERITY,
  L0_CONTEXT_ONLY_STATES,
} from '../data/layer0Definitions.js';

// ---------------------------------------------------------------------------
// Band scoring (local copy — same algorithm as Layer 1, kept separate
// to maintain the Layer 1/Layer 0 engine firewall)
// ---------------------------------------------------------------------------

function scoreByBands(value, itemDef) {
  if (!isFinite(value)) return null;
  const { direction, bands } = itemDef;
  if (direction === 'lower_is_better') {
    const band = bands.find(b => (b.gt === null || value > b.gt) && value <= b.lte);
    return band ? band.score : 0;
  }
  // higher_is_better
  const band = bands.find(b => value >= b.gte && (b.lt === null || value < b.lt));
  return band ? band.score : 0;
}

function extractValue(def, input) {
  if (def.inputType === 'ratio') {
    const num = parseFloat(input.numerator);
    const den = parseFloat(input.denominator);
    if (!isFinite(num) || !isFinite(den)) return null;
    if (num < 0 || den < 0) return null;
    if (den === 0) return null;
    if (num > den) return null;
    return (num / den) * 100;
  }
  // single_value
  const v = parseFloat(input.value);
  if (!isFinite(v) || v < 0) return null;
  return v;
}

// ---------------------------------------------------------------------------
// Tag and displayGroup derivation
// not_verifiable always overrides to Evidence validation / group 5.
// Both functions apply the SAME condition so they cannot conflict.
// ---------------------------------------------------------------------------

function deriveTag(item, state) {
  if (state === L0_STATE.NOT_VERIFIABLE) return L0_TAG.EVIDENCE_VALIDATION;
  return item.baseTag;
}

function deriveDisplayGroup(item, state) {
  if (state === L0_STATE.NOT_VERIFIABLE) return 5;
  return item.baseDisplayGroup;
}

// ---------------------------------------------------------------------------
// Single-item evaluation
// ---------------------------------------------------------------------------

/**
 * evaluateItem(itemId, input) → ItemResult
 *
 * ItemResult:
 * {
 *   state:          string | null,
 *   processScore:   0–4 | null,    — RM-04/05 only; null for qualitative items
 *   derivedPct:     number | null, — RM-04 ratio display value
 *   severity:       'critical'|'high'|'medium_note'|'monitor'|null,
 *   tag:            string,
 *   displayGroup:   1–5,
 *   message:        string | null,
 *   contextualNote: string | null, — non-null only for L0-asset-inventory when flagged
 *   isSkippedAction: boolean,      — true only for BC plan tested 'no_qualifying_test'
 *   processGap:     boolean,       — true for RM-04/05 'process_absent'
 *   invalidInput:   boolean,
 * }
 */
export function evaluateItem(itemId, input) {
  const def = LAYER0_ITEMS[itemId];
  if (!def) throw new Error(`Unknown Layer 0 item: ${itemId}`);

  const state = input?.state ?? null;

  // ── RM-04/RM-05: quantitative process evidence with bands ─────────────────
  if (def.bands !== null) {
    if (state === L0_STATE.MEASURED) {
      const value = extractValue(def, input);
      const derivedPct = def.inputType === 'ratio' ? value : null;

      if (value === null) {
        return {
          state, processScore: null, derivedPct: null,
          severity: null, tag: def.baseTag, displayGroup: def.baseDisplayGroup,
          message: null, contextualNote: null,
          isSkippedAction: false, processGap: false, invalidInput: true,
        };
      }

      const processScore = scoreByBands(value, def);
      const severity = def.processSeverityMap[processScore] ?? null;
      const message = def.processMessages[processScore] ?? null;

      return {
        state, processScore, derivedPct,
        severity, tag: def.baseTag, displayGroup: def.baseDisplayGroup,
        message, contextualNote: null,
        isSkippedAction: false, processGap: false, invalidInput: false,
      };
    }

    // Non-measured RM state (not_measurable / process_absent / context-only)
    const entry = def.stateMap[state] ?? null;
    if (!entry) {
      return {
        state, processScore: null, derivedPct: null,
        severity: null, tag: def.baseTag, displayGroup: def.baseDisplayGroup,
        message: null, contextualNote: null,
        isSkippedAction: false, processGap: false, invalidInput: false,
      };
    }
    return {
      state, processScore: null, derivedPct: null,
      severity: entry.severity ?? null,
      tag: def.baseTag,                    // RM items never use not_verifiable
      displayGroup: def.baseDisplayGroup,
      message: entry.message ?? null,
      contextualNote: null,
      isSkippedAction: false,
      processGap: entry.processGap ?? false,
      invalidInput: false,
    };
  }

  // ── Qualitative items ──────────────────────────────────────────────────────
  const entry = def.stateMap[state] ?? null;
  if (!entry) {
    return {
      state, processScore: null, derivedPct: null,
      severity: null, tag: def.baseTag, displayGroup: def.baseDisplayGroup,
      message: null, contextualNote: null,
      isSkippedAction: false, processGap: false, invalidInput: false,
    };
  }

  const severity = entry.severity ?? null;
  const isFlagged = severity !== null;

  return {
    state, processScore: null, derivedPct: null,
    severity,
    tag:          deriveTag(def, state),
    displayGroup: deriveDisplayGroup(def, state),
    message:      entry.message ?? null,
    // contextualNote only emitted when the item is actually flagged (§6.2)
    contextualNote: isFlagged ? (def.contextualNote ?? null) : null,
    isSkippedAction: entry.isSkippedAction ?? false,
    processGap: false,
    invalidInput: false,
  };
}

// ---------------------------------------------------------------------------
// Action flag generation
// ---------------------------------------------------------------------------

// Severity sort priority (monitor and null are filtered out before reaching sort)
const SEVERITY_RANK = {
  [L0_SEVERITY.CRITICAL]:    0,
  [L0_SEVERITY.HIGH]:        1,
  [L0_SEVERITY.MEDIUM_NOTE]: 2,
};

/**
 * generateActionFlags(evaluatedItems) → Flag[]
 *
 * Filters: only critical, high, medium_note are emitted.
 * monitor and null are excluded from the action panel.
 * Context-only non-events (severity null) are excluded.
 *
 * Sort: primary severity (critical → high → medium_note),
 *       secondary displayGroup (1 → 5),
 *       tertiary canonical item index (stable, deterministic).
 *
 * No automated ranking within a severity tier (§6.2 no-auto-rank rule).
 * The ONLY within-tier content is the asset-inventory contextualNote,
 * which is a per-item annotation, not a ranking prescription.
 */
export function generateActionFlags(evaluatedItems) {
  return Object.entries(evaluatedItems)
    .filter(([_, r]) => r.severity !== null && r.severity !== L0_SEVERITY.MONITOR)
    .map(([itemId, r]) => ({
      itemId,
      itemName:      LAYER0_ITEMS[itemId].name,
      severity:      r.severity,
      tag:           r.tag,
      message:       r.message,
      contextualNote: r.contextualNote,
      displayGroup:  r.displayGroup,
      isSkippedAction: r.isSkippedAction,
      processGap:    r.processGap,
      _itemIndex:    LAYER0_ALL_IDS.indexOf(itemId),  // for stable tertiary sort
    }))
    .sort((a, b) => {
      const sev = (SEVERITY_RANK[a.severity] ?? 99) - (SEVERITY_RANK[b.severity] ?? 99);
      if (sev !== 0) return sev;
      const grp = a.displayGroup - b.displayGroup;
      if (grp !== 0) return grp;
      return a._itemIndex - b._itemIndex;
    })
    .map(({ _itemIndex, ...flag }) => flag);   // strip internal sort key from output
}

// ---------------------------------------------------------------------------
// Full Layer 0 computation
// ---------------------------------------------------------------------------

/**
 * computeLayer0(assessmentRecord) → Layer0Result
 *
 * Only reads assessmentRecord.layer0 — never .indicators or .meta.
 * Layer 1 scores are unchanged by this function.
 *
 * Returns:
 * {
 *   items:       { [itemId]: ItemResult },
 *   groups:      { '0A': ItemResult[], '0B': ItemResult[] },
 *   actionFlags: Flag[],  — sorted, monitor/null excluded
 * }
 */
export function computeLayer0(assessmentRecord) {
  const inputs = assessmentRecord?.layer0 ?? {};

  const items = {};
  for (const id of LAYER0_ALL_IDS) {
    items[id] = evaluateItem(id, inputs[id] ?? { state: null });
  }

  const groups = {
    '0A': LAYER0_0A_IDS.map(id => ({ id, name: LAYER0_ITEMS[id].name, ...items[id] })),
    '0B': LAYER0_0B_IDS.map(id => ({ id, name: LAYER0_ITEMS[id].name, ...items[id] })),
  };

  return { items, groups, actionFlags: generateActionFlags(items) };
}

// ---------------------------------------------------------------------------
// Blank Layer 0 record (for App initialisation)
// ---------------------------------------------------------------------------

export function createBlankLayer0() {
  const layer0 = {};
  for (const def of Object.values(LAYER0_ITEMS)) {
    if (def.inputType === 'ratio') {
      layer0[def.id] = { state: null, numerator: '', denominator: '' };
    } else if (def.inputType === 'single_value') {
      layer0[def.id] = { state: null, value: '' };
    } else {
      layer0[def.id] = { state: null };
    }
  }
  return layer0;
}
