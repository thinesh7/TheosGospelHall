import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';
import * as XLSX from 'xlsx-js-style';
import { pdfLetterheadHtml, getPdfLogoDataUri, PDF_LETTERHEAD_CSS } from './pdfBranding';
import { formatISTFileTimestamp, formatTimestampIST } from './registrations';
import {
  Branch,
  computeAgeFromTimestamp,
  Family,
  formatAddressOneLine,
  formatDateOnly,
  formatPhoneDisplay,
  GENDER_LABELS,
  MARITAL_STATUS_LABELS,
  Member,
  MEMBERSHIP_STATUS_LABELS,
  RELATIONSHIP_LABELS,
} from './churchMembers';

export type ExportFormat = 'excel' | 'pdf';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

async function freezeHeaderRow(base64Xlsx: string): Promise<string> {
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

async function shareFromCache(base64: string, fileName: string, mimeType: string): Promise<void> {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: 'base64' });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType });
}

function buildFileBaseName(prefix: string): string {
  const sanitized = prefix.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `${sanitized}_${formatISTFileTimestamp()}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Member / family list export (respects branch + type + status + search)
// ─────────────────────────────────────────────────────────────────────────

const LIST_COLUMNS = [
  { header: 'Name', minWidth: 22 },
  { header: 'Gender', minWidth: 10 },
  { header: 'Branch', minWidth: 16 },
  { header: 'Family', minWidth: 22 },
  { header: 'Relationship', minWidth: 14 },
  { header: 'Date of Birth', minWidth: 16 },
  { header: 'Age', minWidth: 6 },
  { header: 'Phone Number', minWidth: 16 },
  { header: 'Baptism Date', minWidth: 16 },
  { header: 'Member Since', minWidth: 16 },
  { header: 'Marital Status', minWidth: 14 },
  { header: 'Marriage Date', minWidth: 16 },
  { header: 'Membership Status', minWidth: 16 },
  { header: 'Address', minWidth: 30 },
];

export interface ListExportRow {
  member: Member;
  branchName: string;
  familyName: string;
  address: string;
}

export function buildListExportRows(
  members: Member[],
  families: Family[],
  branches: Branch[]
): ListExportRow[] {
  const branchNameById = new Map(branches.map(b => [b.id, b.name]));
  const familyById = new Map(families.map(f => [f.id, f]));
  return members.map(m => {
    const family = m.familyId ? familyById.get(m.familyId) : undefined;
    const address = m.membershipType === 'SINGLE' ? m.address : family?.address;
    return {
      member: m,
      branchName: branchNameById.get(m.branchId) ?? m.branchId,
      familyName: family?.familyName ?? '',
      address: formatAddressOneLine(address ?? null),
    };
  });
}

function buildListRowValues(row: ListExportRow): (string | number)[] {
  const { member: m } = row;
  return [
    m.name,
    GENDER_LABELS[m.gender] ?? m.gender,
    row.branchName,
    row.familyName || '-',
    m.relationship ? RELATIONSHIP_LABELS[m.relationship] : '-',
    formatDateOnly(m.dateOfBirth),
    computeAgeFromTimestamp(m.dateOfBirth) ?? '',
    m.phoneNumber ? formatPhoneDisplay(m.phoneNumber) : '-',
    formatDateOnly(m.baptismDate),
    formatDateOnly(m.memberSince),
    m.maritalStatus ? MARITAL_STATUS_LABELS[m.maritalStatus] : '-',
    formatDateOnly(m.marriageDate),
    MEMBERSHIP_STATUS_LABELS[m.membershipStatus],
    row.address || '-',
  ];
}

function buildStyledWorksheet(headers: string[], columns: { header: string; minWidth: number }[], rows: (string | number)[][]) {
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

  ws['!cols'] = columns.map((col, i) => {
    const maxLen = aoa.reduce((max, row) => Math.max(max, String(row[i] ?? '').length), col.header.length);
    return { wch: Math.min(Math.max(maxLen + 2, col.minWidth), 45) };
  });
  ws['!rows'] = [{ hpt: 22 }];

  return ws;
}

function listRowsHtml(rows: ListExportRow[]): string {
  return rows
    .map((row, idx) => {
      const values = buildListRowValues(row);
      return `<tr>${[`${idx + 1}`, ...values.map(v => String(v))].map(v => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`;
    })
    .join('');
}

function listTableHtml(rows: ListExportRow[]): string {
  return `<table>
      <thead><tr><th>#</th>${LIST_COLUMNS.map(c => `<th>${escapeHtml(c.header)}</th>`).join('')}</tr></thead>
      <tbody>${listRowsHtml(rows)}</tbody>
    </table>`;
}

// familyRows must already be grouped by family (see expandFamilyMembersGrouped)
// so a family's members always stay together in the export. When both
// families and singles are present, each type gets its own Excel sheet /
// PDF section rather than being interleaved into one table.
export async function exportMemberList(
  format: ExportFormat,
  familyRows: ListExportRow[],
  singleRows: ListExportRow[],
  scopeLabel: string
): Promise<void> {
  const totalCount = familyRows.length + singleRows.length;
  if (totalCount === 0) throw new Error('No records available to export.');
  const splitSections = familyRows.length > 0 && singleRows.length > 0;

  if (format === 'excel') {
    const headers = LIST_COLUMNS.map(c => c.header);
    const wb = XLSX.utils.book_new();
    if (splitSections) {
      const familyWs = buildStyledWorksheet(headers, LIST_COLUMNS, familyRows.map(buildListRowValues));
      XLSX.utils.book_append_sheet(wb, familyWs, 'Families');
      const singleWs = buildStyledWorksheet(headers, LIST_COLUMNS, singleRows.map(buildListRowValues));
      XLSX.utils.book_append_sheet(wb, singleWs, 'Individuals');
    } else {
      const rows = familyRows.length > 0 ? familyRows : singleRows;
      const ws = buildStyledWorksheet(headers, LIST_COLUMNS, rows.map(buildListRowValues));
      XLSX.utils.book_append_sheet(wb, ws, 'Church Members'.slice(0, 31));
    }
    const base64raw = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;
    const base64 = await freezeHeaderRow(base64raw);
    const fileNameNoExt = buildFileBaseName(`ChurchMembers_${scopeLabel}`);
    await shareFromCache(base64, `${fileNameNoExt}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return;
  }

  const generatedAt = formatTimestampIST(Date.now());
  const logoDataUri = await getPdfLogoDataUri();
  const bodyHtml = splitSections
    ? `<div class="sectionTitle">Families (${familyRows.length})</div>${listTableHtml(familyRows)}
       <div class="sectionTitle">Individuals (${singleRows.length})</div>${listTableHtml(singleRows)}`
    : listTableHtml(familyRows.length > 0 ? familyRows : singleRows);

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: A4 landscape; margin: 24px; }
      * { box-sizing: border-box; }
      body { font-family: Helvetica, Arial, sans-serif; color: #1a1a2e; margin: 0; }
      .title { font-size: 20px; font-weight: bold; color: #0f3460; margin-bottom: 4px; }
      .meta { font-size: 11px; color: #666; margin-bottom: 2px; }
      .divider { height: 2px; background: #0f3460; margin: 12px 0 16px; }
      .sectionTitle { font-size: 14px; font-weight: bold; color: #0f3460; margin: 18px 0 8px; }
      table { width: 100%; border-collapse: collapse; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
      th, td { border: 1px solid #ccc; padding: 5px 6px; font-size: 9px; text-align: left; vertical-align: top; }
      th { background-color: #0f3460; color: #fff; font-weight: bold; }
      tbody tr:nth-child(even) { background-color: #f5f7fa; }
${PDF_LETTERHEAD_CSS}
    </style>
  </head>
  <body>
    ${pdfLetterheadHtml(logoDataUri, `
    <div class="title">Theos Gospel Hall — Church Members</div>
    <div class="meta">Scope: ${escapeHtml(scopeLabel)}</div>
    <div class="meta">Generated On: ${generatedAt} (IST)</div>
    <div class="meta">Total Records: ${totalCount}</div>
    `)}
    <div class="divider"></div>
    ${bodyHtml}
  </body>
</html>`;

  const { base64 } = await Print.printToFileAsync({ html, width: 842, height: 595, base64: true });
  if (!base64) throw new Error('Could not generate the PDF file.');
  const fileNameNoExt = buildFileBaseName(`ChurchMembers_${scopeLabel}`);
  await shareFromCache(base64, `${fileNameNoExt}.pdf`, 'application/pdf');
}

// ─────────────────────────────────────────────────────────────────────────
// Reports export (summary counts)
// ─────────────────────────────────────────────────────────────────────────

export interface ReportBranchRow {
  branchName: string;
  total: number;
  active: number;
  inactive: number;
  families: number;
  singles: number;
}

export interface ReportData {
  scopeLabel: string;
  total: number;
  active: number;
  inactive: number;
  families: number;
  singles: number;
  male: number;
  female: number;
  branchRows: ReportBranchRow[];
}

const REPORT_SUMMARY_COLUMNS = [
  { header: 'Metric', minWidth: 24 },
  { header: 'Count', minWidth: 12 },
];

const REPORT_BRANCH_COLUMNS = [
  { header: 'Branch', minWidth: 18 },
  { header: 'Total', minWidth: 8 },
  { header: 'Active', minWidth: 8 },
  { header: 'Inactive', minWidth: 8 },
  { header: 'Families', minWidth: 8 },
  { header: 'Individuals', minWidth: 8 },
];

export async function exportChurchMembersReport(format: ExportFormat, report: ReportData): Promise<void> {
  const summaryRows: (string | number)[][] = [
    ['Active Members', report.active],
    ['Families', report.families],
    ['Individual Members', report.singles],
    ['Inactive Members', report.inactive],
    ['Total Members', report.total],
    [GENDER_LABELS.MALE, report.male],
    [GENDER_LABELS.FEMALE, report.female],
  ];
  const branchRows: (string | number)[][] = report.branchRows.map(r => [
    r.branchName, r.total, r.active, r.inactive, r.families, r.singles,
  ]);

  if (format === 'excel') {
    const wb = XLSX.utils.book_new();
    const summaryWs = buildStyledWorksheet(REPORT_SUMMARY_COLUMNS.map(c => c.header), REPORT_SUMMARY_COLUMNS, summaryRows);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
    const branchWs = buildStyledWorksheet(REPORT_BRANCH_COLUMNS.map(c => c.header), REPORT_BRANCH_COLUMNS, branchRows);
    XLSX.utils.book_append_sheet(wb, branchWs, 'Branch-wise');
    const base64raw = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;
    const base64 = await freezeHeaderRow(base64raw);
    const fileNameNoExt = buildFileBaseName(`ChurchMembers_Report_${report.scopeLabel}`);
    await shareFromCache(base64, `${fileNameNoExt}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return;
  }

  const generatedAt = formatTimestampIST(Date.now());
  const logoDataUri = await getPdfLogoDataUri();
  const summaryHtml = summaryRows.map(([k, v]) => `<tr><td>${escapeHtml(String(k))}</td><td>${v}</td></tr>`).join('');
  const branchHtml = branchRows
    .map(r => `<tr>${r.map(v => `<td>${escapeHtml(String(v))}</td>`).join('')}</tr>`)
    .join('');

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: A4 portrait; margin: 28px; }
      * { box-sizing: border-box; }
      body { font-family: Helvetica, Arial, sans-serif; color: #1a1a2e; margin: 0; }
      .title { font-size: 20px; font-weight: bold; color: #0f3460; margin-bottom: 4px; }
      .meta { font-size: 11px; color: #666; margin-bottom: 2px; }
      .divider { height: 2px; background: #0f3460; margin: 12px 0 16px; }
      .sectionTitle { font-size: 15px; font-weight: bold; color: #0f3460; margin: 20px 0 8px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 11px; text-align: left; }
      th { background-color: #0f3460; color: #fff; font-weight: bold; }
      tbody tr:nth-child(even) { background-color: #f5f7fa; }
${PDF_LETTERHEAD_CSS}
    </style>
  </head>
  <body>
    ${pdfLetterheadHtml(logoDataUri, `
    <div class="title">Theos Gospel Hall — Church Members Report</div>
    <div class="meta">Scope: ${escapeHtml(report.scopeLabel)}</div>
    <div class="meta">Generated On: ${generatedAt} (IST)</div>
    `)}
    <div class="divider"></div>
    <div class="sectionTitle">Overall Summary</div>
    <table><thead><tr><th>Metric</th><th>Count</th></tr></thead><tbody>${summaryHtml}</tbody></table>
    <div class="sectionTitle">Branch-wise</div>
    <table>
      <thead><tr><th>Branch</th><th>Total</th><th>Active</th><th>Inactive</th><th>Families</th><th>Individuals</th></tr></thead>
      <tbody>${branchHtml}</tbody>
    </table>
  </body>
</html>`;

  const { base64 } = await Print.printToFileAsync({ html, width: 595, height: 842, base64: true });
  if (!base64) throw new Error('Could not generate the PDF file.');
  const fileNameNoExt = buildFileBaseName(`ChurchMembers_Report_${report.scopeLabel}`);
  await shareFromCache(base64, `${fileNameNoExt}.pdf`, 'application/pdf');
}
