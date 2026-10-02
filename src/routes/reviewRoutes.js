import express from 'express';
import {
  getProductReviews,
  createReview,
  getAllReviewsAdmin,
  toggleReviewApproval,
  deleteReview,
} from '../controllers/reviewController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/product/:productId', getProductReviews);
router.post('/', protect, createReview);

// Admin routes
router.get('/admin', protect, authorize('ADMIN', 'SUPER_ADMIN'), getAllReviewsAdmin);
router.put('/admin/:id/status', protect, authorize('ADMIN', 'SUPER_ADMIN'), toggleReviewApproval);
router.delete('/admin/:id', protect, authorize('ADMIN', 'SUPER_ADMIN'), deleteReview);

export default router;
