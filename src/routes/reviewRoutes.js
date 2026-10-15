import express from 'express';
import {
  getProductReviews,
  getMyReview,
  createReview,
  deleteMyReview,
  toggleHelpful,
  getAllReviewsAdmin,
  setReviewStatus,
  replyToReview,
  toggleFeatured,
  bulkReviews,
  deleteReview,
} from '../controllers/reviewController.js';
import { protect, authorize, optionalAuth } from '../middleware/authMiddleware.js';

const router = express.Router();
const admin = [protect, authorize('ADMIN', 'SUPER_ADMIN')];

// Storefront
router.get('/product/:productId', optionalAuth, getProductReviews);
router.get('/product/:productId/mine', protect, getMyReview);
router.post('/', protect, createReview);
router.delete('/mine/:id', protect, deleteMyReview);
router.post('/:id/helpful', protect, toggleHelpful);

// Admin moderation
router.get('/admin', ...admin, getAllReviewsAdmin);
router.post('/admin/bulk', ...admin, bulkReviews);
router.put('/admin/:id/status', ...admin, setReviewStatus);
router.put('/admin/:id/reply', ...admin, replyToReview);
router.put('/admin/:id/feature', ...admin, toggleFeatured);
router.delete('/admin/:id', ...admin, deleteReview);

export default router;
