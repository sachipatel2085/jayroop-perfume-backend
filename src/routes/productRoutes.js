import express from 'express';
import {
  getProducts,
  getProductBySlug,
  getAdminProducts,
  getAdminProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/productController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();
const admin = [protect, authorize('ADMIN', 'SUPER_ADMIN')];

router.route('/').get(getProducts).post(...admin, createProduct);

router.get('/admin/list', ...admin, getAdminProducts);
router.get('/admin/:id', ...admin, getAdminProduct);

router.route('/:slug').get(getProductBySlug);

router
  .route('/:id')
  .put(...admin, updateProduct)
  .delete(...admin, deleteProduct);

export default router;
