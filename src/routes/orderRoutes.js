import express from 'express';
import {
  getMyOrders,
  getOrderByIdentifier,
  getAllOrders,
  updateOrderStatus,
  updateOrderTracking,
} from '../controllers/orderController.js';
import { protect, authorize, optionalAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/my-orders', protect, getMyOrders);
router.get('/:identifier', optionalAuth, getOrderByIdentifier); // Authenticated owner sees full PII; guest tracking redacts PII

// Admin routes
router.get('/', protect, authorize('ADMIN', 'SUPER_ADMIN'), getAllOrders);
router.put('/:id/status', protect, authorize('ADMIN', 'SUPER_ADMIN'), updateOrderStatus);
router.put('/:id/tracking', protect, authorize('ADMIN', 'SUPER_ADMIN'), updateOrderTracking);

export default router;
