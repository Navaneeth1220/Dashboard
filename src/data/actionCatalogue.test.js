/**
 * Action catalogue tests — docs/ai-report-spec.md, Step 8.
 *
 * The data must stay identical to docs/action-catalogue.md (the reviewed
 * source), every trigger must name real IDs and states, and the text must be
 * fit for the report on its own: the validator never checks this section.
 */

import { describe, it, expect } from 'vitest';
import catalogueDoc from '../../docs/action-catalogue.md?raw';
import { ACTION_CATALOGUE, ACTION_AREAS, NIS2_ARTICLE, LOW_SCORE_MAX } from './actionCatalogue.js';
import { INDICATORS, ALL_INDICATOR_IDS, STATE, SCORE_LEVEL_LABELS } from './indicatorDefinitions.js';
import { LAYER0_ITEMS, LAYER0_ALL_IDS, L0_STATE } from './layer0Definitions.js';

// ─── The doc, parsed ──────────────────────────────────────────────────────────

const FIELD_KEYS = {
  Trigger: 'trigger', Action: 'action', Steps: 'steps', 'Why it matters': 'why',
  Who: 'who', NIS2: 'nis2', Standard: 'standard',
};

/** [{ id, title, area, fields: { trigger, action, … } }] in doc order; empty fields are null. */
function parseDoc(md) {
  const text = md.replace(/\r\n/g, '\n');
  const entries = [];
  let areaTitle = null;
  for (const block of text.split(/^(?=## |### )/m)) {
    const area = block.match(/^## (.+)$/m);
    if (area && block.startsWith('## ')) { areaTitle = area[1].trim(); continue; }
    const head = block.match(/^### (\S+) · (.+)$/m);
    if (!head) continue;
    const fields = {};
    for (const line of block.split('\n')) {
      const m = line.match(/^- \*\*(.+?):\*\*\s?(.*)$/);
      if (m) fields[FIELD_KEYS[m[1]]] = m[2].trim() || null;
    }
    entries.push({ id: head[1], title: head[2].trim(), areaTitle, fields });
  }
  return entries;
}

const DOC = parseDoc(catalogueDoc);
const BY_ID = Object.fromEntries(ACTION_CATALOGUE.map(e => [e.id, e]));

/** The doc's area headings, as the data's area titles are shorter for the report. */
const DOC_AREA_TITLES = {
  IH: 'Incident Handling',
  BC: 'Business Continuity',
  L0: 'Foundational controls (Layer 0)',
  RM: 'Vulnerability management (process evidence)',
};

const KNOWN_STATES = new Set([...Object.values(STATE), ...Object.values(L0_STATE)]);

/** The trigger keys in backticks: "(`IH-07` or `IH-08: capability_absent`)". */
function docTriggerKeys(trigger) {
  const keys = [...trigger.matchAll(/`([^`]+)`/g)].map(m => m[1]).join(' ');
  const rest = trigger.slice(trigger.indexOf('(`'));
  return {
    ids: new Set(keys.match(/\b(?:IH|BC|RM)-\d+\b|L0-[a-z-]+[a-z]/g) ?? []),
    states: new Set((keys.match(/\b[a-z_]+\b/g) ?? []).filter(w => KNOWN_STATES.has(w) && w !== STATE.MEASURED)),
    lowScore: /score ≤ 2/.test(keys),
    measured: /\bmeasured\b/.test(keys),
    processFlag: /action flag/.test(rest),
    anyFoundational: /any foundational item/.test(rest),
  };
}

function dataTriggerKeys(entry) {
  const ids = new Set();
  const states = new Set();
  let lowScore = false;
  let processFlag = false;
  for (const c of entry.trigger.when) {
    c.ids.forEach(id => ids.add(id));
    (c.states ?? []).forEach(s => states.add(s));
    if (c.kind === 'lowScore') lowScore = true;
    if (c.kind === 'processFlag') processFlag = true;
  }
  return { ids, states, lowScore, processFlag };
}

const VERIFIABLE_ITEM_IDS = LAYER0_ALL_IDS.filter(id => LAYER0_ITEMS[id].allowedStates.includes(L0_STATE.NOT_VERIFIABLE));

// ─── Drift: data and doc agree ────────────────────────────────────────────────

describe('the data equals docs/action-catalogue.md', () => {
  it('has the same entries in the same order', () => {
    expect(DOC.length).toBe(28);
    expect(ACTION_CATALOGUE.map(e => e.id)).toEqual(DOC.map(e => e.id));
  });

  it('has the same area per entry, and the areas in catalogue order', () => {
    for (const d of DOC) expect(DOC_AREA_TITLES[BY_ID[d.id].area]).toBe(d.areaTitle);
    expect(ACTION_AREAS.map(a => a.key)).toEqual(['IH', 'BC', 'L0', 'RM']);
    const order = ACTION_CATALOGUE.map(e => ACTION_AREAS.findIndex(a => a.key === e.area));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it.each(DOC.map(d => [d.id, d]))('%s: title and every text field verbatim', (id, d) => {
    const e = BY_ID[id];
    expect(e.title).toBe(d.title);
    for (const key of ['action', 'steps', 'why', 'who']) expect(e[key]).toBe(d.fields[key]);
  });

  it.each(DOC.map(d => [d.id, d]))('%s: references verbatim, empty ↔ null', (id, d) => {
    expect(BY_ID[id].nis2).toBe(d.fields.nis2);
    expect(BY_ID[id].standard).toBe(d.fields.standard);
  });

  it.each(DOC.map(d => [d.id, d]))('%s: trigger label and keys', (id, d) => {
    const e = BY_ID[id];
    expect(e.trigger.label).toBe(d.fields.trigger.slice(0, d.fields.trigger.indexOf(' (`')));

    const doc = docTriggerKeys(d.fields.trigger);
    const data = dataTriggerKeys(e);
    expect(data.ids).toEqual(doc.anyFoundational ? new Set(VERIFIABLE_ITEM_IDS) : doc.ids);
    expect(data.states).toEqual(doc.states);
    expect(data.lowScore).toBe(doc.lowScore);
    expect(data.processFlag).toBe(doc.processFlag);
    // "measured" in the keys only ever comes with a low score or an action flag.
    expect(doc.measured).toBe(doc.lowScore || doc.processFlag);
  });

  it('states the NIS2 article the references are to', () => {
    expect(catalogueDoc).toContain(`NIS2 references are to ${NIS2_ARTICLE} of Directive (EU) 2022/2555.`);
  });

  it('low score means 2 or lower, as the doc says', () => {
    expect(LOW_SCORE_MAX).toBe(2);
    expect(SCORE_LEVEL_LABELS[LOW_SCORE_MAX + 1]).toBe('Good');
    expect(catalogueDoc).toContain('a measured score of 2 or lower (below Good)');
  });
});

// ─── Triggers name real IDs and states ────────────────────────────────────────

const NON_EVENTS = [
  STATE.NO_QUALIFYING_EVENT, STATE.NO_QUALIFYING_DISRUPTION,
  L0_STATE.NO_QUALIFYING_VULNERABILITY, L0_STATE.NO_REMEDIATED_VULNERABILITIES,
];

describe('triggers', () => {
  it('have unique, prefixed IDs', () => {
    const ids = ACTION_CATALOGUE.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of ACTION_CATALOGUE) expect(e.id).toMatch(new RegExp(`^ACT-${e.area}-\\d{2}$`));
  });

  it('every condition names existing IDs and states they allow', () => {
    for (const e of ACTION_CATALOGUE) {
      expect(e.trigger.when.length).toBeGreaterThan(0);
      for (const c of e.trigger.when) {
        expect(c.ids.length).toBeGreaterThan(0);
        if (c.kind === 'indicatorState' || c.kind === 'lowScore') {
          for (const id of c.ids) expect(ALL_INDICATOR_IDS).toContain(id);
          for (const s of c.states ?? []) for (const id of c.ids) expect(INDICATORS[id].allowedStates).toContain(s);
        } else if (c.kind === 'layer0State' || c.kind === 'processFlag') {
          for (const id of c.ids) expect(LAYER0_ALL_IDS).toContain(id);
          for (const s of c.states ?? []) for (const id of c.ids) expect(LAYER0_ITEMS[id].allowedStates).toContain(s);
        } else {
          throw new Error(`Unknown condition kind: ${c.kind}`);
        }
      }
    }
  });

  it('process flags only on the process-evidence items with bands', () => {
    for (const e of ACTION_CATALOGUE) {
      for (const c of e.trigger.when.filter(c => c.kind === 'processFlag')) {
        for (const id of c.ids) expect(LAYER0_ITEMS[id].bands).not.toBeNull();
      }
    }
  });

  it('no non-event and no measured state is a state trigger', () => {
    for (const e of ACTION_CATALOGUE) {
      for (const c of e.trigger.when) {
        for (const s of c.states ?? []) {
          expect(NON_EVENTS).not.toContain(s);
          expect(s).not.toBe(STATE.MEASURED);
        }
      }
    }
  });
});

// ─── Coverage: every problem state has an entry ───────────────────────────────

describe('coverage', () => {
  const stateTriggers = (kind, id) => ACTION_CATALOGUE.flatMap(e =>
    e.trigger.when.filter(c => c.kind === kind && c.ids.includes(id)).flatMap(c => c.states));

  it('every indicator problem state and every low score has an entry', () => {
    const problems = [STATE.NOT_MEASURABLE, STATE.CAPABILITY_ABSENT, STATE.NO_THRESHOLDS_DEFINED,
      STATE.NO_RTO_DEFINED, STATE.NO_RPO_DEFINED];
    for (const id of ALL_INDICATOR_IDS) {
      for (const s of INDICATORS[id].allowedStates.filter(s => problems.includes(s))) {
        expect(stateTriggers('indicatorState', id), `${id} ${s}`).toContain(s);
      }
      expect(ACTION_CATALOGUE.some(e => e.trigger.when.some(c => c.kind === 'lowScore' && c.ids.includes(id))), id).toBe(true);
    }
  });

  it('every flagged Layer 0 state has an entry, and every banded item a process-flag entry', () => {
    for (const id of LAYER0_ALL_IDS) {
      const def = LAYER0_ITEMS[id];
      for (const [s, entry] of Object.entries(def.stateMap)) {
        if (entry.severity) expect(stateTriggers('layer0State', id), `${id} ${s}`).toContain(s);
      }
      if (def.bands) {
        expect(ACTION_CATALOGUE.some(e => e.trigger.when.some(c => c.kind === 'processFlag' && c.ids.includes(id))), id).toBe(true);
      }
    }
  });
});

// ─── Hygiene: the text stands on its own ──────────────────────────────────────

const TEXT_KEYS = ['title', 'action', 'steps', 'why', 'who'];
const texts = e => TEXT_KEYS.map(k => e[k]);
const refs = e => [e.nis2, e.standard].filter(Boolean);

/** Numbers outside the references, pinned: a new one needs a review. */
const PINNED_NUMBERS = {
  'ACT-BC-06': ['0'],   // "so the indicator stays at 0" (the programme-gap 0)
  'ACT-BC-08': ['0'],
};

describe('hygiene', () => {
  it('no internal ID, raw enum, layer jargon or forbidden wording', () => {
    for (const e of ACTION_CATALOGUE) {
      for (const t of [...texts(e), ...refs(e)]) {
        expect(t, e.id).not.toMatch(/\b(IH|BC|RM)-\d+\b|L0-|ACT-/);
        expect(t, e.id).not.toMatch(/\w_\w/);
        expect(t, e.id).not.toMatch(/Layer [01]/i);
        expect(t, e.id).not.toMatch(/\bpoor\b|reverse-scored/i);
      }
    }
  });

  it('no entry refers to another entry', () => {
    for (const e of ACTION_CATALOGUE) {
      const titles = ACTION_CATALOGUE.filter(o => o !== e).map(o => o.title.toLowerCase());
      for (const t of [...texts(e).slice(1), ...refs(e)]) {
        expect(t, e.id).not.toMatch(/\bsee\b/i);
        expect(t, e.id).not.toMatch(/\b(this|that|the|another|other|above|below|previous|next) (catalogue )?entr(y|ies)\b/i);
        for (const title of titles) expect(t.toLowerCase(), e.id).not.toContain(title);
      }
    }
  });

  it('numbers appear only in the references, apart from the pinned ones', () => {
    for (const e of ACTION_CATALOGUE) {
      const numbers = texts(e).flatMap(t => t.match(/\d+(?:\.\d+)?/g) ?? []);
      expect(numbers, e.id).toEqual(PINNED_NUMBERS[e.id] ?? []);
    }
  });

  it('references have the expected form', () => {
    for (const e of ACTION_CATALOGUE) {
      if (e.nis2) expect(e.nis2, e.id).toMatch(/^\([a-j]\) [^;]+(; \([a-j]\) [^;]+)*$/);
      if (e.standard) expect(e.standard, e.id).toMatch(/^IEC (TR )?62443-\d-\d/);
    }
  });

  it('every entry has a title, action, steps, why and who', () => {
    for (const e of ACTION_CATALOGUE) for (const t of texts(e)) expect(t, e.id).toMatch(/\S/);
  });
});
