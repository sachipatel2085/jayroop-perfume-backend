import express from 'express';
import {
  getCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(getCategories)
  .post(protect, authorize('ADMIN', 'SUPER_ADMIN'), createCategory);

router.route('/:slug')
  .get(getCategoryBySlug);

router.route('/:id')
  .put(protect, authorize('ADMIN', 'SUPER_ADMIN'), updateCategory)
  .delete(protect, authorize('ADMIN', 'SUPER_ADMIN'), deleteCategory);

export default router;
