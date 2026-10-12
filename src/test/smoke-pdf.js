/**
 * Offline smoke test for invoice, shipping label and report rendering (no database needed).
 *   node src/test/smoke-pdf.js [outDir]
 */
import fs from 'fs';
import path from 'path';
import { computeTaxBreakup, sellerSnapshot } from '../services/invoiceService.js';
import { renderInvoicePdf } from '../services/pdf/invoicePdf.js';
import { renderShippingLabelPdf, code128Pattern } from '../services/pdf/labelPdf.js';
import { renderReportPdf } from '../services/reports/pdfExport.js';
import { renderReportXlsx } from '../services/reports/excelExport.js';
import { amountInWords } from '../utils/helpers.js';

const out = process.argv[2] || path.resolve('smoke-output');
fs.mkdirSync(out, { recursive: true });

const settings = {
  business: {
    brandName: 'Jayrup',
    tradeName: 'Jayrup',
    tagline: 'Skincare · Fragrances · Personal Care',
    legalName: 'FITJAYESH',
    registrationNote: 'MSME Registered',
    gstin: '24ABCDE1234F1Z5',
    pan: 'ABCDE1234F',
    addressLine1: 'G-28, Metropolis Complex',
    addressLine2: 'Gambhoi–Bhiloda Road, Gambhoi',
    city: 'Himatnagar',
    district: 'Sabarkantha',
    state: 'Gujarat',
    stateCode: '24',
    postalCode: '383030',
    country: 'India',
    phone: '+91 94081 33100',
    email: 'care@jayrup.in',
    website: 'https://jayrup.in',
  },
  invoice: { prefix: 'JR', defaultHsnCode: '3304', defaultGstRate: 18, shippingGstRate: 18, shippingSacCode: '996812', signatoryName: 'Authorised Signatory' },
  freeShippingThreshold: 999,
  flatShippingFee: 100,
};

const makeOrder = (state, extra = {}) => {
  const order = {
    orderNumber: 'JR-261012-48213',
    createdAt: new Date(),
    customerEmail: 'customer@example.com',
    paymentMethod: 'ONLINE',
    paymentStatus: 'PAID',
    orderStatus: 'PAID',
    paymentInfo: { transactionId: 'OM2410121230456789', paymentMode: 'UPI_INTENT' },
    items: [
      { name: 'Jayrup Face Cream', sku: 'JR-FC-15', hsnCode: '3304', gstRate: 18, productType: 'SKINCARE', price: 399, quantity: 2, subtotal: 798, variant: { title: '15 g' } },
      { name: 'Royal Flora Eau De Parfum', sku: 'JR-RF-50', hsnCode: '3303', gstRate: 18, price: 1999, quantity: 1, subtotal: 1999, variant: { title: '50 ml' } },
    ],
    subtotal: 2797,
    discount: 280,
    shipping: 0,
    codFee: 0,
    total: 2517,
    appliedCoupon: { code: 'WELCOME10' },
    shippingAddress: { fullName: 'Priya Patel', phone: '9876543210', addressLine1: '12, Shanti Nagar Society', addressLine2: 'Near Town Hall', city: state === 'Gujarat' ? 'Ahmedabad' : 'Mumbai', state, postalCode: state === 'Gujarat' ? '380009' : '400001', country: 'India' },
    billingDetails: {},
    ...extra,
  };
  order.invoice = { number: 'JR/26-27/00001', date: new Date(), status: 'ISSUED', seller: sellerSnapshot(settings), ...computeTaxBreakup(order, settings) };
  return order;
};

const intra = makeOrder('Gujarat');
const inter = makeOrder('Maharashtra', { paymentMethod: 'COD', paymentStatus: 'PENDING', orderStatus: 'SHIPPED', shipping: 100, codFee: 49, discount: 0, appliedCoupon: {}, subtotal: 798, total: 947, items: [intra.items[0]], courier: 'Delhivery', trackingId: '1490811234567' });

console.log('Intra-state tax:', { taxable: intra.invoice.totalTaxable, cgst: intra.invoice.totalCgst, sgst: intra.invoice.totalSgst, igst: intra.invoice.totalIgst, roundOff: intra.invoice.roundOff, grand: intra.invoice.grandTotal });
console.log('Inter-state tax:', { taxable: inter.invoice.totalTaxable, igst: inter.invoice.totalIgst, roundOff: inter.invoice.roundOff, grand: inter.invoice.grandTotal });
console.log('Words:', amountInWords(2517.5));

