/**
 * Persistence test suite — Stage 5-i.
 */

import { describe, it, expect } from 'vitest';
import {
  buildExportRecord,
  serializeAssessment,
  parseAndValidateImport,
  sanitizeFilename,
  CURRENT_SCHEMA_VERSION,
  ASSESSMENT_KIND,
} from './persistence.js';
import { createBlankAssessment } from './scoring.js';
import { createBlankLayer0 } from './layer0.js';
import { computeAssessment } from './scoring.js';
import { computeLayer0 } from './layer0.js';
import { computeProjection } from './projection.js';

// ---------------------------------------------------------------------------
// A fully-populated inputs record covering all four state types, RM with
// values, non-uniform Layer 0 states, reasons, and projection targets.
// ---------------------------------------------------------------------------

function richInputs() {
  const indicators = { ...createBlankAssessment().indicators };
  indicators['IH-06'] = { state: 'measured', value: '4' };
  indicators['IH-07'] = { state: 'capability_absent', value: '' };
  indicators['IH-08'] = { state: 'not_measurable', value: '', reason: { layer0ItemId: null, text: 'no incident-timestamp process' } };
  indicators['BC-01'] = { state: 'no_qualifying_disruption', value: '' };
  indicators['BC-02'] = { state: 'measured', value: '90' };
  indicators['BC-04'] = { state: 'no_thresholds_defined', numerator: '', denominator: '' };
  indicators['BC-08'] = { state: 'not_measurable', numerator: '', denominator: '', reason: { layer0ItemId: 'L0-bc-plan-doc', text: 'BC plan missing' } };
  indicators['BC-09'] = { state: 'measured', numerator: '8', denominator: '10' };

  const layer0 = { ...createBlankLayer0() };
  layer0['L0-asset-inventory'] = { state: 'missing' };
  layer0['L0-multi-homed'] = { state: 'uncontrolled_multi_homing_found' };
  layer0['L0-bc-plan-doc'] = { state: 'present' };
  layer0['RM-04'] = { state: 'measured', numerator: '5', denominator: '10' };
  layer0['RM-05'] = { state: 'measured', value: '45' };

  const targets = { 'IH-06': 4, 'IH-07': 3 };   // both projectable

  return { clientId: 'Client A', assessmentDate: '2026-06-24', indicators, layer0, targets };
}

function recordFrom(inputs) {
  return { meta: { clientId: inputs.clientId, assessmentDate: inputs.assessmentDate }, indicators: inputs.indicators, layer0: inputs.layer0 };
}

// ===========================================================================
// Round-trip
// ===========================================================================

describe('round-trip — record + recomputed results', () => {
  it('export → import yields a record deep-equal to the original inputs', () => {
    const inputs = richInputs();
    const { json } = serializeAssessment(inputs);
    const res = parseAndValidateImport(json);
    expect(res.ok).toBe(true);
    expect(res.data).toEqual(inputs);   // clientId, assessmentDate, indicators, layer0, targets all equal
  });

  it('recomputed engine results are identical before and after round-trip', () => {
    const inputs = richInputs();
    const { json } = serializeAssessment(inputs);
    const { data } = parseAndValidateImport(json);

    const recA = recordFrom(inputs);
    const recB = recordFrom(data);

    expect(computeAssessment(recB)).toEqual(computeAssessment(recA));
    expect(computeLayer0(recB)).toEqual(computeLayer0(recA));
    expect(computeProjection(recB, computeAssessment(recB), { targets: data.targets }))
      .toEqual(computeProjection(recA, computeAssessment(recA), { targets: inputs.targets }));
  });

  it('round-trip preserves reason fields on not-measurable indicators', () => {
    const inputs = richInputs();
    const { data } = parseAndValidateImport(serializeAssessment(inputs).json);
    expect(data.indicators['IH-08'].reason).toEqual({ layer0ItemId: null, text: 'no incident-timestamp process' });
    expect(data.indicators['BC-08'].reason).toEqual({ layer0ItemId: 'L0-bc-plan-doc', text: 'BC plan missing' });
  });

  it('round-trip preserves projection targets', () => {
    const inputs = richInputs();
    const { data } = parseAndValidateImport(serializeAssessment(inputs).json);
    expect(data.targets).toEqual({ 'IH-06': 4, 'IH-07': 3 });
  });

  it('round-trip preserves non-uniform Layer 0 states and RM values', () => {
    const inputs = richInputs();
    const { data } = parseAndValidateImport(serializeAssessment(inputs).json);
    expect(data.layer0['L0-multi-homed'].state).toBe('uncontrolled_multi_homing_found');
    expect(data.layer0['RM-04']).toEqual({ state: 'measured', numerator: '5', denominator: '10' });
    expect(data.layer0['RM-05']).toEqual({ state: 'measured', value: '45' });
  });

  it('round-trip preserves meta', () => {
    const inputs = richInputs();
    const { data } = parseAndValidateImport(serializeAssessment(inputs).json);
    expect(data.clientId).toBe('Client A');
    expect(data.assessmentDate).toBe('2026-06-24');
  });
});

