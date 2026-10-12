import { Setting } from '../models/Setting.js';
import { PRODUCT_TYPES, typeOf, resolveTax, isReturnable, isHazmat } from '../config/productTypes.js';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Redirect } from '../models/Redirect.js';
import { logAdminAction } from '../utils/auditLogger.js';
import { escapeRegex } from '../utils/helpers.js';

// Fields an admin may set on a product (everything else is ignored → no mass-assignment)
const PRODUCT_FIELDS = [
  'name', 'slug', 'category', 'subCategory', 'brand', 'shortDescription', 'description', 'price', 'salePrice', 'sku', 'stock',
  'lowStockThreshold', 'maxPerOrder', 'hsnCode', 'gstRate', 'images', 'videos', 'variants', 'specifications', 'fragranceNotes',
  'highlights', 'benefits', 'ingredients', 'howToUse', 'precautions', 'skinTypes', 'concerns', 'gender', 'faqs',
  'netQuantity', 'weight', 'dimensions', 'barcode', 'countryOfOrigin', 'shelfLife', 'manufacturerDetails', 'marketedBy',
  'packerDetails', 'importerDetails', 'licenseNumber', 'customerCareDetails', 'tags', 'featured', 'status', 'seo',
  'productType', 'fragrance', 'returnPolicy', 'shipping',
];

const slugify = (v = '') =>
  String(v)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 120);

const normaliseProductInput = (body) => {
  const data = {};
  PRODUCT_FIELDS.forEach((k) => {
    if (body[k] !== undefined) data[k] = body[k];
  });
  ['price', 'stock', 'lowStockThreshold', 'maxPerOrder'].forEach((k) => {
    if (data[k] !== undefined && data[k] !== '') data[k] = Math.max(0, Number(data[k]) || 0);
  });
  if (data.salePrice !== undefined) data.salePrice = data.salePrice === '' || data.salePrice === null ? null : Number(data.salePrice);
  if (data.gstRate !== undefined) data.gstRate = data.gstRate === '' || data.gstRate === null ? null : Math.min(40, Math.max(0, Number(data.gstRate)));
  if (data.productType !== undefined) data.productType = PRODUCT_TYPES[data.productType] ? data.productType : '';
  if (data.hsnCode !== undefined) data.hsnCode = String(data.hsnCode || '').replace(/\D/g, '').slice(0, 8);
  const triBool = (v) => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : null);
  if (data.returnPolicy !== undefined) {
    data.returnPolicy = { returnable: triBool(data.returnPolicy?.returnable), note: String(data.returnPolicy?.note || '').trim().slice(0, 500) };
  }
  if (data.shipping !== undefined) {
    data.shipping = { surfaceOnly: triBool(data.shipping?.surfaceOnly), note: String(data.shipping?.note || '').trim().slice(0, 300) };
  }
  if (data.fragrance !== undefined) {
    const f = data.fragrance || {};
    const list = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((x) => String(x).trim()).filter(Boolean).slice(0, 10);
    data.fragrance = {
      family: String(f.family || '').trim(),
      concentration: String(f.concentration || '').trim(),
      longevity: String(f.longevity || '').trim(),
      sillage: String(f.sillage || '').trim(),
      season: list(f.season),
      occasion: list(f.occasion),
    };
  }
  if (data.weight !== undefined) data.weight = data.weight === '' || data.weight === null ? null : Number(data.weight);
  if (Array.isArray(data.variants)) {
    data.variants = data.variants
      .filter((v) => v && v.title && v.sku && v.price !== '' && v.price !== undefined)
      .map((v) => ({
        title: String(v.title).trim(),
        sku: String(v.sku).trim(),
        price: Number(v.price) || 0,
        salePrice: v.salePrice === '' || v.salePrice === null || v.salePrice === undefined ? null : Number(v.salePrice),
        stock: Math.max(0, Number(v.stock) || 0),
        weight: v.weight === '' || v.weight === undefined ? null : Number(v.weight),
        netQuantity: String(v.netQuantity || '').trim(),
        barcode: v.barcode || '',
        attributes: v.attributes || {},
      }));
    const skus = data.variants.map((v) => v.sku);
    if (new Set(skus).size !== skus.length) {
      const e = new Error('Variant SKUs must be unique.');
      e.statusCode = 400;
      throw e;
    }
  }
  if (Array.isArray(data.images)) {
    data.images = data.images.filter((i) => i && i.url).map((i, idx) => ({ url: i.url, publicId: i.publicId || '', altText: i.altText || '', isPrimary: idx === 0 }));
  }
  if (Array.isArray(data.faqs)) data.faqs = data.faqs.filter((f) => f && f.question && f.answer).slice(0, 30);
  if (Array.isArray(data.highlights)) data.highlights = data.highlights.map((h) => String(h).trim()).filter(Boolean).slice(0, 12);
  if (Array.isArray(data.tags)) data.tags = data.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 30);
  if (data.salePrice !== undefined && data.salePrice !== null && data.price !== undefined && data.salePrice >= data.price) {
    data.salePrice = null; // a "sale" price above MRP is meaningless
  }
  return data;
};

