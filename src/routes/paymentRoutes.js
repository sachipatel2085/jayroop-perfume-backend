import express from 'express';
import {
  createPaymentOrder,
  createCodOrder,
  verifyPayment,
  handleWebhook,
} from '../controllers/paymentController.js';
import { protect } from '../middleware/authMiddleware.js';
import { paymentLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/create-order', protect, paymentLimiter, createPaymentOrder);
router.post('/create-cod-order', protect, paymentLimiter, createCodOrder);
router.post('/verify', protect, paymentLimiter, verifyPayment);
router.post('/webhook', handleWebhook);

export default router;
