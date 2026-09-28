/**
 * Narrative validator for AI-drafted reports (docs/ai-report-spec.md, Step 3).
 *
 * validateNarrative(narrative, facts) → { ok, errors: [{ section, sentence, rule, detail }] }
 *
 * Pure, no model needed, never throws. Checks every section of a generated
 * narrative against the facts it was written from. It reads only the facts
 * (kind, text, refs) and the data definitions; it re-derives no score or
 * state. `detail` uses descriptive names only: it is sent back to the model
 * on retry and shown in the UI when validation fails.
 *
 * Per section: quoted client name / assessor notes are removed (when their
 * fact is cited), item names are masked for the numbers, leaked-ID and
 * pattern checks, and rules 4–6 run per clause, where a clause that names no
 * item inherits the last item named earlier in the same sentence. The
 * verbatim exemption applies only to clauses that name an item themselves.
 */

import { INDICATORS, ALL_INDICATOR_IDS } from '../data/indicatorDefinitions.js';
import { LAYER0_ITEMS, LAYER0_ALL_IDS } from '../data/layer0Definitions.js';
import { displayName, DIMENSION_NAMES } from '../data/displayNames.js';
import { SECTION_KEYS } from './schema.js';
import { quotedUserText } from './facts.js';

export const VALIDATOR_RULES = [
  'shape', 'factIds', 'numbers', 'leakedIds',
  'noScoreWording', 'unscoredScore', 'programmeGap', 'causal',
];

// ---------------------------------------------------------------------------
// Item names (full catalogue): masking, subjects, bare-code exceptions
// ---------------------------------------------------------------------------

const DIMENSION_IDS = Object.keys(DIMENSION_NAMES);

/** id → every name it may be written as (descriptive name first). */
const ITEM_NAMES = Object.fromEntries([
  ...ALL_INDICATOR_IDS.map(id => [id, [INDICATORS[id].name, INDICATORS[id].shortName]]),
  ...LAYER0_ALL_IDS.map(id => [id, [LAYER0_ITEMS[id].name]]),
  ...DIMENSION_IDS.map(id => [id, [DIMENSION_NAMES[id]]]),
]);

const NAME_TO_ID = new Map(
  Object.entries(ITEM_NAMES).flatMap(([id, names]) => names.map(name => [name.toLowerCase(), id]))
);

const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Longest first, so "Zone Availability Rate" wins over "Zone Availability".
const NAME_PATTERN = new RegExp(
  `(?<![\\w-])(?:${[...NAME_TO_ID.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|')})(?![\\w-])`,
  'gi'
);

const MASK = '§';

function maskNames(text) {
  return text.replace(NAME_PATTERN, MASK);
}

/** Item ids named in the text, in order of appearance. */
function namesIn(text) {
  return [...text.matchAll(NAME_PATTERN)].map(m => NAME_TO_ID.get(m[0].toLowerCase()));
}

function nameOf(id) {
  return DIMENSION_NAMES[id] ?? displayName(id);
}

// A bare dimension code is not a leak when followed by the same word as in a
// known item name ("BC plan", from "BC plan documented for critical processes").
const BARE_CODE = /\b(IH|BC)\b(?:\s+(\w+))?/g;
const ALLOWED_CODE_PHRASES = new Set(
  Object.values(ITEM_NAMES).flat()
    .flatMap(name => [...name.matchAll(/\b(IH|BC)\s+(\w+)/g)])
    .map(m => `${m[1]} ${m[2].toLowerCase()}`)
);

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
};
const NUMBER_WORD_ALT = Object.keys(NUMBER_WORDS).join('|');
const NUMBER_TOKEN = new RegExp(`\\b(\\d{4}-\\d{2}-\\d{2})\\b|(\\d+(?:\\.\\d+)?)|\\b(${NUMBER_WORD_ALT})\\b`, 'gi');

