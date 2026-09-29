/**
 * Narrative validator for AI-drafted reports (docs/ai-report-spec.md, Step 3).
 *
 * validateNarrative(narrative, facts, { parts }?) → { ok, errors: [{ section, sentence, rule, detail }] }
 *
 * Pure, no model needed, never throws. Checks every section of a generated
 * narrative against the facts it was written from; `parts` (default: headline
 * and every section) limits the check to some parts, e.g. the two the model
 * writes. Categories always come from all facts. It reads only the facts
 * (kind, text, refs) and the data definitions; it re-derives no score or
 * state. `detail` uses descriptive names only: it is sent back to the model
 * on retry and shown in the UI when validation fails.
 *
 * Per section: quoted client name / assessor notes are removed (when their
 * fact is cited), item names are masked for the numbers, leaked-ID and
 * pattern checks, and rules 4–6 run per clause, where a clause that names no
 * item inherits the last item named earlier in the same sentence. The
 * verbatim exemption applies only to clauses that name an item themselves.
 * Rule 8 (attribution) ties a number next to one named item to that item's
 * own fact, which is what makes counting the context facts (C1 client and
 * date, C2 counts) as cited for every section safe in the numbers check; the
 * scale fact (C3) follows normal citation. Rule 9 (severity) keeps
 * "critical" on items whose fact is CRITICAL. Rule 10 flags "respectively".
 * Rule 11 holds "N dimensions" to the count C2 states. Rule 12 makes the
 * headline cite a finding, not only context and scale facts. Rule 13 allows
 * "may be related" only when a cited fact says it. Braces (JSON leaking into
 * the text) are a shape error. Rule 14 holds "N flags" to the cited flags,
 * 15 rejects "missing" for an item with no score, 16 judgement words about
 * scores, 17 level labels in the model parts (numbers only), 18 a headline
 * of more than one sentence. Rule 8 also ties a complete dimension's score to
 * its own fact.
 */

import { INDICATORS, ALL_INDICATOR_IDS, SCORE_LEVEL_LABELS } from '../data/indicatorDefinitions.js';
import { LAYER0_ITEMS, LAYER0_ALL_IDS } from '../data/layer0Definitions.js';
import { displayName, DIMENSION_NAMES } from '../data/displayNames.js';
import { SECTION_KEYS, MODEL_PARTS } from './schema.js';
import { quotedUserText } from './facts.js';

export const VALIDATOR_RULES = [
  'shape', 'factIds', 'numbers', 'leakedIds',
  'noScoreWording', 'unscoredScore', 'programmeGap', 'causal', 'attribution', 'severity', 'respectively',
  'dimensionCount', 'headlineFacts', 'relation', 'flagCount', 'missing', 'judgement', 'levelLabel',
  'headlineSentences',
];

/** Fact kinds that set the scene rather than state a finding (C1–C3). */
export const CONTEXT_KINDS = new Set(['context', 'scale']);

// ---------------------------------------------------------------------------
// Item names (full catalogue): masking, subjects, bare-code exceptions
// ---------------------------------------------------------------------------

const DIMENSION_IDS = Object.keys(DIMENSION_NAMES);

/** id → every name it may be written as (descriptive name first, then short name / aliases). */
const ITEM_NAMES = Object.fromEntries([
  ...ALL_INDICATOR_IDS.map(id => [id, [INDICATORS[id].name, INDICATORS[id].shortName]]),
  ...LAYER0_ALL_IDS.map(id => [id, [LAYER0_ITEMS[id].name, ...(LAYER0_ITEMS[id].aliases ?? [])]]),
  ...DIMENSION_IDS.map(id => [id, [DIMENSION_NAMES[id]]]),
]);

const NAME_TO_ID = new Map(
  Object.entries(ITEM_NAMES).flatMap(([id, names]) => names.map(name => [name.toLowerCase(), id]))
);

const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Longest first, so "Zone Availability Rate" wins over "Zone Availability".
// An optional plural "s" ("documented BC plans") still names the item. A
// dimension name followed by "plan" is not the dimension ("Business
// Continuity plan test").
const DIMENSION_NAME_KEYS = new Set(Object.values(DIMENSION_NAMES).map(n => n.toLowerCase()));
const NAME_PATTERN = new RegExp(
  `(?<![\\w-])(${[...NAME_TO_ID.keys()].sort((a, b) => b.length - a.length)
    .map(n => escapeRegExp(n) + (DIMENSION_NAME_KEYS.has(n) ? '(?!\\s+plans?\\b)' : '')).join('|')})s?(?![\\w-])`,
  'gi'
);

