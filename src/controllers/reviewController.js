import mongoose from 'mongoose';
import { Review, APPROVED_FILTER } from '../models/Review.js';
import { Product } from '../models/Product.js';
import { Order } from '../models/Order.js';
import { Setting } from '../models/Setting.js';
import { logAdminAction } from '../utils/auditLogger.js';
import { escapeRegex } from '../utils/helpers.js';

const isId = (v) => mongoose.isValidObjectId(v);
const clean = (v, max) =>
  String(v || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+\n/g, '\n')
    .trim()
    .slice(0, max);

/** "Asha Patel" → "Asha P." – first name + initial, so customers' full names are never published. */
export const publicName = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Jayrup customer';
  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  return parts.length === 1 ? first : `${first} ${parts[parts.length - 1][0].toUpperCase()}.`;
};

// Product rating = approved reviews only
export const updateProductRatingStats = async (productId) => {
  const [stats] = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(String(productId)), ...APPROVED_FILTER } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Product.findByIdAndUpdate(productId, {
    averageRating: stats ? Math.round(stats.avg * 10) / 10 : 0,
    numReviews: stats?.count || 0,
  });
};

const purchasedOrder = (userId, productId) =>
  Order.findOne({
    user: userId,
    'items.product': productId,
    orderStatus: { $in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
  })
    .sort({ createdAt: -1 })
    .select('_id orderStatus shippingAddress.city')
    .lean();

const toPublic = (r, userId = null) => ({
  _id: r._id,
  rating: r.rating,
  title: r.title,
  comment: r.comment,
  reviewerName: r.reviewerName || publicName(r.user?.name),
  reviewerCity: r.reviewerCity || '',
  verifiedPurchase: r.verifiedPurchase,
  featured: Boolean(r.featured),
  helpfulCount: r.helpfulCount || 0,
  votedHelpful: userId ? (r.helpfulVoters || []).some((v) => String(v) === String(userId)) : false,
  reply: r.reply?.text ? { text: r.reply.text, by: r.reply.by || 'Team Jayrup', at: r.reply.at } : null,
  edited: Boolean(r.edited),
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  // kept for older components
  user: { name: r.reviewerName || publicName(r.user?.name) },
});

// @desc    Approved reviews for a product + rating summary
// @route   GET /api/v1/reviews/product/:productId?sort=recent|helpful|highest|lowest&rating=1-5&verified=1&page=1&limit=10
// @access  Public
export const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;
    if (!isId(productId)) return res.status(400).json({ success: false, message: 'Invalid product' });
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const filter = { product: productId, ...APPROVED_FILTER };
    const rating = parseInt(req.query.rating, 10);
    if (rating >= 1 && rating <= 5) filter.rating = rating;
    if (req.query.verified === '1') filter.verifiedPurchase = true;

    const sort = {
      helpful: { featured: -1, helpfulCount: -1, createdAt: -1 },
      highest: { rating: -1, createdAt: -1 },
      lowest: { rating: 1, createdAt: -1 },
    }[req.query.sort] || { featured: -1, createdAt: -1 };

    const [rows, total, dist] = await Promise.all([
      Review.find(filter).select('+helpfulVoters').populate('user', 'name').sort(sort).skip((page - 1) * limit).limit(limit).lean(),
      Review.countDocuments(filter),
      Review.aggregate([
        { $match: { product: new mongoose.Types.ObjectId(productId), ...APPROVED_FILTER } },
        { $group: { _id: '$rating', n: { $sum: 1 }, verified: { $sum: { $cond: ['$verifiedPurchase', 1, 0] } } } },
      ]),
    ]);
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    let count = 0;
    let verified = 0;
    dist.forEach((d) => {
      distribution[d._id] = d.n;
      sum += d._id * d.n;
      count += d.n;
      verified += d.verified;
    });

    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows.map((r) => toPublic(r, req.user?._id)),
      summary: { average: count ? Math.round((sum / count) * 10) / 10 : 0, count, verified, distribution },
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    The signed-in customer's own review of a product (any status) + whether they may review
// @route   GET /api/v1/reviews/product/:productId/mine
// @access  Private
export const getMyReview = async (req, res, next) => {
  try {
    const { productId } = req.params;
    if (!isId(productId)) return res.status(400).json({ success: false, message: 'Invalid product' });
    const [review, order, settings] = await Promise.all([
      Review.findOne({ product: productId, user: req.user._id }).lean(),
      purchasedOrder(req.user._id, productId),
      Setting.getStoreSettings(),
    ]);
    const buyersOnly = Boolean(settings.reviews?.buyersOnly);
    res.status(200).json({
      success: true,
      data: {
        review: review
          ? {
              _id: review._id,
              rating: review.rating,
              title: review.title,
              comment: review.comment,
              status: review.status || (review.isApproved ? 'APPROVED' : 'PENDING'),
              rejectionReason: review.rejectionReason || '',
              updatedAt: review.updatedAt,
            }
          : null,
        verifiedBuyer: Boolean(order),
        canReview: settings.reviews?.enabled !== false && (!buyersOnly || Boolean(order)),
        buyersOnly,
        minLength: settings.reviews?.minLength ?? 20,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create or update the customer's review of a product
// @route   POST /api/v1/reviews   { productId, rating, title, comment }
// @access  Private
export const createReview = async (req, res, next) => {
  try {
    const { productId } = req.body;
    const settings = await Setting.getStoreSettings();
    const cfg = settings.reviews || {};
    if (cfg.enabled === false) return res.status(403).json({ success: false, message: 'Reviews are closed at the moment.' });
    if (!isId(productId)) return res.status(400).json({ success: false, message: 'Invalid product' });

    const rating = Math.round(Number(req.body.rating));
    const title = clean(req.body.title, 120);
    const comment = clean(req.body.comment, 3000);
    const minLength = cfg.minLength ?? 20;
    if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ success: false, message: 'Please choose a rating from 1 to 5 stars.' });
    if (comment.length < minLength) {
      return res.status(400).json({ success: false, message: `Please write at least ${minLength} characters about your experience.` });
    }
    if (/(https?:\/\/|www\.)/i.test(`${title} ${comment}`)) {
      return res.status(400).json({ success: false, message: 'Links are not allowed in reviews.' });
    }

    const product = await Product.findById(productId).select('_id status');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const order = await purchasedOrder(req.user._id, productId);
    const verifiedPurchase = Boolean(order);
    if (cfg.buyersOnly && !verifiedPurchase) {
      return res.status(403).json({ success: false, message: 'Only customers who bought this product can review it.' });
    }
    const autoApprove = verifiedPurchase && cfg.autoApproveVerified !== false;
    const status = autoApprove ? 'APPROVED' : 'PENDING';

    let review = await Review.findOne({ product: productId, user: req.user._id });
    const isUpdate = Boolean(review);
    if (!review) review = new Review({ product: productId, user: req.user._id });
    review.set({
      order: order?._id || review.order || null,
      rating,
      title,
      comment,
      verifiedPurchase,
      status,
      rejectionReason: '',
      reviewerName: publicName(req.user.name),
      reviewerCity: order?.shippingAddress?.city ? String(order.shippingAddress.city).slice(0, 40) : review.reviewerCity || '',
      edited: isUpdate,
    });
    await review.save();
    await updateProductRatingStats(productId);

    res.status(isUpdate ? 200 : 201).json({
      success: true,
      message:
        status === 'APPROVED'
          ? isUpdate
            ? 'Your review has been updated.'
            : 'Thank you! Your review is now live.'
          : 'Thank you! Your review will appear after a quick check by our team.',
      data: { _id: review._id, status },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Customer deletes their own review
// @route   DELETE /api/v1/reviews/mine/:id
// @access  Private
export const deleteMyReview = async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid review' });
    const review = await Review.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    await updateProductRatingStats(review.product);
    res.status(200).json({ success: true, message: 'Your review was removed.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark a review helpful (toggle, one vote per customer)
// @route   POST /api/v1/reviews/:id/helpful
// @access  Private
export const toggleHelpful = async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid review' });
    const review = await Review.findOne({ _id: req.params.id, ...APPROVED_FILTER }).select('+helpfulVoters');
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    if (String(review.user) === String(req.user._id)) return res.status(400).json({ success: false, message: 'You can’t vote on your own review.' });
    const voted = review.helpfulVoters.some((v) => String(v) === String(req.user._id));
    if (voted) review.helpfulVoters.pull(req.user._id);
    else review.helpfulVoters.push(req.user._id);
    review.helpfulCount = review.helpfulVoters.length;
    await review.save();
    res.status(200).json({ success: true, data: { helpfulCount: review.helpfulCount, votedHelpful: !voted } });
  } catch (error) {
    next(error);
  }
};

// ───────────────────────────── Admin ─────────────────────────────

// @desc    Admin: reviews with filters + counts per status
// @route   GET /api/v1/reviews/admin?status=PENDING|APPROVED|REJECTED&rating=&product=&verified=&search=&page=&limit=
// @access  Private/Admin
export const getAllReviewsAdmin = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const filter = {};
    const status = String(req.query.status || '').toUpperCase();
    if (status === 'APPROVED') Object.assign(filter, APPROVED_FILTER);
    else if (status === 'PENDING') filter.$or = [{ status: 'PENDING' }, { status: { $exists: false }, isApproved: false }];
    else if (status === 'REJECTED') filter.status = 'REJECTED';
    const rating = parseInt(req.query.rating, 10);
    if (rating >= 1 && rating <= 5) filter.rating = rating;
    if (isId(req.query.product)) filter.product = req.query.product;
    if (req.query.verified === '1') filter.verifiedPurchase = true;
    if (req.query.search) {
      const rx = new RegExp(escapeRegex(String(req.query.search).slice(0, 80)), 'i');
      filter.$and = [{ $or: [{ title: rx }, { comment: rx }, { reviewerName: rx }] }];
    }

    const [rows, total, counts] = await Promise.all([
      Review.find(filter)
        .populate('product', 'name slug images')
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Review.countDocuments(filter),
      Review.aggregate([{ $group: { _id: { $ifNull: ['$status', { $cond: ['$isApproved', 'APPROVED', 'PENDING'] }] }, n: { $sum: 1 } } }]),
    ]);
    const statusCounts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
    counts.forEach((c) => {
      statusCounts[c._id] = c.n;
    });

    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows.map((r) => ({ ...r, status: r.status || (r.isApproved ? 'APPROVED' : 'PENDING'), displayName: r.reviewerName || publicName(r.user?.name) })),
      statusCounts,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    next(error);
  }
};

const applyStatus = async (req, review, status, reason = '') => {
  review.status = status;
  review.rejectionReason = status === 'REJECTED' ? clean(reason, 300) : '';
  review.moderatedBy = req.user._id;
  review.moderatedAt = new Date();
  await review.save();
};

// @desc    Admin: approve / reject / send back to pending
// @route   PUT /api/v1/reviews/admin/:id/status   { status: APPROVED|REJECTED|PENDING, reason? }
//          (no body = toggle approved ↔ hidden, for older admin screens)
// @access  Private/Admin
export const setReviewStatus = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    const current = review.status || (review.isApproved ? 'APPROVED' : 'PENDING');
    let status = String(req.body?.status || '').toUpperCase();
    if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) status = current === 'APPROVED' ? 'REJECTED' : 'APPROVED';
    await applyStatus(req, review, status, req.body?.reason);
    await updateProductRatingStats(review.product);
    await logAdminAction({ req, action: 'REVIEW_MODERATED', resource: 'Review', resourceId: String(review._id), details: { from: current, to: status, reason: review.rejectionReason } });
    res.status(200).json({ success: true, message: `Review ${status.toLowerCase()}`, data: review });
  } catch (error) {
    next(error);
  }
};
export const toggleReviewApproval = setReviewStatus;

// @desc    Admin: public reply from the brand (empty text removes it)
// @route   PUT /api/v1/reviews/admin/:id/reply   { text }
// @access  Private/Admin
export const replyToReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    const text = clean(req.body?.text, 1500);
    review.reply = text ? { text, by: 'Team Jayrup', at: new Date() } : { text: '', by: '', at: null };
    await review.save();
    await logAdminAction({ req, action: 'REVIEW_MODERATED', resource: 'Review', resourceId: String(review._id), details: { reply: Boolean(text) } });
    res.status(200).json({ success: true, message: text ? 'Reply published' : 'Reply removed', data: review });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: pin / unpin a review at the top of the product page
// @route   PUT /api/v1/reviews/admin/:id/feature
// @access  Private/Admin
export const toggleFeatured = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    review.featured = !review.featured;
    await review.save();
    res.status(200).json({ success: true, message: review.featured ? 'Pinned to the top' : 'Unpinned', data: review });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: bulk approve / reject / delete
// @route   POST /api/v1/reviews/admin/bulk   { ids[], action: approve|reject|delete, reason? }
// @access  Private/Admin
export const bulkReviews = async (req, res, next) => {
  try {
    const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).filter(isId).slice(0, 500);
    const action = String(req.body?.action || '');
    if (!ids.length || !['approve', 'reject', 'delete'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Choose reviews and an action.' });
    }
    const reviews = await Review.find({ _id: { $in: ids } });
    const products = new Set(reviews.map((r) => String(r.product)));
    if (action === 'delete') await Review.deleteMany({ _id: { $in: ids } });
    else for (const r of reviews) await applyStatus(req, r, action === 'approve' ? 'APPROVED' : 'REJECTED', req.body?.reason);
    for (const p of products) await updateProductRatingStats(p);
    await logAdminAction({ req, action: action === 'delete' ? 'REVIEW_DELETED' : 'REVIEW_MODERATED', resource: 'Review', resourceId: 'bulk', details: { action, count: reviews.length } });
    res.status(200).json({ success: true, message: `${reviews.length} review(s) ${action === 'delete' ? 'deleted' : `${action}d`}` });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: delete review permanently
// @route   DELETE /api/v1/reviews/admin/:id
// @access  Private/Admin
export const deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    await updateProductRatingStats(review.product);
    await logAdminAction({ req, action: 'REVIEW_DELETED', resource: 'Review', resourceId: String(review._id), details: { rating: review.rating } });
    res.status(200).json({ success: true, message: 'Review deleted' });
  } catch (error) {
    next(error);
  }
};
