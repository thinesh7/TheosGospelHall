import { ProgramId } from './registrations';
import {
  buildExcelBase64,
  buildExportFileBaseName,
  buildPdfHtml,
  buildSections,
  ExportDataSets,
  ExportFormat,
  ExportStatusOption,
  Section,
} from './exportRegistrations.shared';

export { countForStatus, STATUS_OPTION_LABELS } from './exportRegistrations.shared';
export type { ExportDataSets, ExportFormat, ExportStatusOption } from './exportRegistrations.shared';

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64);
  const byteNumbers = new Array<number>(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function exportToExcel(programId: ProgramId, status: ExportStatusOption, sections: Section[]): Promise<void> {
  const base64 = await buildExcelBase64(sections);
  const fileName = `${buildExportFileBaseName(programId, status)}.xlsx`;
  downloadBlob(base64ToBlob(base64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), fileName);
}

// The web platform has no equivalent to expo-print's file-generating PDF
// renderer, and no native share sheet — the standard browser substitute is
// rendering the same HTML report in a hidden iframe and invoking the
// browser's own print dialog, where "Save as PDF" is a built-in destination
// on every major browser. This is a real UX delta from native (a share sheet
// with a ready-made file vs. an extra "Save as PDF" click), called out
// deliberately rather than papered over.
function exportToPdf(programId: ProgramId, status: ExportStatusOption, sections: Section[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const html = buildPdfHtml(programId, status, sections);
    // Chrome's "Save as PDF" filename comes from the outer TAB's
    // document.title, not the printed iframe's own <title> — the iframe's
    // title has no effect on it. Overriding the app's title for the
    // duration of the print call is the only reliable way to control it.
    const fileBaseName = buildExportFileBaseName(programId, status);
    const originalTitle = document.title;
    document.title = fileBaseName;
    // A real navigation (iframe.src to a Blob URL), not document.write() on
    // an about:blank shell — Chrome doesn't reliably scope
    // contentWindow.print() to a document.write()'d iframe and can print the
    // parent tab instead (visible as the parent page's own URL in the print
    // preview's header/footer). Navigating the iframe to its own URL gives
    // it a real, distinct document that print() targets correctly.
    const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    // A 0x0 iframe lays out to an empty box, and Chrome's print pipeline
    // uses that box for the print preview — the report renders "successfully"
    // into zero pixels, so the resulting PDF/print preview comes out blank.
    // Real dimensions (kept off-screen via a large negative offset, not a
    // zero size) are required for the content to actually show up.
    iframe.style.top = '0';
    iframe.style.left = '-10000px';
    iframe.style.width = '297mm';
    iframe.style.height = '210mm';
    iframe.style.border = '0';

    const cleanup = () => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      URL.revokeObjectURL(blobUrl);
      document.title = originalTitle;
    };

    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) {
        cleanup();
        reject(new Error('Could not prepare the print window.'));
        return;
      }
      try {
        win.focus();
        win.print();
        resolve();
      } catch (err) {
        cleanup();
        reject(err instanceof Error ? err : new Error('Could not generate the PDF file.'));
        return;
      }
      // 'afterprint' fires once the browser's print dialog closes (Save or
      // Cancel either way) — that's the correct signal to tear the iframe
      // down. The fixed timeout is only a fallback for browsers that don't
      // fire it for iframe-hosted windows, sized generously so it doesn't
      // rip the document out from under a slow render of a large report.
      let cleaned = false;
      const cleanupOnce = () => {
        if (cleaned) return;
        cleaned = true;
        cleanup();
      };
      win.addEventListener('afterprint', cleanupOnce, { once: true });
      setTimeout(cleanupOnce, 30000);
    };
    iframe.onerror = () => {
      cleanup();
      reject(new Error('Could not prepare the print window.'));
    };

    iframe.src = blobUrl;
    document.body.appendChild(iframe);
  });
}

export async function exportRegistrations(
  format: ExportFormat,
  programId: ProgramId,
  status: ExportStatusOption,
  dataSets: ExportDataSets
): Promise<void> {
  const sections = buildSections(status, dataSets);
  if (format === 'excel') {
    await exportToExcel(programId, status, sections);
  } else {
    await exportToPdf(programId, status, sections);
  }
}
