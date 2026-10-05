import express from 'express';
import {
  createPaymentOrder,
  createCodOrder,
  verifyPayment,
  handleWebhook,
} from '../controllers/paymentController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/create-order', protect, createPaymentOrder);
router.post('/create-cod-order', protect, createCodOrder);
router.post('/verify', protect, verifyPayment);
router.post('/webhook', handleWebhook);

export default router;
