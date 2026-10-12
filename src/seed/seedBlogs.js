/**
 * Jayrup Journal tool – blog posts only.
 *
 *   npm run blogs:preview   → shows the blogs in the database and what would change (changes nothing)
 *   npm run blogs:wipe      → backup, then DELETE ALL blog posts
 *   npm run blogs:add       → add / update the articles in ./data/blogData.js
 *   npm run blogs:reset     → wipe + add in one go
 *   npm run blogs:restore backups/blogs-<date>.json   → put a backup back
 *
 * Old blog URLs get a 301 redirect to the closest new article (or /blog), so links and rankings are kept.
 */
import '../config/env.js'; // must stay first: loads .env + MongoDB DNS fix
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { Blog } from '../models/Blog.js';
import { Redirect } from '../models/Redirect.js';
import { BLOGS } from './data/blogData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.resolve(__dirname, '../../backups');

const args = process.argv.slice(2);
const CONFIRMED = args.includes('--yes');
const restoreIdx = args.indexOf('--restore');
const RESTORE_FILE = restoreIdx >= 0 ? args[restoreIdx + 1] : null;
const MODE = args.includes('--wipe') ? 'wipe' : args.includes('--add') ? 'add' : 'reset';

const log = (...a) => console.log(...a);
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

const validate = () => {
  const errors = [];
  const slugs = new Set();
  for (const b of BLOGS) {
    if (slugs.has(b.slug)) errors.push(`duplicate slug ${b.slug}`);
    slugs.add(b.slug);
    if (!b.title || !b.excerpt || !b.content || !b.coverImage?.url) errors.push(`${b.slug}: title, excerpt, content and coverImage are required`);
    if (b.excerpt.length > 400) errors.push(`${b.slug}: excerpt is longer than 400 characters`);
    if ((b.seo?.metaTitle || '').length > 65) log(`  ⚠ ${b.slug}: meta title is ${b.seo.metaTitle.length} chars (Google shows ~60)`);
    if ((b.seo?.metaDescription || '').length > 165) log(`  ⚠ ${b.slug}: meta description is ${b.seo.metaDescription.length} chars (Google shows ~160)`);
  }
  if (errors.length) throw new Error(`Blog data is invalid:\n  - ${errors.join('\n  - ')}`);
};

const takeBackup = async () => {
  const blogs = await Blog.find().lean();
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `blogs-${stamp()}.json`);
  fs.writeFileSync(file, JSON.stringify({ createdAt: new Date().toISOString(), count: blogs.length, blogs }, null, 2));
  try {
    await mongoose.connection.collection('blogbackups').insertOne({ createdAt: new Date(), file: path.basename(file), blogs });
  } catch (err) {
    log(`  ⚠ Could not store the backup in MongoDB (${err.message}) – the JSON file backup is still saved.`);
  }
  return file;
};

