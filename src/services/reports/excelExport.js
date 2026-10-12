import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO = path.join(__dirname, '../../assets/images/logo.png');

const C = {
  noir: 'FF0B0B0D',
  gold: 'FFD4AF37',
  goldDeep: 'FF9A7B1C',
  cream: 'FFFBF8F1',
  creamDark: 'FFF4EDDC',
  line: 'FFE7DCC3',
  text: 'FF2B2620',
  muted: 'FF776D5E',
  white: 'FFFFFFFF',
};

const NUMFMT = {
  money: '"₹"#,##0.00;[Red]-"₹"#,##0.00',
  int: '#,##0',
  percent: '0.00%',
  date: 'dd-mmm-yyyy',
};

const toCell = (v, type) => {
  if (v === null || v === undefined || v === '') return type === 'money' || type === 'int' ? 0 : '';
  if (type === 'date') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
    return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : String(v);
  }
  if (type === 'money' || type === 'int' || type === 'percent') return Number(v) || 0;
  return String(v);
};

/**
 * Build a styled multi-sheet workbook from a report dataset (see reportData.js).
 */
export const renderReportXlsx = async (report) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Jayrup Commerce';
  wb.created = new Date();
  wb.company = report.business?.legalName || 'Jayrup';
  wb.title = report.title;

  const logoId = fs.existsSync(LOGO) ? wb.addImage({ filename: LOGO, extension: 'png' }) : null;

  // ───────── Summary sheet ─────────
  const summary = wb.addWorksheet('Summary', { views: [{ showGridLines: false }], properties: { tabColor: { argb: C.gold } } });
  summary.columns = [{ width: 4 }, { width: 34 }, { width: 26 }, { width: 4 }];
  writeTitleBlock(summary, report, 4, logoId);
  let r = 7;
  summary.getCell(`B${r}`).value = 'KEY METRICS';
  summary.getCell(`B${r}`).font = { bold: true, size: 10, color: { argb: C.goldDeep } };
  r += 1;
  (report.kpis || []).forEach((k) => {
    const lc = summary.getCell(`B${r}`);
    const vc = summary.getCell(`C${r}`);
    lc.value = k.label;
    vc.value = k.type === 'percentRaw' ? Number(k.value) / 100 : Number(k.value) || 0;
    vc.numFmt = k.type === 'money' ? NUMFMT.money : k.type === 'percentRaw' ? NUMFMT.percent : NUMFMT.int;
    [lc, vc].forEach((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r % 2 ? C.cream : C.white } };
      c.border = { bottom: { style: 'thin', color: { argb: C.line } } };
      c.alignment = { vertical: 'middle' };
    });
    lc.font = { size: 10, color: { argb: C.text } };
    vc.font = { bold: true, size: 11, color: { argb: C.noir } };
    vc.alignment = { horizontal: 'right', vertical: 'middle' };
    summary.getRow(r).height = 20;
    r += 1;
  });
  if (report.notes?.length) {
    r += 1;
    summary.getCell(`B${r}`).value = 'NOTES';
    summary.getCell(`B${r}`).font = { bold: true, size: 10, color: { argb: C.goldDeep } };
    r += 1;
    report.notes.forEach((n) => {
      summary.mergeCells(`B${r}:C${r}`);
      const c = summary.getCell(`B${r}`);
      c.value = `• ${n}`;
      c.alignment = { wrapText: true, vertical: 'top' };
      c.font = { size: 9, color: { argb: C.muted } };
      summary.getRow(r).height = 30;
      r += 1;
    });
  }
  r += 1;
  summary.getCell(`B${r}`).value = 'Sheets in this workbook:';
  summary.getCell(`B${r}`).font = { size: 9, color: { argb: C.muted } };
  r += 1;
  report.sheets.forEach((s) => {
    summary.getCell(`B${r}`).value = { text: `→ ${s.name} (${s.rows.length} rows)`, hyperlink: `#'${safeSheetName(s.name)}'!A1` };
    summary.getCell(`B${r}`).font = { size: 9, color: { argb: C.goldDeep }, underline: true };
    r += 1;
  });

  // ───────── Data sheets ─────────
  report.sheets.forEach((sheet) => {
    const ws = wb.addWorksheet(safeSheetName(sheet.name), {
      views: [{ state: 'frozen', ySplit: 6, showGridLines: false }],
      pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } },
      headerFooter: { oddFooter: `&L${report.title} · ${report.period}&RPage &P of &N` },
    });
    const cols = sheet.columns;
    ws.columns = cols.map((c) => ({ key: c.key, width: c.width || 14 }));
    writeTitleBlock(ws, { ...report, title: `${report.title} — ${sheet.name}` }, cols.length, logoId);

    const headerRow = ws.getRow(6);
    cols.forEach((c, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = c.header;
      cell.font = { bold: true, size: 9, color: { argb: C.gold } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.noir } };
      cell.alignment = { vertical: 'middle', horizontal: ['money', 'int', 'percent'].includes(c.type) ? 'right' : 'left', wrapText: true };
      cell.border = { bottom: { style: 'medium', color: { argb: C.gold } } };
    });
    headerRow.height = 26;

    sheet.rows.forEach((row, idx) => {
      const xr = ws.getRow(7 + idx);
      cols.forEach((c, i) => {
        const cell = xr.getCell(i + 1);
        cell.value = toCell(row[c.key], c.type);
        if (NUMFMT[c.type]) cell.numFmt = NUMFMT[c.type];
        cell.font = { size: 9, color: { argb: C.text } };
        cell.alignment = { vertical: 'middle', horizontal: ['money', 'int', 'percent'].includes(c.type) ? 'right' : 'left' };
        if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.cream } };
        cell.border = { bottom: { style: 'hair', color: { argb: C.line } } };
      });
      xr.height = 18;
    });

    if (sheet.rows.length === 0) {
      ws.mergeCells(7, 1, 7, cols.length);
      const c = ws.getCell(7, 1);
      c.value = 'No records for the selected period.';
      c.font = { italic: true, size: 9, color: { argb: C.muted } };
      c.alignment = { horizontal: 'center' };
    } else {
      ws.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6 + sheet.rows.length, column: cols.length } };
    }

    if (sheet.totals && sheet.rows.length) {
      const tr = ws.getRow(7 + sheet.rows.length);
      const firstRow = 7;
      const lastRow = 6 + sheet.rows.length;
      cols.forEach((c, i) => {
        const cell = tr.getCell(i + 1);
        if (i === 0) cell.value = 'TOTAL';
        else if (sheet.totals[c.key] !== undefined && ['money', 'int'].includes(c.type)) {
          const colLetter = ws.getColumn(i + 1).letter;
          cell.value = { formula: `SUBTOTAL(9,${colLetter}${firstRow}:${colLetter}${lastRow})`, result: sheet.totals[c.key] };
          cell.numFmt = NUMFMT[c.type];
        }
        cell.font = { bold: true, size: 9.5, color: { argb: C.noir } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.creamDark } };
        cell.border = { top: { style: 'medium', color: { argb: C.gold } }, bottom: { style: 'medium', color: { argb: C.gold } } };
        cell.alignment = { horizontal: ['money', 'int'].includes(c.type) ? 'right' : 'left', vertical: 'middle' };
      });
      tr.height = 22;
    }
  });

  return wb.xlsx.writeBuffer();
};

