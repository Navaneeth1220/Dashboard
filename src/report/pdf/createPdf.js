/**
 * The lazily loaded part of the PDF export (docs/ai-report-spec.md, Step 6):
 * jsPDF, the renderer and the bundled fonts. download.js imports this module
 * with import() on the first click, so none of it is in the main bundle. The
 * fonts are fetched from the app's own origin (Vite emits them as assets),
 * so this works offline.
 */

import regularUrl from '../../assets/fonts/LiberationSans-Regular.ttf?url';
import boldUrl from '../../assets/fonts/LiberationSans-Bold.ttf?url';
import { renderReportPdf } from './renderPdf.js';

async function base64Of(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Font not loaded: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

let fonts = null;   // loaded once per page

/** createReportPdf(doc) → Blob */
export async function createReportPdf(doc) {
  fonts ??= Promise.all([base64Of(regularUrl), base64Of(boldUrl)])
    .then(([regular, bold]) => ({ regular, bold }))
    .catch(error => { fonts = null; throw error; });
  return renderReportPdf(doc, await fonts);
}
