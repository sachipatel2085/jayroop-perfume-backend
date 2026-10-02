import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { logAdminAction } from '../utils/auditLogger.js';

// @desc    Get all products with filtering, search, sorting & pagination
// @route   GET /api/v1/products
// @access  Public
export const getProducts = async (req, res, next) => {
  try {
    const {
      search,
      category,
      subCategory,
      minPrice,
      maxPrice,
      brand,
      featured,
      inStock,
      sort,
      page = 1,
      limit = 12,
    } = req.query;

    const filter = { status: 'ACTIVE' };

    // Search query
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
        { shortDescription: { $regex: search, $options: 'i' } },
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

    // Price range filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    // Brand filter
    if (brand) {
      filter.brand = { $regex: brand, $options: 'i' };
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
    else if (sort === 'popularity') sortOption = { numReviews: -1 };

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Product.countDocuments(filter);

    const products = await Product.find(filter)
      .populate('category', 'name slug')
      .populate('subCategory', 'name slug')
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit));

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
      .populate('category', 'name slug')
      .populate('subCategory', 'name slug');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Find related products in the same category
    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: product._id },
      status: 'ACTIVE',
    })
      .limit(4)
      .select('name slug price salePrice images averageRating numReviews');

    res.status(200).json({
      success: true,
      data: {
        product,
        relatedProducts,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Create product
// @route   POST /api/v1/products
// @access  Private/Admin
export const createProduct = async (req, res, next) => {
  try {
    const {
      name,
      slug,
      category,
      subCategory,
      brand,
      shortDescription,
      description,
      price,
      salePrice,
      sku,
      stock,
      images,
      videos,
      variants,
      specifications,
      tags,
      featured,
      status,
      seo,
    } = req.body;

    const formattedSlug = (slug || name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    const existingSlug = await Product.findOne({ slug: formattedSlug });
    if (existingSlug) {
      return res.status(400).json({
        success: false,
        message: 'A product with this slug already exists. Please choose a unique name/slug.',
      });
    }

    const existingSku = await Product.findOne({ sku });
    if (existingSku) {
      return res.status(400).json({
        success: false,
        message: 'A product with this SKU already exists.',
      });
    }

    const product = await Product.create({
      name,
      slug: formattedSlug,
      category,
      subCategory: subCategory || null,
      brand: brand || 'Jayroop Special',
      shortDescription,
      description,
      price: Number(price),
      salePrice: salePrice ? Number(salePrice) : null,
      sku,
      stock: Number(stock || 0),
      images: images || [],
      videos: videos || [],
      variants: variants || [],
      specifications: specifications || {},
      tags: tags || [],
      featured: featured || false,
      status: status || 'ACTIVE',
      seo: seo || {},
    });

    await logAdminAction({
      req,
      action: 'PRODUCT_CREATED',
      resource: 'Product',
      resourceId: product._id.toString(),
      details: { name: product.name, sku: product.sku, price: product.price },
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product,
    });
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
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const updated = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    await logAdminAction({
      req,
      action: 'PRODUCT_UPDATED',
      resource: 'Product',
      resourceId: updated._id.toString(),
      details: { name: updated.name, sku: updated.sku, stock: updated.stock },
    });

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: updated,
    });
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
