import { typeOf, inferProductType } from '../config/productTypes.js';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Blog } from '../models/Blog.js';
import { Redirect } from '../models/Redirect.js';
import { Setting } from '../models/Setting.js';
import { siteUrl, buildSeoForPath, renderHeadHtml, STATIC_SITEMAP_ROUTES, LEGACY_REDIRECTS, resolveLegacyRedirect, truncate } from '../seo/headBuilder.js';

const escapeXml = (unsafe) => {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const absUrl = (u) => (!u ? '' : /^https?:\/\//.test(u) ? u : `${siteUrl()}${u.startsWith('/') ? '' : '/'}${u}`);
const day = (d) => new Date(d || Date.now()).toISOString().split('T')[0];

// @desc    Dynamic XML sitemap with image extensions
// @route   GET /sitemap.xml  |  GET /api/v1/seo/sitemap.xml
// @access  Public
export const getSitemapXml = async (req, res, next) => {
  try {
    const base = siteUrl();
    const [products, categories, blogs] = await Promise.all([
      Product.find({ status: 'ACTIVE', 'seo.searchIndexing': { $ne: 'NOINDEX_NOFOLLOW' } }).select('slug updatedAt images name').lean(),
      Category.find({ status: 'ACTIVE' }).select('slug updatedAt image name').lean(),
      Blog.find({ status: 'PUBLISHED' }).select('slug updatedAt coverImage title').lean(),
    ]);

    const latest = [...products, ...blogs].reduce((m, d) => (d.updatedAt > m ? d.updatedAt : m), new Date(0));
    const urls = [];
    STATIC_SITEMAP_ROUTES.forEach((p) =>
      urls.push({ loc: `${base}${p.url === '/' ? '/' : p.url}`, lastmod: day(['/', '/shop', '/blog'].includes(p.url) ? latest : undefined), changefreq: p.changefreq, priority: p.priority })
    );
    categories.forEach((c) =>
      urls.push({ loc: `${base}/category/${c.slug}`, lastmod: day(c.updatedAt), changefreq: 'weekly', priority: '0.8', images: c.image?.url ? [{ loc: absUrl(c.image.url), title: c.name }] : [] })
    );
    products.forEach((p) =>
      urls.push({
        loc: `${base}/products/${p.slug}`,
        lastmod: day(p.updatedAt),
        changefreq: 'weekly',
        priority: '0.9',
        images: (p.images || []).slice(0, 8).map((i) => ({ loc: absUrl(i.url), title: i.altText || p.name })),
      })
    );
    blogs.forEach((b) =>
      urls.push({ loc: `${base}/blog/${b.slug}`, lastmod: day(b.updatedAt), changefreq: 'monthly', priority: '0.7', images: b.coverImage?.url ? [{ loc: absUrl(b.coverImage.url), title: b.title }] : [] })
    );

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';
    urls.forEach((u) => {
      xml += `  <url>\n    <loc>${escapeXml(u.loc)}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n`;
      (u.images || []).forEach((img) => {
        xml += `    <image:image>\n      <image:loc>${escapeXml(img.loc)}</image:loc>\n      <image:title>${escapeXml(img.title)}</image:title>\n    </image:image>\n`;
      });
      xml += '  </url>\n';
    });
    xml += '</urlset>';

    res.header('Content-Type', 'application/xml; charset=utf-8');
    res.header('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(xml);
  } catch (error) {
    next(error);
  }
};

// Public, read-only API endpoints the storefront calls while a page renders.
// Googlebot renders pages with JavaScript and obeys robots.txt for every API call it makes –
// if these are blocked, product / category / blog pages render as "not found" for Google
// (the page then shows noindex and is dropped from search). Keep this list in sync with the
// GET calls in the frontend services.
export const PUBLIC_API_PATHS = [
  '/api/v1/products',
  '/api/v1/categories',
  '/api/v1/blogs',
  '/api/v1/reviews/product/',
  '/api/v1/settings/public',
  '/api/v1/advertisements',
  '/api/v1/influencers',
  '/api/v1/seo/',
];
// Private routes that live underneath the public prefixes above (longest rule wins for Google)
const PRIVATE_UNDER_PUBLIC = ['/api/v1/products/admin', '/api/v1/influencers/admin', '/api/v1/reviews/admin', '/api/v1/reviews/product/*/mine'];

const isApiHost = (req) => {
  const host = String(req.hostname || '').toLowerCase();
  let site = '';
  try {
    site = new URL(siteUrl()).hostname.toLowerCase();
  } catch {
    site = '';
  }
  return host.startsWith('api.') || (site && host && host !== site && host !== `www.${site}` && host !== 'localhost');
};

// @desc    robots.txt (host-aware: storefront jayrup.in vs. API api.jayrup.in – same Node process)
// @route   GET /robots.txt  |  GET /api/v1/seo/robots.txt
export const getRobotsTxt = async (req, res) => {
  const base = siteUrl();
  const allowApi = PUBLIC_API_PATHS.map((p) => `Allow: ${p}`).join('\n');
  const blockPrivate = PRIVATE_UNDER_PUBLIC.map((p) => `Disallow: ${p}`).join('\n');

  const robots = isApiHost(req)
    ? `# ${req.hostname} – JSON API for ${base}
# Crawlers may read the public catalogue endpoints so storefront pages render completely.
# API responses send "X-Robots-Tag: noindex", so they never show up in search results themselves.
User-agent: *
${allowApi}
Allow: /uploads/
${blockPrivate}
Disallow: /

Sitemap: ${base}/sitemap.xml
`
    : `# Jayrup – ${base}
User-agent: *
Allow: /
Disallow: /admin
Disallow: /cart
Disallow: /checkout
Disallow: /account
Disallow: /profile
Disallow: /orders
Disallow: /wishlist
Disallow: /payment/
Disallow: /order-success/
Disallow: /track-order
Disallow: /login
Disallow: /register
Disallow: /forgot-password
Disallow: /reset-password/
Disallow: /*?*sort=
Disallow: /*?*page=
${allowApi}
${blockPrivate}
Disallow: /api/

Sitemap: ${base}/sitemap.xml
`;
  res.header('Content-Type', 'text/plain; charset=utf-8');
  res.header('Cache-Control', 'public, max-age=3600');
  res.header('Vary', 'Host');
  return res.status(200).send(robots);
};

// Category override (Admin › Categories) → product type default (config/productTypes.js)
const googleCategory = (p) => p.category?.googleProductCategory || typeOf(inferProductType(p, p.category)).googleCategory;
const GENDER = { MEN: 'male', WOMEN: 'female', UNISEX: 'unisex' };

// @desc    Google Merchant Center RSS feed (variants become separate items with item_group_id)
// @route   GET /google-merchant-feed.xml  |  GET /api/v1/seo/google-merchant-feed.xml
export const getGoogleMerchantFeed = async (req, res, next) => {
  try {
    const base = siteUrl();
    const settings = await Setting.getStoreSettings();
    const threshold = Number(settings.freeShippingThreshold ?? 999);
    const fee = Number(settings.flatShippingFee ?? 100);
    const products = await Product.find({ status: 'ACTIVE' }).populate('category', 'name productType hsnCode googleProductCategory').lean();

    const item = (p, { id, title, price, salePrice, stock, gtin, groupId, size, weight }) => {
      const sell = salePrice && salePrice < price ? salePrice : price;
      const imgs = (p.images || []).map((i) => absUrl(i.url)).filter(Boolean);
      return `    <item>
      <g:id>${escapeXml(id)}</g:id>
      ${groupId ? `<g:item_group_id>${escapeXml(groupId)}</g:item_group_id>` : ''}
      <g:title>${escapeXml(title.slice(0, 150))}</g:title>
      <g:description>${escapeXml(truncate(p.shortDescription ? `${p.shortDescription} ${p.description}` : p.description, 4900))}</g:description>
      <g:link>${base}/products/${p.slug}</g:link>
      <g:image_link>${escapeXml(imgs[0] || `${base}/logo-512.png`)}</g:image_link>
      ${imgs.slice(1, 10).map((u) => `<g:additional_image_link>${escapeXml(u)}</g:additional_image_link>`).join('\n      ')}
      <g:price>${Number(price).toFixed(2)} INR</g:price>
      ${salePrice && salePrice < price ? `<g:sale_price>${Number(salePrice).toFixed(2)} INR</g:sale_price>` : ''}
      <g:availability>${stock > 0 ? 'in_stock' : 'out_of_stock'}</g:availability>
      <g:condition>new</g:condition>
      <g:brand>${escapeXml(p.brand || 'Jayrup')}</g:brand>
      ${gtin && /^\d{8,14}$/.test(gtin) ? `<g:gtin>${gtin}</g:gtin>` : '<g:identifier_exists>no</g:identifier_exists>'}
      <g:mpn>${escapeXml(id)}</g:mpn>
      ${size ? `<g:size>${escapeXml(size)}</g:size>` : ''}
      ${weight ? `<g:shipping_weight>${weight} g</g:shipping_weight>` : ''}
      <g:product_type>${escapeXml([typeOf(inferProductType(p, p.category)).label, p.category?.name].filter(Boolean).join(' > '))}</g:product_type>
      ${GENDER[p.gender] ? `<g:gender>${GENDER[p.gender]}</g:gender>` : ''}
      <g:google_product_category>${escapeXml(googleCategory(p))}</g:google_product_category>
      <g:shipping><g:country>IN</g:country><g:service>Standard</g:service><g:price>${sell >= threshold ? '0.00' : fee.toFixed(2)} INR</g:price></g:shipping>
      <g:custom_label_0>${escapeXml(typeOf(inferProductType(p, p.category)).label)}</g:custom_label_0>
      ${[p.fragrance?.family, p.fragrance?.concentration, ...(p.concerns || [])].filter(Boolean).slice(0, 4).map((c, i) => `<g:custom_label_${i + 1}>${escapeXml(c)}</g:custom_label_${i + 1}>`).join('')}
    </item>\n`;
    };

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n  <channel>\n';
    xml += `    <title>${escapeXml(settings.business?.brandName || 'Jayrup')} Products</title>\n    <link>${base}</link>\n    <description>${escapeXml(settings.defaultMetaDescription)}</description>\n`;
    for (const p of products) {
      if (p.variants?.length) {
        p.variants.forEach((v) => {
          xml += item(p, { id: v.sku, title: `${p.name} – ${v.title}`, price: v.price, salePrice: v.salePrice, stock: v.stock, gtin: v.barcode || p.barcode, groupId: p.sku, size: v.title, weight: v.weight || p.weight });
        });
      } else {
        xml += item(p, { id: p.sku, title: `${p.name}${p.netQuantity ? ` ${p.netQuantity}` : ''}`, price: p.price, salePrice: p.salePrice, stock: p.stock, gtin: p.barcode, size: p.netQuantity, weight: p.weight });
      }
    }
    xml += '  </channel>\n</rss>';

    res.header('Content-Type', 'application/xml; charset=utf-8');
    res.header('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(xml);
  } catch (error) {
    next(error);
  }
};

// @desc    Lookup redirect for a path (used by the SPA's 404 page)
// @route   GET /api/v1/seo/redirects/lookup?url=/old-path
export const lookupRedirect = async (req, res, next) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ success: false, message: 'URL parameter required' });
    const target = await resolveLegacyRedirect(String(url));
    return res.status(200).json({ success: true, redirect: target ? { targetUrl: target, statusCode: 301 } : null });
  } catch (error) {
    next(error);
  }
};

