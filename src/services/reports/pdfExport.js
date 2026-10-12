import { createDoc, toBuffer, COLORS, FONT, box, brandBand, stampFooters, money, dateIN } from '../pdf/theme.js';

const fmt = (v, type) => {
  if (v === null || v === undefined || v === '') return type === 'money' ? money(0) : type === 'int' ? '0' : '';
  if (type === 'money') return money(v);
  if (type === 'int') return Number(v).toLocaleString('en-IN');
  if (type === 'percent') return `${(Number(v) * 100).toFixed(Number(v) * 100 % 1 ? 1 : 0)}%`;
  if (type === 'date') return dateIN(`${v}T00:00:00+05:30`);
  return String(v);
};

/**
 * Landscape A4 PDF version of any report dataset – branded header, KPI cards and paginated tables.
 */
export const renderReportPdf = async (report) => {
  const doc = createDoc({ layout: 'landscape', margin: 30, info: { Title: `${report.title} (${report.period})` } });
  const W = doc.page.width;
  const M = 30;
  const CW = W - M * 2;
  const bottom = doc.page.height - 44;

  const b = report.business || {};
  let y = brandBand(doc, {
    title: report.title.toUpperCase(),
    subtitle: `PERIOD: ${report.from} → ${report.to}`,
    height: 78,
    brandName: b.brandName,
    tagline: b.tagline,
  });
  y += 10;
  doc
    .font(FONT.regular)
    .fontSize(7.6)
    .fillColor(COLORS.muted)
    .text(
      `${b.legalName || 'Jayrup'}${b.gstin ? ` · GSTIN ${b.gstin}` : ''} · ${[b.addressLine1, b.city, b.state, b.postalCode].filter(Boolean).join(', ')} · Generated ${new Date(report.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
      M,
      y,
      { width: CW }
    );
  y += 18;

  // KPI cards
  const kpis = report.kpis || [];
  if (kpis.length) {
    const gap = 8;
    const cw = (CW - gap * (kpis.length - 1)) / kpis.length;
    kpis.forEach((k, i) => {
      const x = M + i * (cw + gap);
      box(doc, x, y, cw, 48, { fill: i === 0 ? COLORS.noir : COLORS.cream, stroke: i === 0 ? null : COLORS.line, radius: 8 });
      doc.font(FONT.semibold).fontSize(6.8).fillColor(i === 0 ? '#CFC6B3' : COLORS.muted).text(k.label.toUpperCase(), x + 10, y + 9, { width: cw - 20, characterSpacing: 0.7 });
      const v = k.type === 'money' ? money(k.value) : k.type === 'percentRaw' ? `${k.value}%` : Number(k.value || 0).toLocaleString('en-IN');
      doc.font(FONT.heavy).fontSize(14).fillColor(i === 0 ? COLORS.gold : COLORS.ink).text(v, x + 10, y + 22, { width: cw - 20, lineBreak: false, ellipsis: true });
    });
    y += 60;
  }

  (report.notes || []).forEach((n) => {
    doc.font(FONT.regular).fontSize(7.2).fillColor(COLORS.muted).text(`• ${n}`, M, y, { width: CW });
    y = doc.y + 2;
  });
  if (report.notes?.length) y += 6;

  for (const sheet of report.sheets) {
    if (sheet.pdfSkip) continue;
    let cols = sheet.columns;
    if (sheet.pdfColumns) cols = sheet.pdfColumns.map((k) => sheet.columns.find((c) => c.key === k)).filter(Boolean);
    if (cols.length > 13) cols = cols.slice(0, 13);
    const totalW = cols.reduce((s, c) => s + (c.width || 12), 0);
    const widths = cols.map((c) => ((c.width || 12) / totalW) * CW);

    const drawHead = (yy) => {
      box(doc, M, yy, CW, 20, { fill: COLORS.noir, radius: 4 });
      let x = M;
      cols.forEach((c, i) => {
        doc.font(FONT.bold).fontSize(6.6).fillColor(COLORS.gold).text(c.header.toUpperCase(), x + 4, yy + 7, {
          width: widths[i] - 8,
          align: ['money', 'int', 'percent'].includes(c.type) ? 'right' : 'left',
          lineBreak: false,
          ellipsis: true,
        });
        x += widths[i];
      });
      return yy + 20;
    };

    if (y + 70 > bottom) {
      doc.addPage();
      y = M;
    }
    doc.font(FONT.bold).fontSize(10).fillColor(COLORS.goldDeep).text(sheet.name.toUpperCase(), M, y, { characterSpacing: 1 });
    doc.font(FONT.regular).fontSize(7.2).fillColor(COLORS.muted).text(`${sheet.rows.length} record(s)`, M, y + 2, { width: CW, align: 'right' });
    y += 16;
    y = drawHead(y);

    if (!sheet.rows.length) {
      doc.font(FONT.regular).fontSize(8).fillColor(COLORS.muted).text('No records for the selected period.', M, y + 8, { width: CW, align: 'center' });
      y += 30;
      continue;
    }

    sheet.rows.forEach((row, idx) => {
      const rowH = 16;
      if (y + rowH > bottom) {
        doc.addPage();
        y = drawHead(M);
      }
      if (idx % 2 === 0) doc.save().rect(M, y, CW, rowH).fill(COLORS.cream).restore();
      let x = M;
      cols.forEach((c, i) => {
        doc.font(FONT.regular).fontSize(7.2).fillColor(COLORS.text).text(fmt(row[c.key], c.type), x + 4, y + 4.8, {
          width: widths[i] - 8,
          align: ['money', 'int', 'percent'].includes(c.type) ? 'right' : 'left',
          lineBreak: false,
          ellipsis: true,
        });
        x += widths[i];
      });
      y += rowH;
    });

    if (sheet.totals) {
      if (y + 20 > bottom) {
        doc.addPage();
        y = drawHead(M);
      }
      box(doc, M, y + 2, CW, 18, { fill: COLORS.goldSoft, radius: 3 });
      let x = M;
      cols.forEach((c, i) => {
        const v = i === 0 ? 'TOTAL' : sheet.totals[c.key] !== undefined && ['money', 'int'].includes(c.type) ? fmt(sheet.totals[c.key], c.type) : '';
        doc.font(FONT.bold).fontSize(7.4).fillColor(COLORS.ink).text(v, x + 4, y + 7.5, {
          width: widths[i] - 8,
          align: i !== 0 && ['money', 'int'].includes(c.type) ? 'right' : 'left',
          lineBreak: false,
        });
        x += widths[i];
      });
      y += 30;
    } else {
      y += 12;
    }
  }

  stampFooters(doc, { left: `${report.title} · ${report.period} · ${b.website || 'jayrup.in'} · Confidential – for internal & tax filing use` });
  return toBuffer(doc);
};
