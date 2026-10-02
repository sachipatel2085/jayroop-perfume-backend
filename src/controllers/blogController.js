import { Blog } from '../models/Blog.js';
import { logAdminAction } from '../utils/auditLogger.js';

// @desc    Get all published blogs
// @route   GET /api/v1/blogs
// @access  Public
export const getBlogs = async (req, res, next) => {
  try {
    const { category, tag, page = 1, limit = 9 } = req.query;
    const filter = { status: 'PUBLISHED' };

    if (category) filter.category = category;
    if (tag) filter.tags = tag;

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Blog.countDocuments(filter);

    const blogs = await Blog.find(filter)
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      count: blogs.length,
      total,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      data: blogs,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single blog by slug
// @route   GET /api/v1/blogs/:slug
// @access  Public
export const getBlogBySlug = async (req, res, next) => {
  try {
    const blog = await Blog.findOne({
      slug: req.params.slug,
      status: 'PUBLISHED',
    });

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Editorial article not found',
      });
    }

    // Recent articles
    const recentBlogs = await Blog.find({
      _id: { $ne: blog._id },
      status: 'PUBLISHED',
    })
      .sort({ publishedAt: -1 })
      .limit(3)
      .select('title slug coverImage publishedAt readTime');

    res.status(200).json({
      success: true,
      data: {
        blog,
        recentBlogs,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Create blog
// @route   POST /api/v1/blogs
// @access  Private/Admin
export const createBlog = async (req, res, next) => {
  try {
    const {
      title,
      slug,
      excerpt,
      content,
      coverImage,
      author,
      category,
      tags,
      readTime,
      status,
      seo,
    } = req.body;

    const formattedSlug = (slug || title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    const existing = await Blog.findOne({ slug: formattedSlug });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A blog with this slug already exists',
      });
    }

    const blog = await Blog.create({
      title,
      slug: formattedSlug,
      excerpt,
      content,
      coverImage,
      author: author || 'Jayroop Editorial House',
      category: category || 'Fragrance & Skincare',
      tags: tags || [],
      readTime: readTime || '5 min read',
      status: status || 'PUBLISHED',
      seo: seo || {},
    });

    await logAdminAction({
      req,
      action: 'BLOG_CREATED',
      resource: 'Blog',
      resourceId: blog._id.toString(),
      details: { title: blog.title, slug: blog.slug },
    });

    res.status(201).json({
      success: true,
      message: 'Article published successfully',
      data: blog,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Update blog
// @route   PUT /api/v1/blogs/:id
// @access  Private/Admin
export const updateBlog = async (req, res, next) => {
  try {
    const updated = await Blog.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    await logAdminAction({
      req,
      action: 'BLOG_UPDATED',
      resource: 'Blog',
      resourceId: updated._id.toString(),
      details: { title: updated.title },
    });

    res.status(200).json({
      success: true,
      message: 'Article updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Delete blog
// @route   DELETE /api/v1/blogs/:id
// @access  Private/Admin
export const deleteBlog = async (req, res, next) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    await logAdminAction({
      req,
      action: 'BLOG_DELETED',
      resource: 'Blog',
      resourceId: req.params.id,
      details: { title: blog.title },
    });

    res.status(200).json({
      success: true,
      message: 'Article deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
