import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, '../../assets');

export const COLORS = {
  ink: '#16130E',
  text: '#2B2620',
  muted: '#776D5E',
  faint: '#A79C88',
  line: '#E7DCC3',
  cream: '#FBF8F1',
  creamDark: '#F4EDDC',
  gold: '#C9A227',
  goldDeep: '#9A7B1C',
  goldSoft: '#F3E6BD',
  noir: '#0B0B0D',
  white: '#FFFFFF',
  green: '#1E7B45',
  greenSoft: '#E3F3E9',
  red: '#B3261E',
  redSoft: '#FBE9E7',
  amber: '#B26A00',
  amberSoft: '#FFF2DB',
};

export const FONT = {
  regular: 'Jakarta',
  medium: 'Jakarta-Medium',
  semibold: 'Jakarta-SemiBold',
  bold: 'Jakarta-Bold',
  heavy: 'Jakarta-ExtraBold',
  display: 'Cinzel',
};

const fontFiles = {
  [FONT.regular]: 'PlusJakartaSans_400Regular.ttf',
  [FONT.medium]: 'PlusJakartaSans_500Medium.ttf',
  [FONT.semibold]: 'PlusJakartaSans_600SemiBold.ttf',
  [FONT.bold]: 'PlusJakartaSans_700Bold.ttf',
  [FONT.heavy]: 'PlusJakartaSans_800ExtraBold.ttf',
  [FONT.display]: 'Cinzel_700Bold.ttf',
};

export const LOGO_PATH = path.join(ASSETS, 'images/logo.png');
export const hasLogo = () => fs.existsSync(LOGO_PATH);

/** Create a PDFKit document with brand fonts registered (falls back to Helvetica if missing). */
export const createDoc = (options = {}) => {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 36,
    bufferPages: true,
    info: { Producer: 'Jayrup Commerce', Creator: 'jayrup.in', ...options.info },
    ...options,
  });
  for (const [name, file] of Object.entries(fontFiles)) {
    const p = path.join(ASSETS, 'fonts', file);
    if (fs.existsSync(p)) doc.registerFont(name, p);
    else doc.registerFont(name, name === FONT.display || name.includes('Bold') ? 'Helvetica-Bold' : 'Helvetica');
  }
  doc.font(FONT.regular);
  return doc;
};

/** Collect a PDFKit document into a Buffer */
export const toBuffer = (doc) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });

export const money = (n, { symbol = true, decimals = 2 } = {}) => {
  const v = Number(n || 0);
  const s = Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${v < 0 ? '−' : ''}${symbol ? '₹' : ''}${s}`;
};

export const dateIN = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '—';

export const dateTimeIN = (d) =>
  d
    ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
    : '—';

/** Rounded rectangle fill helper */
export const box = (doc, x, y, w, h, { fill = COLORS.cream, stroke = null, radius = 6, lineWidth = 0.6 } = {}) => {
  doc.save();
  doc.roundedRect(x, y, w, h, radius);
  if (fill && stroke) doc.lineWidth(lineWidth).fillAndStroke(fill, stroke);
  else if (fill) doc.fill(fill);
  else if (stroke) doc.lineWidth(lineWidth).stroke(stroke);
  doc.restore();
};

export const label = (doc, text, x, y, opts = {}) => {
  doc.font(FONT.semibold).fontSize(6.6).fillColor(COLORS.muted).text(String(text).toUpperCase(), x, y, { characterSpacing: 0.8, ...opts });
};

export const value = (doc, text, x, y, opts = {}) => {
  doc.font(opts.font || FONT.semibold).fontSize(opts.size || 9).fillColor(opts.color || COLORS.ink).text(String(text ?? '—'), x, y, opts);
};

/** Brand header band used by invoice, label and reports */
export const brandBand = (doc, { title, subtitle, height = 86, rightLines = [] } = {}) => {
  const w = doc.page.width;
  doc.save();
  doc.rect(0, 0, w, height).fill(COLORS.noir);
  // gold hairline
  doc.rect(0, height, w, 2.2).fill(COLORS.gold);
  doc.restore();

  let x = 36;
  if (hasLogo()) {
    doc.image(LOGO_PATH, x, (height - 52) / 2, { width: 52, height: 52 });
    x += 62;
  }
  doc.font(FONT.display).fontSize(21).fillColor(COLORS.gold).text('JAYRUP', x, height / 2 - 17, { characterSpacing: 3, lineBreak: false });
  doc.font(FONT.medium).fontSize(7.4).fillColor('#CFC6B3').text('PIMPLES CREAM · AYURVEDIC SKINCARE · LUXURY PERFUMES', x, height / 2 + 9, { characterSpacing: 0.9, lineBreak: false });

  const rx = w - 36 - 230;
  if (title) {
    doc.font(FONT.display).fontSize(17).fillColor(COLORS.white).text(title, rx, height / 2 - (subtitle ? 18 : 9), { width: 230, align: 'right', characterSpacing: 1.5 });
  }
  if (subtitle) {
    doc.font(FONT.semibold).fontSize(7.4).fillColor(COLORS.gold).text(subtitle, rx, height / 2 + 6, { width: 230, align: 'right', characterSpacing: 1 });
  }
  rightLines.forEach((l, i) => {
    doc.font(FONT.regular).fontSize(7).fillColor('#CFC6B3').text(l, rx, height / 2 + 18 + i * 9, { width: 230, align: 'right' });
  });
  doc.fillColor(COLORS.text);
  return height + 2.2;
};

/** Footer on every buffered page: contact strip + page numbers */
export const stampFooters = (doc, { left = '', right = '' } = {}) => {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const h = doc.page.height;
    const w = doc.page.width;
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; // allow writing inside the bottom margin without auto page-break
    doc.save();
    doc.moveTo(36, h - 30).lineTo(w - 36, h - 30).lineWidth(0.5).strokeColor(COLORS.line).stroke();
    doc.restore();
    doc.font(FONT.regular).fontSize(6.8).fillColor(COLORS.faint);
    doc.text(left, 36, h - 24, { width: w - 72 - 80, lineBreak: false });
    doc.text(right || `Page ${i - range.start + 1} of ${range.count}`, w - 36 - 120, h - 24, { width: 120, align: 'right', lineBreak: false });
    doc.page.margins.bottom = bottom;
  }
};

export const watermark = (doc, text, color = COLORS.red) => {
  doc.save();
  doc.rotate(-32, { origin: [doc.page.width / 2, doc.page.height / 2] });
  doc.font(FONT.heavy).fontSize(84).fillColor(color).opacity(0.08);
  doc.text(text, 0, doc.page.height / 2 - 50, { width: doc.page.width, align: 'center', lineBreak: false });
  doc.restore();
  doc.opacity(1);
};
