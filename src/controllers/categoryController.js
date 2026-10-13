import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { Redirect } from '../models/Redirect.js';
import { logAdminAction } from '../utils/auditLogger.js';
import { PRODUCT_TYPES } from '../config/productTypes.js';

const slugifyCat = (v = '') =>
  String(v)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

// Whitelisted, normalised category input (tax / type defaults are inherited by every product in it)
const categoryInput = (body = {}) => {
  const d = {};
  ['name', 'intro', 'description', 'image', 'featured', 'status', 'seo', 'googleProductCategory'].forEach((k) => {
    if (body[k] !== undefined) d[k] = body[k];
  });
  if (Array.isArray(body.faqs)) {
    d.faqs = body.faqs
      .map((f) => ({ question: String(f?.question || '').trim(), answer: String(f?.answer || '').trim() }))
      .filter((f) => f.question && f.answer)
      .slice(0, 20);
  }
  if (body.slug !== undefined) d.slug = slugifyCat(body.slug);
  if (body.parent !== undefined) d.parent = body.parent || null;
  if (body.sortOrder !== undefined) d.sortOrder = Number(body.sortOrder) || 0;
  if (body.productType !== undefined) d.productType = PRODUCT_TYPES[body.productType] ? body.productType : '';
  if (body.hsnCode !== undefined) d.hsnCode = String(body.hsnCode || '').replace(/\D/g, '').slice(0, 8);
  if (body.gstRate !== undefined) d.gstRate = body.gstRate === '' || body.gstRate === null ? null : Math.min(40, Math.max(0, Number(body.gstRate) || 0));
  if (d.status !== undefined && !['ACTIVE', 'INACTIVE'].includes(d.status)) delete d.status;
  return d;
};

// @desc    Get all active categories with subcategories
// @route   GET /api/v1/categories
// @access  Public
export const getCategories = async (req, res, next) => {
  try {
    const query = req.query.all === 'true' ? {} : { status: 'ACTIVE' };
    
    // Find parent categories
    const categories = await Category.find({ ...query, parent: null })
      .populate({
        path: 'subcategories',
        match: query,
      })
      .sort({ sortOrder: 1, createdAt: 1 });

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get category by slug
// @route   GET /api/v1/categories/:slug
// @access  Public
export const getCategoryBySlug = async (req, res, next) => {
  try {
    // Storefront: active categories only (admins use ?all=true to open inactive ones)
    const query = { slug: String(req.params.slug).toLowerCase() };
    if (req.query.all !== 'true') query.status = 'ACTIVE';
    const category = await Category.findOne(query)
      .populate({ path: 'subcategories', match: { status: 'ACTIVE' } })
      .populate('parent', 'name slug');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Create category
// @route   POST /api/v1/categories
// @access  Private/Admin
export const createCategory = async (req, res, next) => {
  try {
    const input = categoryInput(req.body);
    if (!input.name) return res.status(400).json({ success: false, message: 'Category name is required' });
    const formattedSlug = input.slug || slugifyCat(input.name);

    const existing = await Category.findOne({ slug: formattedSlug });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A category with this slug already exists',
      });
    }

    const category = await Category.create({
      description: '',
      image: { url: '', publicId: '' },
      featured: false,
      status: 'ACTIVE',
      seo: { metaTitle: '', metaDescription: '' },
      ...input,
      slug: formattedSlug,
      parent: input.parent || null,
    });

    await logAdminAction({
      req,
      action: 'CATEGORY_CREATED',
      resource: 'Category',
      resourceId: category._id.toString(),
      details: { name: category.name, slug: category.slug },
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Update category
// @route   PUT /api/v1/categories/:id
// @access  Private/Admin
export const updateCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    const input = categoryInput(req.body);
    const oldSlug = category.slug;
    const newSlug = input.slug || null;
    if (input.parent && String(input.parent) === String(category._id)) {
      return res.status(400).json({ success: false, message: 'A category cannot be its own parent' });
    }
    if (newSlug && newSlug !== oldSlug) {
      if (await Category.exists({ slug: newSlug, _id: { $ne: category._id } })) {
        return res.status(400).json({ success: false, message: 'A category with this slug already exists' });
      }
      await Redirect.registerRedirect(`/category/${oldSlug}`, `/category/${newSlug}`, 'CATEGORY');
    }

    const updated = await Category.findByIdAndUpdate(req.params.id, input, {
      new: true,
      runValidators: true,
    });

    await logAdminAction({
      req,
      action: 'CATEGORY_UPDATED',
      resource: 'Category',
      resourceId: updated._id.toString(),
      details: input,
    });

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Delete category
// @route   DELETE /api/v1/categories/:id
// @access  Private/Admin
export const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    // Check if category has associated products
    const productCount = await Product.countDocuments({
      $or: [{ category: category._id }, { subCategory: category._id }],
    });

    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete this category – ${productCount} product(s) are still in it (archived ones count too). Delete them in Admin › Products (Delete permanently) or move them to another category first.`,
      });
    }

    await Category.findByIdAndDelete(req.params.id);

    await logAdminAction({
      req,
      action: 'CATEGORY_DELETED',
      resource: 'Category',
      resourceId: category._id.toString(),
      details: { name: category.name, slug: category.slug },
    });

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
