import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Blog } from '../models/Blog.js';
import { Redirect } from '../models/Redirect.js';

const getBaseUrl = () => {
  return process.env.CLIENT_URL || 'https://jayrup.com';
};

// Helper to escape XML special characters
const escapeXml = (unsafe) => {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

// @desc    Dynamic XML Sitemap generation
// @route   GET /sitemap.xml or GET /api/v1/seo/sitemap.xml
// @access  Public
export const getSitemapXml = async (req, res, next) => {
  try {
    const baseUrl = getBaseUrl();
    const now = new Date().toISOString().split('T')[0];

    // 1. Fetch active data from DB
    const [products, categories, blogs] = await Promise.all([
      Product.find({ status: 'ACTIVE', 'seo.searchIndexing': { $ne: 'NOINDEX_NOFOLLOW' } })
        .select('slug updatedAt images name shortDescription')
        .lean(),
      Category.find({ status: 'ACTIVE' })
        .select('slug updatedAt image name description')
        .lean(),
      Blog.find({ status: 'PUBLISHED' })
        .select('slug updatedAt coverImage title excerpt')
        .lean(),
    ]);

    // 2. Static Landing Pages
    const staticPages = [
      { url: '/', changefreq: 'daily', priority: '1.0' },
      { url: '/shop', changefreq: 'daily', priority: '0.9' },
      { url: '/about', changefreq: 'monthly', priority: '0.7' },
      { url: '/contact', changefreq: 'monthly', priority: '0.7' },
      { url: '/faq', changefreq: 'weekly', priority: '0.8' },
      { url: '/blog', changefreq: 'weekly', priority: '0.8' },
      { url: '/shipping-policy', changefreq: 'monthly', priority: '0.4' },
      { url: '/return-policy', changefreq: 'monthly', priority: '0.4' },
      { url: '/privacy-policy', changefreq: 'yearly', priority: '0.3' },
      { url: '/terms-of-service', changefreq: 'yearly', priority: '0.3' },
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

    // Add Static Pages
    for (const page of staticPages) {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}${page.url}</loc>\n`;
      xml += `    <lastmod>${now}</lastmod>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += `  </url>\n`;
    }

    // Add Categories
    for (const cat of categories) {
      const lastMod = cat.updatedAt ? new Date(cat.updatedAt).toISOString().split('T')[0] : now;
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/category/${cat.slug}</loc>\n`;
      xml += `    <lastmod>${lastMod}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.85</priority>\n`;
      if (cat.image?.url) {
        xml += `    <image:image>\n`;
        xml += `      <image:loc>${escapeXml(cat.image.url)}</image:loc>\n`;
        xml += `      <image:title>${escapeXml(cat.name)}</image:title>\n`;
        xml += `    </image:image>\n`;
      }
      xml += `  </url>\n`;
    }

    // Add Products (with Image Sitemap tags)
    for (const prod of products) {
      const lastMod = prod.updatedAt ? new Date(prod.updatedAt).toISOString().split('T')[0] : now;
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/products/${prod.slug}</loc>\n`;
      xml += `    <lastmod>${lastMod}</lastmod>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>0.95</priority>\n`;

      if (prod.images && prod.images.length > 0) {
        for (const img of prod.images.slice(0, 3)) {
          if (img.url) {
            xml += `    <image:image>\n`;
            xml += `      <image:loc>${escapeXml(img.url)}</image:loc>\n`;
            xml += `      <image:title>${escapeXml(img.altText || prod.name)}</image:title>\n`;
            if (prod.shortDescription) {
              xml += `      <image:caption>${escapeXml(prod.shortDescription)}</image:caption>\n`;
            }
            xml += `    </image:image>\n`;
          }
        }
      }
      xml += `  </url>\n`;
    }

    // Add Blog Posts
    for (const blog of blogs) {
      const lastMod = blog.updatedAt ? new Date(blog.updatedAt).toISOString().split('T')[0] : now;
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/blog/${blog.slug}</loc>\n`;
      xml += `    <lastmod>${lastMod}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      if (blog.coverImage?.url) {
        xml += `    <image:image>\n`;
        xml += `      <image:loc>${escapeXml(blog.coverImage.url)}</image:loc>\n`;
        xml += `      <image:title>${escapeXml(blog.title)}</image:title>\n`;
        xml += `    </image:image>\n`;
      }
      xml += `  </url>\n`;
    }

    xml += `</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.header('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    return res.status(200).send(xml);
  } catch (error) {
    next(error);
  }
};

// @desc    Dynamic robots.txt generation
// @route   GET /robots.txt or GET /api/v1/seo/robots.txt
// @access  Public
export const getRobotsTxt = async (req, res) => {
  const baseUrl = getBaseUrl();
  const robots = `# Jayrup (JR) Royal Luxury Fragrance & Skincare House - Search Engine Directives
User-agent: *
Allow: /
Allow: /shop
Allow: /category/
Allow: /products/
Allow: /blog/
Allow: /about
Allow: /contact
Allow: /faq
Allow: /privacy-policy
Allow: /shipping-policy
Allow: /return-policy
Allow: /terms-of-service

# Disallow Private & Administrative Routes
Disallow: /admin/
Disallow: /cart
Disallow: /checkout
Disallow: /profile
Disallow: /orders
Disallow: /order-success/
Disallow: /api/v1/admin/
Disallow: /api/v1/auth/
Disallow: /api/v1/orders/
Disallow: /api/v1/cart/
Disallow: /api/v1/payments/

# Dynamic XML Sitemap
Sitemap: ${baseUrl}/sitemap.xml
`;

  res.header('Content-Type', 'text/plain');
  res.header('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
  return res.status(200).send(robots);
};

// @desc    Google Merchant Center RSS 2.0 Product Feed XML
// @route   GET /google-merchant-feed.xml or GET /api/v1/seo/google-merchant-feed.xml
// @access  Public
export const getGoogleMerchantFeed = async (req, res, next) => {
  try {
    const baseUrl = getBaseUrl();
    const products = await Product.find({ status: 'ACTIVE' })
      .populate('category', 'name')
      .populate('subCategory', 'name')
      .lean();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n`;
    xml += `  <channel>\n`;
    xml += `    <title>Jayrup Royal Luxury Perfumes &amp; Skincare Products</title>\n`;
    xml += `    <link>${baseUrl}</link>\n`;
    xml += `    <description>Authentic handcrafted Indian luxury perfumes, extraits de parfum, saffron soaps, and therapeutic cosmetics.</description>\n`;

    for (const prod of products) {
      const activePrice = (prod.salePrice && prod.salePrice < prod.price ? prod.salePrice : prod.price) || 0;
      const primaryImage = prod.images?.[0]?.url || `${baseUrl}/src/assets/jayroop-logo.webp`;
      const categoryName = prod.category?.name || 'Luxury Fragrance';

      xml += `    <item>\n`;
      xml += `      <g:id>${escapeXml(prod.sku || prod._id.toString())}</g:id>\n`;
      xml += `      <g:title>${escapeXml(prod.name)}</g:title>\n`;
      xml += `      <g:description>${escapeXml(prod.shortDescription || prod.description || prod.name)}</g:description>\n`;
      xml += `      <g:link>${baseUrl}/products/${prod.slug}</g:link>\n`;
      xml += `      <g:image_link>${escapeXml(primaryImage)}</g:image_link>\n`;
      xml += `      <g:price>${activePrice.toFixed(2)} INR</g:price>\n`;
      if (prod.salePrice && prod.salePrice < prod.price) {
        xml += `      <g:sale_price>${prod.salePrice.toFixed(2)} INR</g:sale_price>\n`;
      }
      xml += `      <g:availability>${prod.stock > 0 ? 'in_stock' : 'out_of_stock'}</g:availability>\n`;
      xml += `      <g:condition>new</g:condition>\n`;
      xml += `      <g:brand>${escapeXml(prod.brand || 'Jayrup')}</g:brand>\n`;
      xml += `      <g:identifier_exists>no</g:identifier_exists>\n`;
      xml += `      <g:mpn>${escapeXml(prod.sku)}</g:mpn>\n`;
      xml += `      <g:product_type>${escapeXml(categoryName)}</g:product_type>\n`;
      xml += `      <g:google_product_category>Health &amp; Beauty &gt; Personal Care &gt; Cosmetics &gt; Perfume &amp; Cologne</g:google_product_category>\n`;
      xml += `    </item>\n`;
    }

    xml += `  </channel>\n`;
    xml += `</rss>`;

    res.header('Content-Type', 'application/xml');
    res.header('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(xml);
  } catch (error) {
    next(error);
  }
};

// @desc    Lookup 301 redirect for a requested path
// @route   GET /api/v1/seo/redirects/lookup?url=...
// @access  Public
export const lookupRedirect = async (req, res, next) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL parameter required' });
    }

    const redirect = await Redirect.findOne({ sourceUrl: url.toLowerCase().trim() });
    if (!redirect) {
      return res.status(200).json({ success: true, redirect: null });
    }

    // Increment hit counter
    await Redirect.findByIdAndUpdate(redirect._id, { $inc: { hits: 1 } });

    return res.status(200).json({
      success: true,
      redirect: {
        targetUrl: redirect.targetUrl,
        statusCode: redirect.statusCode,
      },
    });
  } catch (error) {
    next(error);
  }
};
