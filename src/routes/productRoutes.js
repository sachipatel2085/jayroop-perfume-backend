import express from 'express';
import {
  getProducts,
  getProductBySlug,
  getAdminProducts,
  getAdminProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  deleteProductPermanently,
} from '../controllers/productController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { PRODUCT_TYPES, HSN_DESCRIPTIONS } from '../config/productTypes.js';

const router = express.Router();
const admin = [protect, authorize('ADMIN', 'SUPER_ADMIN')];

router.route('/').get(getProducts).post(...admin, createProduct);

// Product-type catalogue (single source of truth for the admin product & category forms)
router.get('/meta/types', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({ success: true, data: { types: PRODUCT_TYPES, hsn: HSN_DESCRIPTIONS } });
});

router.get('/admin/list', ...admin, getAdminProducts);
router.get('/admin/:id', ...admin, getAdminProduct);

router.route('/:slug').get(getProductBySlug);

router.delete('/:id/permanent', ...admin, deleteProductPermanently);

router
  .route('/:id')
  .put(...admin, updateProduct)
  .delete(...admin, deleteProduct);

export default router;
