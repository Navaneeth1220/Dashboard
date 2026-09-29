/**
 * The parts of a report as the user sees them (docs/ai-report-spec.md,
 * Step 6): shared by NarrativePanel, its Copy text and the PDF, so the three
 * cannot disagree about which parts are shown, their text or their label.
 *
 * Pure. `edits` is the panel's edit state ({ [key]: text }); an edit that
 * equals the generated text is no edit. On `failed` and `unavailable` only
 * the generated sections exist, whatever `edits` holds for the model parts.
 */

import { SECTION_KEYS, GENERATED_KEYS } from './schema.js';
import { SECTION_TITLES, NARRATIVE_WORDING as W } from '../data/reportWording.js';

/**
 * reportParts(result, edits?) →
 *   [{ key, title, text, generatedText, factIds, origin, edited, label }]
 * label: 'ai' | 'generated' | 'edited' (a key of NARRATIVE_WORDING.label).
 */
export function reportParts(result, edits = {}) {
  if (!result) return [];
  const entries = result.status === 'ok'
    ? ['headline', ...SECTION_KEYS].map(key => [key, key === 'headline' ? result.narrative.headline : result.narrative.sections[key]])
    : GENERATED_KEYS.map(key => [key, result.generated[key]]);

  return entries.map(([key, part]) => {
    const edited = edits[key] !== undefined && edits[key] !== part.text;
    const origin = result.origin[key];
    return {
      key,
      title: SECTION_TITLES[key],
      text: edited ? edits[key] : part.text,
      generatedText: part.text,
      factIds: part.factIds ?? [],
      origin,
      edited,
      label: edited ? 'edited' : origin,
    };
  });
}

/**
 * The provenance lines under a report (Copy's footer, the PDF's closing).
 * `extraGenerated`: titles of further generated content (the PDF's scores
 * table), listed first in the generated line.
 */
export function provenanceLines(parts, model, extraGenerated = []) {
  const ai = parts.filter(p => p.origin === 'ai').map(p => p.title);
  const generated = [...extraGenerated, ...parts.filter(p => p.origin === 'generated').map(p => p.title)];
  const edited = parts.filter(p => p.edited).map(p => p.title);
  return [
    ...(ai.length > 0 ? [W.footer.ai(model, ai)] : []),
    ...(generated.length > 0 ? [W.footer.generated(generated)] : []),
    ...(edited.length > 0 ? [W.footer.edited(edited)] : []),
  ];
}
