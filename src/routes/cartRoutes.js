import express from 'express';
import { calculateCart } from '../controllers/cartController.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/calculate', optionalAuth, calculateCart);

export default router;
