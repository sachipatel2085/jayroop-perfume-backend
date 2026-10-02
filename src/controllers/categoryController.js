import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { logAdminAction } from '../utils/auditLogger.js';

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
      .sort({ createdAt: 1 });

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
    const category = await Category.findOne({ slug: req.params.slug })
      .populate('subcategories')
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
    const { name, slug, parent, description, image, featured, status, seo } = req.body;

    const formattedSlug = (slug || name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    const existing = await Category.findOne({ slug: formattedSlug });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A category with this slug already exists',
      });
    }

    const category = await Category.create({
      name,
      slug: formattedSlug,
      parent: parent || null,
      description: description || '',
      image: image || { url: '', publicId: '' },
      featured: featured || false,
      status: status || 'ACTIVE',
      seo: seo || { metaTitle: '', metaDescription: '' },
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

    const updated = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    await logAdminAction({
      req,
      action: 'CATEGORY_UPDATED',
      resource: 'Category',
      resourceId: updated._id.toString(),
      details: req.body,
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
        message: `Cannot delete category. ${productCount} product(s) are assigned to it. Reassign products first.`,
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
