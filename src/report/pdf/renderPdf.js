/**
 * jsPDF renderer (docs/ai-report-spec.md, Step 6): replays layoutReport's
 * pages with Liberation Sans. It decides nothing about content or position;
 * it only supplies the font's widths to the layout and draws the result.
 *
 * fonts: { regular, bold } as base64 TTF data. jsPDF embeds only the glyphs
 * that are used.
 */

import { jsPDF } from 'jspdf';
import { layoutReport, STYLES } from './layout.js';

export const FONT_FAMILY = 'LiberationSans';

const COLORS = { text: [17, 24, 39], muted: [107, 114, 128] };
const RULE_COLOR = [209, 213, 219];

export function addFonts(pdf, fonts) {
  pdf.addFileToVFS('LiberationSans-Regular.ttf', fonts.regular);
  pdf.addFont('LiberationSans-Regular.ttf', FONT_FAMILY, 'normal');
  pdf.addFileToVFS('LiberationSans-Bold.ttf', fonts.bold);
  pdf.addFont('LiberationSans-Bold.ttf', FONT_FAMILY, 'bold');
}

/** drawReport(doc, fonts) → { pdf, pages }: the jsPDF document and the layout it drew. */
export function drawReport(doc, fonts) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  addFonts(pdf, fonts);

  const setStyle = style => {
    const s = STYLES[style];
    pdf.setFont(FONT_FAMILY, s.font === 'bold' ? 'bold' : 'normal');
    pdf.setFontSize(s.size);
    pdf.setTextColor(...COLORS[s.color]);
  };
  const measure = (text, style) => {
    setStyle(style);
    return pdf.getTextWidth(text);
  };

  const pages = layoutReport(doc, measure);
  pages.forEach((page, i) => {
    if (i > 0) pdf.addPage();
    for (const op of page.ops) {
      if (op.kind === 'text') {
        setStyle(op.style);
        pdf.text(op.text, op.x, op.y);
      } else {
        pdf.setDrawColor(...RULE_COLOR);
        pdf.setLineWidth(0.3);
        pdf.line(op.x1, op.y1, op.x2, op.y2);
      }
    }
  });
  pdf.setProperties({ title: doc.title });
  return { pdf, pages };
}

/** renderReportPdf(doc, fonts) → Blob (application/pdf). */
export function renderReportPdf(doc, fonts) {
  return drawReport(doc, fonts).pdf.output('blob');
}
