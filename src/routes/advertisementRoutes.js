import express from 'express';
import {
  getActiveAdvertisements,
  getAllAdvertisements,
  createAdvertisement,
  updateAdvertisement,
  deleteAdvertisement,
} from '../controllers/advertisementController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/active', getActiveAdvertisements);

// Admin routes
router.use(protect, authorize('ADMIN', 'SUPER_ADMIN'));
router.route('/')
  .get(getAllAdvertisements)
  .post(createAdvertisement);

router.route('/:id')
  .put(updateAdvertisement)
  .delete(deleteAdvertisement);

export default router;