// ===========================================================================
// Export excludes authoritative scores; derived is non-authoritative
// ===========================================================================

describe('export does not persist authoritative scores', () => {
  it('exported indicator entries carry no score field', () => {
    const inputs = richInputs();
    const rec = buildExportRecord(inputs);
    for (const entry of Object.values(rec.assessment.indicators)) {
      expect(entry).not.toHaveProperty('score');
    }
  });

  it('derived snapshot is present but clearly marked non-authoritative', () => {
    const inputs = richInputs();
    const results = computeAssessment(recordFrom(inputs));
    const rec = buildExportRecord({ ...inputs, results });
    expect(rec.derived).toBeDefined();
    expect(rec.derived._note).toMatch(/never trusted|non-authoritative|recomputed/i);
  });

  it('import ignores derived — data carries only inputs, no scores', () => {
    const inputs = richInputs();
    const results = computeAssessment(recordFrom(inputs));
    const json = JSON.stringify(buildExportRecord({ ...inputs, results }));
    const { data } = parseAndValidateImport(json);
    expect(data).not.toHaveProperty('derived');
    expect(data).not.toHaveProperty('ih');
    // The validated record is exactly the inputs
    expect(data).toEqual(inputs);
  });

  it('record has schemaVersion and kind', () => {
    const rec = buildExportRecord(richInputs());
    expect(rec.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(rec.kind).toBe(ASSESSMENT_KIND);
    expect(typeof rec.exportedAt).toBe('string');
  });
});

// ===========================================================================
// Import validation — reject wholesale
// ===========================================================================

describe('import validation', () => {
  it('malformed JSON → clear error, no throw, no partial load', () => {
    const res = parseAndValidateImport('{ not valid json ');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not valid JSON/i);
  });

  it('foreign file (wrong kind) → rejected', () => {
    const res = parseAndValidateImport(JSON.stringify({ kind: 'something-else', schemaVersion: 1, assessment: {} }));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not a recognised assessment file/i);
  });

  it('non-object JSON (array / scalar) → rejected', () => {
    expect(parseAndValidateImport('[1,2,3]').ok).toBe(false);
    expect(parseAndValidateImport('42').ok).toBe(false);
  });

  it('missing schemaVersion → rejected', () => {
    const res = parseAndValidateImport(JSON.stringify({ kind: ASSESSMENT_KIND, assessment: { indicators: {}, layer0: {} } }));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/schemaVersion/i);
  });

  it('unknown/newer schemaVersion → ok with a warning (not rejected)', () => {
    const rec = buildExportRecord(richInputs());
    rec.schemaVersion = 99;
    const res = parseAndValidateImport(JSON.stringify(rec));
    expect(res.ok).toBe(true);
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(res.warnings[0]).toMatch(/schemaVersion 99/);
  });

  it('unknown indicator id → rejected wholesale', () => {
    const rec = buildExportRecord(richInputs());
    rec.assessment.indicators['IH-99'] = { state: 'measured', value: '1' };
    const res = parseAndValidateImport(JSON.stringify(rec));
    expect(res.ok).toBe(false);
    expect(res.error).toBe('Unknown indicator in the file: "IH-99".');
  });

  it('indicator in a state not in its allowed set → rejected', () => {
    const rec = buildExportRecord(richInputs());
    rec.assessment.indicators['BC-01'] = { state: 'no_rto_defined' };   // BC-01 has no such state
    const res = parseAndValidateImport(JSON.stringify(rec));
    expect(res.ok).toBe(false);
    expect(res.error).toBe('Network Operability Under Disruption has a state that is not allowed: "no_rto_defined".');
  });

  it('unknown foundational control key → rejected, the key quoted', () => {
    const rec = buildExportRecord(richInputs());
    rec.assessment.layer0['L0-bogus'] = { state: 'present' };
    const res = parseAndValidateImport(JSON.stringify(rec));
    expect(res.ok).toBe(false);
    expect(res.error).toBe('Unknown foundational control in the file: "L0-bogus".');
  });

  it('foundational control invalid state → rejected, by name', () => {
    const rec = buildExportRecord(richInputs());
    rec.assessment.layer0['L0-multi-homed'] = { state: 'present' };   // not in multi-homed vocab
    const res = parseAndValidateImport(JSON.stringify(rec));
    expect(res.ok).toBe(false);
    expect(res.error).toBe('Zero uncontrolled multi-homed devices has a state that is not allowed: "present".');
  });

  it('invalid target (out of range / unknown id) → rejected', () => {
    const rec1 = buildExportRecord(richInputs());
    rec1.targets = { 'IH-06': 7 };
    expect(parseAndValidateImport(JSON.stringify(rec1)).ok).toBe(false);

    const rec2 = buildExportRecord(richInputs());
    rec2.targets = { 'NOPE': 3 };
    expect(parseAndValidateImport(JSON.stringify(rec2)).ok).toBe(false);
  });

  it('empty/blank record → ok, fills blanks for all ids', () => {
    const rec = { kind: ASSESSMENT_KIND, schemaVersion: 1, assessment: { meta: {}, indicators: {}, layer0: {} }, targets: {} };
    const res = parseAndValidateImport(JSON.stringify(rec));
    expect(res.ok).toBe(true);
    // all 8 indicators + 9 layer0 present, blank
    expect(Object.keys(res.data.indicators)).toHaveLength(8);
    expect(Object.keys(res.data.layer0)).toHaveLength(9);
    expect(res.data.indicators['IH-06'].state).toBeNull();
    expect(res.data.targets).toEqual({});
  });

  it('partial file (some ids present, some missing) → present used, missing filled blank', () => {
    const rec = {
      kind: ASSESSMENT_KIND, schemaVersion: 1,
      assessment: { meta: { clientId: 'X' }, indicators: { 'IH-06': { state: 'measured', value: '4' } }, layer0: {} },
      targets: {},
    };
    const res = parseAndValidateImport(JSON.stringify(rec));
    expect(res.ok).toBe(true);
    expect(res.data.indicators['IH-06']).toEqual({ state: 'measured', value: '4' });
    expect(res.data.indicators['BC-01'].state).toBeNull();   // missing → blank
  });
});