/** [{ raw, value }] in order of appearance; ISO dates are one token, digits normalised. */
function numberTokens(text) {
  return [...text.matchAll(NUMBER_TOKEN)].map(([raw, date, digits, word]) => ({
    raw,
    value: date ?? (digits !== undefined ? String(Number(digits)) : String(NUMBER_WORDS[word.toLowerCase()])),
  }));
}

/** Normalised numbers in the text: '1.80' → '1.8', '85%' → '85', 'two' → '2', dates whole. */
export function extractNumbers(text) {
  return numberTokens(text).map(t => t.value);
}

// ---------------------------------------------------------------------------
// Sentences and clauses
// ---------------------------------------------------------------------------

/** Split after . ! ? when whitespace and an uppercase letter, digit, or opening quote/bracket follow. */
export function splitSentences(text) {
  return text.replace(/\s+/g, ' ').trim()
    .split(/(?<=[.!?])\s+(?=["“'([]?[A-Z0-9])/)
    .filter(s => s.length > 0);
}

const CLAUSE_SEPARATOR = /\s*[,;—]\s*|\s+[–-]\s+|\s+(?:and|but|while|whereas|although|though)\s+/i;

export function splitClauses(sentence) {
  return sentence.split(CLAUSE_SEPARATOR).map(c => c.trim()).filter(c => c.length > 0);
}

/** Lower-cased, whitespace collapsed, outer punctuation and quotes trimmed. */
function normalize(text) {
  return text.toLowerCase().replace(/\s+/g, ' ')
    .replace(/^[\s"'“”‘’([.,;:!?—–-]+|[\s"'“”‘’)\].,;:!?—–-]+$/g, '');
}

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

const FACT_ID = /\b[CF]\d+\b/g;
const INTERNAL_ID = /\b(?:IH|BC|RM)-\d+\b|\bL0-[\w-]*\w/g;
const RAW_ENUM = /\b\w*_\w*\b/g;

const PERFORMANCE_WORD = /\b(?:poor|weak|bad|failing|failed|good|strong|underperform\w*|low|high)\b/i;
const NOT_PERFORMANCE = /\bhigh(?:-|\s+)(?:priority|severity)\b/gi;

const NUM = `(?:\\d+(?:\\.\\d+)?|${NUMBER_WORD_ALT})`;
const SCORE_CLAIM = new RegExp(
  `\\b(?:score|scores|scored|scoring|rated|rating)\\b(?:\\W+\\w+){0,3}?\\W+${NUM}\\b` +
  `|\\b${NUM}\\s+(?:\\w+\\s+)?score\\b` +
  `|\\b${NUM}\\s*(?:out of|/)\\s*\\d`,
  'i'
);
const DIMENSION_VALUE = Object.fromEntries(DIMENSION_IDS.map(id => [
  id, new RegExp(`${escapeRegExp(DIMENSION_NAMES[id])}\\W+(?:\\w+\\W+){0,2}?${NUM}\\b`, 'i'),
]));

const FAIL_WORD = /\b(?:fail\w*|missed|poor)\b/gi;
const NEGATION = /\b(?:not|no|never)\b|\brather than\b|\binstead of\b/i;

const MAY_BE_RELATED = /may be related/i;
const CAUSAL = /\b(?:caused|causes|because of|due to|led to|results from|resulted in)\b/i;

const QUOTED = /"([^"]*)"|“([^”]*)”/g;

// ---------------------------------------------------------------------------
// Fact-derived categories (from ALL facts, not only cited ones)
// ---------------------------------------------------------------------------

function categorize(facts) {
  const noJudgement = new Map();   // rule 4: id → why it cannot be judged
  const unscored = new Map();      // rule 5: id → why it has no score
  const gaps = new Set();          // rule 6

  for (const id of LAYER0_ALL_IDS) unscored.set(id, 'is not scored');
  for (const f of facts) {
    if (f.kind === 'no_score') {
      for (const id of f.refs) {
        noJudgement.set(id, 'has no score');
        unscored.set(id, 'has no score');
      }
    } else if (f.kind === 'l0_unset') {
      for (const id of f.refs) noJudgement.set(id, 'was not assessed');
    } else if (f.kind === 'dim_incomplete') {
      noJudgement.set(f.refs[0], 'is incomplete and has no score');
      unscored.set(f.refs[0], 'is incomplete and has no score');
    } else if (f.kind === 'gap_zero') {
      for (const id of f.refs) gaps.add(id);
    }
  }
  return { noJudgement, unscored, gaps };
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function sectionLabel(section) {
  return section === 'headline' ? 'The headline' : `The "${section}" section`;
}

function checkShape(section, part) {
  const label = sectionLabel(section);
  if (part === null || typeof part !== 'object') return [`${label} is missing.`];
  const problems = [];
  if (!Array.isArray(part.factIds) || part.factIds.length === 0) problems.push(`${label} cites no facts.`);
  if (typeof part.text !== 'string' || part.text.trim() === '') problems.push(`${label} has no text.`);
  return problems;
}

function checkFactIds(factIds, byId) {
  const details = [];
  const seen = new Set();
  for (const id of factIds) {
    if (!byId.has(id)) details.push(`Cited fact ID "${String(id)}" does not exist.`);
    else if (seen.has(id)) details.push(`Fact ID "${id}" is cited more than once in this section.`);
    seen.add(id);
  }
  return details;
}

/** Remove quotes of user text (client name, assessor notes) from cited facts. */
function removeExemptQuotes(text, cited) {
  const sources = cited.flatMap(quotedUserText).map(s => s.replace(/\s+/g, ' ').trim());
  return text.replace(QUOTED, (whole, straight, curly) => {
    const inner = (straight ?? curly).replace(/\s+/g, ' ').trim();
    return inner && sources.some(src => src.includes(inner)) ? '""' : whole;
  });
}

/** Leaked tokens in masked text → { details, cleaned } (cleaned has them blanked). */
function checkLeaks(masked) {
  const details = [];
  let cleaned = masked;

  for (const m of masked.matchAll(FACT_ID)) details.push(`Fact ID "${m[0]}" appears in the text. Never write fact IDs.`);
  for (const m of masked.matchAll(INTERNAL_ID)) {
    const name = displayName(m[0]);
    details.push(name !== m[0]
      ? `An internal code appears in the text. Write "${name}" instead.`
      : 'An internal code appears in the text. Use descriptive names only.');
  }
  cleaned = cleaned.replace(FACT_ID, ' ').replace(INTERNAL_ID, ' ');

  if (cleaned.match(RAW_ENUM)) details.push('A code-style word with an underscore appears in the text. Use plain words.');
  cleaned = cleaned.replace(RAW_ENUM, ' ');

  for (const m of cleaned.matchAll(BARE_CODE)) {
    const next = m[2]?.toLowerCase();
    if (next && ALLOWED_CODE_PHRASES.has(`${m[1]} ${next}`)) continue;
    details.push(`The abbreviation "${m[1]}" appears in the text. Write "${DIMENSION_NAMES[m[1]]}" instead.`);
  }

  return { details, cleaned };
}

function checkClause(clause, subjects, categories) {
  const masked = maskNames(clause);
  const errors = [];

  const performance = masked.replace(NOT_PERFORMANCE, ' ').match(PERFORMANCE_WORD);
  if (performance) {
    for (const id of subjects.filter(s => categories.noJudgement.has(s))) {
      errors.push(['noScoreWording',
        `${nameOf(id)} ${categories.noJudgement.get(id)}; do not describe it as "${performance[0]}".`]);
    }
  }

  for (const id of subjects.filter(s => categories.unscored.has(s))) {
    const dimensionValue = DIMENSION_IDS.includes(id) && DIMENSION_VALUE[id].test(clause);
    if (SCORE_CLAIM.test(masked) || dimensionValue) {
      errors.push(['unscoredScore', `${nameOf(id)} ${categories.unscored.get(id)}; do not give it a score.`]);
    }
  }

  const gapSubjects = subjects.filter(s => categories.gaps.has(s));
  if (gapSubjects.length > 0) {
    for (const m of masked.matchAll(FAIL_WORD)) {
      const preceding = masked.slice(0, m.index).trim().split(/\s+/).slice(-3).join(' ');
      if (NEGATION.test(preceding)) continue;
      for (const id of gapSubjects) {
        errors.push(['programmeGap',
          `${nameOf(id)} is a programme gap, not a measured failure; do not describe it as "${m[0]}".`]);
      }
    }
  }

  return errors;
}

function checkSection(section, part, ctx) {
  const errors = [];
  const add = (rule, detail, sentence = null) => errors.push({ section, sentence, rule, detail });

  const shape = checkShape(section, part);
  if (shape.length > 0) {
    for (const detail of shape) add('shape', detail);
    return errors;
  }

  for (const detail of checkFactIds(part.factIds, ctx.byId)) add('factIds', detail);

  const cited = [...new Set(part.factIds)].filter(id => ctx.byId.has(id)).map(id => ctx.byId.get(id));
  const citedTexts = cited.map(f => normalize(f.text));
  const allowedNumbers = new Set(cited.flatMap(f => extractNumbers(maskNames(f.text))));
  const mayBeRelated = cited.some(f => MAY_BE_RELATED.test(f.text));

  const text = removeExemptQuotes(part.text.replace(/\s+/g, ' ').trim(), cited);

  for (const sentence of splitSentences(text)) {
    // Checks 2–3 on the masked sentence
    const { details: leaks, cleaned } = checkLeaks(maskNames(sentence));
    for (const detail of leaks) add('leakedIds', detail, sentence);

    const missing = new Set();
    for (const { raw, value } of numberTokens(cleaned)) {
      if (!allowedNumbers.has(value) && !missing.has(value)) {
        missing.add(value);
        add('numbers', `The number "${raw}" does not appear in any fact cited by this section.`, sentence);
      }
    }

    // Checks 4–6 per clause, with inheritance and the verbatim exemption
    let lastNamed = null;
    for (const clause of splitClauses(sentence)) {
      const named = namesIn(clause);
      const subjects = named.length > 0 ? named : (lastNamed ? [lastNamed] : []);
      if (named.length > 0) lastNamed = named[named.length - 1];
      if (subjects.length === 0) continue;

      // Verbatim exemption only for a clause that names an item itself. An
      // inherited clause ("poor") is short enough to match almost any fact.
      if (named.length > 0 && citedTexts.some(t => t.includes(normalize(clause)))) continue;

      for (const [rule, detail] of checkClause(clause, subjects, ctx.categories)) add(rule, detail, sentence);
    }

    // Check 7
    const causal = mayBeRelated ? sentence.match(CAUSAL) : null;
    if (causal) add('causal', `A cited fact says "may be related"; do not claim a cause ("${causal[0]}").`, sentence);
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function validateNarrative(narrative, facts) {
  const factList = Array.isArray(facts) ? facts : [];
  const ctx = {
    byId: new Map(factList.map(f => [f.id, f])),
    categories: categorize(factList),
  };

  if (narrative === null || typeof narrative !== 'object' || Array.isArray(narrative)) {
    const detail = 'The narrative is not an object with a headline and sections.';
    return { ok: false, errors: [{ section: null, sentence: null, rule: 'shape', detail }] };
  }

  const sections = narrative.sections !== null && typeof narrative.sections === 'object' ? narrative.sections : {};
  const parts = [['headline', narrative.headline], ...SECTION_KEYS.map(key => [key, sections[key]])];

  const seen = new Set();
  const errors = [];
  for (const [section, part] of parts) {
    for (const error of checkSection(section, part, ctx)) {
      const key = JSON.stringify(error);
      if (!seen.has(key)) {
        seen.add(key);
        errors.push(error);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
