import express from 'express';
import {
  getMyOrders,
  getMyOrder,
  cancelMyOrder,
  requestReturn,
  updateReturnRequest,
  getOrderByIdentifier,
  getAllOrders,
  getAdminOrder,
  updateOrderStatus,
  updateOrderTracking,
  updateAdminNote,
  downloadInvoice,
  generateInvoice,
  downloadShippingLabel,
  taxPreview,
} from '../controllers/orderController.js';
import { protect, authorize, optionalAuth } from '../middleware/authMiddleware.js';
import { trackingLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
const admin = [protect, authorize('ADMIN', 'SUPER_ADMIN')];

// Customer account
router.get('/my-orders', protect, getMyOrders);
router.get('/my-orders/:orderNumber', protect, getMyOrder);
router.post('/my-orders/:orderNumber/cancel', protect, cancelMyOrder);
router.post('/my-orders/:orderNumber/return-request', protect, requestReturn);

// Admin
router.get('/', ...admin, getAllOrders);
router.get('/admin/:id', ...admin, getAdminOrder);
router.put('/:id/status', ...admin, updateOrderStatus);
router.put('/:id/tracking', ...admin, updateOrderTracking);
router.put('/:id/note', ...admin, updateAdminNote);
router.put('/:id/return-request', ...admin, updateReturnRequest);
router.post('/:id/invoice', ...admin, generateInvoice);
router.get('/:id/label', ...admin, downloadShippingLabel);
router.get('/:id/tax-preview', ...admin, taxPreview);

// Invoice PDF (owner or admin)
router.get('/:id/invoice', protect, downloadInvoice);

// Public tracking (guests must verify with phone number)
router.get('/:identifier', trackingLimiter, optionalAuth, getOrderByIdentifier);

export default router;
