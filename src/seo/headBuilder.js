import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Blog } from '../models/Blog.js';
import { Review } from '../models/Review.js';
import { Setting } from '../models/Setting.js';
import { Redirect } from '../models/Redirect.js';

/**
 * Server-side SEO head builder.
 * Produces <title>, meta, canonical, Open Graph, Twitter and JSON-LD for every public route so that
 * Google, Bing, WhatsApp, Facebook & X get complete metadata WITHOUT executing JavaScript.
 * Used by (a) the Node SPA server (seoServer.js) and (b) the build-time prerender script of the frontend.
 */

export const siteUrl = () => (process.env.SITE_URL || process.env.CLIENT_URL || 'https://jayrup.in').replace(/\/+$/, '');

// Old WordPress / WooCommerce URLs → new React routes (301)
export const LEGACY_REDIRECTS = {
  '/store': '/shop',
  '/shop-2': '/shop',
  '/my-account': '/account',
  '/my-account/orders': '/account/orders',
  '/my-account/edit-address': '/account/addresses',
  '/my-account/edit-account': '/account/profile',
  '/my-account/lost-password': '/forgot-password',
  '/checkout/order-received': '/account/orders',
  '/contact': '/contact-us',
  '/about-us': '/about',
  '/return-policy': '/refund-return-policy',
  '/refund-policy': '/refund-return-policy',
  '/cancellation-policy': '/refund-return-policy',
  '/terms-of-service': '/terms-and-conditions',
  '/terms': '/terms-and-conditions',
  '/pravicy-policy': '/privacy-policy',
  '/wishlist-2': '/wishlist',
  '/home': '/',
  '/feed': '/blog',
  '/sample-page': '/',
};

export const resolveLegacyRedirect = async (pathname) => {
  const clean = decodeURIComponent(pathname).replace(/\/+$/, '').toLowerCase() || '/';
  if (LEGACY_REDIRECTS[clean]) return LEGACY_REDIRECTS[clean];
  // WooCommerce single product  /product/<slug>  →  /products/<slug>
  let m = /^\/product\/([^/]+)$/.exec(clean);
  if (m) return `/products/${m[1]}`;
  // WooCommerce categories  /product-category/<slug>(/<child>)  →  /category/<last>
  m = /^\/product-category\/(?:[^/]+\/)*([^/]+)$/.exec(clean);
  if (m) return `/category/${m[1]}`;
  m = /^\/product-tag\/([^/]+)$/.exec(clean);
  if (m) return `/shop?search=${encodeURIComponent(m[1].replace(/-/g, ' '))}`;
  // WordPress posts /YYYY/MM/DD/<slug> or /category/blog/<slug>
  m = /^\/\d{4}\/\d{2}(?:\/\d{2})?\/([^/]+)$/.exec(clean);
  if (m) return `/blog/${m[1]}`;
  if (/^\/(wp-admin|wp-login\.php)/.test(clean)) return '/login';
  // Admin-managed redirects (slug changes etc.)
  const r = await Redirect.findOne({ sourceUrl: clean }).lean();
  if (r) {
    Redirect.updateOne({ _id: r._id }, { $inc: { hits: 1 } }).catch(() => {});
    return r.targetUrl;
  }
  return null;
};

const NOINDEX_PREFIXES = ['/cart', '/checkout', '/account', '/profile', '/orders', '/login', '/register', '/forgot-password', '/reset-password', '/wishlist', '/payment', '/order-success', '/admin', '/track-order'];

const stripHtml = (html = '') =>
  String(html)
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