// ===========================================================================
// Filename sanitisation
// ===========================================================================

describe('sanitizeFilename', () => {
  it('strips path-breaking and unsafe characters', () => {
    const out = sanitizeFilename('Client/A: 2026..\\x');
    expect(out).not.toMatch(/[/\\:.\s]/);
    expect(out).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('empty / all-unsafe input → fallback "assessment"', () => {
    expect(sanitizeFilename('')).toBe('assessment');
    expect(sanitizeFilename('///')).toBe('assessment');
  });

  it('serializeAssessment produces a safe filename', () => {
    const { filename } = serializeAssessment({ ...richInputs(), clientId: 'Acme/Corp', assessmentDate: '2026-06-24' });
    expect(filename).toMatch(/^[A-Za-z0-9_-]+\.json$/);
    expect(filename).toMatch(/\.json$/);
  });
});

// ===========================================================================
// Purity / decoupling (Stage 5-ii readiness)
// ===========================================================================

describe('purity and decoupling', () => {
  it('parseAndValidateImport does not mutate its input string and is deterministic', () => {
    const json = serializeAssessment(richInputs()).json;
    const r1 = parseAndValidateImport(json);
    const r2 = parseAndValidateImport(json);
    expect(r1).toEqual(r2);
  });

  it('two independent files validate into two independent records (no shared/active coupling)', () => {
    const a = richInputs();
    const b = { ...richInputs(), clientId: 'Client B', targets: { 'IH-06': 2 } };
    const da = parseAndValidateImport(serializeAssessment(a).json).data;
    const db = parseAndValidateImport(serializeAssessment(b).json).data;
    expect(da.clientId).toBe('Client A');
    expect(db.clientId).toBe('Client B');
    expect(da.targets).toEqual({ 'IH-06': 4, 'IH-07': 3 });
    expect(db.targets).toEqual({ 'IH-06': 2 });
    // mutating one must not affect the other
    da.indicators['IH-06'] = { state: 'measured', value: '999' };
    expect(db.indicators['IH-06'].value).toBe('4');
  });
});
