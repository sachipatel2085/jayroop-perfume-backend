import { Order } from '../../models/Order.js';
import { Product } from '../../models/Product.js';
import { User } from '../../models/User.js';
import { Setting } from '../../models/Setting.js';
import { computeTaxBreakup } from '../invoiceService.js';
import { round2, parseDateRange } from '../../utils/helpers.js';
import { stateCodeOf, canonicalStateName } from '../../utils/indiaStates.js';
import { HSN_DESCRIPTIONS, PRODUCT_TYPES, resolveTax, inferProductType } from '../../config/productTypes.js';

/**
 * A "valid sale" = revenue the business actually earned/committed:
 *  - Online: payment captured (PAID / refunded variants – refunds are reported separately)
 *  - COD:    order accepted (not cancelled / not pending)
 */
export const VALID_SALE_FILTER = {
  $or: [
    { paymentMethod: 'ONLINE', paymentStatus: { $in: ['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'] } },
    { paymentMethod: 'COD', orderStatus: { $in: ['PROCESSING', 'PAID', 'SHIPPED', 'DELIVERED', 'REFUND_REQUESTED', 'REFUNDED'] } },
  ],
};

const STATUS_LABEL = {
  PENDING_PAYMENT: 'Pending Payment',
  PAID: 'Paid',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUND_REQUESTED: 'Refund Requested',
  REFUNDED: 'Refunded',
};

const taxOf = (order, settings) => (order.invoice?.lines?.length ? order.invoice : computeTaxBreakup(order, settings));

const istDate = (d) => (d ? new Date(new Date(d).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10) : '');

export const REPORT_TYPES = {
  sales: 'Sales Register',
  gst: 'GST Report (GSTR-1 Ready)',
  hsn: 'HSN-wise Summary',
  products: 'Product-wise Sales',
  categories: 'Category & Product-type Sales',
  orders: 'Order Book (All Orders)',
  payments: 'Payments & Refunds',
  customers: 'Customer Report',
  statewise: 'State-wise Sales',
  inventory: 'Inventory & Stock Valuation',
};

const money = (header, key, width = 14) => ({ header, key, width, type: 'money' });
const int = (header, key, width = 10) => ({ header, key, width, type: 'int' });
const text = (header, key, width = 18) => ({ header, key, width, type: 'text' });
const date = (header, key, width = 12) => ({ header, key, width, type: 'date' });
const pct = (header, key, width = 9) => ({ header, key, width, type: 'percent' });

const sumBy = (rows, keys) => {
  const t = {};
  keys.forEach((k) => (t[k] = round2(rows.reduce((s, r) => s + Number(r[k] || 0), 0))));
  return t;
};

