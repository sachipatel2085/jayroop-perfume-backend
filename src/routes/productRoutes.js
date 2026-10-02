import express from 'express';
import {
  getProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/productController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(getProducts)
  .post(protect, authorize('ADMIN', 'SUPER_ADMIN'), createProduct);

router.route('/:slug')
  .get(getProductBySlug);

router.route('/:id')
  .put(protect, authorize('ADMIN', 'SUPER_ADMIN'), updateProduct)
  .delete(protect, authorize('ADMIN', 'SUPER_ADMIN'), deleteProduct);

export default router;