const MASK = '§';

function maskNames(text) {
  return text.replace(NAME_PATTERN, MASK);
}

/** Item ids named in the text, in order of appearance. */
function namesIn(text) {
  return [...text.matchAll(NAME_PATTERN)].map(m => NAME_TO_ID.get(m[1].toLowerCase()));
}

function nameOf(id) {
  return DIMENSION_NAMES[id] ?? displayName(id);
}

// A bare dimension code is not a leak when followed by a word that starts
// with the word after it in a known item name: "BC plan", "BC plans",
// "BC planning" (from "BC plan documented for critical processes").
const BARE_CODE = /\b(IH|BC)\b(?:\s+(\w+))?/g;
const ALLOWED_CODE_NEXT_WORDS = Object.values(ITEM_NAMES).flat()
  .flatMap(name => [...name.matchAll(/\b(IH|BC)\s+(\w+)/g)])
  .map(m => ({ code: m[1], next: m[2].toLowerCase() }));

function isAllowedCodePhrase(code, nextWord) {
  const next = nextWord?.toLowerCase();
  return !!next && ALLOWED_CODE_NEXT_WORDS.some(a => a.code === code && next.startsWith(a.next));
}

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
const NOT_PERFORMANCE = /\bhigh(?:-|\s+)(?:priority|severity|risk)\b/gi;

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
const MEASURED_WORD = /\bmeasured\b/gi;
const NEGATION = /\b(?:not|no|never)\b|\brather than\b|\binstead of\b/i;

/** Negated when not / no / never / "rather than" / "instead of" is among the three words before it. */
function isNegated(text, index) {
  return NEGATION.test(text.slice(0, index).trim().split(/\s+/).slice(-3).join(' '));
}

// "critical process(es)" is part of the BC plan item's name, not a severity claim.
const CRITICAL_WORD = /\bcritical\b(?!\s+process)/i;
const RESPECTIVELY = /\brespectively\b/i;
const DIMENSION_COUNT = new RegExp(`\\b(${NUM})\\s+dimensions?\\b`, 'gi');
const C2_DIMENSIONS = /\b(\d+) dimensions\b/;
const MAY_BE_RELATED = /may be related/i;

// Check 14: a flag or process fact with a severity is a flag.
const FLAG_SEVERITY = /^(CRITICAL|HIGH|MEDIUM NOTE)\./;
const FLAG_COUNT = new RegExp(`\\b(${NUM})\\s+((?:[\\w-]+\\s+){0,2})flags?\\b`, 'gi');
const SEVERITY_WORD = { critical: 'CRITICAL', high: 'HIGH', medium: 'MEDIUM NOTE' };

// Check 15: "missing" for an item that exists but has no score.
const MISSING_INDICATOR = /\bmissing\s+(?:effectiveness\s+)?indicators?\b/i;
// "a missing § score": the item's name is masked as §; its score is what is missing.
const MISSING_WORD = /\bmissing\b(?!\s+(?:§\s+)?(?:data|scores?|evidence|values?)\b)/i;

// Check 16: judgement words about a scored result (level labels are allowed).
const JUDGEMENT = /\bbelow average\b|\bweakness(?:es)?\b|\bareas? of concern\b|\bperforming well\b|\bpoor\b|\blow\b|\bweak\b/i;
const SCORE_WORD = /\b(?:score|scores|scored|scoring)\b/i;
// Not "performed": "no BC plan test was performed" is not about a score.
const PERFORM_WORD = /\bperform(?:s|ing|ance)?\b/i;

// Check 17: level labels in the model parts. Capitalised after the first word
// of a sentence, or lower case before "level(s)".
const LEVEL_WORDS = Object.values(SCORE_LEVEL_LABELS);
const LEVEL_CAPITALISED = new RegExp(`\\b(${LEVEL_WORDS.join('|')})\\b`, 'g');
const LEVEL_LOWER = new RegExp(`\\b(${LEVEL_WORDS.map(w => w.toLowerCase()).join('|')})\\s+levels?\\b`, 'g');
const LEVEL_CHECKED_PARTS = new Set(MODEL_PARTS);

