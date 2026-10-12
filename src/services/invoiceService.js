import { Counter } from '../models/Counter.js';
import { Setting } from '../models/Setting.js';
import { round2, financialYear, isValidGSTIN } from '../utils/helpers.js';
import { findState, stateCodeOf, canonicalStateName } from '../utils/indiaStates.js';

/**
 * GST computation for an order.
 * All storefront prices are GST-inclusive (MRP style), so tax is back-calculated:
 *   taxable = net / (1 + rate/100), tax = net − taxable
 * Intra-state (buyer state == seller state) → CGST + SGST (half each); otherwise IGST.
 * Coupon discount is allocated proportionally across product lines (discount shown on the invoice
 * reduces the transaction value, Sec. 15(3)(a) CGST Act).
 */
export const computeTaxBreakup = (order, settings) => {
  const business = settings.business || {};
  const inv = settings.invoice || {};
  const gstRegistered = isValidGSTIN(business.gstin);

  const sellerState = findState(business.state) || { name: business.state || 'Gujarat', code: business.stateCode || '24' };
  const buyerStateName = canonicalStateName(order.shippingAddress?.state);
  const buyerCode = stateCodeOf(order.shippingAddress?.state);
  const isInterState = Boolean(buyerCode && sellerState.code && buyerCode !== sellerState.code);

  const lines = [];
  const itemsGross = order.items.reduce((s, i) => s + Number(i.subtotal || 0), 0);
  const discount = Number(order.discount || 0);
  let discountLeft = round2(discount);

  const pushLine = ({ description, hsnCode, quantity, gross, lineDiscount, rate, isService }) => {
    const net = round2(gross - lineDiscount);
    const effectiveRate = gstRegistered ? Number(rate || 0) : 0;
    const taxable = round2(net / (1 + effectiveRate / 100));
    const tax = round2(net - taxable);
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    if (isInterState) igst = tax;
    else {
      cgst = round2(tax / 2);
      sgst = round2(tax - cgst);
    }
    lines.push({
      description,
      hsnCode,
      quantity,
      unitPrice: quantity ? round2(net / quantity) : net,
      grossAmount: round2(gross),
      discount: round2(lineDiscount),
      taxableValue: taxable,
      gstRate: effectiveRate,
      cgst,
      sgst,
      igst,
      total: net,
      isService: Boolean(isService),
    });
  };

  order.items.forEach((item, idx) => {
    const gross = Number(item.subtotal || item.price * item.quantity);
    let alloc = 0;
    if (discount > 0 && itemsGross > 0) {
      alloc = idx === order.items.length - 1 ? discountLeft : round2((discount * gross) / itemsGross);
      alloc = Math.min(alloc, gross);
      discountLeft = round2(discountLeft - alloc);
    }
    pushLine({
      description: `${item.name}${item.variant?.title ? ` (${item.variant.title})` : ''}`,
      hsnCode: item.hsnCode || inv.defaultHsnCode || '',
      quantity: item.quantity,
      gross,
      lineDiscount: alloc,
      rate: typeof item.gstRate === 'number' ? item.gstRate : inv.defaultGstRate ?? 18,
    });
  });

  // Shipping / COD handling is part of a composite supply of goods → by default taxed at the
  // highest GST rate among the goods in the order (never under-pays when a cart mixes 5 % and 18 % items).
  // Settings › Invoices › "Shipping GST" can switch to a fixed rate instead.
  const itemRates = order.items.map((i) => (typeof i.gstRate === 'number' ? i.gstRate : Number(inv.defaultGstRate ?? 18)));
  const chargeRate =
    (inv.shippingTaxMode || 'HIGHEST_ITEM_RATE') === 'FIXED' || itemRates.length === 0
      ? Number(inv.shippingGstRate ?? 18)
      : Math.max(...itemRates);

  if (Number(order.shipping) > 0) {
    pushLine({
      description: 'Shipping & Handling Charges',
      hsnCode: inv.shippingSacCode || '996812',
      quantity: 1,
      gross: Number(order.shipping),
      lineDiscount: 0,
      rate: chargeRate,
      isService: true,
    });
  }
  if (Number(order.codFee) > 0) {
    pushLine({
      description: 'Cash on Delivery Handling Charges',
      hsnCode: inv.shippingSacCode || '996812',
      quantity: 1,
      gross: Number(order.codFee),
      lineDiscount: 0,
      rate: chargeRate,
      isService: true,
    });
  }

  const sum = (k) => round2(lines.reduce((s, l) => s + Number(l[k] || 0), 0));
  const totalTaxable = sum('taxableValue');
  const totalCgst = sum('cgst');
  const totalSgst = sum('sgst');
  const totalIgst = sum('igst');
  const totalTax = round2(totalCgst + totalSgst + totalIgst);
  const linesTotal = sum('total');
  const grandTotal = round2(Number(order.total));
  const roundOff = round2(grandTotal - linesTotal);

  return {
    type: gstRegistered ? 'TAX_INVOICE' : 'INVOICE',
    placeOfSupply: buyerStateName,
    placeOfSupplyCode: buyerCode,
    isInterState,
    lines,
    totalTaxable,
    totalCgst,
    totalSgst,
    totalIgst,
    totalTax,
    roundOff,
    grandTotal,
  };
};

