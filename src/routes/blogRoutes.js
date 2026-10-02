import express from 'express';
import {
  getBlogs,
  getBlogBySlug,
  createBlog,
  updateBlog,
  deleteBlog,
} from '../controllers/blogController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', getBlogs);
router.get('/:slug', getBlogBySlug);

// Admin routes
router.post('/', protect, authorize('ADMIN', 'SUPER_ADMIN'), createBlog);
router.put('/:id', protect, authorize('ADMIN', 'SUPER_ADMIN'), updateBlog);
router.delete('/:id', protect, authorize('ADMIN', 'SUPER_ADMIN'), deleteBlog);

export default router;