// Check 8, complete dimensions: the number of a score claim ("score of 5",
// "5 out of 4") and the score in a dim_complete fact.
const SCORE_CLAIM_NUMBER = new RegExp(
  `\\b(?:score|scores|scored|scoring|rated|rating)\\b(?:\\W+\\w+){0,3}?\\W+(${NUM})\\b|\\b(${NUM})\\s*(?:out of|/)\\s*\\d`,
  'gi'
);
const DIMENSION_SCORE = /\bscore:?\s+(\d+(?:\.\d+)?)\s+out of\b/;
const CAUSAL = /\b(?:caused|causes|because of|due to|led to|results from|resulted in)\b/i;

const QUOTED = /"([^"]*)"|“([^”]*)”/g;

// ---------------------------------------------------------------------------
// Fact-derived categories (from ALL facts, not only cited ones)
// ---------------------------------------------------------------------------

const OWN_FACT_KINDS = new Set(['scored', 'gap_zero', 'no_score', 'process']);

function categorize(facts) {
  const noJudgement = new Map();   // rule 4: id → why it cannot be judged
  const noScore = new Set();       // rule 4 "measured": no-score indicators
  const unscored = new Map();      // rule 5: id → why it has no score
  const gaps = new Set();          // rule 6
  const ownFacts = new Map();      // rule 8: id → the item's own fact
  const criticalItems = new Set(); // rule 9: items whose flag / process fact is CRITICAL
  const flaggedItems = new Set();  // rule 9, per sentence: items with any flag
  const notScored = new Set();     // rule 15: no-score indicators and unassessed Layer 0 items
  const scored = new Set();        // rule 16: scored indicators and complete dimensions
  const dimensionScores = new Map(); // rule 8: complete dimension → its score as the fact writes it
  const contextNumbers = new Set(facts.filter(f => f.kind === 'context').flatMap(f => extractNumbers(maskNames(f.text))));

  for (const id of LAYER0_ALL_IDS) unscored.set(id, 'is not scored');
  for (const f of facts) {
    if (OWN_FACT_KINDS.has(f.kind)) {
      for (const id of f.refs) ownFacts.set(id, f);
    }
    if ((f.kind === 'l0_flag' || f.kind === 'process') && f.text.includes('CRITICAL')) {
      for (const id of f.refs) criticalItems.add(id);
    }
    if (isFlagFact(f)) {
      for (const id of f.refs) flaggedItems.add(id);
    }
    if (f.kind === 'scored') for (const id of f.refs) scored.add(id);
    if (f.kind === 'dim_complete') {
      scored.add(f.refs[0]);
      ownFacts.set(f.refs[0], f);
      const score = f.text.match(DIMENSION_SCORE)?.[1];
      if (score !== undefined) dimensionScores.set(f.refs[0], score);
    }
    if (f.kind === 'no_score' || f.kind === 'l0_unset') for (const id of f.refs) notScored.add(id);
    if (f.kind === 'no_score') {
      for (const id of f.refs) {
        noJudgement.set(id, 'has no score');
        noScore.add(id);
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
  return { noJudgement, noScore, unscored, gaps, ownFacts, criticalItems, flaggedItems, notScored, scored, dimensionScores, contextNumbers };
}

/** A flag fact: an l0_flag fact, or a process fact with a severity. → its severity, or null. */
function flagSeverity(f) {
  if (f.kind !== 'l0_flag' && f.kind !== 'process') return null;
  return f.text.match(FLAG_SEVERITY)?.[1] ?? null;
}

function isFlagFact(f) {
  return flagSeverity(f) !== null;
}

/**
 * Check 14: "<number> [≤ 2 words] flag(s)" must equal the cited flag facts,
 * of the named severity if a severity word stands in between.
 */
function checkFlagCount(cleaned, cited) {
  const flags = cited.map(flagSeverity).filter(Boolean);
  const details = [];
  for (const m of cleaned.matchAll(FLAG_COUNT)) {
    const [value] = extractNumbers(m[1]);
    const word = m[2].toLowerCase().split(/\s+/).find(w => SEVERITY_WORD[w]);
    const severity = word ? SEVERITY_WORD[word] : null;
    const count = severity ? flags.filter(s => s === severity).length : flags.length;
    if (value === String(count)) continue;
    details.push(`The cited facts contain ${count} ${severity ? `${severity} ` : ''}flag${count === 1 ? '' : 's'}; ` +
      `do not write "${m[0]}".`);
  }
  return details;
}

/** The text with the numbers of flag counts blanked: check 14 decides those, not checks 2 and 8. */
function blankFlagCounts(text) {
  return text.replace(FLAG_COUNT, (whole, number) => whole.replace(number, ' '));
}

/**
 * Check 8, complete dimensions: in a clause whose subject (named or
 * inherited) is exactly one complete dimension, each score claim must give
 * that dimension's score.
 */
function checkDimensionScore(clause, subjects, categories) {
  if (subjects.length !== 1 || !categories.dimensionScores.has(subjects[0])) return [];
  const [id] = subjects;
  const score = categories.dimensionScores.get(id);
  const details = [];
  for (const m of maskNames(blankFlagCounts(clause)).matchAll(SCORE_CLAIM_NUMBER)) {
    const raw = m[1] ?? m[2];
    const [value] = extractNumbers(raw);
    if (value === String(Number(score))) continue;
    details.push(`The score of ${nameOf(id)} is ${score}; do not write "${raw}".`);
  }
  return details;
}

/** Check 17: level labels used as such; a "<number> (<label>)" pair from a cited fact's text passes. */
function checkLevelLabels(masked, citedTexts) {
  const firstWord = masked.search(/[A-Za-z]/);
  const labels = [];
  for (const m of masked.matchAll(LEVEL_CAPITALISED)) {
    if (m.index === firstWord) continue;
    const pair = masked.slice(0, m.index).match(/(\d+(?:\.\d+)?)\s*\($/);
    if (pair && citedTexts.some(t => t.includes(`${pair[1]} (${m[1].toLowerCase()})`))) continue;
    labels.push(m[1]);
  }
  for (const m of masked.matchAll(LEVEL_LOWER)) labels.push(m[1]);
  return [...new Set(labels)];
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

/** Masked text with fact IDs, internal IDs and raw enums blanked (their digits are not numbers). */
function stripLeakTokens(masked) {
  return masked.replace(FACT_ID, ' ').replace(INTERNAL_ID, ' ').replace(RAW_ENUM, ' ');
}

/** Leaked tokens in masked text → { details, cleaned } (cleaned has them blanked). */
function checkLeaks(masked) {
  const details = [];

  for (const m of masked.matchAll(FACT_ID)) details.push(`Fact ID "${m[0]}" appears in the text. Never write fact IDs.`);
  for (const m of masked.matchAll(INTERNAL_ID)) {
    const name = displayName(m[0]);
    details.push(name !== m[0]
      ? `An internal code appears in the text. Write "${name}" instead.`
      : 'An internal code appears in the text. Use descriptive names only.');
  }
  if (masked.replace(FACT_ID, ' ').replace(INTERNAL_ID, ' ').match(RAW_ENUM)) {
    details.push('A code-style word with an underscore appears in the text. Use plain words.');
  }

  const cleaned = stripLeakTokens(masked);
  for (const m of cleaned.matchAll(BARE_CODE)) {
    if (isAllowedCodePhrase(m[1], m[2])) continue;
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

  const measured = [...masked.matchAll(MEASURED_WORD)].find(m => !isNegated(masked, m.index));
  if (measured) {
    for (const id of subjects.filter(s => categories.noScore.has(s))) {
      errors.push(['noScoreWording', `${nameOf(id)} has no score; do not describe it as "${measured[0]}".`]);
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
      if (isNegated(masked, m.index)) continue;
      for (const id of gapSubjects) {
        errors.push(['programmeGap',
          `${nameOf(id)} is a programme gap, not a measured failure; do not describe it as "${m[0]}".`]);
      }
    }
  }

  return errors;
}

/**
 * Check 8: a clause that itself names exactly one item with an own fact may
 * only use numbers from that fact, not from another fact that refs the item.
 * Inherited clauses are not checked (they misfire on forward references:
 * "…and several areas with scores of 2, including …").
 */
function checkAttribution(clause, named, categories) {
  const items = [...new Set(named)];
  if (items.length !== 1 || !categories.ownFacts.has(items[0])) return [];

  const [id] = items;
  const own = new Set(extractNumbers(maskNames(categories.ownFacts.get(id).text)));
  const isDimension = categories.dimensionScores.has(id);
  const seen = new Set();
  const details = [];
  for (const { raw, value } of numberTokens(stripLeakTokens(maskNames(blankFlagCounts(clause))))) {
    if (own.has(value) || seen.has(value)) continue;
    // The context facts describe the dimensions (C1 date, C2 counts): "8 indicators in two
    // dimensions: Incident Handling …". Score claims are checked strictly below.
    if (isDimension && categories.contextNumbers.has(value)) continue;
    seen.add(value);
    details.push(`The number "${raw}" is not in the fact about ${nameOf(id)}.`);
  }
  return details;
}

/**
 * Check 9: a clause that itself names exactly one item and says "critical"
 * (after masking names such as "BC plan documented for critical processes")
 * fails unless that item's flag or process fact carries CRITICAL.
 */
function checkSeverity(clause, named, categories) {
  const items = [...new Set(named)];
  if (items.length !== 1 || !CRITICAL_WORD.test(maskNames(clause))) return [];
  const [id] = items;
  if (categories.criticalItems.has(id)) return [];
  return [`${nameOf(id)} is not marked CRITICAL in its fact; do not call it critical.`];
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
  // Context facts (C1, C2) count as cited everywhere; safe only with check 8.
  const allowedNumbers = new Set([...cited, ...ctx.contextFacts].flatMap(f => extractNumbers(maskNames(f.text))));
  const mayBeRelated = cited.some(f => MAY_BE_RELATED.test(f.text));

  // Check 12: a headline that cites only context and scale facts is a title,
  // not a finding (first hybrid run set: all five headlines).
  if (section === 'headline' && !cited.some(f => !CONTEXT_KINDS.has(f.kind))) {
    add('headlineFacts', 'The headline cites only the assessment context. ' +
      'State the most important finding and cite the fact it comes from.');
  }

  const text = removeExemptQuotes(part.text.replace(/\s+/g, ' ').trim(), cited);

  // Check 0, braces: JSON leaking into the text (June manual check: an
  // accepted overview ended with " }"). After quote removal, so a quoted
  // client name may contain one; the other checks still run.
  if (/[{}]/.test(text)) {
    add('shape', 'The text contains "{" or "}". Write plain sentences only, without JSON.');
  }

  // Check 18: the headline is one sentence (the app: three flag facts copied).
  if (section === 'headline' && splitSentences(text).length !== 1) {
    add('headlineSentences', 'The headline must be exactly one sentence.');
  }

  for (const sentence of splitSentences(text)) {
    // Check 13: only a cited fact that says "may be related" allows it (June
    // manual check: a HIGH flag "may be related to the Incident Handling score").
    if (!mayBeRelated && MAY_BE_RELATED.test(sentence)) {
      add('relation', 'Do not write "may be related": no cited fact relates these items. ' +
        'Only an advisory fact can state that two items may be related.', sentence);
    }

    // Checks 2–3 on the masked sentence
    const { details: leaks, cleaned } = checkLeaks(maskNames(sentence));
    for (const detail of leaks) add('leakedIds', detail, sentence);

    const missing = new Set();
    for (const { raw, value } of numberTokens(blankFlagCounts(cleaned))) {
      if (!allowedNumbers.has(value) && !missing.has(value)) {
        missing.add(value);
        add('numbers', `The number "${raw}" does not appear in any fact cited by this section.`, sentence);
      }
    }

    // Check 11: "N dimensions" must match the count the context fact states.
    // (C2's numbers are allowed everywhere by check 2, so "three dimensions"
    // would otherwise pass.)
    if (ctx.dimensionCount !== null) {
      const reported = new Set();
      for (const m of cleaned.matchAll(DIMENSION_COUNT)) {
        const [value] = extractNumbers(m[1]);
        if (value === String(ctx.dimensionCount) || reported.has(m[0].toLowerCase())) continue;
        reported.add(m[0].toLowerCase());
        add('dimensionCount', `The facts state ${ctx.dimensionCount} dimensions; do not write "${m[0]}".`, sentence);
      }
    }

    // Check 14: "N flags" must match the cited flag facts (C2's numbers are
    // allowed everywhere by check 2, so "two flags" would otherwise pass).
    for (const detail of checkFlagCount(cleaned, cited)) add('flagCount', detail, sentence);

    // Check 10: pairing items with numbers or labels across "respectively"
    // is not reliable, so such sentences skip checks 8–9.
    const respectively = RESPECTIVELY.test(sentence);
    if (respectively) add('respectively', 'Give each item its own number or label; do not write "respectively".', sentence);

    const verbatim = citedTexts.some(t => t.includes(normalize(sentence)));
    const maskedSentence = maskNames(sentence);
    const sentenceNames = namesIn(sentence);

    // Check 15: the indicator exists; only its score is missing.
    const missingPhrase = MISSING_INDICATOR.test(sentence);
    if (missingPhrase) {
      add('missing', 'Do not write "missing indicator": the indicator exists; say it has no score.', sentence);
    }

    // Checks 4–6, 15 and 8–9 per clause, with inheritance (4–6 and 15 only)
    // and the verbatim exemption.
    let lastNamed = null;
    let severityReported = false;
    for (const clause of splitClauses(sentence)) {
      const named = namesIn(clause);
      const subjects = named.length > 0 ? named : (lastNamed ? [lastNamed] : []);
      if (named.length > 0) lastNamed = named[named.length - 1];
      if (subjects.length === 0) continue;

      // Verbatim exemption only for a clause that names an item itself. An
      // inherited clause ("poor") is short enough to match almost any fact.
      if (named.length > 0 && citedTexts.some(t => t.includes(normalize(clause)))) continue;

      for (const [rule, detail] of checkClause(clause, subjects, ctx.categories)) add(rule, detail, sentence);
      if (!missingPhrase && MISSING_WORD.test(maskNames(clause))) {
        for (const id of subjects.filter(s => ctx.categories.notScored.has(s))) {
          add('missing', `Do not call ${nameOf(id)} missing: it exists and has no score. Say it has no score.`, sentence);
        }
      }
      if (respectively) continue;
      for (const detail of checkAttribution(clause, named, ctx.categories)) add('attribution', detail, sentence);
      for (const detail of checkDimensionScore(clause, subjects, ctx.categories)) add('attribution', detail, sentence);
      for (const detail of checkSeverity(clause, named, ctx.categories)) {
        add('severity', detail, sentence);
        severityReported = true;
      }
    }

    // Check 9, per sentence: "critical" naming no flagged item, while no
    // cited flag is CRITICAL (June re-run: "equal priority critical issues
    // with response times and recovery rates").
    const critical = maskedSentence.match(CRITICAL_WORD);
    if (!respectively && !severityReported && !verbatim && critical && !isNegated(maskedSentence, critical.index)
        && !sentenceNames.some(id => ctx.categories.flaggedItems.has(id))
        && !cited.some(f => flagSeverity(f) === 'CRITICAL')) {
      add('severity', 'None of the cited flags is CRITICAL; do not write "critical".', sentence);
    }

    // Check 16: a judgement word in a sentence about a scored result. Level
    // labels (Good, Developing, …) are not in the list.
    const judgement = maskedSentence.match(JUDGEMENT);
    const aboutScore = sentenceNames.some(id => ctx.categories.scored.has(id))
      || SCORE_CLAIM.test(maskedSentence) || SCORE_WORD.test(maskedSentence) || PERFORM_WORD.test(maskedSentence);
    if (judgement && aboutScore && !verbatim) {
      add('judgement', `Do not describe a score as "${judgement[0].toLowerCase()}": describe it only by its number ` +
        'or its level label (for example Good or Developing).', sentence);
    }

    // Check 17: the model parts give scores as numbers only (no fact gives
    // them the level of a dimension score).
    if (LEVEL_CHECKED_PARTS.has(section) && !verbatim) {
      for (const label of checkLevelLabels(maskedSentence, cited.map(f => f.text.toLowerCase()))) {
        add('levelLabel', `Do not write the level label "${label}": describe a score only by its number.`, sentence);
      }
    }

    // Check 7
    const causal = mayBeRelated ? sentence.match(CAUSAL) : null;
    if (causal) {
      add('causal', `Do not write "${causal[0]}": a cited fact says "may be related", and "${causal[0]}" claims a cause. ` +
        'Use the fact\'s own wording (for example "so") or leave the explanation out.', sentence);
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/** Every part of a full narrative; `options.parts` narrows the check to some of them. */
const ALL_PARTS = ['headline', ...SECTION_KEYS];

export function validateNarrative(narrative, facts, { parts: partNames = ALL_PARTS } = {}) {
  const factList = Array.isArray(facts) ? facts : [];
  const contextFacts = factList.filter(f => f.kind === 'context');
  const dimensionMatch = contextFacts.map(f => f.text.match(C2_DIMENSIONS)).find(Boolean);
  const ctx = {
    byId: new Map(factList.map(f => [f.id, f])),
    contextFacts,
    dimensionCount: dimensionMatch ? Number(dimensionMatch[1]) : null,
    categories: categorize(factList),
  };

  if (narrative === null || typeof narrative !== 'object' || Array.isArray(narrative)) {
    const detail = 'The narrative is not an object with a headline and sections.';
    return { ok: false, errors: [{ section: null, sentence: null, rule: 'shape', detail }] };
  }

  const sections = narrative.sections !== null && typeof narrative.sections === 'object' ? narrative.sections : {};
  const parts = partNames.map(key => [key, key === 'headline' ? narrative.headline : sections[key]]);

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
