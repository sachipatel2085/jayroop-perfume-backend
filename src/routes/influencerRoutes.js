import express from 'express';
import {
  getActiveInfluencerVideos,
  getAdminInfluencerVideos,
  createInfluencerVideo,
  updateInfluencerVideo,
  deleteInfluencerVideo,
} from '../controllers/influencerController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public storefront endpoint
router.get('/', getActiveInfluencerVideos);

// Admin endpoints
router.get('/admin', protect, authorize('ADMIN', 'SUPER_ADMIN'), getAdminInfluencerVideos);
router.post('/', protect, authorize('ADMIN', 'SUPER_ADMIN'), createInfluencerVideo);
router.put('/:id', protect, authorize('ADMIN', 'SUPER_ADMIN'), updateInfluencerVideo);
router.delete('/:id', protect, authorize('ADMIN', 'SUPER_ADMIN'), deleteInfluencerVideo);

export default router;
