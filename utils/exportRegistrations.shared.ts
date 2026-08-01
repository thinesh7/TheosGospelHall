import JSZip from 'jszip';
import * as XLSX from 'xlsx-js-style';
import {
  computeAge,
  formatDateDisplay,
  formatISTFileTimestamp,
  formatPhoneDisplay,
  formatTimestampIST,
  PROGRAMS,
  ProgramId,
  Registration,
  STATUS_LABELS,
} from './registrations';

export type ExportFormat = 'excel' | 'pdf';
export type ExportStatusOption = 'all' | 'registered' | 'accepted' | 'deleted';

// Note: the 'deleted' key is the internal ExportStatusOption/data-model name
// (matches Registration.isDeleted) — only its display label is "Rejected".
export const STATUS_OPTION_LABELS: Record<ExportStatusOption, string> = {
  all: 'All',
  registered: 'Registered',
  accepted: 'Accepted',
  deleted: 'Rejected',
};

export interface ExportDataSets {
  registered: Registration[];
  accepted: Registration[];
  deleted: Registration[];
}

export interface Section {
  title: string;
  registrations: Registration[];
}

const COLUMNS = [
  { header: 'Name', minWidth: 22 },
  { header: 'Age', minWidth: 6 },
  { header: 'Date of Birth', minWidth: 16 },
  { header: 'Gender', minWidth: 10 },
  { header: 'Mobile Number', minWidth: 18 },
  { header: 'Place', minWidth: 18 },
  { header: 'Church Details', minWidth: 22 },
  { header: 'Status', minWidth: 14 },
  { header: 'Registered On (IST)', minWidth: 22 },
];

export function buildSections(status: ExportStatusOption, dataSets: ExportDataSets): Section[] {
  if (status === 'all') {
    return [
      { title: STATUS_OPTION_LABELS.registered, registrations: dataSets.registered },
      { title: STATUS_OPTION_LABELS.accepted, registrations: dataSets.accepted },
      { title: STATUS_OPTION_LABELS.deleted, registrations: dataSets.deleted },
    ].filter(section => section.registrations.length > 0);
  }
  return [{ title: STATUS_OPTION_LABELS[status], registrations: dataSets[status] }];
}

export function countForStatus(status: ExportStatusOption, dataSets: ExportDataSets): number {
  if (status === 'all') {
    return dataSets.registered.length + dataSets.accepted.length + dataSets.deleted.length;
  }
  return dataSets[status].length;
}

// A soft-deleted registration keeps whatever status it last had (registered/
// follow-up/accepted) — isDeleted is a separate flag — so the displayed
// status must check isDeleted first rather than printing the raw field.
function displayStatusLabel(r: Registration): string {
  return r.isDeleted ? STATUS_OPTION_LABELS.deleted : STATUS_LABELS[r.status];
}

function buildRows(registrations: Registration[]): (string | number)[][] {
  return registrations.map(r => [
    r.name,
    computeAge(r.dob) ?? '',
    formatDateDisplay(r.dob),
    r.gender,
    formatPhoneDisplay(r.phone),
    r.place,
    r.churchDetails || '-',
    displayStatusLabel(r),
    formatTimestampIST(r.createdAt),
  ]);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildExportFileBaseName(programId: ProgramId, status: ExportStatusOption): string {
  const sanitizedProgram = PROGRAMS[programId].label.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const sanitizedStatus = STATUS_OPTION_LABELS[status].replace(/[^a-zA-Z0-9]+/g, '_');
  return `${sanitizedProgram}_${sanitizedStatus}_${formatISTFileTimestamp()}`;
}

const THIN_BORDER_DARK = {
  top: { style: 'thin' as const, color: { rgb: '333333' } },
  bottom: { style: 'thin' as const, color: { rgb: '333333' } },
  left: { style: 'thin' as const, color: { rgb: '333333' } },
  right: { style: 'thin' as const, color: { rgb: '333333' } },
};

const THIN_BORDER_LIGHT = {
  top: { style: 'thin' as const, color: { rgb: 'CCCCCC' } },
  bottom: { style: 'thin' as const, color: { rgb: 'CCCCCC' } },
  left: { style: 'thin' as const, color: { rgb: 'CCCCCC' } },
  right: { style: 'thin' as const, color: { rgb: 'CCCCCC' } },
};

// xlsx-js-style's writer doesn't implement the community "!freeze" shorthand,
// so each sheet's header row is frozen by patching the generated sheet XML
// directly (an xlsx file is just a zip of XML parts) after XLSX.write() runs.
async function freezeHeaderRows(base64Xlsx: string): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(base64Xlsx, { base64: true });
    const sheetFiles = Object.keys(zip.files).filter(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));

    for (const sheetPath of sheetFiles) {
      const sheetFile = zip.file(sheetPath);
      if (!sheetFile) continue;
      let xml = await sheetFile.async('string');
      if (!/<sheetView[^>]*\/>/.test(xml)) continue;
      xml = xml.replace(
        /<sheetView([^>]*)\/>/,
        '<sheetView$1><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView>'
      );
      zip.file(sheetPath, xml);
    }
    return await zip.generateAsync({ type: 'base64' });
  } catch {
    return base64Xlsx;
  }
}