export const truncate = (s = '', n = 158) => {
  const t = stripHtml(s);
  if (t.length <= n) return t;
  const cut = t.slice(0, n - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 60 ? cut.lastIndexOf(' ') : cut.length)}…`;
};

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const abs = (u) => {
  if (!u) return `${siteUrl()}/og-image.jpg`;
  if (/^https?:\/\//i.test(u)) return u;
  return `${siteUrl()}${u.startsWith('/') ? '' : '/'}${u}`;
};

const effectivePrice = (p) => (p.salePrice && p.salePrice < p.price ? p.salePrice : p.price);

// ───────────────────────── Schema.org builders ─────────────────────────
export const organizationSchema = (settings) => {
  const b = settings.business || {};
  const sameAs = [b.instagram, b.facebook, b.youtube].filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    '@id': `${siteUrl()}/#organization`,
    name: b.brandName || 'Jayrup',
    alternateName: [b.tradeName, 'Jayrup Pimples Cream', 'जयरूप'].filter(Boolean),
    legalName: b.legalName || undefined,
    url: siteUrl(),
    logo: { '@type': 'ImageObject', url: `${siteUrl()}/logo-512.png`, width: 512, height: 512 },
    image: `${siteUrl()}/og-image.jpg`,
    email: b.email,
    telephone: b.phone,
    vatID: b.gstin || undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: [b.addressLine1, b.addressLine2].filter(Boolean).join(', '),
      addressLocality: b.city,
      addressRegion: b.state,
      postalCode: b.postalCode,
      addressCountry: 'IN',
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: b.phone,
        email: b.email,
        contactType: 'customer service',
        areaServed: 'IN',
        availableLanguage: ['English', 'Hindi', 'Gujarati'],
      },
    ],
    areaServed: { '@type': 'Country', name: 'India' },
    hasMerchantReturnPolicy: returnPolicySchema(),
    ...(sameAs.length ? { sameAs } : {}),
  };
};

export const websiteSchema = (settings) => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${siteUrl()}/#website`,
  name: settings.business?.brandName || 'Jayrup',
  alternateName: ['Jayrup Pimples Cream', 'jayrup.in'],
  url: siteUrl(),
  inLanguage: 'en-IN',
  publisher: { '@id': `${siteUrl()}/#organization` },
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${siteUrl()}/shop?search={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
});

export const returnPolicySchema = () => ({
  '@type': 'MerchantReturnPolicy',
  applicableCountry: 'IN',
  returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
  merchantReturnDays: 3,
  returnMethod: 'https://schema.org/ReturnByMail',
  itemCondition: 'https://schema.org/DamagedCondition',
  url: `${siteUrl()}/refund-return-policy`,
});

export const shippingSchema = (price, settings) => {
  const threshold = Number(settings.freeShippingThreshold ?? 999);
  const fee = Number(settings.flatShippingFee ?? 100);
  return {
    '@type': 'OfferShippingDetails',
    shippingRate: { '@type': 'MonetaryAmount', value: price >= threshold ? 0 : fee, currency: 'INR' },
    shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 2, unitCode: 'DAY' },
      transitTime: { '@type': 'QuantitativeValue', minValue: 3, maxValue: 8, unitCode: 'DAY' },
    },
  };
};

export const productSchema = (product, settings, reviews = []) => {
  const url = `${siteUrl()}/products/${product.slug}`;
  const images = (product.images || []).map((i) => abs(i.url)).filter(Boolean);
  const priceValidUntil = `${new Date().getFullYear() + 1}-12-31`;
  const brandName = product.brand || 'Jayrup';
  const gtin = /^\d{8,14}$/.test(product.barcode || '') ? product.barcode : undefined;

  const offerFor = (name, sku, price, stock, barcode) => ({
    '@type': 'Offer',
    url,
    ...(name ? { name } : {}),
    sku,
    ...(barcode && /^\d{8,14}$/.test(barcode) ? { gtin: barcode } : {}),
    priceCurrency: 'INR',
    price: Number(price).toFixed(2),
    priceValidUntil,
    availability: stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    itemCondition: 'https://schema.org/NewCondition',
    seller: { '@id': `${siteUrl()}/#organization` },
    shippingDetails: shippingSchema(price, settings),
    hasMerchantReturnPolicy: returnPolicySchema(),
  });

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: product.name,
    url,
    image: images.length ? images : [`${siteUrl()}/logo-512.png`],
    description: truncate(product.seo?.metaDescription || product.shortDescription || product.description, 500),
    sku: product.sku,
    mpn: product.sku,
    ...(gtin ? { gtin } : {}),
    brand: { '@type': 'Brand', name: brandName },
    manufacturer: product.manufacturerDetails ? { '@type': 'Organization', name: truncate(product.manufacturerDetails, 120) } : undefined,
    category: product.category?.name,
    countryOfOrigin: product.countryOfOrigin || 'India',
    ...(product.netQuantity ? { size: product.netQuantity } : {}),
    ...(product.weight ? { weight: { '@type': 'QuantitativeValue', value: product.weight, unitCode: 'GRM' } } : {}),
    ...(product.ingredients ? { additionalProperty: [{ '@type': 'PropertyValue', name: 'Key Ingredients', value: truncate(product.ingredients, 300) }] } : {}),
  };

  if (product.variants?.length) {
    const offers = product.variants.map((v) =>
      offerFor(`${product.name} – ${v.title}`, v.sku, v.salePrice && v.salePrice < v.price ? v.salePrice : v.price, v.stock, v.barcode)
    );
    const prices = offers.map((o) => Number(o.price));
    schema.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: 'INR',
      lowPrice: Math.min(...prices).toFixed(2),
      highPrice: Math.max(...prices).toFixed(2),
      offerCount: offers.length,
      availability: offers.some((o) => o.availability.endsWith('InStock')) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      offers,
    };
  } else {
    schema.offers = offerFor(null, product.sku, effectivePrice(product), product.stock, product.barcode);
  }

  if (product.numReviews > 0 && product.averageRating > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(product.averageRating).toFixed(1),
      reviewCount: product.numReviews,
      bestRating: 5,
      worstRating: 1,
    };
    if (reviews.length) {
      schema.review = reviews.slice(0, 5).map((r) => ({
        '@type': 'Review',
        reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 },
        author: { '@type': 'Person', name: r.user?.name ? r.user.name.split(' ')[0] : 'Verified Buyer' },
        datePublished: new Date(r.createdAt).toISOString().slice(0, 10),
        ...(r.title ? { name: r.title } : {}),
        reviewBody: truncate(r.comment, 500),
      }));
    }
  }
  return JSON.parse(JSON.stringify(schema)); // drop undefined
};

