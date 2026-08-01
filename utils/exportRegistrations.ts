import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
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

// Android's Storage Access Framework requires the admin to precisely
// navigate to a real folder in the system picker (its "Downloads" shortcut
// resolves to a provider that rejects writes outright, and even the regular
// Download folder can hit the same restriction on some Android versions) —
// too fragile for a reliable "download" action. The share sheet is the
// standard, well-tested path on both platforms: it hands the generated file
// to the OS, which offers "Save to Downloads"/Files/Drive/etc, and Android
// performs that save through its own document-creation flow rather than our
// raw SAF call, sidestepping the restriction entirely.
async function shareFromCache(base64: string, fileName: string, mimeType: string): Promise<void> {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: 'base64' });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType });
}

async function saveExportedFile(base64: string, fileNameNoExt: string, extension: 'xlsx' | 'pdf', mimeType: string): Promise<void> {
  await shareFromCache(base64, `${fileNameNoExt}.${extension}`, mimeType);
}

async function exportToExcel(programId: ProgramId, status: ExportStatusOption, sections: Section[]): Promise<void> {
  const base64 = await buildExcelBase64(sections);
  const fileNameNoExt = buildExportFileBaseName(programId, status);
  await saveExportedFile(base64, fileNameNoExt, 'xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

async function exportToPdf(programId: ProgramId, status: ExportStatusOption, sections: Section[]): Promise<void> {
  const html = buildPdfHtml(programId, status, sections);
  // A4 landscape at 72 PPI (842x595pt); printToFileAsync has no separate
  // `orientation` option — width/height alone determine the page dimensions.
  const { base64 } = await Print.printToFileAsync({ html, width: 842, height: 595, base64: true });
  if (!base64) throw new Error('Could not generate the PDF file.');

  const fileNameNoExt = buildExportFileBaseName(programId, status);
  await saveExportedFile(base64, fileNameNoExt, 'pdf', 'application/pdf');
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
