import express from 'express';
import {
  validateCoupon,
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from '../controllers/couponController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { couponLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/validate', couponLimiter, validateCoupon);

// Admin routes
router.use(protect, authorize('ADMIN', 'SUPER_ADMIN'));
router.route('/')
  .get(getCoupons)
  .post(createCoupon);

router.route('/:id')
  .put(updateCoupon)
  .delete(deleteCoupon);

export default router;