export const breadcrumbSchema = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.url) })),
});

export const faqSchema = (faqs = []) =>
  faqs.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: stripHtml(f.answer) } })),
      }
    : null;

// ───────────────────────── Static route meta ─────────────────────────
const STATIC = {
  '/': {
    title: null, // settings.defaultMetaTitle
    description: null,
    changefreq: 'daily',
    priority: '1.0',
  },
  '/shop': {
    title: 'Shop All Products – Pimples Cream, Skincare & Perfumes | Jayrup',
    description: 'Shop the complete Jayrup range online: Ayurvedic-inspired Pimples Cream for acne & marks, daily skincare and long-lasting perfumes. Pay with PhonePe or COD. Delivery across India.',
    priority: '0.9',
    changefreq: 'daily',
  },
  '/about': {
    title: 'About Jayrup – Ayurvedic-Inspired Skincare Made in India',
    description: 'Jayrup creates safe, effective and affordable cosmetic skincare inspired by Ayurveda and modern cosmetic science. Learn about our philosophy, quality standards and vision.',
    priority: '0.7',
  },
  '/contact-us': {
    title: 'Contact Jayrup – Customer Care, Orders & Returns',
    description: 'Questions about Jayrup Pimples Cream or your order? Call +91 94081 33100 or email care@jayrup.in. Business address: G-28 Metropolis Complex, Himatnagar, Gujarat 383030.',
    priority: '0.7',
  },
  '/faq': { title: 'FAQs – Orders, Delivery, Payments & Product Usage | Jayrup', description: 'Answers to common questions about Jayrup products, how to use Pimples Cream, delivery timelines, PhonePe & COD payments, returns and refunds.', priority: '0.6' },
  '/blog': { title: 'Skincare Journal – Acne Care Tips & Guides | Jayrup', description: 'Expert-backed tips on pimples, acne marks, oily skin and daily skincare routines for Indian skin from the Jayrup journal.', priority: '0.7', changefreq: 'weekly' },
  '/shipping-policy': { title: 'Shipping Policy | Jayrup', description: 'Jayrup ships across India via registered courier partners. Orders are delivered in 7–10 business days. Read about charges, tracking and damaged shipments.', priority: '0.3' },
  '/refund-return-policy': { title: 'Return & Refund Policy | Jayrup', description: 'Return or exchange within 3 days of delivery for damaged or defective items. Refunds are credited to the original payment method. Read the full Jayrup policy.', priority: '0.3' },
  '/privacy-policy': { title: 'Privacy Policy | Jayrup', description: 'How Jayrup collects, uses, shares and protects your personal data when you use jayrup.in.', priority: '0.2', changefreq: 'yearly' },
  '/terms-and-conditions': { title: 'Terms and Conditions | Jayrup', description: 'Terms of use governing access to and purchases from jayrup.in, published under the Information Technology Act, 2000.', priority: '0.2', changefreq: 'yearly' },
  '/track-order': { title: 'Track Your Order | Jayrup', description: 'Track your Jayrup order status and courier shipment.', priority: '0.3', noindex: true },
};

