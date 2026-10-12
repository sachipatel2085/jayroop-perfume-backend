/**
 * Jayrup catalogue seeder – replaces ALL products & categories with the catalogue in ./data/catalogData.js
 *
 *   npm run seed:catalog                 → DRY RUN: shows what will be backed up / deleted / created
 *   npm run seed:catalog -- --yes        → backup → delete old catalogue → create new catalogue
 *   npm run seed:catalog -- --restore backups/catalog-2026-10-12T12-00-00.json --yes
 *                                        → put a backed-up catalogue back exactly as it was
 *
 * Safety:
 *  • Before anything is deleted, the old products, categories, reviews, hero banners and redirects are
 *    saved to   jayroop-perfume-backend/backups/catalog-<date>.json   AND to the "catalogbackups"
 *    collection in MongoDB.
 *  • Orders, invoices, customers, coupons, blogs and settings are NEVER touched (orders keep their own
 *    product snapshots, so old invoices and reports stay correct).
 *  • Old product / category URLs get 301 redirects to the closest new page, so Google rankings and old
 *    links keep working.
 */
import '../config/env.js'; // must stay first: loads .env + MongoDB DNS fix
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Review } from '../models/Review.js';
import { Redirect } from '../models/Redirect.js';
import { Advertisement } from '../models/Advertisement.js';
import { InfluencerVideo } from '../models/InfluencerVideo.js';
import { User } from '../models/User.js';
import { inferProductType } from '../config/productTypes.js';
import { CATEGORIES, PRODUCTS, HERO_AD } from './data/catalogData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.resolve(__dirname, '../../backups');

const args = process.argv.slice(2);
const CONFIRMED = args.includes('--yes');
const restoreIdx = args.indexOf('--restore');
const RESTORE_FILE = restoreIdx >= 0 ? args[restoreIdx + 1] : null;

const log = (...a) => console.log(...a);
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

// ───────────────────────────── validation (fails before touching the DB) ─────────────────────────────
const validateCatalog = () => {
  const errors = [];
  const catKeys = new Set(CATEGORIES.map((c) => c.key));
  const slugs = new Set();
  const skus = new Set();
  for (const p of PRODUCTS) {
    if (!catKeys.has(p.categoryKey)) errors.push(`${p.name}: unknown categoryKey "${p.categoryKey}"`);
    if (slugs.has(p.slug)) errors.push(`duplicate slug ${p.slug}`);
    if (skus.has(p.sku)) errors.push(`duplicate SKU ${p.sku}`);
    slugs.add(p.slug);
    skus.add(p.sku);
    if (!p.description || !p.price || !p.images?.length) errors.push(`${p.name}: description, price and images are required`);
    if ((p.seo?.metaTitle || '').length > 65) log(`  ⚠ ${p.name}: meta title is ${p.seo.metaTitle.length} chars (Google shows ~60)`);
    if ((p.seo?.metaDescription || '').length > 165) log(`  ⚠ ${p.name}: meta description is ${p.seo.metaDescription.length} chars (Google shows ~160)`);
  }
  if (errors.length) throw new Error(`Catalogue data is invalid:\n  - ${errors.join('\n  - ')}`);
};

