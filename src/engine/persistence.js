/**
 * Assessment persistence — Stage 5-i. Pure functions only (no DOM, no I/O).
 *
 * Export serialises the INPUT record (the source of truth); scores are derived
 * by the engines, never persisted as authoritative. Import validates a foreign
 * file and returns a normalised record — fully decoupled from "the active
 * assessment", so Stage 5-ii can validate two files into two comparison slots
 * with the same function. App.jsx does the DOM I/O (Blob download, FileReader)
 * and the state-setting; this module does none of that.
 */

import { INDICATORS, ALL_INDICATOR_IDS } from '../data/indicatorDefinitions.js';
import { LAYER0_ITEMS, LAYER0_ALL_IDS } from '../data/layer0Definitions.js';
import { createBlankAssessment } from './scoring.js';
import { createBlankLayer0 } from './layer0.js';

export const CURRENT_SCHEMA_VERSION = 1;
export const ASSESSMENT_KIND = 'nis2-ot-assessment';

// ---------------------------------------------------------------------------
// Filename safety
// ---------------------------------------------------------------------------

/** Strip anything that isn't [A-Za-z0-9-_]; collapse runs; never path-breaking. */
export function sanitizeFilename(s) {
  const cleaned = String(s ?? '')
    .replace(/[^A-Za-z0-9-_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned.length > 0 ? cleaned : 'assessment';
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Build the export record. `results` is optional and used ONLY for a
 * human-readable, NON-AUTHORITATIVE derived snapshot — ignored on import.
 */
export function buildExportRecord({ clientId, assessmentDate, indicators, layer0, targets, results }) {
  const record = {
    kind: ASSESSMENT_KIND,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    assessment: {
      meta: { clientId: clientId ?? '', assessmentDate: assessmentDate ?? '' },
      // JSON-clone so the export never aliases live UI state
      indicators: JSON.parse(JSON.stringify(indicators ?? {})),
      layer0: JSON.parse(JSON.stringify(layer0 ?? {})),
    },
    targets: JSON.parse(JSON.stringify(targets ?? {})),
  };

  if (results) {
    record.derived = {
      _note: 'Derived snapshot for human readability only — recomputed from inputs on import; never trusted as authoritative.',
      ih: results.ih?.score ?? null,
      bc: results.bc?.score ?? null,
      overall: results.overall?.score ?? null,
    };
  }

  return record;
}

/** Build { json, filename, record } for download. */
export function serializeAssessment(args) {
  const record = buildExportRecord(args);
  const json = JSON.stringify(record, null, 2);
  const base = `${args.clientId || 'client'}_${args.assessmentDate || 'undated'}_assessment`;
  return { json, filename: `${sanitizeFilename(base)}.json`, record };
}

// ---------------------------------------------------------------------------
// Import — validate + normalise (pure; never throws)
// ---------------------------------------------------------------------------

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * parseAndValidateImport(jsonString) →
 *   { ok: true, data: { clientId, assessmentDate, indicators, layer0, targets }, warnings: [] }
 *   | { ok: false, error: string }
 *
 * Reject-wholesale policy: any unknown id, invalid state, or malformed target
 * fails the whole import (predictable, no silent data loss). Missing ids are
 * filled blank (an omitted/empty record is valid). `derived` is ignored.
 */
export function parseAndValidateImport(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, error: 'Not a recognised assessment file.' };
  }
  if (parsed.kind !== ASSESSMENT_KIND || !isPlainObject(parsed.assessment)) {
    return { ok: false, error: 'Not a recognised assessment file (missing kind or assessment block).' };
  }

  const warnings = [];
  const sv = parsed.schemaVersion;
  if (typeof sv !== 'number' || !Number.isFinite(sv)) {
    return { ok: false, error: 'Missing or invalid schemaVersion.' };
  }
  if (sv !== CURRENT_SCHEMA_VERSION) {
    warnings.push(`File schemaVersion ${sv} differs from supported version ${CURRENT_SCHEMA_VERSION}; loaded on a best-effort basis.`);
  }

  const a = parsed.assessment;
  const rawIndicators = a.indicators ?? {};
  const rawLayer0 = a.layer0 ?? {};
  const rawTargets = parsed.targets ?? {};

  if (!isPlainObject(rawIndicators)) return { ok: false, error: 'Invalid indicators block.' };
  if (!isPlainObject(rawLayer0)) return { ok: false, error: 'Invalid layer0 block.' };
  if (!isPlainObject(rawTargets)) return { ok: false, error: 'Invalid targets block.' };

  // Validate Layer 1 indicators
  for (const [id, entry] of Object.entries(rawIndicators)) {
    if (!ALL_INDICATOR_IDS.includes(id)) {
      return { ok: false, error: `Unknown indicator id: ${id}.` };
    }
    if (!isPlainObject(entry)) {
      return { ok: false, error: `Invalid entry for indicator ${id}.` };
    }
    const state = entry.state ?? null;
    if (state !== null && !INDICATORS[id].allowedStates.includes(state)) {
      return { ok: false, error: `Indicator ${id} has a state not in its allowed set: ${state}.` };
    }
  }

  // Validate Layer 0 items
  for (const [id, entry] of Object.entries(rawLayer0)) {
    if (!LAYER0_ALL_IDS.includes(id)) {
      return { ok: false, error: `Unknown Layer 0 item id: ${id}.` };
    }
    if (!isPlainObject(entry)) {
      return { ok: false, error: `Invalid entry for Layer 0 item ${id}.` };
    }
    const state = entry.state ?? null;
    if (state !== null && !LAYER0_ITEMS[id].allowedStates.includes(state)) {
      return { ok: false, error: `Layer 0 item ${id} has a state not in its allowed set: ${state}.` };
    }
  }

  // Validate projection targets
  for (const [id, val] of Object.entries(rawTargets)) {
    if (!ALL_INDICATOR_IDS.includes(id)) {
      return { ok: false, error: `Unknown target indicator id: ${id}.` };
    }
    if (!Number.isInteger(val) || val < 0 || val > 4) {
      return { ok: false, error: `Invalid target for ${id}: ${val} (expected integer 0–4).` };
    }
  }

  // Normalise: present (validated) entries used as-is; missing ids filled blank.
  const blankIndicators = createBlankAssessment().indicators;
  const blankLayer0 = createBlankLayer0();

  const indicators = {};
  for (const id of ALL_INDICATOR_IDS) {
    indicators[id] = Object.prototype.hasOwnProperty.call(rawIndicators, id)
      ? rawIndicators[id]
      : blankIndicators[id];
  }
  const layer0 = {};
  for (const id of LAYER0_ALL_IDS) {
    layer0[id] = Object.prototype.hasOwnProperty.call(rawLayer0, id)
      ? rawLayer0[id]
      : blankLayer0[id];
  }

  const meta = isPlainObject(a.meta) ? a.meta : {};
  const data = {
    clientId: String(meta.clientId ?? ''),
    assessmentDate: String(meta.assessmentDate ?? ''),
    indicators,
    layer0,
    targets: { ...rawTargets },
  };

  return { ok: true, data, warnings };
}
