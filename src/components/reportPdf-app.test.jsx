/**
 * PDF export in the App (docs/ai-report-spec.md, Step 6): the PDF's client
 * and assessment date come from the snapshot the report was generated from,
 * never from live App state; a changed assessment disables the download.
 * fetch is stubbed so Ollama is unavailable and only the generated sections
 * are shown.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App.jsx';
import { downloadReportPdf } from '../report/pdf/download.js';
import { buildReportDocument } from '../report/pdf/reportDocument.js';
import { NARRATIVE_WORDING as W } from '../data/reportWording.js';

vi.mock('../report/pdf/download.js', () => ({ downloadReportPdf: vi.fn(async () => {}) }));

beforeEach(() => {
  downloadReportPdf.mockClear();
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
});
afterEach(() => vi.unstubAllGlobals());

const clientField = () => screen.getByPlaceholderText('e.g. Client A');
const pdfButton = () => screen.getByRole('button', { name: W.downloadPdf });

describe('Download PDF in the App', () => {
  it('the header comes from the generated snapshot; editing the client makes the draft stale and disables the download', async () => {
    const { container } = render(<App />);
    fireEvent.change(clientField(), { target: { value: 'Westmaas' } });
    fireEvent.change(container.querySelector('input[type="date"]'), { target: { value: '2026-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: W.generate }));
    await waitFor(() => expect(pdfButton()).toBeEnabled());

    fireEvent.click(pdfButton());
    const input = downloadReportPdf.mock.calls[0][0];
    const doc = buildReportDocument(input);
    expect(doc.meta.slice(0, 2).map(m => m.value)).toEqual(['Westmaas', '2026-01-01']);
    expect(doc.filename).toBe('Westmaas_2026-01-01_report.pdf');
    expect(input.generatedAt).toEqual(expect.any(String));

    fireEvent.change(clientField(), { target: { value: 'Oudendijk' } });
    expect(pdfButton()).toBeDisabled();
    expect(screen.getByText(W.regenerateFirst)).toBeInTheDocument();
  }, 30_000);   // the whole App renders; slow when the suite runs in parallel
});
