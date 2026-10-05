import express from 'express';
import {
  getPublicSettings,
  getAdminSettings,
  updateSettings,
} from '../controllers/settingController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public store configuration for customers at checkout
router.get('/public', getPublicSettings);

// Admin configuration management
router
  .route('/')
  .get(protect, authorize('ADMIN', 'SUPER_ADMIN'), getAdminSettings)
  .put(protect, authorize('ADMIN', 'SUPER_ADMIN'), updateSettings);

export default router;