export const sellerSnapshot = (settings) => {
  const b = settings.business || {};
  return {
    brandName: b.brandName,
    tradeName: b.tradeName,
    tagline: b.tagline,
    legalName: b.legalName,
    registrationNote: b.registrationNote,
    gstin: b.gstin,
    pan: b.pan,
    udyamNumber: b.udyamNumber,
    addressLine1: b.addressLine1,
    addressLine2: b.addressLine2,
    city: b.city,
    district: b.district,
    state: b.state,
    stateCode: b.stateCode || stateCodeOf(b.state),
    postalCode: b.postalCode,
    country: b.country,
    phone: b.phone,
    email: b.email,
    website: b.website,
  };
};

/**
 * Assign a gap-free FY-wise invoice number (JR/26-27/00001) and freeze the tax snapshot.
 * Idempotent: an order that already has an invoice number keeps it.
 */
export const issueInvoice = async (order, { settings = null, date = new Date() } = {}) => {
  if (order.invoice?.number) return order;
  const store = settings || (await Setting.getStoreSettings());
  const fy = financialYear(date);
  const prefix = (store.invoice?.prefix || 'JR').replace(/[^A-Z0-9]/gi, '').toUpperCase() || 'JR';
  const seq = await Counter.next(`invoice-${prefix}-${fy.full}`);
  const number = `${prefix}/${fy.short}/${String(seq).padStart(5, '0')}`;

  order.invoice = {
    number,
    sequence: seq,
    financialYear: fy.full,
    date,
    status: 'ISSUED',
    seller: sellerSnapshot(store),
    ...computeTaxBreakup(order, store),
  };
  order.markModified('invoice');
  return order;
};

/**
 * Cancel an issued invoice by raising a credit note (CN/26-27/00001). Used for cancellations & refunds.
 */
export const issueCreditNote = async (order, { reason = 'Order cancelled', amount = null, settings = null } = {}) => {
  if (!order.invoice?.number || order.invoice?.creditNote?.number) return order;
  const store = settings || (await Setting.getStoreSettings());
  const fy = financialYear(new Date());
  const prefix = (store.invoice?.creditNotePrefix || 'CN').replace(/[^A-Z0-9]/gi, '').toUpperCase() || 'CN';
  const seq = await Counter.next(`creditnote-${prefix}-${fy.full}`);
  order.invoice.creditNote = {
    number: `${prefix}/${fy.short}/${String(seq).padStart(5, '0')}`,
    sequence: seq,
    date: new Date(),
    reason,
    amount: amount ?? order.invoice.grandTotal,
  };
  if (amount === null || Number(amount) >= Number(order.invoice.grandTotal)) {
    order.invoice.status = 'CANCELLED';
  }
  order.markModified('invoice');
  return order;
};

/** Live (non-persisted) breakup — for previews of orders that are not invoiced yet */
export const previewInvoice = async (order) => {
  const store = await Setting.getStoreSettings();
  return { seller: sellerSnapshot(store), ...computeTaxBreakup(order, store) };
};
