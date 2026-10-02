import express from 'express';
import multer from 'multer';
import { uploadSingleMedia, uploadMultipleMedia } from '../controllers/uploadController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Configure Multer with Memory Storage (streaming buffer directly to Cloudinary)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Allow common image and video formats
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'video/mp4',
    'video/webm',
    'video/quicktime',
  ];

  if (allowedMimeTypes.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}. Please upload JPG, PNG, WebP, or MP4.`), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB max file size
  },
  fileFilter,
});

// Single media upload
router.post(
  '/',
  protect,
  authorize('ADMIN', 'SUPER_ADMIN'),
  upload.single('file'),
  uploadSingleMedia
);

// Multiple media uploads (up to 10 files)
router.post(
  '/multiple',
  protect,
  authorize('ADMIN', 'SUPER_ADMIN'),
  upload.array('files', 10),
  uploadMultipleMedia
);

export default router;
