/**
 * Jayrup health check – READ ONLY (changes nothing).
 *
 *   npm run doctor
 *
 * Checks the database and configuration the storefront depends on and prints the exact command or
 * admin screen that fixes each problem: missing catalogue products, categories without products,
 * products pointing to missing/inactive categories, blog "Shop the products" links, images that
 * don't exist, redirect loops, hero banner, GST / shipping settings and production .env values.
 */
import '../config/env.js'; // must stay first: loads .env + MongoDB DNS fix
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Blog } from '../models/Blog.js';
import { Redirect } from '../models/Redirect.js';
import { Advertisement } from '../models/Advertisement.js';
import { Setting } from '../models/Setting.js';
import { User } from '../models/User.js';
import { PRODUCTS, CATEGORIES } from '../seed/data/catalogData.js';
import { isValidGSTIN } from '../utils/helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '../../../jayroop-perfume-frontend/public');

let problems = 0;
let warnings = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const warn = (m, fix) => {
  warnings += 1;
  console.log(`  ⚠ ${m}${fix ? `\n      → ${fix}` : ''}`);
};
const bad = (m, fix) => {
  problems += 1;
  console.log(`  ✖ ${m}${fix ? `\n      → ${fix}` : ''}`);
};
const section = (t) => console.log(`\n━━ ${t} ━━`);
const localImageMissing = (url = '') => url.startsWith('/images/') && fs.existsSync(PUBLIC_DIR) && !fs.existsSync(path.join(PUBLIC_DIR, url));

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set in .env');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  console.log(`\nJayrup health check – database "${mongoose.connection.name}" (read only, nothing is changed)`);

  // ───────── Catalogue ─────────
  section('Products & categories');
  const [products, categories] = await Promise.all([
    Product.find().select('name slug sku status category subCategory images price stock').lean(),
    Category.find().select('name slug status parent').lean(),
  ]);
  const catById = new Map(categories.map((c) => [String(c._id), c]));
  const active = products.filter((p) => p.status === 'ACTIVE');
  console.log(`  ${products.length} products (${active.length} active) · ${categories.length} categories (${categories.filter((c) => c.status === 'ACTIVE').length} active)`);

  const missingSeed = PRODUCTS.filter((sp) => !products.some((p) => p.slug === sp.slug && p.status === 'ACTIVE'));
  if (missingSeed.length) {
    bad(
      `Catalogue products missing or not ACTIVE: ${missingSeed.map((p) => p.slug).join(', ')}`,
      'npm run catalog:add   (adds/updates them – keeps everything else)   or   npm run catalog:reset   (delete old + add)'
    );
  } else ok('Royal Flora & Pimples Cream are in the database and active');

  const missingCats = CATEGORIES.filter((sc) => !categories.some((c) => c.slug === sc.slug && c.status === 'ACTIVE'));
  if (missingCats.length) bad(`Catalogue categories missing or inactive: ${missingCats.map((c) => c.slug).join(', ')}`, 'npm run catalog:add');
  else ok('Luxury Perfumes & Ayurvedic Skin Care categories are active');

  const extra = active.filter((p) => !PRODUCTS.some((sp) => sp.slug === p.slug));
  if (extra.length) warn(`${extra.length} other active product(s) still on the store: ${extra.map((p) => p.slug).slice(0, 8).join(', ')}`, 'npm run catalog:reset  (or delete them in Admin › Products)');

  for (const p of active) {
    const cat = catById.get(String(p.category));
    if (!p.category || !cat) bad(`"${p.name}" has no valid category – it won't show on any category page`, 'Admin › Products › edit › Category');
    else if (cat.status !== 'ACTIVE') bad(`"${p.name}" is in the INACTIVE category "${cat.name}"`, 'Admin › Categories › set it Active, or move the product');
    if (!p.images?.length) bad(`"${p.name}" has no images`, 'Admin › Products › Images');
    for (const img of p.images || []) if (localImageMissing(img.url)) bad(`"${p.name}" image not found in frontend/public: ${img.url}`);
    if (!p.price) bad(`"${p.name}" has no price`);
    if (!p.stock) warn(`"${p.name}" is out of stock (stock 0)`, 'Admin › Inventory');
  }

  for (const c of categories.filter((x) => x.status === 'ACTIVE')) {
    const count = active.filter((p) => String(p.category) === String(c._id) || String(p.subCategory) === String(c._id)).length;
    if (!count) warn(`Category "${c.name}" (/category/${c.slug}) has no active products – the menu shows it but the page is empty`, 'npm run catalog:reset, or set the category Inactive in Admin › Categories');
    else ok(`Category "${c.name}" → ${count} product(s)`);
  }

  // ───────── Blogs ─────────
  section('Blogs');
  const blogs = await Blog.find({ status: 'PUBLISHED' }).select('title slug relatedProductSlugs coverImage').lean();
  console.log(`  ${blogs.length} published article(s)`);
  if (!blogs.length) warn('No published articles', 'npm run blogs:add');
  const liveSlugs = new Set(active.map((p) => p.slug));
  for (const b of blogs) {
    const dead = (b.relatedProductSlugs || []).filter((s) => !liveSlugs.has(s));
    if (dead.length) bad(`"${b.title}" links to products that don't exist: ${dead.join(', ')}`, 'npm run catalog:add  (or fix "Related products" in Admin › Blogs)');
    if (localImageMissing(b.coverImage?.url)) bad(`"${b.title}" cover image not found: ${b.coverImage.url}`);
  }

  // ───────── Redirects ─────────
  section('Redirects');
  const liveUrls = new Set([
    ...active.map((p) => `/products/${p.slug}`),
    ...categories.filter((c) => c.status === 'ACTIVE').map((c) => `/category/${c.slug}`),
    ...blogs.map((b) => `/blog/${b.slug}`),
  ]);
  const redirects = await Redirect.find().select('sourceUrl targetUrl').lean();
  const hijacked = redirects.filter((r) => liveUrls.has(r.sourceUrl));
  if (hijacked.length) bad(`${hijacked.length} live page(s) are redirected away: ${hijacked.map((r) => r.sourceUrl).join(', ')}`, 'npm run catalog:add  (removes these) or Admin › SEO › Redirects');
  else ok(`${redirects.length} redirect(s), none hide a live page`);

  // ───────── Homepage ─────────
  section('Homepage');
  const hero = await Advertisement.findOne({ location: 'HOMEPAGE_HERO', status: 'ACTIVE' }).lean();
  if (hero) ok(`Hero banner: "${hero.title}"`);
  else warn('No active HOMEPAGE_HERO banner – the built-in Royal Flora artwork is shown', 'npm run catalog:add (sets it) or Admin › Ads');

  // ───────── Settings ─────────
  section('Store settings');
  const s = await Setting.getStoreSettings();
  const gstin = s.business?.gstin;
  if (!gstin) warn('GSTIN is empty – invoices are issued without GST', 'Admin › Settings › GST & Tax');
  else if (!isValidGSTIN(gstin)) bad(`GSTIN "${gstin}" is not a valid format`, 'Admin › Settings › GST & Tax');
  else ok(`GSTIN ${gstin} · ${s.invoice?.gstScheme || 'REGULAR'} scheme · prices ${s.invoice?.pricesIncludeTax === false ? 'EXCLUDE' : 'include'} GST`);
  ok(`Shipping: ${s.shipping?.zoneRatesEnabled ? 'zone rates ON' : `flat ₹${s.flatShippingFee}`}, free above ₹${s.freeShippingThreshold}${s.shipping?.freeShippingEnabled === false ? ' (free shipping OFF)' : ''}`);
  if (!s.codEnabled && s.onlinePaymentEnabled === false) bad('Both COD and online payment are switched off – nobody can check out', 'Admin › Settings › Payments');

  const admins = await User.countDocuments({ role: { $in: ['ADMIN', 'SUPER_ADMIN'] } });
  if (!admins) bad('No admin user exists', 'register on the site, then set role ADMIN in MongoDB');
  else ok(`${admins} admin user(s)`);

  // ───────── .env ─────────
  section('.env');
  const prod = process.env.NODE_ENV === 'production';
  ok(`NODE_ENV=${process.env.NODE_ENV || 'development'} · PORT=${process.env.PORT || 5000}`);
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) (prod ? bad : warn)('JWT_SECRET is missing or short (use 64+ random characters)');
  if (prod && !/^https:\/\//.test(process.env.CLIENT_URL || '')) bad('CLIENT_URL must be https://jayrup.in in production');
  if (prod && !/^https:\/\//.test(process.env.API_PUBLIC_URL || '')) bad('API_PUBLIC_URL must be https://api.jayrup.in in production (PhonePe webhook URL)');
  const pp = process.env.PHONEPE_CLIENT_ID && process.env.PHONEPE_CLIENT_SECRET;
  if (!pp) warn('PhonePe keys not set – only Cash on Delivery works');
  else ok(`PhonePe keys set · PHONEPE_ENV=${process.env.PHONEPE_ENV || 'SANDBOX'}`);
  if (pp && !(process.env.PHONEPE_WEBHOOK_USERNAME && process.env.PHONEPE_WEBHOOK_PASSWORD)) warn('PhonePe webhook username/password not set', 'DEPLOY-VPS.md → Step 10b');

  console.log(`\n${problems ? `✖ ${problems} problem(s)` : '✓ No problems'}${warnings ? ` · ⚠ ${warnings} warning(s)` : ''}\n`);
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('\n✖ Health check failed:', err.message, '\n');
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