const writeTitleBlock = (ws, report, span, logoId) => {
  const lastCol = Math.max(span, 3);
  ws.getRow(1).height = 30;
  ws.getRow(2).height = 18;
  ws.getRow(3).height = 16;
  ws.getRow(4).height = 14;
  for (let r = 1; r <= 4; r++) {
    for (let c = 1; c <= lastCol; c++) {
      ws.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.noir } };
    }
  }
  if (logoId !== null && logoId !== undefined) {
    ws.addImage(logoId, { tl: { col: 0.15, row: 0.2 }, ext: { width: 54, height: 54 } });
  }
  const startCol = logoId !== null && logoId !== undefined ? 2 : 1;
  ws.mergeCells(1, startCol, 1, lastCol);
  const t = ws.getCell(1, startCol);
  t.value = `${report.business?.brandName?.toUpperCase() || 'JAYRUP'}  ·  ${report.title}`;
  t.font = { bold: true, size: 15, color: { argb: C.gold } };
  t.alignment = { vertical: 'middle' };

  ws.mergeCells(2, startCol, 2, lastCol);
  const s = ws.getCell(2, startCol);
  const b = report.business || {};
  s.value = `${b.legalName || ''}${b.gstin ? ` · GSTIN ${b.gstin}` : ''} · ${[b.city, b.state].filter(Boolean).join(', ')}`;
  s.font = { size: 9, color: { argb: 'FFCFC6B3' } };

  ws.mergeCells(3, startCol, 3, lastCol);
  const p = ws.getCell(3, startCol);
  p.value = `Period: ${report.period}    ·    Generated: ${new Date(report.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;
  p.font = { size: 9, color: { argb: 'FFCFC6B3' } };

  for (let c = 1; c <= lastCol; c++) {
    ws.getCell(5, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.gold } };
  }
  ws.getRow(5).height = 3;
};

const safeSheetName = (n) => String(n).replace(/[\\/?*[\]:]/g, '-').slice(0, 31);