// Mixed-rate cart (perfume 18 % + hair oil 5 %) with shipping → shipping must follow the highest item rate
const mixed = makeOrder('Rajasthan', {
  items: [
    { name: 'Royal Oud Eau De Parfum', sku: 'JR-RO-100', hsnCode: '3303', gstRate: 18, productType: 'FRAGRANCE', price: 599, quantity: 1, subtotal: 599, variant: { title: '100 ml' } },
    { name: 'Herbal Hair Oil', sku: 'JR-HO-100', hsnCode: '3305', gstRate: 5, productType: 'HAIR_CARE', price: 249, quantity: 1, subtotal: 249, variant: { title: '100 ml' } },
  ],
  subtotal: 848, discount: 0, appliedCoupon: {}, shipping: 100, total: 948,
});
const shipLine = mixed.invoice.lines.find((l) => l.isService);
console.log('Mixed cart:', mixed.invoice.lines.map((l) => `${l.hsnCode}@${l.gstRate}%`).join(', '), '| shipping rate', shipLine.gstRate);
if (shipLine.gstRate !== 18) throw new Error('Shipping GST should follow the highest item rate (18%)');
const fixed = computeTaxBreakup(mixed, { ...settings, invoice: { ...settings.invoice, shippingTaxMode: 'FIXED', shippingGstRate: 12 } });
if (fixed.lines.find((l) => l.isService).gstRate !== 12) throw new Error('FIXED shipping GST mode not applied');

// Code128 sanity: every symbol must have 11 modules (stop has 13)
const pattern = code128Pattern('JR-261012-48213');
console.log('Barcode modules:', [...pattern].reduce((s, d) => s + Number(d), 0));

fs.writeFileSync(path.join(out, 'invoice-intra.pdf'), await renderInvoicePdf(intra, { settings }));
fs.writeFileSync(path.join(out, 'invoice-mixed-rates.pdf'), await renderInvoicePdf(mixed, { settings }));
fs.writeFileSync(path.join(out, 'invoice-inter-cod.pdf'), await renderInvoicePdf(inter, { settings }));
fs.writeFileSync(path.join(out, 'label.pdf'), await renderShippingLabelPdf(inter, { settings }));

const report = {
  type: 'sales',
  title: 'Sales Register',
  period: '2026-10-01 to 2026-10-12',
  from: '2026-10-01',
  to: '2026-10-12',
  generatedAt: new Date(),
  business: settings.business,
  kpis: [
    { label: 'Orders', value: 2, type: 'int' },
    { label: 'Gross Sales', value: 3464, type: 'money' },
    { label: 'GST Collected', value: 528.4, type: 'money' },
    { label: 'Net Sales', value: 3464, type: 'money' },
  ],
  notes: ['Sample dataset generated by smoke test.'],
  sheets: [
    {
      name: 'Sales Register',
      columns: [
        { header: 'Date', key: 'date', type: 'date', width: 12 },
        { header: 'Order No.', key: 'orderNumber', type: 'text', width: 18 },
        { header: 'Customer', key: 'customer', type: 'text', width: 22 },
        { header: 'State', key: 'state', type: 'text', width: 14 },
        { header: 'Taxable', key: 'taxable', type: 'money', width: 14 },
        { header: 'CGST', key: 'cgst', type: 'money', width: 11 },
        { header: 'SGST', key: 'sgst', type: 'money', width: 11 },
        { header: 'IGST', key: 'igst', type: 'money', width: 11 },
        { header: 'Total', key: 'total', type: 'money', width: 14 },
      ],
      rows: [
        { date: '2026-10-11', orderNumber: intra.orderNumber, customer: 'Priya Patel', state: 'Gujarat', taxable: intra.invoice.totalTaxable, cgst: intra.invoice.totalCgst, sgst: intra.invoice.totalSgst, igst: 0, total: intra.total },
        { date: '2026-10-12', orderNumber: 'JR-261012-11111', customer: 'Rahul Shah', state: 'Maharashtra', taxable: inter.invoice.totalTaxable, cgst: 0, sgst: 0, igst: inter.invoice.totalIgst, total: inter.total },
      ],
      totals: { taxable: 2000, cgst: 100, sgst: 100, igst: 50, total: 3464 },
    },
  ],
};
fs.writeFileSync(path.join(out, 'report.pdf'), await renderReportPdf(report));
fs.writeFileSync(path.join(out, 'report.xlsx'), Buffer.from(await renderReportXlsx(report)));
console.log('✓ Wrote PDFs & XLSX to', out);