function buildWorksheetForRegistrations(registrations: Registration[]) {
  const headers = COLUMNS.map(c => c.header);
  const rows = buildRows(registrations);
  const aoa: (string | number)[][] = [headers, ...rows];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const range = XLSX.utils.decode_range(ws['!ref'] as string);

  const headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
    fill: { fgColor: { rgb: '0F3460' }, patternType: 'solid' as const },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
    border: THIN_BORDER_DARK,
  };
  const cellStyle = {
    font: { sz: 10 },
    alignment: { horizontal: 'left' as const, vertical: 'center' as const },
    border: THIN_BORDER_LIGHT,
  };

  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;
      cell.s = r === 0 ? headerStyle : cellStyle;
    }
  }

  ws['!cols'] = COLUMNS.map((col, i) => {
    const maxLen = aoa.reduce((max, row) => Math.max(max, String(row[i] ?? '').length), col.header.length);
    return { wch: Math.min(Math.max(maxLen + 2, col.minWidth), 45) };
  });
  ws['!rows'] = [{ hpt: 22 }];

  return ws;
}

export async function buildExcelBase64(sections: Section[]): Promise<string> {
  const wb = XLSX.utils.book_new();
  for (const section of sections) {
    const ws = buildWorksheetForRegistrations(section.registrations);
    // Excel worksheet names are capped at 31 characters and can't contain : \ / ? * [ ]
    XLSX.utils.book_append_sheet(wb, ws, section.title.slice(0, 31));
  }
  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;
  return freezeHeaderRows(base64);
}

export function buildPdfHtml(programId: ProgramId, status: ExportStatusOption, sections: Section[]): string {
  const programLabel = PROGRAMS[programId].label;
  const generatedAt = formatTimestampIST(Date.now());
  const totalCount = sections.reduce((sum, s) => sum + s.registrations.length, 0);
  // Chrome's "Save as PDF" print destination suggests document.title as the
  // filename — without a <title>, the save dialog's filename field comes up
  // blank. Matches the Excel export's filename for the same report.
  const fileBaseName = buildExportFileBaseName(programId, status);

  const sectionsHtml = sections
    .map((section, idx) => {
      const rowsHtml = section.registrations
        .map(
          (r, rIdx) => `
            <tr>
              <td>${rIdx + 1}</td>
              <td>${escapeHtml(r.name)}</td>
              <td>${computeAge(r.dob) ?? '-'}</td>
              <td>${escapeHtml(formatDateDisplay(r.dob))}</td>
              <td>${escapeHtml(r.gender)}</td>
              <td>${escapeHtml(formatPhoneDisplay(r.phone))}</td>
              <td>${escapeHtml(r.place)}</td>
              <td>${escapeHtml(r.churchDetails || '-')}</td>
              <td>${displayStatusLabel(r)}</td>
              <td>${formatTimestampIST(r.createdAt)}</td>
            </tr>`
        )
        .join('');

      return `
      <div class="${idx > 0 ? 'section pagebreak' : 'section'}">
        <h2 class="sectionTitle">${escapeHtml(section.title)} (${section.registrations.length})</h2>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Name</th><th>Age</th><th>Date of Birth</th><th>Gender</th>
              <th>Mobile Number</th><th>Place</th><th>Church Details</th><th>Status</th><th>Registered On (IST)</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(fileBaseName)}</title>
    <style>
      @page { size: A4 landscape; margin: 28px; }
      /* Browsers drop background colors/shading from print & "Save as PDF"
         output by default (an ink-saving default) — this opts back in, so
         the navy header/alternating row shading matches native's rendering. */
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { font-family: Helvetica, Arial, sans-serif; color: #1a1a2e; margin: 0; }
      .title { font-size: 20px; font-weight: bold; color: #0f3460; margin-bottom: 4px; }
      .meta { font-size: 11px; color: #666; margin-bottom: 2px; }
      .divider { height: 2px; background: #0f3460; margin: 12px 0 16px; }
      .sectionTitle { font-size: 15px; font-weight: bold; color: #0f3460; margin: 0 0 8px; }
      .pagebreak { page-break-before: always; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 10px; text-align: left; vertical-align: top; }
      th { background-color: #0f3460; color: #fff; font-weight: bold; }
      tbody tr:nth-child(even) { background-color: #f5f7fa; }
    </style>
  </head>
  <body>
    <div class="title">${escapeHtml(programLabel)}</div>
    <div class="meta">Registrations Report — ${STATUS_OPTION_LABELS[status]}</div>
    <div class="meta">Generated On: ${generatedAt} (IST)</div>
    <div class="meta">Total Registrations: ${totalCount}</div>
    <div class="divider"></div>
    ${sectionsHtml}
  </body>
</html>`;
}