// @desc    All indexable routes (used by the frontend's build-time prerender script)
// @route   GET /api/v1/seo/routes
export const getSeoRoutes = async (req, res, next) => {
  try {
    const [products, categories, blogs] = await Promise.all([
      Product.find({ status: 'ACTIVE' }).select('slug').lean(),
      Category.find({ status: 'ACTIVE' }).select('slug').lean(),
      Blog.find({ status: 'PUBLISHED' }).select('slug').lean(),
    ]);
    const manual = await Redirect.find().select('sourceUrl targetUrl').lean();
    res.status(200).json({
      success: true,
      data: {
        routes: [
          ...STATIC_SITEMAP_ROUTES.map((r) => r.url),
          '/track-order',
          ...categories.map((c) => `/category/${c.slug}`),
          ...products.map((p) => `/products/${p.slug}`),
          ...blogs.map((b) => `/blog/${b.slug}`),
        ],
        redirects: { ...LEGACY_REDIRECTS, ...Object.fromEntries(manual.map((m) => [m.sourceUrl, m.targetUrl])) },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Render SEO head for one path
// @route   GET /api/v1/seo/render?path=/products/xyz
export const renderSeo = async (req, res, next) => {
  try {
    const seo = await buildSeoForPath(String(req.query.path || '/'));
    const settings = await Setting.getStoreSettings();
    res.status(200).json({
      success: true,
      data: { status: seo.status, redirect: seo.redirect || null, head: seo.redirect ? '' : renderHeadHtml(seo, settings), bodyHtml: seo.bodyHtml || '', title: seo.title },
    });
  } catch (error) {
    next(error);
  }
};