// ───────────────────────────── backup ─────────────────────────────
const takeBackup = async () => {
  const [products, categories, reviews, ads, redirects] = await Promise.all([
    Product.find().lean(),
    Category.find().lean(),
    Review.find().lean(),
    Advertisement.find({ location: 'HOMEPAGE_HERO' }).lean(),
    Redirect.find().lean(),
  ]);
  const backup = { createdAt: new Date().toISOString(), counts: { products: products.length, categories: categories.length, reviews: reviews.length, heroAds: ads.length, redirects: redirects.length }, products, categories, reviews, ads, redirects };

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `catalog-${stamp()}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, null, 2));

  // Second copy inside MongoDB (survives if the server folder is lost)
  try {
    await mongoose.connection.collection('catalogbackups').insertOne({ ...backup, createdAt: new Date(), file: path.basename(file) });
  } catch (err) {
    log(`  ⚠ Could not store the backup in MongoDB (${err.message}) – the JSON file backup is still saved.`);
  }
  return { file, backup };
};

// ───────────────────────────── restore ─────────────────────────────
const restore = async (file) => {
  const full = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
  if (!fs.existsSync(full)) throw new Error(`Backup file not found: ${full}`);
  const data = JSON.parse(fs.readFileSync(full, 'utf8'));
  log(`\nRestore from ${path.basename(full)} (taken ${data.createdAt})`);
  log(`  products ${data.products.length} · categories ${data.categories.length} · reviews ${data.reviews.length} · hero ads ${data.ads.length}`);
  if (!CONFIRMED) {
    log('\nDRY RUN – nothing changed. Add --yes to restore.\n');
    return;
  }
  const safety = await takeBackup();
  log(`  ✓ Current catalogue backed up first → ${path.relative(process.cwd(), safety.file)}`);

  await Product.deleteMany({});
  await Category.deleteMany({});
  await Category.insertMany(data.categories, { ordered: false });
  await Product.insertMany(data.products, { ordered: false });
  const reviewIds = data.reviews.map((r) => r._id);
  await Review.deleteMany({ _id: { $in: reviewIds } });
  if (data.reviews.length) await Review.insertMany(data.reviews, { ordered: false });
  await Advertisement.deleteMany({ location: 'HOMEPAGE_HERO' });
  if (data.ads.length) await Advertisement.insertMany(data.ads, { ordered: false });
  await Redirect.deleteMany({});
  if (data.redirects?.length) await Redirect.insertMany(data.redirects, { ordered: false });
  log('  ✓ Restored. Rebuild the storefront (npm run build) so sitemap & product pages update.\n');
};

// ───────────────────────────── seed ─────────────────────────────
const seed = async () => {
  validateCatalog();

  const [oldProducts, oldCategories] = await Promise.all([
    Product.find().select('name slug productType hsnCode category').populate('category', 'name slug productType').lean(),
    Category.find().select('name slug productType').lean(),
  ]);
  const reviewCount = await Review.countDocuments({ product: { $in: oldProducts.map((p) => p._id) } });

  log('\n━━━━━━━━━━━━ Jayrup catalogue seed ━━━━━━━━━━━━');
  log(`Will BACK UP and DELETE: ${oldProducts.length} products, ${oldCategories.length} categories, ${reviewCount} reviews of those products`);
  oldProducts.forEach((p) => log(`   – ${p.name}  (/products/${p.slug})`));
  log(`Will CREATE: ${CATEGORIES.length} categories, ${PRODUCTS.length} products`);
  CATEGORIES.forEach((c) => log(`   + category  ${c.name}  (/category/${c.slug}) · ${c.productType} · HSN ${c.hsnCode} · GST ${c.gstRate}%`));
  PRODUCTS.forEach((p) => log(`   + product   ${p.name}  (/products/${p.slug}) · MRP ₹${p.price} · stock ${p.stock}`));
  log('Never touched: orders, invoices, customers, coupons, blogs, settings.');

  if (!CONFIRMED) {
    log('\nDRY RUN – nothing changed. Run again with  --yes  to apply:\n   npm run seed:catalog -- --yes\n');
    return;
  }

  // 1) Backup
  const { file } = await takeBackup();
  log(`\n✓ Backup saved → ${path.relative(process.cwd(), file)} (and in MongoDB collection "catalogbackups")`);

  // 2) Delete old catalogue (+ dangling references)
  const oldIds = oldProducts.map((p) => p._id);
  await Review.deleteMany({ product: { $in: oldIds } });
  await InfluencerVideo.updateMany({ taggedProduct: { $in: oldIds } }, { $set: { taggedProduct: null } });
  await User.updateMany({ wishlist: { $in: oldIds } }, { $pull: { wishlist: { $in: oldIds } } });
  await Product.deleteMany({});
  await Category.deleteMany({});
  log('✓ Old products, categories and their reviews removed');

  // 3) Create categories
  const catByKey = {};
  for (const c of CATEGORIES) {
    const { key, ...data } = c;
    const doc = await Category.create({ ...data, parent: null });
    catByKey[key] = doc;
    log(`✓ Category  ${doc.name}`);
  }

  // 4) Create products (Product.create runs all schema validation)
  const created = [];
  for (const p of PRODUCTS) {
    const { categoryKey, ...data } = p;
    const doc = await Product.create({
      ...data,
      category: catByKey[categoryKey]._id,
      subCategory: null,
      images: data.images.map((img, i) => ({ url: img.url, publicId: '', altText: img.altText, isPrimary: i === 0 })),
      averageRating: 0,
      numReviews: 0,
      totalSold: 0,
    });
    created.push(doc);
    log(`✓ Product   ${doc.name}  → /products/${doc.slug}`);
  }

  // 5) Redirects – make sure new URLs are never redirected away, and send old URLs to the closest new page
  const liveUrls = [...created.map((p) => `/products/${p.slug}`), ...Object.values(catByKey).map((c) => `/category/${c.slug}`)];
  await Redirect.deleteMany({ sourceUrl: { $in: liveUrls } });

  const typeTarget = (type) => {
    const match = created.find((p) => p.productType === type) || (type === 'SKINCARE' ? created.find((p) => p.productType === 'AYURVEDIC') : null);
    return match ? `/products/${match.slug}` : '/shop';
  };
  let redirects = 0;
  for (const p of oldProducts) {
    const src = `/products/${p.slug}`;
    if (liveUrls.includes(src)) continue;
    const type = inferProductType(p, p.category);
    await Redirect.registerRedirect(src, typeTarget(type), 'PRODUCT');
    redirects += 1;
  }
  for (const c of oldCategories) {
    const src = `/category/${c.slug}`;
    if (liveUrls.includes(src)) continue;
    const type = c.productType || inferProductType({ name: `${c.name} ${c.slug}` }, null);
    const cat = Object.values(catByKey).find((x) => x.productType === type || (type === 'SKINCARE' && x.productType === 'AYURVEDIC'));
    await Redirect.registerRedirect(src, cat ? `/category/${cat.slug}` : '/shop', 'CATEGORY');
    redirects += 1;
  }
  log(`✓ ${redirects} old URLs now 301-redirect to the new pages`);

  // 6) Homepage hero banner (responsive artwork shipped with the storefront)
  await Advertisement.updateMany({ location: 'HOMEPAGE_HERO' }, { $set: { status: 'INACTIVE' } });
  await Advertisement.findOneAndUpdate({ location: 'HOMEPAGE_HERO', title: HERO_AD.title }, { $set: HERO_AD }, { upsert: true, new: true, runValidators: true });
  log('✓ Homepage hero set to the Royal Flora campaign (older hero banners kept, set to INACTIVE)');

  log('\nDone. Next: open Admin › Products to check prices & stock, then rebuild the storefront (npm run build).\n');
};

// ───────────────────────────── run ─────────────────────────────
const run = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set in .env');
  await mongoose.connect(process.env.MONGO_URI);
  if (RESTORE_FILE) await restore(RESTORE_FILE);
  else await seed();
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('\n✖ Catalogue seed failed:', err.message, '\n');
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