// Pick the new article that best matches an old one (by shared words), else /blog
const closestArticle = (oldBlog) => {
  const words = (s = '') => new Set(String(s).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  const old = words(`${oldBlog.title} ${oldBlog.slug} ${(oldBlog.tags || []).join(' ')}`);
  let best = null;
  let bestScore = 0;
  for (const b of BLOGS) {
    const w = words(`${b.title} ${b.slug} ${b.tags.join(' ')}`);
    const score = [...old].filter((x) => w.has(x)).length;
    if (score > bestScore) {
      best = b;
      bestScore = score;
    }
  }
  return bestScore >= 2 ? `/blog/${best.slug}` : '/blog';
};

const wipe = async (oldBlogs) => {
  const file = await takeBackup();
  log(`\n✓ Backup saved → ${path.relative(process.cwd(), file)} (and in MongoDB collection "blogbackups")`);
  const res = await Blog.deleteMany({});
  // Old URLs → /blog for now (`blogs:add` re-points them to the closest new article)
  for (const o of oldBlogs) await Redirect.registerRedirect(`/blog/${o.slug}`, '/blog', 'BLOG');
  log(`✓ Deleted ${res.deletedCount} blog posts`);
};

const add = async (oldBlogs) => {
  validate();
  for (const b of BLOGS) {
    const existing = await Blog.findOne({ slug: b.slug });
    if (existing) {
      existing.set({ ...b, status: 'PUBLISHED', author: 'Jayrup Editorial Team' });
      await existing.save();
      log(`✓ Updated  /blog/${b.slug}`);
    } else {
      await Blog.create({ ...b, status: 'PUBLISHED', author: 'Jayrup Editorial Team' });
      log(`✓ Added    /blog/${b.slug}`);
    }
  }
  const live = BLOGS.map((b) => `/blog/${b.slug}`);
  await Redirect.deleteMany({ sourceUrl: { $in: live } });
  let n = 0;
  for (const o of oldBlogs) {
    const src = `/blog/${o.slug}`;
    if (live.includes(src)) continue;
    await Redirect.registerRedirect(src, closestArticle(o), 'BLOG');
    n += 1;
  }
  // Redirects parked on /blog by an earlier `blogs:wipe` → closest new article
  const parked = await Redirect.find({ entityType: 'BLOG', targetUrl: '/blog' }).lean();
  for (const r of parked) {
    const slug = r.sourceUrl.replace(/^\/blog\//, '');
    if (live.includes(r.sourceUrl)) continue;
    const target = closestArticle({ title: slug.replace(/-/g, ' '), slug, tags: [] });
    if (target !== '/blog') {
      await Redirect.updateOne({ _id: r._id }, { $set: { targetUrl: target } });
      n += 1;
    }
  }
  if (n) log(`✓ ${n} old blog URLs now 301-redirect to the closest new article`);
};

const restore = async (file) => {
  const full = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
  if (!fs.existsSync(full)) throw new Error(`Backup file not found: ${full}`);
  const data = JSON.parse(fs.readFileSync(full, 'utf8'));
  log(`\nRestore ${data.blogs.length} blog posts from ${path.basename(full)} (taken ${data.createdAt})`);
  if (!CONFIRMED) return log('\nPREVIEW ONLY – nothing changed.\n');
  const safety = await takeBackup();
  log(`  ✓ Current blogs backed up first → ${path.relative(process.cwd(), safety)}`);
  await Blog.deleteMany({});
  if (data.blogs.length) await Blog.insertMany(data.blogs, { ordered: false });
  await Redirect.deleteMany({ sourceUrl: { $in: data.blogs.map((b) => `/blog/${b.slug}`) } });
  log('  ✓ Restored.\n');
};

const main = async () => {
  const oldBlogs = await Blog.find().select('title slug tags status').lean();
  const title = { wipe: 'DELETE ALL blog posts', add: 'ADD the new articles', reset: 'DELETE ALL, then ADD the new articles' }[MODE];
  log(`\n━━━━━━━━━━━━ Jayrup Journal – ${title} ━━━━━━━━━━━━`);
  log(`In the database now: ${oldBlogs.length} blog posts`);
  oldBlogs.forEach((b) => log(`   • ${b.title}  (/blog/${b.slug})${b.status !== 'PUBLISHED' ? `  [${b.status}]` : ''}`));
  if (MODE !== 'add') log(`Will BACK UP and DELETE: ${oldBlogs.length} blog posts`);
  if (MODE !== 'wipe') {
    log(`Will ADD: ${BLOGS.length} articles`);
    BLOGS.forEach((b) => log(`   + ${b.title}  (/blog/${b.slug})`));
  }

  if (!CONFIRMED) {
    log('\nPREVIEW ONLY – nothing changed. To apply, run one of:');
    log('   npm run blogs:wipe     (delete all blog posts)');
    log('   npm run blogs:add      (add the new articles)');
    log('   npm run blogs:reset    (both in one go)\n');
    return;
  }
  if (MODE === 'wipe' || MODE === 'reset') await wipe(oldBlogs);
  if (MODE === 'add' || MODE === 'reset') await add(oldBlogs);
  log(`\nDone. Database now has ${await Blog.countDocuments()} blog posts.\n`);
};

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set in .env');
  await mongoose.connect(process.env.MONGO_URI);
  if (RESTORE_FILE) await restore(RESTORE_FILE);
  else await main();
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('\n✖ Blog seed failed:', err.message, '\n');
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
