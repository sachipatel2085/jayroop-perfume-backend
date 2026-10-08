import express from 'express';
import {
  submitContactInquiry,
  getContactInquiries,
  updateInquiryStatus,
} from '../controllers/contactController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', submitContactInquiry);
router.get('/', protect, authorize('ADMIN', 'SUPER_ADMIN'), getContactInquiries);
router.patch('/:id', protect, authorize('ADMIN', 'SUPER_ADMIN'), updateInquiryStatus);

export default router;