export const STATIC_SITEMAP_ROUTES = Object.entries(STATIC)
  .filter(([, v]) => !v.noindex)
  .map(([url, v]) => ({ url, priority: v.priority || '0.5', changefreq: v.changefreq || 'monthly' }));

/**
 * Build SEO data for a path.
 * @returns {Promise<{status:number, redirect?:string, title, description, canonical, robots, ogType, image, keywords, jsonLd:Array<{id,data}>, bodyHtml}>}
 */
export const buildSeoForPath = async (rawPath = '/') => {
  const settings = await Setting.getStoreSettings();
  const path = (decodeURIComponent(rawPath.split('?')[0]).replace(/\/+$/, '') || '/').toLowerCase();
  const base = {
    status: 200,
    title: settings.defaultMetaTitle,
    description: settings.defaultMetaDescription,
    keywords: settings.defaultMetaKeywords,
    canonical: `${siteUrl()}${path === '/' ? '/' : path}`,
    robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    ogType: 'website',
    image: settings.ogDefaultImage || `${siteUrl()}/og-image.jpg`,
    jsonLd: [],
    bodyHtml: '',
  };

  const redirect = await resolveLegacyRedirect(path);
  if (redirect && redirect !== path) return { ...base, status: 301, redirect };

  if (NOINDEX_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return { ...base, robots: 'noindex, nofollow', title: `${settings.business?.brandName || 'Jayrup'}`, jsonLd: [] };
  }

  if (path === '/') {
    return {
      ...base,
      jsonLd: [
        { id: 'organization-schema-jsonld', data: organizationSchema(settings) },
        { id: 'website-schema-jsonld', data: websiteSchema(settings) },
      ],
      bodyHtml: `<h1>${esc(settings.business?.brandName || 'Jayrup')} – Pimples Cream, Ayurvedic Skincare & Perfumes</h1><p>${esc(settings.defaultMetaDescription)}</p>`,
    };
  }

  if (STATIC[path]) {
    const s = STATIC[path];
    const crumbs = [{ name: 'Home', url: '/' }, { name: (s.title || '').split(/[–|]/)[0].trim(), url: path }];
    return {
      ...base,
      title: s.title || base.title,
      description: s.description || base.description,
      robots: s.noindex ? 'noindex, follow' : base.robots,
      jsonLd: [
        { id: 'breadcrumb-schema-jsonld', data: breadcrumbSchema(crumbs) },
        ...(['/about', '/contact-us'].includes(path) ? [{ id: 'organization-schema-jsonld', data: organizationSchema(settings) }] : []),
      ],
      bodyHtml: `<h1>${esc(crumbs[1].name)}</h1><p>${esc(s.description || '')}</p>`,
    };
  }

  let m = /^\/products\/([a-z0-9-]+)$/.exec(path);
  if (m) {
    const product = await Product.findOne({ slug: m[1], status: 'ACTIVE' }).populate('category', 'name slug').lean();
    if (!product) return { ...base, status: 404, title: 'Product not found | Jayrup', robots: 'noindex, follow' };
    const reviews = product.numReviews
      ? await Review.find({ product: product._id, isApproved: true }).populate('user', 'name').sort({ createdAt: -1 }).limit(5).lean()
      : [];
    const price = product.variants?.length
      ? Math.min(...product.variants.map((v) => (v.salePrice && v.salePrice < v.price ? v.salePrice : v.price)))
      : effectivePrice(product);
    const crumbs = [
      { name: 'Home', url: '/' },
      { name: 'Shop', url: '/shop' },
      ...(product.category ? [{ name: product.category.name, url: `/category/${product.category.slug}` }] : []),
      { name: product.name, url: `/products/${product.slug}` },
    ];
    const title =
      product.seo?.metaTitle ||
      `${product.name}${product.netQuantity ? ` ${product.netQuantity}` : ''} – Buy Online at ₹${price} | ${product.brand || 'Jayrup'}`;
    const description =
      product.seo?.metaDescription ||
      truncate(`${product.shortDescription || stripHtml(product.description)} ✓ ₹${price} ✓ Free delivery above ₹${settings.freeShippingThreshold ?? 999} ✓ PhonePe & COD`, 160);
    const faq = faqSchema(product.faqs || []);
    const canonical = product.seo?.canonicalUrl ? abs(product.seo.canonicalUrl) : `${siteUrl()}/products/${product.slug}`;
    return {
      ...base,
      title,
      description,
      keywords: product.seo?.metaKeywords || [product.name, product.brand, ...(product.tags || []), ...(product.concerns || [])].filter(Boolean).join(', '),
      canonical,
      robots: product.seo?.searchIndexing === 'NOINDEX_NOFOLLOW' ? 'noindex, nofollow' : base.robots,
      ogType: 'product',
      image: abs(product.seo?.ogImage || product.images?.[0]?.url),
      productMeta: { price, currency: 'INR', availability: product.stock > 0 ? 'in stock' : 'out of stock', brand: product.brand || 'Jayrup' },
      jsonLd: [
        { id: 'product-schema-jsonld', data: productSchema(product, settings, reviews) },
        { id: 'breadcrumb-schema-jsonld', data: breadcrumbSchema(crumbs) },
        ...(faq ? [{ id: 'product-faq-schema-jsonld', data: faq }] : []),
      ],
      bodyHtml: `<nav>${crumbs.map((c) => `<a href="${esc(c.url)}">${esc(c.name)}</a>`).join(' › ')}</nav><h1>${esc(product.name)}</h1><p>Price: ₹${price}</p><p>${esc(product.shortDescription || '')}</p>${(product.highlights || []).length ? `<ul>${product.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}<div>${truncate(product.description, 1200)}</div>`,
    };
  }

  m = /^\/category\/([a-z0-9-]+)$/.exec(path);
  if (m) {
    const cat = await Category.findOne({ slug: m[1], status: 'ACTIVE' }).lean();
    if (!cat) return { ...base, status: 404, title: 'Category not found | Jayrup', robots: 'noindex, follow' };
    const products = await Product.find({ category: cat._id, status: 'ACTIVE' }).select('name slug price salePrice images').limit(30).lean();
    const crumbs = [
      { name: 'Home', url: '/' },
      { name: 'Shop', url: '/shop' },
      { name: cat.name, url: `/category/${cat.slug}` },
    ];
    return {
      ...base,
      title: cat.seo?.metaTitle || `${cat.name} – Buy ${cat.name} Online in India | Jayrup`,
      description: cat.seo?.metaDescription || truncate(cat.description || `Shop ${cat.name} by Jayrup online. Genuine products, secure PhonePe & COD checkout and delivery across India.`, 158),
      keywords: cat.seo?.metaKeywords || base.keywords,
      canonical: cat.seo?.canonicalUrl ? abs(cat.seo.canonicalUrl) : `${siteUrl()}/category/${cat.slug}`,
      image: abs(cat.image?.url),
      jsonLd: [
        { id: 'breadcrumb-schema-jsonld', data: breadcrumbSchema(crumbs) },
        {
          id: 'collection-schema-jsonld',
          data: {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: cat.name,
            url: `${siteUrl()}/category/${cat.slug}`,
            description: truncate(cat.description || '', 300),
            mainEntity: {
              '@type': 'ItemList',
              itemListElement: products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${siteUrl()}/products/${p.slug}`, name: p.name })),
            },
          },
        },
      ],
      bodyHtml: `<h1>${esc(cat.name)}</h1><p>${esc(stripHtml(cat.description || ''))}</p><ul>${products.map((p) => `<li><a href="/products/${esc(p.slug)}">${esc(p.name)}</a> – ₹${effectivePrice(p)}</li>`).join('')}</ul>`,
    };
  }

  m = /^\/blog\/([a-z0-9-]+)$/.exec(path);
  if (m) {
    const blog = await Blog.findOne({ slug: m[1], status: 'PUBLISHED' }).lean();
    if (!blog) return { ...base, status: 404, title: 'Article not found | Jayrup', robots: 'noindex, follow' };
    const url = `${siteUrl()}/blog/${blog.slug}`;
    return {
      ...base,
      title: blog.seo?.metaTitle || `${blog.title} | Jayrup Journal`,
      description: blog.seo?.metaDescription || truncate(blog.excerpt || blog.content, 158),
      keywords: blog.seo?.metaKeywords || (blog.tags || []).join(', '),
      canonical: blog.seo?.canonicalUrl ? abs(blog.seo.canonicalUrl) : url,
      ogType: 'article',
      image: abs(blog.coverImage?.url),
      articleMeta: { published: blog.publishedAt || blog.createdAt, modified: blog.updatedAt, section: blog.category, tags: blog.tags || [] },
      jsonLd: [
        {
          id: 'article-schema-jsonld',
          data: {
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: blog.title.slice(0, 110),
            description: truncate(blog.excerpt, 300),
            image: [abs(blog.coverImage?.url)],
            datePublished: new Date(blog.publishedAt || blog.createdAt).toISOString(),
            dateModified: new Date(blog.updatedAt).toISOString(),
            author: { '@type': 'Organization', name: blog.author || 'Jayrup', url: siteUrl() },
            publisher: { '@id': `${siteUrl()}/#organization` },
            mainEntityOfPage: { '@type': 'WebPage', '@id': url },
            articleSection: blog.category,
            keywords: (blog.tags || []).join(', '),
            inLanguage: 'en-IN',
          },
        },
        {
          id: 'breadcrumb-schema-jsonld',
          data: breadcrumbSchema([
            { name: 'Home', url: '/' },
            { name: 'Journal', url: '/blog' },
            { name: blog.title, url: `/blog/${blog.slug}` },
          ]),
        },
      ],
      bodyHtml: `<article><h1>${esc(blog.title)}</h1><p>${esc(blog.excerpt || '')}</p><div>${truncate(blog.content, 2000)}</div></article>`,
    };
  }

  // Unknown route → real 404 (avoids soft-404s in Search Console)
  return { ...base, status: 404, title: 'Page not found | Jayrup', robots: 'noindex, follow' };
};

