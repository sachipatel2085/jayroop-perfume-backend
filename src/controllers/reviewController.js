import { Review } from '../models/Review.js';
import { Product } from '../models/Product.js';
import { Order } from '../models/Order.js';
import { logAdminAction } from '../utils/auditLogger.js';

// Helper to recalculate product rating
const updateProductRatingStats = async (productId) => {
  const reviews = await Review.find({ product: productId, isApproved: true });
  const numReviews = reviews.length;
  const averageRating =
    numReviews > 0
      ? reviews.reduce((acc, item) => item.rating + acc, 0) / numReviews
      : 0;

  await Product.findByIdAndUpdate(productId, {
    averageRating: Math.round(averageRating * 10) / 10,
    numReviews,
  });
};

// @desc    Get reviews for a product
// @route   GET /api/v1/reviews/product/:productId
// @access  Public
export const getProductReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({
      product: req.params.productId,
      isApproved: true,
    })
      .populate('user', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a product review (verifies purchase if order was completed)
// @route   POST /api/v1/reviews
// @access  Private
export const createReview = async (req, res, next) => {
  try {
    const { productId, rating, title, comment } = req.body;

    if (!productId || !rating || !comment || String(comment).trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a rating (1-5) and a review of at least 10 characters',
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Check if user has purchased this product in a PAID or DELIVERED order
    const completedOrder = await Order.findOne({
      user: req.user._id,
      'items.product': productId,
      orderStatus: { $in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
    }).sort({ createdAt: -1 });
    const safeRating = Math.min(5, Math.max(1, Math.round(Number(rating) || 0)));

    const verifiedPurchase = Boolean(completedOrder);

    // Check if user already reviewed
    const existingReview = await Review.findOne({
      product: productId,
      user: req.user._id,
    });

    if (existingReview) {
      existingReview.rating = safeRating;
      existingReview.title = String(title || '').slice(0, 120);
      existingReview.comment = String(comment).slice(0, 3000);
      existingReview.verifiedPurchase = verifiedPurchase;
      // Edited reviews from non-buyers go back to moderation
      if (!verifiedPurchase) existingReview.isApproved = false;
      await existingReview.save();

      await updateProductRatingStats(productId);

      return res.status(200).json({
        success: true,
        message: verifiedPurchase ? 'Your review has been updated' : 'Your review has been updated and will appear after moderation',
        data: existingReview,
      });
    }

    const review = await Review.create({
      product: productId,
      user: req.user._id,
      order: completedOrder ? completedOrder._id : null,
      rating: safeRating,
      title: String(title || '').slice(0, 120),
      comment: String(comment).slice(0, 3000),
      verifiedPurchase,
      // Verified buyers are published instantly; other reviews wait for admin moderation (prevents fake reviews)
      isApproved: verifiedPurchase,
    });

    await updateProductRatingStats(productId);

    res.status(201).json({
      success: true,
      message: verifiedPurchase ? 'Thank you! Your review is live.' : 'Thank you! Your review will appear after moderation.',
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Get all reviews for moderation
// @route   GET /api/v1/reviews/admin
// @access  Private/Admin
export const getAllReviewsAdmin = async (req, res, next) => {
  try {
    const reviews = await Review.find()
      .populate('product', 'name slug images')
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Toggle review approval status
// @route   PUT /api/v1/reviews/admin/:id/status
// @access  Private/Admin
export const toggleReviewApproval = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    review.isApproved = !review.isApproved;
    await review.save();

    await updateProductRatingStats(review.product);

    await logAdminAction({
      req,
      action: 'REVIEW_MODERATED',
      resource: 'Review',
      resourceId: review._id.toString(),
      details: { isApproved: review.isApproved },
    });

    res.status(200).json({
      success: true,
      message: `Review ${review.isApproved ? 'approved' : 'hidden'}`,
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Delete review
// @route   DELETE /api/v1/reviews/admin/:id
// @access  Private/Admin
export const deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    await updateProductRatingStats(review.product);

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
