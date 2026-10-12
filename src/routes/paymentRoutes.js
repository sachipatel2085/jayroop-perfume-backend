import express from 'express';
import {
  checkout,
  retryPayment,
  getPaymentStatus,
  phonePeWebhook,
  adminSyncPayment,
  adminRefund,
  adminSyncRefund,
  gatewayInfo,
} from '../controllers/paymentController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { paymentLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// PhonePe server-to-server webhook (signature verified inside the controller)
router.post('/phonepe/webhook', phonePeWebhook);

// Customer checkout
router.post('/checkout', protect, paymentLimiter, checkout());
router.post('/create-order', protect, paymentLimiter, checkout('ONLINE')); // backward compatible alias
router.post('/create-cod-order', protect, paymentLimiter, checkout('COD')); // backward compatible alias
router.get('/status/:orderNumber', protect, getPaymentStatus);
router.post('/:orderNumber/retry', protect, paymentLimiter, retryPayment);

// Admin
router.get('/admin/gateway', protect, authorize('ADMIN', 'SUPER_ADMIN'), gatewayInfo);
router.post('/admin/:id/sync', protect, authorize('ADMIN', 'SUPER_ADMIN'), adminSyncPayment);
router.post('/admin/:id/refund', protect, authorize('ADMIN', 'SUPER_ADMIN'), adminRefund);
router.post('/admin/:id/refunds/:refundId/sync', protect, authorize('ADMIN', 'SUPER_ADMIN'), adminSyncRefund);

export default router;
