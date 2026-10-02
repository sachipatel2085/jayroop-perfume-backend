import express from 'express';
import { calculateCart } from '../controllers/cartController.js';

const router = express.Router();

router.post('/calculate', calculateCart);

export default router;
