import { createDoc, toBuffer, COLORS, FONT, LOGO_PATH, hasLogo, money, dateIN } from './theme.js';

// ───────────── Code 128 (set B) barcode – no external dependency ─────────────
const CODE128 = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

export const code128Pattern = (text) => {
  const clean = String(text).replace(/[^\x20-\x7E]/g, '');
  const codes = [104];
  for (const ch of clean) codes.push(ch.charCodeAt(0) - 32);
  const checksum = codes.reduce((sum, c, i) => sum + c * (i === 0 ? 1 : i), 0) % 103;
  codes.push(checksum, 106);
  return codes.map((c) => CODE128[c]).join('');
};

export const drawBarcode = (doc, text, x, y, width, height) => {
  const pattern = code128Pattern(text);
  const modules = [...pattern].reduce((s, d) => s + Number(d), 0) + 20; // + quiet zones
  const unit = width / modules;
  let cx = x + 10 * unit;
  doc.save();
  [...pattern].forEach((d, i) => {
    const w = Number(d) * unit;
    if (i % 2 === 0) doc.rect(cx, y, w, height).fill(COLORS.noir);
    cx += w;
  });
  doc.restore();
};

/**
 * 4" × 6" thermal shipping label (works on A4 too when printed "fit to page").
 */
export const renderShippingLabelPdf = async (order, { settings = {} } = {}) => {
  const W = 288;
  const H = 432;
  const doc = createDoc({ size: [W, H], margin: 10, info: { Title: `Shipping Label ${order.orderNumber}` } });
  const b = settings.business || order.invoice?.seller || {};
  const a = order.shippingAddress || {};
  const isCod = order.paymentMethod === 'COD' && order.paymentStatus !== 'PAID';

  // Outer frame
  doc.save().lineWidth(1.2).rect(6, 6, W - 12, H - 12).stroke(COLORS.noir).restore();

  // Header
  doc.save().rect(6, 6, W - 12, 44).fill(COLORS.noir).restore();
  if (hasLogo()) doc.image(LOGO_PATH, 14, 12, { width: 32, height: 32 });
  doc.font(FONT.display).fontSize(15).fillColor(COLORS.gold).text(String(b.brandName || 'Jayrup').toUpperCase(), 52, 16, { characterSpacing: 2, width: 150, lineBreak: false });
  doc.font(FONT.regular).fontSize(6).fillColor('#CFC6B3').text(`${String(b.website || 'jayrup.in').replace(/^https?:\/\//, '')} · ${b.email || 'care@jayrup.in'}`, 52, 34, { width: 150, lineBreak: false });

  // Payment type badge
  const badgeW = 104;
  doc.save().roundedRect(W - 12 - badgeW, 12, badgeW, 32, 4).fill(isCod ? COLORS.gold : COLORS.white).restore();
  doc.font(FONT.heavy).fontSize(isCod ? 9 : 11).fillColor(COLORS.noir).text(isCod ? 'COD – COLLECT' : 'PREPAID', W - 12 - badgeW, isCod ? 15 : 22, { width: badgeW, align: 'center' });
  if (isCod) doc.font(FONT.heavy).fontSize(12).text(money(order.total, { decimals: 0 }), W - 12 - badgeW, 26, { width: badgeW, align: 'center' });

  // Ship to
  let y = 58;
  doc.font(FONT.bold).fontSize(7).fillColor(COLORS.muted).text('DELIVER TO', 14, y, { characterSpacing: 1 });
  y += 10;
  doc.font(FONT.heavy).fontSize(13).fillColor(COLORS.noir).text(a.fullName || '', 14, y, { width: W - 28 });
  y = doc.y + 2;
  doc.font(FONT.medium).fontSize(9.4).fillColor(COLORS.ink).text([a.addressLine1, a.addressLine2].filter(Boolean).join(', '), 14, y, { width: W - 28, lineGap: 1 });
  y = doc.y + 2;
  doc.font(FONT.bold).fontSize(10.5).text(`${a.city || ''}, ${a.state || ''}`, 14, y, { width: W - 28 });
  y = doc.y + 2;
  doc.font(FONT.heavy).fontSize(18).text(`PIN ${a.postalCode || ''}`, 14, y);
  doc.font(FONT.bold).fontSize(10).text(`☎ ${a.phone || ''}`.replace('☎ ', 'Ph: '), 150, y + 5, { width: W - 164, align: 'right' });
  y = doc.y + 10;

  doc.save().moveTo(6, y).lineTo(W - 6, y).lineWidth(1).stroke(COLORS.noir).restore();
  y += 8;

  // Order barcode
  doc.font(FONT.bold).fontSize(7).fillColor(COLORS.muted).text('ORDER', 14, y, { characterSpacing: 1 });
  doc.font(FONT.regular).fontSize(7).text(dateIN(order.createdAt), W - 120, y, { width: 106, align: 'right' });
  y += 10;
  drawBarcode(doc, order.orderNumber, 14, y, W - 28, 38);
  y += 41;
  doc.font(FONT.heavy).fontSize(10).fillColor(COLORS.noir).text(order.orderNumber, 14, y, { width: W - 28, align: 'center', characterSpacing: 1.5 });
  y += 18;

  // Courier / AWB
  if (order.trackingId) {
    doc.save().moveTo(6, y).lineTo(W - 6, y).lineWidth(0.6).dash(3, { space: 2 }).stroke(COLORS.noir).undash().restore();
    y += 7;
    doc.font(FONT.bold).fontSize(7).fillColor(COLORS.muted).text(`${(order.courier || 'COURIER').toUpperCase()} · AWB`, 14, y, { characterSpacing: 1 });
    y += 10;
    drawBarcode(doc, order.trackingId, 14, y, W - 28, 30);
    y += 33;
    doc.font(FONT.bold).fontSize(9).fillColor(COLORS.noir).text(order.trackingId, 14, y, { width: W - 28, align: 'center', characterSpacing: 1 });
    y += 15;
  }

  // Contents
  doc.save().moveTo(6, y).lineTo(W - 6, y).lineWidth(1).stroke(COLORS.noir).restore();
  y += 7;
  const units = (order.items || []).reduce((s, i) => s + Number(i.quantity || 0), 0);
  doc.font(FONT.bold).fontSize(7).fillColor(COLORS.muted).text(`CONTENTS · ${units} UNIT${units === 1 ? '' : 'S'}`, 14, y, { characterSpacing: 1 });
  y += 10;
  (order.items || []).slice(0, 4).forEach((i) => {
    doc.font(FONT.medium).fontSize(7.6).fillColor(COLORS.ink).text(`• ${i.name}${i.variant?.title ? ` (${i.variant.title})` : ''} × ${i.quantity}`, 14, y, { width: W - 28, lineBreak: false, ellipsis: true });
    y += 10;
  });
  if ((order.items || []).length > 4) {
    doc.font(FONT.regular).fontSize(7).fillColor(COLORS.muted).text(`+ ${order.items.length - 4} more item(s)`, 14, y);
    y += 10;
  }
  if (order.invoice?.number) {
    doc.font(FONT.regular).fontSize(7).fillColor(COLORS.muted).text(`Invoice ${order.invoice.number} · Value ${money(order.total)}`, 14, y);
  }

  // Return address (bottom)
  const ry = H - 62;
  doc.save().rect(6, ry, W - 12, 56).fill(COLORS.cream).restore();
  doc.save().moveTo(6, ry).lineTo(W - 6, ry).lineWidth(1).stroke(COLORS.noir).restore();
  doc.font(FONT.bold).fontSize(6.6).fillColor(COLORS.muted).text('IF UNDELIVERED, RETURN TO', 14, ry + 6, { characterSpacing: 0.8 });
  doc.font(FONT.semibold).fontSize(7.4).fillColor(COLORS.ink).text(
    `${b.tradeName || b.brandName || 'Jayrup'}${b.legalName ? ` (${b.legalName})` : ''}\n${[b.addressLine1, b.addressLine2].filter(Boolean).join(', ')}\n${[b.city, b.district, b.state].filter(Boolean).join(', ')} – ${b.postalCode || ''} · ${b.phone || ''}`,
    14,
    ry + 16,
    { width: W - 28, lineGap: 0.5 }
  );

  return toBuffer(doc);
};