// @desc    Get all products with filtering, search, sorting & pagination
// @route   GET /api/v1/products
// @access  Public
export const getProducts = async (req, res, next) => {
  try {
    const {
      ids,
      search,
      category,
      subCategory,
      minPrice,
      maxPrice,
      brand,
      featured,
      inStock,
      sort,
    } = req.query;
    let { page = 1, limit = 12 } = req.query;

    const filter = { status: 'ACTIVE' };

    // Filter by specific IDs (e.g. for wishlist or bulk lookup)
    if (ids) {
      const idList = ids.split(',').map((id) => id.trim()).filter((id) => id.match(/^[0-9a-fA-F]{24}$/));
      if (idList.length > 0) {
        filter._id = { $in: idList };
      }
    }

    // Search query
    if (search) {
      const safe = escapeRegex(String(search).trim());
      filter.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { brand: { $regex: safe, $options: 'i' } },
        { tags: { $in: [new RegExp(safe, 'i')] } },
        { shortDescription: { $regex: safe, $options: 'i' } },
        { concerns: { $in: [new RegExp(safe, 'i')] } },
        { 'fragranceNotes.topNotes': { $regex: safe, $options: 'i' } },
        { 'fragranceNotes.heartNotes': { $regex: safe, $options: 'i' } },
        { 'fragranceNotes.baseNotes': { $regex: safe, $options: 'i' } },
        { 'fragrance.family': { $regex: safe, $options: 'i' } },
      ];
    }

    // Category filter by slug or ID
    if (category) {
      if (category.match(/^[0-9a-fA-F]{24}$/)) {
        filter.category = category;
      } else {
        const catDoc = await Category.findOne({ slug: category });
        if (catDoc) {
          // Include products in this category or any of its subcategories
          const subCats = await Category.find({ parent: catDoc._id });
          const catIds = [catDoc._id, ...subCats.map((s) => s._id)];
          filter.category = { $in: catIds };
        }
      }
    }

    // Subcategory filter
    if (subCategory) {
      if (subCategory.match(/^[0-9a-fA-F]{24}$/)) {
        filter.subCategory = subCategory;
      } else {
        const subDoc = await Category.findOne({ slug: subCategory });
        if (subDoc) filter.subCategory = subDoc._id;
      }
    }

    // Price range filter (on the effective selling price)
    if (minPrice || maxPrice) {
      const effective = { $cond: [{ $and: [{ $gt: ['$salePrice', 0] }, { $lt: ['$salePrice', '$price'] }] }, '$salePrice', '$price'] };
      const conds = [];
      if (minPrice) conds.push({ $gte: [effective, Number(minPrice)] });
      if (maxPrice) conds.push({ $lte: [effective, Number(maxPrice)] });
      filter.$expr = conds.length > 1 ? { $and: conds } : conds[0];
    }

    // Brand filter
    if (brand) {
      filter.brand = { $regex: escapeRegex(brand), $options: 'i' };
    }

    // Featured filter
    if (featured === 'true') {
      filter.featured = true;
    }

    // Stock availability filter
    if (inStock === 'true') {
      filter.stock = { $gt: 0 };
    }

    // Sorting options
    let sortOption = { createdAt: -1 }; // Default newest
    if (sort === 'price-asc') sortOption = { price: 1 };
    else if (sort === 'price-desc') sortOption = { price: -1 };
    else if (sort === 'rating') sortOption = { averageRating: -1 };
    else if (sort === 'popularity') sortOption = { numReviews: -1, totalSold: -1 };
    else if (sort === 'bestselling') sortOption = { totalSold: -1 };
    else if (sort === 'featured') sortOption = { featured: -1, totalSold: -1 };

    limit = Math.min(60, Math.max(1, Number(limit) || 12));
    page = Math.max(1, Number(page) || 1);
    const skip = (page - 1) * limit;
    const total = await Product.countDocuments(filter);

    const products = await Product.find(filter)
      .populate('category', 'name slug')
      .populate('subCategory', 'name slug')
      .select('-description -benefits -ingredients -howToUse -precautions -faqs -manufacturerDetails -packerDetails -importerDetails')
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product by slug
// @route   GET /api/v1/products/:slug
// @access  Public
export const getProductBySlug = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      slug: req.params.slug,
      status: 'ACTIVE',
    })
      .populate('category', 'name slug productType hsnCode gstRate')
      .populate('subCategory', 'name slug');

    if (!product) {
      const redirect = await Redirect.findOne({ sourceUrl: `/products/${String(req.params.slug).toLowerCase()}` });
      return res.status(404).json({
        success: false,
        message: 'Product not found',
        redirectTo: redirect?.targetUrl || null,
      });
    }

    // Related products: same category first, then best sellers
    let relatedProducts = await Product.find({
      category: product.category?._id,
      _id: { $ne: product._id },
      status: 'ACTIVE',
    })
      .sort({ totalSold: -1 })
      .limit(4)
      .select('name slug price salePrice images averageRating numReviews stock variants brand');
    if (relatedProducts.length < 4) {
      const more = await Product.find({ _id: { $nin: [product._id, ...relatedProducts.map((p) => p._id)] }, status: 'ACTIVE' })
        .sort({ totalSold: -1, featured: -1 })
        .limit(4 - relatedProducts.length)
        .select('name slug price salePrice images averageRating numReviews stock variants brand');
      relatedProducts = [...relatedProducts, ...more];
    }

    // Resolved, product-type aware facts for the storefront (no product-specific code in the UI)
    const settings = await Setting.getStoreSettings();
    const tax = resolveTax(product, product.category, settings);
    const surfaceOnly = isHazmat(product, product.category);
    const meta = {
      productType: tax.productType,
      productTypeLabel: typeOf(tax.productType).label,
      sections: typeOf(tax.productType).sections,
      returnable: isReturnable(product, product.category),
      returnNote: product.returnPolicy?.note || '',
      surfaceOnly,
      shippingNote: product.shipping?.note || '',
      estimatedDeliveryText: surfaceOnly ? settings.surfaceDeliveryText || settings.estimatedDeliveryText : settings.estimatedDeliveryText,
    };

    res.status(200).json({
      success: true,
      data: {
        product,
        meta,
        relatedProducts,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: list ALL products (incl. drafts / archived) for the catalogue manager
// @route   GET /api/v1/products/admin/list?search&status&page&limit
// @access  Private/Admin
export const getAdminProducts = async (req, res, next) => {
  try {
    const { search, status, category } = req.query;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const page = Math.max(1, Number(req.query.page) || 1);
    const filter = {};
    if (status && ['ACTIVE', 'DRAFT', 'ARCHIVED'].includes(status)) filter.status = status;
    else filter.status = { $ne: 'ARCHIVED' };
    if (category && /^[0-9a-fA-F]{24}$/.test(category)) filter.category = category;
    if (search) {
      const rx = { $regex: escapeRegex(search), $options: 'i' };
      filter.$or = [{ name: rx }, { sku: rx }, { 'variants.sku': rx }, { tags: rx }];
    }
    const [total, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter).populate('category', 'name slug').populate('subCategory', 'name slug').sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit),
    ]);
    res.status(200).json({ success: true, total, totalPages: Math.ceil(total / limit), currentPage: page, data: products });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: single product by id (any status)
// @route   GET /api/v1/products/admin/:id
// @access  Private/Admin
export const getAdminProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate('category', 'name slug').populate('subCategory', 'name slug');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

const syncNotesIntoSpecs = (data, existingSpecs = {}) => {
  if (!data.fragranceNotes) return;
  const specs = { ...(data.specifications || existingSpecs) };
  const map = { topNotes: 'Top Notes', heartNotes: 'Heart Notes', baseNotes: 'Base Notes' };
  Object.entries(map).forEach(([k, label]) => {
    if (data.fragranceNotes[k]) specs[label] = data.fragranceNotes[k];
    else delete specs[label];
  });
  data.specifications = specs;
};

// @desc    Admin: Create product
// @route   POST /api/v1/products
// @access  Private/Admin
export const createProduct = async (req, res, next) => {
  try {
    const data = normaliseProductInput(req.body);
    if (!data.name || !data.sku || !data.category || data.price === undefined || !data.description) {
      return res.status(400).json({ success: false, message: 'Name, SKU, category, price and description are required.' });
    }
    data.slug = slugify(data.slug || data.name);
    if (!data.slug) return res.status(400).json({ success: false, message: 'Please provide a valid slug.' });

    if (await Product.exists({ slug: data.slug })) {
      return res.status(400).json({ success: false, message: 'A product with this slug already exists. Please choose a unique name/slug.' });
    }
    if (await Product.exists({ $or: [{ sku: data.sku }, { 'variants.sku': data.sku }] })) {
      return res.status(400).json({ success: false, message: 'A product with this SKU already exists.' });
    }
    if (data.variants?.length && (await Product.exists({ $or: [{ sku: { $in: data.variants.map((v) => v.sku) } }, { 'variants.sku': { $in: data.variants.map((v) => v.sku) } }] }))) {
      return res.status(400).json({ success: false, message: 'One of the variant SKUs is already used by another product.' });
    }
    if (data.variants?.length && (data.stock === undefined || data.stock === '')) {
      data.stock = data.variants.reduce((s, v) => s + v.stock, 0);
    }
    syncNotesIntoSpecs(data);
    data.brand = data.brand || 'Jayrup';
    data.subCategory = data.subCategory || null;

    const product = await Product.create(data);

    await logAdminAction({
      req,
      action: 'PRODUCT_CREATED',
      resource: 'Product',
      resourceId: product._id.toString(),
      details: { name: product.name, sku: product.sku, price: product.price },
    });

    res.status(201).json({ success: true, message: 'Product created successfully', data: product });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Update product
// @route   PUT /api/v1/products/:id
// @access  Private/Admin
export const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const data = normaliseProductInput(req.body);
    const oldSlug = product.slug;
    if (data.slug !== undefined) data.slug = slugify(data.slug || product.name);
    if (data.slug && data.slug !== oldSlug) {
      if (await Product.exists({ slug: data.slug, _id: { $ne: product._id } })) {
        return res.status(400).json({ success: false, message: 'Another product already uses this slug.' });
      }
      await Redirect.registerRedirect(`/products/${oldSlug}`, `/products/${data.slug}`, 'PRODUCT');
    }
    if (data.sku && data.sku !== product.sku && (await Product.exists({ sku: data.sku, _id: { $ne: product._id } }))) {
      return res.status(400).json({ success: false, message: 'Another product already uses this SKU.' });
    }
    if (data.subCategory === '') data.subCategory = null;
    const priceForCheck = data.price ?? product.price;
    if (data.salePrice !== undefined && data.salePrice !== null && data.salePrice >= priceForCheck) data.salePrice = null;

    syncNotesIntoSpecs(data, product.specifications ? Object.fromEntries(product.specifications) : {});

    const updated = await Product.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });

    await logAdminAction({
      req,
      action: 'PRODUCT_UPDATED',
      resource: 'Product',
      resourceId: updated._id.toString(),
      details: { name: updated.name, sku: updated.sku, stock: updated.stock, fields: Object.keys(data), slugChanged: Boolean(data.slug && data.slug !== oldSlug) },
    });

    res.status(200).json({ success: true, message: 'Product updated successfully', data: updated });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Delete product
// @route   DELETE /api/v1/products/:id
// @access  Private/Admin
export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Soft deletion by setting status to ARCHIVED to preserve past order history
    product.status = 'ARCHIVED';
    await product.save();

    await logAdminAction({
      req,
      action: 'PRODUCT_DELETED',
      resource: 'Product',
      resourceId: product._id.toString(),
      details: { name: product.name, sku: product.sku },
    });

    res.status(200).json({
      success: true,
      message: 'Product archived successfully',
    });
  } catch (error) {
    next(error);
  }
};
