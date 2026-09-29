/**
 * downloadReportPdf (docs/ai-report-spec.md, Step 6): builds the report
 * document, loads jsPDF and the fonts on first use, and saves the PDF under
 * the document's filename. No print dialog, no server.
 */

import { buildReportDocument } from './reportDocument.js';

/** Save a Blob as a file through a temporary link. */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking at once can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** downloadReportPdf({ result, edits, generatedAt, model }) → Promise, rejects if the PDF cannot be made. */
export async function downloadReportPdf(input, { save = saveBlob } = {}) {
  const doc = buildReportDocument(input);
  const { createReportPdf } = await import('./createPdf.js');
  save(await createReportPdf(doc), doc.filename);
}
