import { createDoc, toBuffer, COLORS, FONT, box, label, value, brandBand, stampFooters, watermark, money, dateIN } from './theme.js';
import { amountInWords, round2 } from '../../utils/helpers.js';

const PAGE_W = 595.28;
const M = 36;
const CW = PAGE_W - M * 2; // content width ≈ 523

/**
 * Render a modern, print-ready GST invoice (A4).
 * @param {Object} order  Mongoose order (lean or doc) with `invoice` snapshot
 * @param {Object} opts   { copyLabel: 'ORIGINAL FOR RECIPIENT' | 'DUPLICATE FOR TRANSPORTER' | 'TRIPLICATE FOR SUPPLIER', settings }
 */
export const renderInvoicePdf = async (order, { copyLabel = 'ORIGINAL FOR RECIPIENT', settings = {} } = {}) => {
  const inv = order.invoice || {};
  const seller = inv.seller || {};
  const isTax = inv.type !== 'INVOICE';
  const isInter = Boolean(inv.isInterState);
  const doc = createDoc({
    info: {
      Title: `${isTax ? 'Tax Invoice' : 'Invoice'} ${inv.number || order.orderNumber}`,
      Author: seller.legalName || 'Jayrup',
      Subject: `Order ${order.orderNumber}`,
    },
  });

  // ───────────── Header band ─────────────
  let y = brandBand(doc, {
    title: isTax ? 'TAX INVOICE' : 'INVOICE',
    subtitle: copyLabel,
    brandName: seller.brandName || settings?.business?.brandName,
    tagline: seller.tagline ?? settings?.business?.tagline ?? '',
  });
  y += 16;

  // ───────────── Meta cards ─────────────
  const paid = ['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(order.paymentStatus);
  const metas = [
    ['Invoice No.', inv.number || 'Not issued'],
    ['Invoice Date', dateIN(inv.date)],
    ['Order No.', order.orderNumber],
    ['Order Date', dateIN(order.createdAt)],
  ];
  const metas2 = [
    ['Payment', order.paymentMethod === 'COD' ? 'Cash on Delivery' : `PhonePe${order.paymentInfo?.paymentMode ? ` · ${prettyMode(order.paymentInfo.paymentMode)}` : ''}`],
    ['Transaction Ref.', order.paymentInfo?.transactionId || (order.paymentMethod === 'COD' ? 'Collect on delivery' : '—')],
    ['Place of Supply', `${inv.placeOfSupply || order.shippingAddress?.state || '—'}${inv.placeOfSupplyCode ? ` (${inv.placeOfSupplyCode})` : ''}`],
    ['Reverse Charge', 'No'],
  ];
  const cardW = (CW - 3 * 8) / 4;
  [metas, metas2].forEach((row, r) => {
    row.forEach(([k, v], i) => {
      const x = M + i * (cardW + 8);
      const yy = y + r * 44;
      box(doc, x, yy, cardW, 38, { fill: COLORS.cream, stroke: COLORS.line, radius: 6 });
      label(doc, k, x + 9, yy + 7, { width: cardW - 18 });
      value(doc, v, x + 9, yy + 18, { width: cardW - 18, size: 8.6, lineBreak: false, ellipsis: true });
    });
  });
  y += 44 * 2 + 6;

  // Status pill
  const status = order.invoice?.status === 'CANCELLED' ? ['CANCELLED', COLORS.red, COLORS.redSoft] : paid ? ['PAID', COLORS.green, COLORS.greenSoft] : ['PAYMENT DUE ON DELIVERY', COLORS.amber, COLORS.amberSoft];
  doc.font(FONT.bold).fontSize(7.4);
  const pillW = doc.widthOfString(status[0], { characterSpacing: 0.8 }) + 18;
  box(doc, PAGE_W - M - pillW, y, pillW, 16, { fill: status[2], radius: 8 });
  doc.fillColor(status[1]).text(status[0], PAGE_W - M - pillW, y + 4.6, { width: pillW, align: 'center', characterSpacing: 0.8 });
  y += 24;

  // ───────────── Parties ─────────────
  const colW = (CW - 2 * 10) / 3;
  const sellerLines = [
    seller.legalName ? `${seller.legalName}${seller.tradeName ? ` (${seller.tradeName})` : ''}` : seller.tradeName,
    seller.addressLine1,
    seller.addressLine2,
    [seller.city, seller.district].filter(Boolean).join(', '),
    `${seller.state || ''}${seller.postalCode ? ` – ${seller.postalCode}` : ''}${seller.stateCode ? ` · State Code ${seller.stateCode}` : ''}`,
    seller.gstin ? `GSTIN: ${seller.gstin}` : 'GST: Unregistered',
    seller.pan ? `PAN: ${seller.pan}` : null,
    seller.udyamNumber ? `UDYAM: ${seller.udyamNumber}` : seller.registrationNote || null,
    [seller.phone, seller.email].filter(Boolean).join(' · '),
  ].filter(Boolean);

  const a = order.shippingAddress || {};
  const billLines = [
    order.billingDetails?.businessName || a.fullName,
    order.billingDetails?.businessName ? `Attn: ${a.fullName}` : null,
    order.billingDetails?.gstin ? `GSTIN: ${order.billingDetails.gstin}` : 'Unregistered (B2C)',
    a.phone ? `Phone: ${a.phone}` : null,
    order.customerEmail || a.email || null,
  ].filter(Boolean);
  const shipLines = [
    a.fullName,
    a.addressLine1,
    a.addressLine2,
    `${a.city || ''}, ${a.state || ''} – ${a.postalCode || ''}`,
    a.country || 'India',
    a.phone ? `Phone: ${a.phone}` : null,
  ].filter(Boolean);

  const partyH = Math.max(sellerLines.length, billLines.length, shipLines.length) * 10.6 + 30;
  [
    ['Sold By', sellerLines],
    ['Bill To', billLines],
    ['Ship To', shipLines],
  ].forEach(([title, lines], i) => {
    const x = M + i * (colW + 10);
    box(doc, x, y, colW, partyH, { fill: COLORS.white, stroke: COLORS.line, radius: 6 });
    doc.save().rect(x, y + 8, 2.4, 12).fill(COLORS.gold).restore();
    doc.font(FONT.bold).fontSize(8).fillColor(COLORS.goldDeep).text(title.toUpperCase(), x + 10, y + 10, { characterSpacing: 1 });
    let ly = y + 26;
    lines.forEach((l, li) => {
      doc.font(li === 0 ? FONT.bold : FONT.regular).fontSize(li === 0 ? 8.8 : 7.8).fillColor(li === 0 ? COLORS.ink : COLORS.text);
      doc.text(l, x + 10, ly, { width: colW - 20, lineBreak: false, ellipsis: true });
      ly += 10.6;
    });
  });
  y += partyH + 14;

  // ───────────── Items table ─────────────
  const cols = isInter
    ? [
        { key: 'idx', title: '#', w: 18, align: 'center' },
        { key: 'desc', title: 'Item & Description', w: 176 },
        { key: 'hsn', title: 'HSN/SAC', w: 52, align: 'center' },
        { key: 'qty', title: 'Qty', w: 30, align: 'center' },
        { key: 'rate', title: 'Rate', w: 56, align: 'right' },
        { key: 'taxable', title: 'Taxable', w: 62, align: 'right' },
        { key: 'igst', title: 'IGST', w: 64, align: 'right' },
        { key: 'total', title: 'Amount', w: 67, align: 'right' },
      ]
    : [
        { key: 'idx', title: '#', w: 18, align: 'center' },
        { key: 'desc', title: 'Item & Description', w: 140 },
        { key: 'hsn', title: 'HSN/SAC', w: 52, align: 'center' },
        { key: 'qty', title: 'Qty', w: 30, align: 'center' },
        { key: 'rate', title: 'Rate', w: 52, align: 'right' },
        { key: 'taxable', title: 'Taxable', w: 58, align: 'right' },
        { key: 'cgst', title: 'CGST', w: 55, align: 'right' },
        { key: 'sgst', title: 'SGST', w: 55, align: 'right' },
        { key: 'total', title: 'Amount', w: 65, align: 'right' },
      ];
  const scale = CW / cols.reduce((s, c) => s + c.w, 0);
  cols.forEach((c) => (c.w *= scale));

  const drawHeader = (yy) => {
    box(doc, M, yy, CW, 22, { fill: COLORS.noir, radius: 5 });
    let x = M;
    cols.forEach((c) => {
      doc.font(FONT.bold).fontSize(6.6).fillColor(COLORS.gold).text(c.title.toUpperCase(), x + 4, yy + 7.5, {
        width: c.w - 8,
        align: c.align || 'left',
        characterSpacing: 0.4,
        lineBreak: false,
      });
      x += c.w;
    });
    return yy + 22;
  };

  y = drawHeader(y);
  const lines = inv.lines?.length ? inv.lines : [];
  const bottomLimit = doc.page.height - 60;

  lines.forEach((l, i) => {
    const descTitle = l.description;
    const sub = [
      l.isService ? 'Service' : order.items?.[i]?.sku ? `SKU ${order.items[i].sku}` : null,
      l.discount > 0 ? `Disc. ${money(l.discount)}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    doc.font(FONT.semibold).fontSize(8.2);
    const descH = doc.heightOfString(descTitle, { width: cols[1].w - 10 });
    doc.font(FONT.regular).fontSize(6.8);
    const subH = sub ? doc.heightOfString(sub, { width: cols[1].w - 10 }) + 2 : 0;
    const rowH = Math.max(28, descH + subH + 14);

    if (y + rowH > bottomLimit) {
      doc.addPage();
      y = drawHeader(M);
    }
    if (i % 2 === 0) doc.save().rect(M, y, CW, rowH).fill(COLORS.cream).restore();

    const half = (n) => round2(Number(n || 0));
    const cells = {
      idx: String(i + 1),
      desc: null,
      hsn: l.hsnCode || '—',
      qty: String(l.quantity ?? 1),
      rate: money(l.quantity ? (l.grossAmount || l.total) / l.quantity : l.total, { decimals: 2 }),
      taxable: money(l.taxableValue),
      cgst: l.gstRate ? `${money(half(l.cgst))}\n${l.gstRate / 2}%` : '—',
      sgst: l.gstRate ? `${money(half(l.sgst))}\n${l.gstRate / 2}%` : '—',
      igst: l.gstRate ? `${money(l.igst)}\n${l.gstRate}%` : '—',
      total: money(l.total),
    };

    let x = M;
    cols.forEach((c) => {
      if (c.key === 'desc') {
        doc.font(FONT.semibold).fontSize(8.2).fillColor(COLORS.ink).text(descTitle, x + 5, y + 7, { width: c.w - 10 });
        if (sub) doc.font(FONT.regular).fontSize(6.8).fillColor(COLORS.muted).text(sub, x + 5, y + 7 + descH + 2, { width: c.w - 10 });
      } else {
        const isTaxCol = ['cgst', 'sgst', 'igst'].includes(c.key);
        doc
          .font(c.key === 'total' ? FONT.bold : FONT.regular)
          .fontSize(isTaxCol ? 7.6 : 8)
          .fillColor(c.key === 'total' ? COLORS.ink : COLORS.text)
          .text(cells[c.key], x + 5, y + 7, { width: c.w - 10, align: c.align || 'left', lineGap: 1 });
      }
      x += c.w;
    });
    doc.save().moveTo(M, y + rowH).lineTo(M + CW, y + rowH).lineWidth(0.4).strokeColor(COLORS.line).stroke().restore();
    y += rowH;
  });

  y += 14;
  if (y + 210 > bottomLimit) {
    doc.addPage();
    y = M;
  }

  // ───────────── Totals (right) ─────────────
  const totW = 214;
  const totX = M + CW - totW;
  const grossItems = round2((order.items || []).reduce((s, it) => s + Number(it.subtotal || 0), 0));
  const totals = [
    ['Items Total (incl. GST)', money(grossItems)],
    order.discount > 0 ? [`Discount${order.appliedCoupon?.code ? ` (${order.appliedCoupon.code})` : ''}`, `- ${money(order.discount)}`, COLORS.green] : null,
    order.shipping > 0 ? ['Shipping', money(order.shipping)] : ['Shipping', 'FREE', COLORS.green],
    order.codFee > 0 ? ['COD Charges', money(order.codFee)] : null,
    ['Taxable Value', money(inv.totalTaxable)],
    ...(isTax
      ? isInter
        ? [['IGST', money(inv.totalIgst)]]
        : [
            ['CGST', money(inv.totalCgst)],
            ['SGST', money(inv.totalSgst)],
          ]
      : []),
    Math.abs(inv.roundOff || 0) >= 0.01 ? ['Round Off', money(inv.roundOff)] : null,
  ].filter(Boolean);

  const totH = totals.length * 15 + 16 + 34;
  box(doc, totX, y, totW, totH, { fill: COLORS.white, stroke: COLORS.line, radius: 8 });
  let ty = y + 10;
  totals.forEach(([k, v, color]) => {
    doc.font(FONT.regular).fontSize(8.2).fillColor(COLORS.muted).text(k, totX + 12, ty, { width: 120 });
    doc.font(FONT.semibold).fontSize(8.4).fillColor(color || COLORS.ink).text(v, totX + 100, ty, { width: totW - 112, align: 'right' });
    ty += 15;
  });
  ty += 4;
  box(doc, totX + 6, ty, totW - 12, 30, { fill: COLORS.noir, radius: 6 });
  doc.font(FONT.bold).fontSize(8).fillColor('#CFC6B3').text('GRAND TOTAL', totX + 16, ty + 11, { characterSpacing: 1 });
  doc.font(FONT.heavy).fontSize(13).fillColor(COLORS.gold).text(money(inv.grandTotal ?? order.total), totX + 90, ty + 8, { width: totW - 108, align: 'right' });

  // ───────────── Amount in words + HSN summary (left) ─────────────
  const leftW = CW - totW - 14;
  box(doc, M, y, leftW, 40, { fill: COLORS.cream, stroke: COLORS.line, radius: 8 });
  label(doc, 'Amount in words', M + 12, y + 8);
  doc.font(FONT.semibold).fontSize(8.4).fillColor(COLORS.ink).text(amountInWords(inv.grandTotal ?? order.total), M + 12, y + 19, { width: leftW - 24 });

  let ly = y + 50;
  if (isTax) {
    // HSN-wise tax summary (required for GSTR-1 table 12 reconciliation)
    const hsnMap = new Map();
    (inv.lines || []).forEach((l) => {
      const k = `${l.hsnCode}|${l.gstRate}`;
      const prev = hsnMap.get(k) || { hsn: l.hsnCode, rate: l.gstRate, taxable: 0, tax: 0 };
      prev.taxable = round2(prev.taxable + Number(l.taxableValue || 0));
      prev.tax = round2(prev.tax + Number(l.cgst || 0) + Number(l.sgst || 0) + Number(l.igst || 0));
      hsnMap.set(k, prev);
    });
    const hsnCols = [
      ['HSN/SAC', 0.24],
      ['Taxable', 0.28],
      ['Rate', 0.16],
      [isInter ? 'IGST' : 'CGST+SGST', 0.32],
    ];
    label(doc, 'HSN / SAC tax summary', M + 2, ly);
    ly += 11;
    box(doc, M, ly, leftW, 16, { fill: COLORS.creamDark, radius: 4 });
    let hx = M;
    hsnCols.forEach(([t, f]) => {
      doc.font(FONT.bold).fontSize(6.8).fillColor(COLORS.goldDeep).text(t.toUpperCase(), hx + 8, ly + 5, { width: leftW * f - 16, align: t === 'HSN/SAC' ? 'left' : 'right' });
      hx += leftW * f;
    });
    ly += 16;
    [...hsnMap.values()].forEach((h) => {
      let cx = M;
      [h.hsn, money(h.taxable), `${h.rate}%`, money(h.tax)].forEach((v, idx) => {
        const f = hsnCols[idx][1];
        doc.font(FONT.regular).fontSize(7.6).fillColor(COLORS.text).text(v, cx + 8, ly + 4, { width: leftW * f - 16, align: idx === 0 ? 'left' : 'right' });
        cx += leftW * f;
      });
      doc.save().moveTo(M, ly + 15).lineTo(M + leftW, ly + 15).lineWidth(0.3).strokeColor(COLORS.line).stroke().restore();
      ly += 15;
    });
  } else {
    doc.font(FONT.regular).fontSize(7.4).fillColor(COLORS.muted).text('Supplier not registered under GST – no GST charged on this invoice.', M + 2, ly, { width: leftW });
    ly += 14;
  }

  y = Math.max(ly, y + totH) + 18;
  if (y + 120 > bottomLimit) {
    doc.addPage();
    y = M;
  }

  // ───────────── Notes, terms & signature ─────────────
  const termsText = settings?.invoice?.termsText || 'Goods once sold are subject to our Return & Refund Policy.';
  const footerNote = settings?.invoice?.footerNote || 'Thank you for shopping with Jayrup.';
  const noteW = CW - 190;
  label(doc, 'Terms & Notes', M, y);
  doc.font(FONT.regular).fontSize(7.4).fillColor(COLORS.text).text(
    [
      termsText,
      'Please read the label and usage directions before use.',
      (order.items || []).some((i) => i.returnable === false)
        ? 'Some items in this order are not returnable once opened (hygiene / sealed products); damaged, leaking or wrong items are replaced as per our policy.'
        : null,
      order.paymentMethod === 'COD' && !paid ? `Please pay ${money(order.total)} to the delivery partner (cash or UPI).` : null,
      inv.creditNote?.number ? `Credit Note ${inv.creditNote.number} dated ${dateIN(inv.creditNote.date)} issued: ${inv.creditNote.reason} (${money(inv.creditNote.amount)}).` : null,
    ]
      .filter(Boolean)
      .join('\n'),
    M,
    y + 11,
    { width: noteW, lineGap: 2 }
  );
  doc.font(FONT.semibold).fontSize(8).fillColor(COLORS.goldDeep).text(footerNote, M, doc.y + 8, { width: noteW });

  const sx = M + CW - 170;
  box(doc, sx, y, 170, 74, { fill: COLORS.white, stroke: COLORS.line, radius: 8 });
  doc.font(FONT.semibold).fontSize(7.6).fillColor(COLORS.muted).text(`For ${seller.legalName || seller.tradeName || 'Jayrup'}`, sx + 10, y + 9, { width: 150, align: 'center' });
  doc.font(FONT.display).fontSize(13).fillColor(COLORS.goldDeep).text(seller.brandName || 'Jayrup', sx + 10, y + 27, { width: 150, align: 'center' });
  doc.save().moveTo(sx + 22, y + 52).lineTo(sx + 148, y + 52).lineWidth(0.5).strokeColor(COLORS.faint).stroke().restore();
  doc.font(FONT.regular).fontSize(7).fillColor(COLORS.muted).text(settings?.invoice?.signatoryName || 'Authorised Signatory', sx + 10, y + 57, { width: 150, align: 'center' });

  doc.font(FONT.regular).fontSize(6.8).fillColor(COLORS.faint).text('This is a computer-generated invoice and does not require a physical signature.', M, y + 84, { width: CW, align: 'center' });

  if (inv.status === 'CANCELLED') {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      watermark(doc, 'CANCELLED');
    }
  }

  stampFooters(doc, {
    left: `${seller.legalName || 'Jayrup'} · ${seller.website || 'jayrup.in'} · ${seller.email || 'care@jayrup.in'} · ${seller.phone || ''}`,
  });

  return toBuffer(doc);
};

const prettyMode = (m = '') =>
  ({
    UPI_INTENT: 'UPI',
    UPI_COLLECT: 'UPI',
    UPI_QR: 'UPI QR',
    CARD: 'Card',
    TOKEN: 'Saved Card',
    NET_BANKING: 'Net Banking',
    UPI_MOCK: 'UPI (Test)',
  })[m] || m.replace(/_/g, ' ');