/** Render SEO object to an HTML string for <head> */
export const renderHeadHtml = (seo, settings = {}) => {
  const t = esc(seo.title);
  const d = esc(seo.description || '');
  const lines = [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    seo.keywords ? `<meta name="keywords" content="${esc(seo.keywords)}" />` : '',
    `<meta name="robots" content="${esc(seo.robots)}" />`,
    `<link rel="canonical" href="${esc(seo.canonical)}" />`,
    `<link rel="alternate" hreflang="en-IN" href="${esc(seo.canonical)}" />`,
    `<link rel="alternate" hreflang="x-default" href="${esc(seo.canonical)}" />`,
    `<meta property="og:site_name" content="Jayrup" />`,
    `<meta property="og:locale" content="en_IN" />`,
    `<meta property="og:type" content="${esc(seo.ogType)}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:url" content="${esc(seo.canonical)}" />`,
    `<meta property="og:image" content="${esc(seo.image)}" />`,
    `<meta property="og:image:alt" content="${t}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${esc(seo.image)}" />`,
  ];
  if (seo.productMeta) {
    lines.push(
      `<meta property="product:price:amount" content="${seo.productMeta.price}" />`,
      `<meta property="product:price:currency" content="INR" />`,
      `<meta property="product:availability" content="${seo.productMeta.availability}" />`,
      `<meta property="product:brand" content="${esc(seo.productMeta.brand)}" />`,
      `<meta property="product:condition" content="new" />`
    );
  }
  if (seo.articleMeta) {
    lines.push(
      `<meta property="article:published_time" content="${new Date(seo.articleMeta.published).toISOString()}" />`,
      `<meta property="article:modified_time" content="${new Date(seo.articleMeta.modified).toISOString()}" />`
    );
  }
  if (settings.googleSiteVerification) lines.push(`<meta name="google-site-verification" content="${esc(settings.googleSiteVerification)}" />`);
  if (settings.bingSiteVerification) lines.push(`<meta name="msvalidate.01" content="${esc(settings.bingSiteVerification)}" />`);
  (seo.jsonLd || []).forEach(({ id, data }) => {
    lines.push(`<script type="application/ld+json" id="${id}">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`);
  });
  return lines.filter(Boolean).join('\n    ');
};