// ═════════════════════════════════════ OVERVIEW (dashboard) ═════════════════════════════════════
export const buildOverview = async ({ from, to, groupBy = 'day' }) => {
  const range = parseDateRange(from, to);
  const settings = await Setting.getStoreSettings();
  const base = { createdAt: { $gte: range.from, $lte: range.to } };

  const [sales, allInRange, newCustomers] = await Promise.all([
    Order.find({ ...base, ...VALID_SALE_FILTER }).lean(),
    Order.find(base).select('orderStatus paymentStatus paymentMethod total createdAt').lean(),
    User.countDocuments({ role: 'CUSTOMER', createdAt: { $gte: range.from, $lte: range.to } }),
  ]);

  let gross = 0;
  let discount = 0;
  let shipping = 0;
  let tax = 0;
  let taxable = 0;
  let units = 0;
  let refunded = 0;
  const series = new Map();
  const products = new Map();
  const states = new Map();
  const payMix = { ONLINE: { orders: 0, amount: 0 }, COD: { orders: 0, amount: 0 } };
  const customers = new Set();

  const bucket = (d) => {
    const s = istDate(d);
    return groupBy === 'month' ? s.slice(0, 7) : s;
  };

  for (const o of sales) {
    const t = taxOf(o, settings);
    gross += Number(o.total || 0);
    discount += Number(o.discount || 0);
    shipping += Number(o.shipping || 0) + Number(o.codFee || 0);
    tax += Number(t.totalTax || 0);
    taxable += Number(t.totalTaxable || 0);
    refunded += Number(o.refundedAmount || 0);
    customers.add(String(o.user));
    payMix[o.paymentMethod] = payMix[o.paymentMethod] || { orders: 0, amount: 0 };
    payMix[o.paymentMethod].orders += 1;
    payMix[o.paymentMethod].amount += Number(o.total || 0);

    const k = bucket(o.createdAt);
    const s = series.get(k) || { period: k, revenue: 0, orders: 0, units: 0 };
    s.revenue += Number(o.total || 0);
    s.orders += 1;

    for (const it of o.items || []) {
      units += Number(it.quantity || 0);
      s.units += Number(it.quantity || 0);
      const pk = String(it.product);
      const p = products.get(pk) || { name: it.name, slug: it.slug, units: 0, revenue: 0, image: it.image };
      p.units += Number(it.quantity || 0);
      p.revenue += Number(it.subtotal || 0);
      p.categoryName = p.categoryName || it.categoryName || '';
      products.set(pk, p);
    }
    series.set(k, s);

    const st = canonicalStateName(o.shippingAddress?.state) || 'Unknown';
    const sv = states.get(st) || { state: st, orders: 0, revenue: 0 };
    sv.orders += 1;
    sv.revenue += Number(o.total || 0);
    states.set(st, sv);
  }

  // Fill empty days so charts are continuous
  const filled = [];
  if (groupBy === 'day') {
    const cursor = new Date(range.from);
    while (cursor <= range.to && filled.length < 400) {
      const k = istDate(cursor);
      filled.push(series.get(k) || { period: k, revenue: 0, orders: 0, units: 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  } else {
    filled.push(...[...series.values()].sort((a, b) => a.period.localeCompare(b.period)));
  }

  // Category mix (legacy orders without a category snapshot are resolved from the product)
  const needCat = [...products.entries()].filter(([, p]) => !p.categoryName).map(([id]) => id);
  if (needCat.length) {
    const docs = await Product.find({ _id: { $in: needCat } }).select('category').populate('category', 'name').lean();
    docs.forEach((d) => {
      const p = products.get(String(d._id));
      if (p) p.categoryName = d.category?.name || '';
    });
  }
  const catMap = new Map();
  products.forEach((p) => {
    const key = p.categoryName || 'Uncategorised';
    const c = catMap.get(key) || { name: key, units: 0, revenue: 0 };
    c.units += p.units;
    c.revenue += p.revenue;
    catMap.set(key, c);
  });

  const statusBreakdown = {};
  allInRange.forEach((o) => {
    statusBreakdown[o.orderStatus] = (statusBreakdown[o.orderStatus] || 0) + 1;
  });
  const onlineAttempts = allInRange.filter((o) => o.paymentMethod === 'ONLINE').length;
  const onlineSuccess = allInRange.filter((o) => o.paymentMethod === 'ONLINE' && ['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(o.paymentStatus)).length;

  return {
    range: { from: istDate(range.from), to: istDate(range.to) },
    kpis: {
      grossSales: round2(gross),
      netSales: round2(gross - refunded),
      taxableValue: round2(taxable),
      taxCollected: round2(tax),
      discounts: round2(discount),
      shippingCollected: round2(shipping),
      refunds: round2(refunded),
      orders: sales.length,
      unitsSold: units,
      averageOrderValue: sales.length ? round2(gross / sales.length) : 0,
      uniqueCustomers: customers.size,
      newCustomers,
      cancelledOrders: statusBreakdown.CANCELLED || 0,
      paymentSuccessRate: onlineAttempts ? round2((onlineSuccess / onlineAttempts) * 100) : null,
    },
    series: filled.map((s) => ({ ...s, revenue: round2(s.revenue) })),
    topProducts: [...products.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10).map((p) => ({ ...p, revenue: round2(p.revenue) })),
    categories: [...catMap.values()].sort((a, b) => b.revenue - a.revenue).map((c) => ({ ...c, revenue: round2(c.revenue) })),
    states: [...states.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 15).map((s) => ({ ...s, revenue: round2(s.revenue) })),
    paymentMix: Object.entries(payMix).map(([method, v]) => ({ method, orders: v.orders, amount: round2(v.amount) })),
    statusBreakdown,
  };
};

// ═════════════════════════════════════ EXPORT DATASETS ═════════════════════════════════════
export const buildReport = async (type, { from, to }) => {
  if (!REPORT_TYPES[type]) {
    const e = new Error(`Unknown report type '${type}'. Allowed: ${Object.keys(REPORT_TYPES).join(', ')}`);
    e.statusCode = 400;
    throw e;
  }
  const range = parseDateRange(from, to);
  const settings = await Setting.getStoreSettings();
  const meta = {
    type,
    title: REPORT_TYPES[type],
    period: `${istDate(range.from)} to ${istDate(range.to)}`,
    from: istDate(range.from),
    to: istDate(range.to),
    generatedAt: new Date(),
    business: settings.business?.toObject ? settings.business.toObject() : settings.business,
  };

  const builders = { sales, gst, hsn, products, categories, orders, payments, customers, statewise, inventory };
  const result = await builders[type]({ range, settings });
  return { ...meta, ...result };
};

// ───────────── Sales Register ─────────────
const sales = async ({ range, settings }) => {
  const list = await Order.find({ createdAt: { $gte: range.from, $lte: range.to }, ...VALID_SALE_FILTER })
    .sort({ createdAt: 1 })
    .lean();

  const rows = list.map((o) => {
    const t = taxOf(o, settings);
    return {
      date: istDate(o.createdAt),
      orderNumber: o.orderNumber,
      invoiceNumber: o.invoice?.number || '',
      customer: o.shippingAddress?.fullName || '',
      phone: o.shippingAddress?.phone || '',
      state: canonicalStateName(o.shippingAddress?.state),
      gstin: o.billingDetails?.gstin || '',
      paymentMethod: o.paymentMethod === 'COD' ? 'COD' : 'PhonePe',
      paymentStatus: o.paymentStatus,
      orderStatus: STATUS_LABEL[o.orderStatus] || o.orderStatus,
      units: (o.items || []).reduce((s, i) => s + Number(i.quantity || 0), 0),
      itemsValue: round2(o.subtotal),
      discount: round2(o.discount),
      shipping: round2(Number(o.shipping || 0) + Number(o.codFee || 0)),
      taxable: round2(t.totalTaxable),
      cgst: round2(t.totalCgst),
      sgst: round2(t.totalSgst),
      igst: round2(t.totalIgst),
      total: round2(o.total),
      refunded: round2(o.refundedAmount || 0),
      net: round2(Number(o.total || 0) - Number(o.refundedAmount || 0)),
    };
  });

  const lineRows = [];
  list.forEach((o) => {
    const t = taxOf(o, settings);
    (t.lines || []).forEach((l) =>
      lineRows.push({
        date: istDate(o.createdAt),
        orderNumber: o.orderNumber,
        invoiceNumber: o.invoice?.number || '',
        description: l.description,
        hsn: l.hsnCode,
        qty: l.quantity,
        gross: l.grossAmount,
        discount: l.discount,
        taxable: l.taxableValue,
        rate: l.gstRate / 100,
        cgst: l.cgst,
        sgst: l.sgst,
        igst: l.igst,
        total: l.total,
      })
    );
  });

  const totals = sumBy(rows, ['units', 'itemsValue', 'discount', 'shipping', 'taxable', 'cgst', 'sgst', 'igst', 'total', 'refunded', 'net']);
  return {
    kpis: [
      { label: 'Orders', value: rows.length, type: 'int' },
      { label: 'Gross Sales', value: totals.total, type: 'money' },
      { label: 'Taxable Value', value: totals.taxable, type: 'money' },
      { label: 'GST Collected', value: round2(totals.cgst + totals.sgst + totals.igst), type: 'money' },
      { label: 'Refunds', value: totals.refunded, type: 'money' },
      { label: 'Net Sales', value: totals.net, type: 'money' },
    ],
    sheets: [
      {
        name: 'Sales Register',
        columns: [
          date('Date', 'date'), text('Order No.', 'orderNumber', 18), text('Invoice No.', 'invoiceNumber', 16), text('Customer', 'customer', 22),
          text('Phone', 'phone', 14), text('State', 'state', 16), text('Buyer GSTIN', 'gstin', 17), text('Payment', 'paymentMethod', 10),
          text('Pay Status', 'paymentStatus', 12), text('Order Status', 'orderStatus', 14), int('Units', 'units', 7), money('Items Value', 'itemsValue'),
          money('Discount', 'discount', 11), money('Shipping/COD', 'shipping', 12), money('Taxable', 'taxable'), money('CGST', 'cgst', 11),
          money('SGST', 'sgst', 11), money('IGST', 'igst', 11), money('Invoice Total', 'total'), money('Refunded', 'refunded', 11), money('Net', 'net'),
        ],
        rows,
        totals,
        pdfColumns: ['date', 'orderNumber', 'invoiceNumber', 'customer', 'state', 'paymentMethod', 'orderStatus', 'taxable', 'cgst', 'sgst', 'igst', 'total'],
      },
      {
        name: 'Line Items',
        columns: [
          date('Date', 'date'), text('Order No.', 'orderNumber', 18), text('Invoice No.', 'invoiceNumber', 16), text('Description', 'description', 40),
          text('HSN/SAC', 'hsn', 10), int('Qty', 'qty', 6), money('Gross', 'gross', 12), money('Discount', 'discount', 11), money('Taxable', 'taxable', 12),
          pct('GST %', 'rate'), money('CGST', 'cgst', 11), money('SGST', 'sgst', 11), money('IGST', 'igst', 11), money('Total', 'total', 12),
        ],
        rows: lineRows,
        totals: sumBy(lineRows, ['qty', 'gross', 'discount', 'taxable', 'cgst', 'sgst', 'igst', 'total']),
        pdfSkip: true,
      },
    ],
  };
};

// ───────────── GST (GSTR-1 ready) ─────────────
const gst = async ({ range, settings }) => {
  const invoiced = await Order.find({ 'invoice.number': { $exists: true, $ne: null }, 'invoice.date': { $gte: range.from, $lte: range.to } })
    .sort({ 'invoice.sequence': 1 })
    .lean();
  const creditNotes = await Order.find({ 'invoice.creditNote.number': { $exists: true }, 'invoice.creditNote.date': { $gte: range.from, $lte: range.to } }).lean();

  const posLabel = (o) => {
    const code = o.invoice?.placeOfSupplyCode || stateCodeOf(o.shippingAddress?.state);
    return `${code}-${o.invoice?.placeOfSupply || canonicalStateName(o.shippingAddress?.state)}`;
  };

  const active = invoiced.filter((o) => o.invoice?.status !== 'CANCELLED');
  const cancelled = invoiced.filter((o) => o.invoice?.status === 'CANCELLED');

  // Invoice register
  const register = invoiced.map((o) => ({
    invoiceNumber: o.invoice.number,
    invoiceDate: istDate(o.invoice.date),
    orderNumber: o.orderNumber,
    customer: o.billingDetails?.businessName || o.shippingAddress?.fullName,
    gstin: o.billingDetails?.gstin || '',
    pos: posLabel(o),
    supply: o.invoice.isInterState ? 'Inter-state' : 'Intra-state',
    taxable: round2(o.invoice.totalTaxable),
    cgst: round2(o.invoice.totalCgst),
    sgst: round2(o.invoice.totalSgst),
    igst: round2(o.invoice.totalIgst),
    total: round2(o.invoice.grandTotal),
    status: o.invoice.status === 'CANCELLED' ? `Cancelled (CN ${o.invoice.creditNote?.number || ''})` : 'Issued',
  }));

  // B2B (Table 4)
  const b2b = [];
  active
    .filter((o) => o.billingDetails?.gstin)
    .forEach((o) => {
      const byRate = new Map();
      o.invoice.lines.forEach((l) => {
        const r = byRate.get(l.gstRate) || { taxable: 0, igst: 0, cgst: 0, sgst: 0 };
        r.taxable += l.taxableValue;
        r.igst += l.igst;
        r.cgst += l.cgst;
        r.sgst += l.sgst;
        byRate.set(l.gstRate, r);
      });
      byRate.forEach((v, rate) =>
        b2b.push({
          gstin: o.billingDetails.gstin,
          receiver: o.billingDetails.businessName || o.shippingAddress?.fullName,
          invoiceNumber: o.invoice.number,
          invoiceDate: istDate(o.invoice.date),
          invoiceValue: round2(o.invoice.grandTotal),
          pos: posLabel(o),
          reverseCharge: 'N',
          invoiceType: 'Regular B2B',
          rate: rate / 100,
          taxable: round2(v.taxable),
          igst: round2(v.igst),
          cgst: round2(v.cgst),
          sgst: round2(v.sgst),
          cess: 0,
        })
      );
    });

  // B2CL (Table 5) – inter-state to unregistered with invoice value > ₹1,00,000
  const B2CL_LIMIT = 100000;
  const b2cl = [];
  const b2csMap = new Map();
  active
    .filter((o) => !o.billingDetails?.gstin)
    .forEach((o) => {
      const isLarge = o.invoice.isInterState && Number(o.invoice.grandTotal) > B2CL_LIMIT;
      o.invoice.lines.forEach((l) => {
        if (isLarge) {
          b2cl.push({
            invoiceNumber: o.invoice.number,
            invoiceDate: istDate(o.invoice.date),
            invoiceValue: round2(o.invoice.grandTotal),
            pos: posLabel(o),
            rate: l.gstRate / 100,
            taxable: round2(l.taxableValue),
            igst: round2(l.igst),
            cess: 0,
          });
        } else {
          const key = `${posLabel(o)}|${l.gstRate}`;
          const r = b2csMap.get(key) || { type: 'OE', pos: posLabel(o), rate: l.gstRate / 100, taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 };
          r.taxable += l.taxableValue;
          r.igst += l.igst;
          r.cgst += l.cgst;
          r.sgst += l.sgst;
          b2csMap.set(key, r);
        }
      });
    });
  const b2cs = [...b2csMap.values()]
    .map((r) => ({ ...r, taxable: round2(r.taxable), igst: round2(r.igst), cgst: round2(r.cgst), sgst: round2(r.sgst) }))
    .sort((a, b) => a.pos.localeCompare(b.pos));

  // HSN (Table 12) split B2B / B2C
  const hsnRows = buildHsnRows(active);

  // Credit notes (CDNR / CDNUR)
  const cdn = creditNotes.map((o) => {
    const ratio = o.invoice.grandTotal ? Number(o.invoice.creditNote.amount || 0) / Number(o.invoice.grandTotal) : 1;
    return {
      noteNumber: o.invoice.creditNote.number,
      noteDate: istDate(o.invoice.creditNote.date),
      againstInvoice: o.invoice.number,
      invoiceDate: istDate(o.invoice.date),
      gstin: o.billingDetails?.gstin || '',
      type: o.billingDetails?.gstin ? 'CDNR' : 'CDNUR',
      pos: posLabel(o),
      reason: o.invoice.creditNote.reason || '',
      noteValue: round2(o.invoice.creditNote.amount),
      taxable: round2(o.invoice.totalTaxable * ratio),
      igst: round2(o.invoice.totalIgst * ratio),
      cgst: round2(o.invoice.totalCgst * ratio),
      sgst: round2(o.invoice.totalSgst * ratio),
    };
  });

  // Documents issued (Table 13)
  const seqs = invoiced.map((o) => o.invoice.number);
  const docs = [
    {
      nature: 'Invoices for outward supply',
      from: seqs[0] || '',
      to: seqs[seqs.length - 1] || '',
      total: invoiced.length,
      cancelled: cancelled.length,
      net: invoiced.length - cancelled.length,
    },
    {
      nature: 'Credit Note',
      from: cdn[0]?.noteNumber || '',
      to: cdn[cdn.length - 1]?.noteNumber || '',
      total: cdn.length,
      cancelled: 0,
      net: cdn.length,
    },
  ];

  const regTotals = sumBy(register.filter((r) => r.status === 'Issued'), ['taxable', 'cgst', 'sgst', 'igst', 'total']);
  const cdnTotals = sumBy(cdn, ['noteValue', 'taxable', 'igst', 'cgst', 'sgst']);
  return {
    kpis: [
      { label: 'Invoices Issued', value: invoiced.length, type: 'int' },
      { label: 'Taxable Value', value: regTotals.taxable, type: 'money' },
      { label: 'CGST', value: regTotals.cgst, type: 'money' },
      { label: 'SGST', value: regTotals.sgst, type: 'money' },
      { label: 'IGST', value: regTotals.igst, type: 'money' },
      { label: 'Credit Notes', value: cdnTotals.noteValue, type: 'money' },
    ],
    notes: [
      `Seller GSTIN: ${settings.business?.gstin || 'NOT SET – add it in Admin › Settings › Business & GST'}`,
      'B2CS rows are grouped by Place of Supply + Rate (GSTR-1 Table 7). Type OE = other than e-commerce operator.',
      'HSN summary is split into B2B and B2C as required from 2025 (Table 12). UQC: NOS for goods, NA for services.',
      'Cancelled invoices remain in the document series (Table 13) and are reversed through the listed credit notes.',
    ],
    sheets: [
      {
        name: 'Invoice Register',
        columns: [
          text('Invoice No.', 'invoiceNumber', 16), date('Invoice Date', 'invoiceDate'), text('Order No.', 'orderNumber', 18), text('Customer', 'customer', 24),
          text('Buyer GSTIN', 'gstin', 17), text('Place of Supply', 'pos', 20), text('Supply', 'supply', 11), money('Taxable', 'taxable'),
          money('CGST', 'cgst', 11), money('SGST', 'sgst', 11), money('IGST', 'igst', 11), money('Invoice Value', 'total'), text('Status', 'status', 22),
        ],
        rows: register,
        totals: regTotals,
        pdfColumns: ['invoiceNumber', 'invoiceDate', 'customer', 'pos', 'taxable', 'cgst', 'sgst', 'igst', 'total', 'status'],
      },
      {
        name: 'B2B (4A)',
        columns: [
          text('GSTIN of Recipient', 'gstin', 18), text('Receiver Name', 'receiver', 24), text('Invoice No.', 'invoiceNumber', 16), date('Invoice Date', 'invoiceDate'),
          money('Invoice Value', 'invoiceValue'), text('Place of Supply', 'pos', 20), text('Reverse Charge', 'reverseCharge', 9), text('Invoice Type', 'invoiceType', 13),
          pct('Rate', 'rate'), money('Taxable Value', 'taxable'), money('IGST', 'igst', 11), money('CGST', 'cgst', 11), money('SGST', 'sgst', 11), money('Cess', 'cess', 8),
        ],
        rows: b2b,
        totals: sumBy(b2b, ['taxable', 'igst', 'cgst', 'sgst']),
      },
      {
        name: 'B2CL (5)',
        columns: [
          text('Invoice No.', 'invoiceNumber', 16), date('Invoice Date', 'invoiceDate'), money('Invoice Value', 'invoiceValue'), text('Place of Supply', 'pos', 20),
          pct('Rate', 'rate'), money('Taxable Value', 'taxable'), money('IGST', 'igst', 11), money('Cess', 'cess', 8),
        ],
        rows: b2cl,
        totals: sumBy(b2cl, ['taxable', 'igst']),
      },
      {
        name: 'B2CS (7)',
        columns: [
          text('Type', 'type', 7), text('Place of Supply', 'pos', 24), pct('Rate', 'rate'), money('Taxable Value', 'taxable'),
          money('IGST', 'igst', 12), money('CGST', 'cgst', 12), money('SGST', 'sgst', 12), money('Cess', 'cess', 8),
        ],
        rows: b2cs,
        totals: sumBy(b2cs, ['taxable', 'igst', 'cgst', 'sgst']),
      },
      hsnSheet(hsnRows, 'HSN (12)'),
      {
        name: 'Credit Notes (9B)',
        columns: [
          text('Note No.', 'noteNumber', 16), date('Note Date', 'noteDate'), text('Against Invoice', 'againstInvoice', 16), date('Invoice Date', 'invoiceDate'),
          text('Type', 'type', 8), text('GSTIN', 'gstin', 17), text('Place of Supply', 'pos', 20), text('Reason', 'reason', 24), money('Note Value', 'noteValue'),
          money('Taxable', 'taxable'), money('IGST', 'igst', 11), money('CGST', 'cgst', 11), money('SGST', 'sgst', 11),
        ],
        rows: cdn,
        totals: cdnTotals,
      },
      {
        name: 'Docs Issued (13)',
        columns: [text('Nature of Document', 'nature', 30), text('Sr. No. From', 'from', 18), text('Sr. No. To', 'to', 18), int('Total Number', 'total', 12), int('Cancelled', 'cancelled', 11), int('Net Issued', 'net', 11)],
        rows: docs,
      },
    ],
  };
};

const buildHsnRows = (orders) => {
  const map = new Map();
  orders.forEach((o) => {
    const supply = o.billingDetails?.gstin ? 'B2B' : 'B2C';
    o.invoice.lines.forEach((l) => {
      const key = `${supply}|${l.hsnCode}|${l.gstRate}`;
      const r = map.get(key) || {
        supply,
        hsn: l.hsnCode,
        description: l.isService ? 'Shipping / handling services' : hsnDescription(l.hsnCode),
        uqc: l.isService ? 'NA' : 'NOS-NUMBERS',
        qty: 0,
        value: 0,
        rate: l.gstRate / 100,
        taxable: 0,
        igst: 0,
        cgst: 0,
        sgst: 0,
        cess: 0,
      };
      r.qty += l.isService ? 0 : Number(l.quantity || 0);
      r.value += Number(l.total || 0);
      r.taxable += Number(l.taxableValue || 0);
      r.igst += Number(l.igst || 0);
      r.cgst += Number(l.cgst || 0);
      r.sgst += Number(l.sgst || 0);
      map.set(key, r);
    });
  });
  return [...map.values()]
    .map((r) => ({ ...r, value: round2(r.value), taxable: round2(r.taxable), igst: round2(r.igst), cgst: round2(r.cgst), sgst: round2(r.sgst) }))
    .sort((a, b) => a.supply.localeCompare(b.supply) || a.hsn.localeCompare(b.hsn));
};

const hsnDescription = (hsn = '') => {
  const code = String(hsn);
  return HSN_DESCRIPTIONS[code] || HSN_DESCRIPTIONS[code.slice(0, 4)] || (code.startsWith('99') ? 'Services' : 'Goods');
};

const hsnSheet = (rows, name = 'HSN Summary') => ({
  name,
  columns: [
    text('Supply', 'supply', 8), text('HSN/SAC', 'hsn', 10), text('Description', 'description', 30), text('UQC', 'uqc', 13), int('Total Qty', 'qty', 10),
    money('Total Value', 'value'), pct('Rate', 'rate'), money('Taxable Value', 'taxable'), money('IGST', 'igst', 12), money('CGST', 'cgst', 12),
    money('SGST', 'sgst', 12), money('Cess', 'cess', 8),
  ],
  rows,
  totals: sumBy(rows, ['qty', 'value', 'taxable', 'igst', 'cgst', 'sgst']),
});

// ───────────── HSN summary only ─────────────
const hsn = async ({ range }) => {
  const invoiced = await Order.find({
    'invoice.number': { $exists: true },
    'invoice.status': { $ne: 'CANCELLED' },
    'invoice.date': { $gte: range.from, $lte: range.to },
  }).lean();
  const rows = buildHsnRows(invoiced);
  const t = sumBy(rows, ['qty', 'taxable', 'igst', 'cgst', 'sgst', 'value']);
  return {
    kpis: [
      { label: 'HSN Codes', value: new Set(rows.map((r) => r.hsn)).size, type: 'int' },
      { label: 'Units', value: t.qty, type: 'int' },
      { label: 'Taxable Value', value: t.taxable, type: 'money' },
      { label: 'Total Tax', value: round2(t.igst + t.cgst + t.sgst), type: 'money' },
    ],
    sheets: [hsnSheet(rows)],
  };
};

// ───────────── Product-wise ─────────────
const products = async ({ range, settings }) => {
  const list = await Order.find({ createdAt: { $gte: range.from, $lte: range.to }, ...VALID_SALE_FILTER }).lean();
  const map = new Map();
  list.forEach((o) => {
    const t = taxOf(o, settings);
    (o.items || []).forEach((it, idx) => {
      const l = t.lines?.[idx] || {};
      const key = `${it.product}|${it.variant?.sku || ''}`;
      const r = map.get(key) || {
        productId: String(it.product),
        name: it.name,
        variant: it.variant?.title || 'Standard',
        sku: it.variant?.sku || it.sku || '',
        hsn: it.hsnCode || l.hsnCode || '',
        category: it.categoryName || '',
        productType: it.productType || '',
        orders: 0,
        units: 0,
        gross: 0,
        discount: 0,
        taxable: 0,
        tax: 0,
        net: 0,
      };
      r.orders += 1;
      r.units += Number(it.quantity || 0);
      r.gross += Number(it.subtotal || 0);
      r.discount += Number(l.discount || 0);
      r.taxable += Number(l.taxableValue || 0);
      r.tax += Number(l.cgst || 0) + Number(l.sgst || 0) + Number(l.igst || 0);
      r.net += Number(l.total ?? it.subtotal);
      map.set(key, r);
    });
  });
  const ids = [...new Set([...map.values()].map((r) => r.productId))];
  const stockDocs = await Product.find({ _id: { $in: ids } }).select('name stock variants productType hsnCode category').populate('category', 'name productType hsnCode').lean();
  const stockMap = new Map(stockDocs.map((p) => [String(p._id), p]));
  const rows = [...map.values()]
    .map((r) => {
      const p = stockMap.get(r.productId);
      const stock = r.sku && p?.variants?.length ? p.variants.find((v) => v.sku === r.sku)?.stock ?? p?.stock : p?.stock;
      const type = r.productType || (p ? inferProductType(p, p.category) : '');
      return {
        ...r,
        category: r.category || p?.category?.name || '—',
        productType: PRODUCT_TYPES[type]?.label || type || '—',
        gross: round2(r.gross),
        discount: round2(r.discount),
        taxable: round2(r.taxable),
        tax: round2(r.tax),
        net: round2(r.net),
        avgPrice: r.units ? round2(r.net / r.units) : 0,
        stock: stock ?? 0,
      };
    })
    .sort((a, b) => b.net - a.net);
  const t = sumBy(rows, ['orders', 'units', 'gross', 'discount', 'taxable', 'tax', 'net']);
  return {
    kpis: [
      { label: 'Products Sold', value: rows.length, type: 'int' },
      { label: 'Units', value: t.units, type: 'int' },
      { label: 'Net Revenue', value: t.net, type: 'money' },
      { label: 'Discounts', value: t.discount, type: 'money' },
    ],
    sheets: [
      {
        name: 'Product Sales',
        columns: [
          text('Product', 'name', 32), text('Variant', 'variant', 12), text('SKU', 'sku', 16), text('Category', 'category', 16), text('Type', 'productType', 16), text('HSN', 'hsn', 8), int('Orders', 'orders', 8), int('Units', 'units', 8),
          money('Gross', 'gross'), money('Discount', 'discount', 11), money('Taxable', 'taxable'), money('GST', 'tax', 11), money('Net Revenue', 'net'),
          money('Avg. Price', 'avgPrice', 11), int('Current Stock', 'stock', 11),
        ],
        rows,
        totals: t,
      },
    ],
  };
};

// ───────────── Category & product-type sales ─────────────
const categories = async ({ range, settings }) => {
  const list = await Order.find({ createdAt: { $gte: range.from, $lte: range.to }, ...VALID_SALE_FILTER }).lean();
  // Older orders (before category snapshots existed) are resolved from the current product record
  const missing = new Set();
  list.forEach((o) => (o.items || []).forEach((it) => !it.categoryName && missing.add(String(it.product))));
  const docs = missing.size
    ? await Product.find({ _id: { $in: [...missing] } }).select('name productType hsnCode category').populate('category', 'name productType hsnCode').lean()
    : [];
  const lookup = new Map(docs.map((p) => [String(p._id), p]));

  const byCat = new Map();
  const byType = new Map();
  const add = (map, key, label, extra, it, l) => {
    const r = map.get(key) || { name: label, ...extra, orders: new Set(), units: 0, gross: 0, discount: 0, taxable: 0, tax: 0, net: 0 };
    r.orders.add(it.__order);
    r.units += Number(it.quantity || 0);
    r.gross += Number(it.subtotal || 0);
    r.discount += Number(l.discount || 0);
    r.taxable += Number(l.taxableValue || 0);
    r.tax += Number(l.cgst || 0) + Number(l.sgst || 0) + Number(l.igst || 0);
    r.net += Number(l.total ?? it.subtotal);
    map.set(key, r);
  };

  list.forEach((o) => {
    const t = taxOf(o, settings);
    (o.items || []).forEach((it, idx) => {
      const l = t.lines?.[idx] || {};
      const p = lookup.get(String(it.product));
      const catName = it.categoryName || p?.category?.name || 'Uncategorised';
      const type = it.productType || (p ? inferProductType(p, p.category) : 'GENERAL');
      const typeLabel = PRODUCT_TYPES[type]?.label || type;
      const tagged = { ...it, __order: o.orderNumber };
      add(byCat, catName, catName, { productType: typeLabel }, tagged, l);
      add(byType, type, typeLabel, { hsn: it.hsnCode || l.hsnCode || '' }, tagged, l);
    });
  });

  const finish = (map) => {
    const rows = [...map.values()]
      .map((r) => ({
        ...r,
        orders: r.orders.size,
        gross: round2(r.gross),
        discount: round2(r.discount),
        taxable: round2(r.taxable),
        tax: round2(r.tax),
        net: round2(r.net),
      }))
      .sort((a, b) => b.net - a.net);
    const total = rows.reduce((s, r) => s + r.net, 0) || 1;
    rows.forEach((r) => (r.share = round2(r.net / total)));
    return rows;
  };
  const catRows = finish(byCat);
  const typeRows = finish(byType);
  const metricCols = () => [
    int('Orders', 'orders', 8), int('Units', 'units', 8), money('Gross', 'gross'), money('Discount', 'discount', 11),
    money('Taxable', 'taxable'), money('GST', 'tax', 11), money('Net Revenue', 'net'), pct('Share', 'share'),
  ];
  const t = sumBy(catRows, ['units', 'gross', 'discount', 'taxable', 'tax', 'net']);
  return {
    kpis: [
      { label: 'Categories', value: catRows.length, type: 'int' },
      { label: 'Product Types', value: typeRows.length, type: 'int' },
      { label: 'Units', value: t.units, type: 'int' },
      { label: 'Net Revenue', value: t.net, type: 'money' },
    ],
    sheets: [
      { name: 'By Category', columns: [text('Category', 'name', 28), text('Type', 'productType', 18), ...metricCols()], rows: catRows, totals: t },
      { name: 'By Product Type', columns: [text('Product Type', 'name', 24), text('HSN', 'hsn', 8), ...metricCols()], rows: typeRows, totals: sumBy(typeRows, ['units', 'gross', 'discount', 'taxable', 'tax', 'net']) },
    ],
  };
};

// ───────────── Order book ─────────────
const orders = async ({ range }) => {
  const list = await Order.find({ createdAt: { $gte: range.from, $lte: range.to } }).populate('user', 'email').sort({ createdAt: -1 }).lean();
  const rows = list.map((o) => ({
    date: istDate(o.createdAt),
    orderNumber: o.orderNumber,
    customer: o.shippingAddress?.fullName,
    email: o.customerEmail || o.user?.email || '',
    phone: o.shippingAddress?.phone,
    city: o.shippingAddress?.city,
    state: canonicalStateName(o.shippingAddress?.state),
    pincode: o.shippingAddress?.postalCode,
    items: (o.items || []).map((i) => `${i.name}${i.variant?.title ? ` (${i.variant.title})` : ''} ×${i.quantity}`).join('; '),
    payment: o.paymentMethod === 'COD' ? 'COD' : 'PhonePe',
    paymentStatus: o.paymentStatus,
    status: STATUS_LABEL[o.orderStatus] || o.orderStatus,
    coupon: o.appliedCoupon?.code || '',
    total: round2(o.total),
    courier: o.courier || '',
    awb: o.trackingId || '',
    invoice: o.invoice?.number || '',
  }));
  const counts = {};
  rows.forEach((r) => (counts[r.status] = (counts[r.status] || 0) + 1));
  return {
    kpis: [
      { label: 'Orders', value: rows.length, type: 'int' },
      { label: 'Delivered', value: counts.Delivered || 0, type: 'int' },
      { label: 'Shipped', value: counts.Shipped || 0, type: 'int' },
      { label: 'Cancelled', value: counts.Cancelled || 0, type: 'int' },
      { label: 'Order Value', value: sumBy(rows, ['total']).total, type: 'money' },
    ],
    sheets: [
      {
        name: 'Orders',
        columns: [
          date('Date', 'date'), text('Order No.', 'orderNumber', 18), text('Customer', 'customer', 22), text('Email', 'email', 26), text('Phone', 'phone', 14),
          text('City', 'city', 14), text('State', 'state', 16), text('PIN', 'pincode', 8), text('Items', 'items', 46), text('Payment', 'payment', 9),
          text('Pay Status', 'paymentStatus', 12), text('Status', 'status', 14), text('Coupon', 'coupon', 11), money('Total', 'total', 12),
          text('Courier', 'courier', 12), text('AWB', 'awb', 16), text('Invoice', 'invoice', 16),
        ],
        rows,
        totals: sumBy(rows, ['total']),
        pdfColumns: ['date', 'orderNumber', 'customer', 'state', 'payment', 'paymentStatus', 'status', 'total', 'awb'],
      },
    ],
  };
};

// ───────────── Payments & refunds ─────────────
const payments = async ({ range }) => {
  const list = await Order.find({ createdAt: { $gte: range.from, $lte: range.to }, paymentMethod: 'ONLINE' }).sort({ createdAt: -1 }).lean();
  const rows = list.map((o) => ({
    date: istDate(o.createdAt),
    orderNumber: o.orderNumber,
    merchantOrderId: o.paymentInfo?.merchantOrderId || '',
    transactionId: o.paymentInfo?.transactionId || '',
    mode: o.paymentInfo?.paymentMode || '',
    attempts: o.paymentInfo?.attempts || 0,
    amount: round2(o.total),
    status: o.paymentStatus,
    paidAt: o.paymentInfo?.paidAt ? istDate(o.paymentInfo.paidAt) : '',
    refunded: round2(o.refundedAmount || 0),
  }));
  const refundRows = [];
  const refundOrders = await Order.find({ 'refunds.0': { $exists: true }, 'refunds.createdAt': { $gte: range.from, $lte: range.to } }).lean();
  refundOrders.forEach((o) =>
    o.refunds.forEach((r) =>
      refundRows.push({
        date: istDate(r.createdAt),
        orderNumber: o.orderNumber,
        refundId: r.merchantRefundId,
        gatewayRefundId: r.gatewayRefundId || '',
        amount: round2(r.amount),
        state: r.state,
        reason: r.reason,
        by: r.initiatedBy,
      })
    )
  );
  const captured = rows.filter((r) => ['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(r.status));
  return {
    kpis: [
      { label: 'Payment Attempts', value: rows.length, type: 'int' },
      { label: 'Successful', value: captured.length, type: 'int' },
      { label: 'Success Rate', value: rows.length ? round2((captured.length / rows.length) * 100) : 0, type: 'percentRaw' },
      { label: 'Captured', value: sumBy(captured, ['amount']).amount, type: 'money' },
      { label: 'Refunded', value: sumBy(refundRows, ['amount']).amount, type: 'money' },
    ],
    sheets: [
      {
        name: 'PhonePe Transactions',
        columns: [
          date('Date', 'date'), text('Order No.', 'orderNumber', 18), text('Merchant Order ID', 'merchantOrderId', 22), text('PhonePe Txn ID', 'transactionId', 26),
          text('Mode', 'mode', 12), int('Attempts', 'attempts', 9), money('Amount', 'amount', 12), text('Status', 'status', 18), date('Paid On', 'paidAt'), money('Refunded', 'refunded', 12),
        ],
        rows,
        totals: sumBy(rows, ['amount', 'refunded']),
        pdfColumns: ['date', 'orderNumber', 'transactionId', 'mode', 'amount', 'status', 'refunded'],
      },
      {
        name: 'Refunds',
        columns: [
          date('Date', 'date'), text('Order No.', 'orderNumber', 18), text('Refund ID', 'refundId', 22), text('Gateway Refund ID', 'gatewayRefundId', 24),
          money('Amount', 'amount', 12), text('State', 'state', 11), text('Reason', 'reason', 30), text('Initiated By', 'by', 22),
        ],
        rows: refundRows,
        totals: sumBy(refundRows, ['amount']),
      },
    ],
  };
};

// ───────────── Customers ─────────────
const customers = async ({ range }) => {
  const agg = await Order.aggregate([
    { $match: { createdAt: { $gte: range.from, $lte: range.to }, ...VALID_SALE_FILTER } },
    {
      $group: {
        _id: '$user',
        orders: { $sum: 1 },
        spent: { $sum: '$total' },
        first: { $min: '$createdAt' },
        last: { $max: '$createdAt' },
        name: { $last: '$shippingAddress.fullName' },
        phone: { $last: '$shippingAddress.phone' },
        city: { $last: '$shippingAddress.city' },
        state: { $last: '$shippingAddress.state' },
      },
    },
    { $sort: { spent: -1 } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
  ]);
  const rows = agg.map((c) => ({
    name: c.u?.[0]?.name || c.name,
    email: c.u?.[0]?.email || '',
    phone: c.phone,
    city: c.city,
    state: canonicalStateName(c.state),
    orders: c.orders,
    spent: round2(c.spent),
    aov: round2(c.spent / c.orders),
    first: istDate(c.first),
    last: istDate(c.last),
    since: istDate(c.u?.[0]?.createdAt),
  }));
  const t = sumBy(rows, ['orders', 'spent']);
  return {
    kpis: [
      { label: 'Customers', value: rows.length, type: 'int' },
      { label: 'Repeat Customers', value: rows.filter((r) => r.orders > 1).length, type: 'int' },
      { label: 'Revenue', value: t.spent, type: 'money' },
      { label: 'Avg. per Customer', value: rows.length ? round2(t.spent / rows.length) : 0, type: 'money' },
    ],
    sheets: [
      {
        name: 'Customers',
        columns: [
          text('Customer', 'name', 24), text('Email', 'email', 28), text('Phone', 'phone', 14), text('City', 'city', 14), text('State', 'state', 16),
          int('Orders', 'orders', 8), money('Total Spent', 'spent'), money('AOV', 'aov', 11), date('First Order', 'first'), date('Last Order', 'last'), date('Customer Since', 'since'),
        ],
        rows,
        totals: t,
      },
    ],
  };
};

// ───────────── State-wise ─────────────
const statewise = async ({ range, settings }) => {
  const list = await Order.find({ createdAt: { $gte: range.from, $lte: range.to }, ...VALID_SALE_FILTER }).lean();
  const map = new Map();
  list.forEach((o) => {
    const t = taxOf(o, settings);
    const st = canonicalStateName(o.shippingAddress?.state) || 'Unknown';
    const r = map.get(st) || { state: st, code: stateCodeOf(st), orders: 0, units: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
    r.orders += 1;
    r.units += (o.items || []).reduce((s, i) => s + Number(i.quantity || 0), 0);
    r.taxable += Number(t.totalTaxable || 0);
    r.cgst += Number(t.totalCgst || 0);
    r.sgst += Number(t.totalSgst || 0);
    r.igst += Number(t.totalIgst || 0);
    r.total += Number(o.total || 0);
    map.set(st, r);
  });
  const rows = [...map.values()]
    .map((r) => ({ ...r, taxable: round2(r.taxable), cgst: round2(r.cgst), sgst: round2(r.sgst), igst: round2(r.igst), total: round2(r.total) }))
    .sort((a, b) => b.total - a.total);
  const t = sumBy(rows, ['orders', 'units', 'taxable', 'cgst', 'sgst', 'igst', 'total']);
  rows.forEach((r) => (r.share = t.total ? r.total / t.total : 0));
  return {
    kpis: [
      { label: 'States', value: rows.length, type: 'int' },
      { label: 'Orders', value: t.orders, type: 'int' },
      { label: 'Revenue', value: t.total, type: 'money' },
    ],
    sheets: [
      {
        name: 'State-wise Sales',
        columns: [
          text('State', 'state', 24), text('GST Code', 'code', 9), int('Orders', 'orders', 8), int('Units', 'units', 8), money('Taxable', 'taxable'),
          money('CGST', 'cgst', 11), money('SGST', 'sgst', 11), money('IGST', 'igst', 11), money('Total', 'total'), pct('Share', 'share'),
        ],
        rows,
        totals: t,
      },
    ],
  };
};

// ───────────── Inventory ─────────────
const inventory = async ({ settings } = {}) => {
  const list = await Product.find({ status: { $ne: 'ARCHIVED' } }).populate('category', 'name productType hsnCode gstRate').sort({ name: 1 }).lean();
  const rows = [];
  list.forEach((p) => {
    const price = p.salePrice && p.salePrice < p.price ? p.salePrice : p.price;
    const tax = resolveTax(p, p.category, settings || {});
    const type = PRODUCT_TYPES[tax.productType]?.label || tax.productType;
    if (p.variants?.length) {
      p.variants.forEach((v) => {
        const vp = v.salePrice && v.salePrice < v.price ? v.salePrice : v.price;
        rows.push({
          name: p.name, variant: v.title, sku: v.sku, category: p.category?.name || '', productType: type, hsn: tax.hsnCode, gstRate: tax.gstRate / 100, status: p.status,
          stock: v.stock, price: vp, value: round2(vp * v.stock), sold: p.totalSold || 0,
          alert: v.stock <= 0 ? 'OUT OF STOCK' : v.stock <= (p.lowStockThreshold ?? 5) ? 'LOW' : 'OK',
        });
      });
    } else {
      rows.push({
        name: p.name, variant: 'Standard', sku: p.sku, category: p.category?.name || '', productType: type, hsn: tax.hsnCode, gstRate: tax.gstRate / 100, status: p.status,
        stock: p.stock, price, value: round2(price * p.stock), sold: p.totalSold || 0,
        alert: p.stock <= 0 ? 'OUT OF STOCK' : p.stock <= (p.lowStockThreshold ?? 5) ? 'LOW' : 'OK',
      });
    }
  });
  const t = sumBy(rows, ['stock', 'value']);
  return {
    kpis: [
      { label: 'SKUs', value: rows.length, type: 'int' },
      { label: 'Units in Stock', value: t.stock, type: 'int' },
      { label: 'Stock Value (MRP)', value: t.value, type: 'money' },
      { label: 'Low / Out of Stock', value: rows.filter((r) => r.alert !== 'OK').length, type: 'int' },
    ],
    sheets: [
      {
        name: 'Inventory',
        columns: [
          text('Product', 'name', 32), text('Variant', 'variant', 12), text('SKU', 'sku', 18), text('Category', 'category', 16), text('Type', 'productType', 16), text('HSN', 'hsn', 8), pct('GST', 'gstRate', 7),
          text('Status', 'status', 9), int('Stock', 'stock', 8), money('Selling Price', 'price', 13), money('Stock Value', 'value', 14), int('Total Sold', 'sold', 10), text('Alert', 'alert', 13),
        ],
        rows,
        totals: t,
      },
    ],
  };
};
