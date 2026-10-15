/**
 * Invoices issued BEFORE the GSTIN was entered in Admin › Settings print "GST: Unregistered" and show no
 * CGST/SGST/IGST, because every invoice freezes the seller details at the moment it is issued.
 *
 *   npm run invoices:gstin-preview   → lists those invoices (changes nothing)
 *   npm run invoices:gstin-fix       → re-applies the CURRENT business details + GST breakup to them
 *
 * Invoice number, date and amounts are kept – only the seller block (GSTIN, PAN, address) and the tax
 * split are refreshed. Invoices that already have a credit note are never touched.
 * Use this only if the business was GST-registered on those invoice dates (ask your CA if unsure).
 */
import '../config/env.js'; // must stay first: loads .env + MongoDB DNS fix
import mongoose from 'mongoose';
import { Order } from '../models/Order.js';
import { Setting } from '../models/Setting.js';
import { sellerSnapshot, computeTaxBreakup } from '../services/invoiceService.js';
import { isValidGSTIN } from '../utils/helpers.js';

const APPLY = process.argv.includes('--yes');

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set in .env');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  const store = await Setting.getStoreSettings();
  const gstin = store.business?.gstin || '';
  if (!isValidGSTIN(gstin)) throw new Error('No valid GSTIN in Admin › Settings › GST & Tax yet – add it and save first.');

  // --seller: invoices that already carry THIS GSTIN but an old business name/address (e.g. FITJAYESH) get the
  // current seller block. Amounts and GST split are not touched.
  if (process.argv.includes('--seller')) {
    const rows = await Order.find({ 'invoice.seller.gstin': gstin, 'invoice.seller.legalName': { $ne: store.business.legalName } });
    console.log(`\nInvoices with GSTIN ${gstin} but an old legal name: ${rows.length}`);
    for (const o of rows) {
      console.log(`  ${o.invoice.number}  ${o.invoice.seller?.legalName || '—'} → ${store.business.legalName}`);
      if (!APPLY) continue;
      o.invoice = { ...o.invoice.toObject(), seller: sellerSnapshot(store) };
      o.markModified('invoice');
      await o.save({ validateBeforeSave: false });
    }
    console.log(APPLY ? `✓ Updated ${rows.length} invoice(s).\n` : 'PREVIEW ONLY – to apply: npm run invoices:seller-fix\n');
    await mongoose.disconnect();
    return;
  }

  const orders = await Order.find({
    'invoice.number': { $exists: true },
    'invoice.creditNote.number': { $exists: false },
    $or: [{ 'invoice.seller.gstin': { $in: ['', null] } }, { 'invoice.seller.gstin': { $exists: false } }],
  }).sort({ 'invoice.date': 1 });

  console.log(`\nCurrent GSTIN: ${gstin} (${store.invoice?.gstScheme || 'REGULAR'} scheme)`);
  console.log(`Invoices printed without a GSTIN: ${orders.length}\n`);
  for (const o of orders) {
    const next = computeTaxBreakup(o, store);
    console.log(`  ${o.invoice.number}  ${o.orderNumber}  ₹${o.total}  ${o.invoice.type} → ${next.type}  GST ₹${o.invoice.totalTax || 0} → ₹${next.totalTax}`);
    if (!APPLY) continue;
    const { pricesIncludeTax, ...breakup } = next; // eslint-disable-line no-unused-vars
    o.invoice = {
      ...o.invoice.toObject(),
      seller: sellerSnapshot(store),
      ...breakup,
    };
    o.markModified('invoice');
    await o.save({ validateBeforeSave: false });
  }
  if (!orders.length) console.log('  Nothing to fix – every invoice already carries the GSTIN.');
  else if (APPLY) console.log(`\n✓ Updated ${orders.length} invoice(s). Download them again from Admin › Orders.\n`);
  else console.log('\nPREVIEW ONLY – nothing changed. To apply:  npm run invoices:gstin-fix\n');
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('\n✖', err.message, '\n');
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
