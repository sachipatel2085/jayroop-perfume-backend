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
  bulkPrint,
  getPrintOptions,
  taxPreview,
} from '../controllers/orderController.js';
import { bulkUpdateOrders, selectOrders, getQueues, lookupOrders, bulkDispatch } from '../controllers/orderBulkController.js';
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
router.get('/print/options', ...admin, getPrintOptions);
router.post('/print', ...admin, bulkPrint);
// Bulk order tools (status, ship, deliver, COD, invoices, returns, notes, courier sheet)
router.post('/bulk', ...admin, bulkUpdateOrders);
router.get('/bulk/select', ...admin, selectOrders);
router.get('/bulk/queues', ...admin, getQueues);
router.post('/bulk/lookup', ...admin, lookupOrders);
router.post('/bulk/dispatch', ...admin, bulkDispatch);
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
