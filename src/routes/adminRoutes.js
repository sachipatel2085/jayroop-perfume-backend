import express from 'express';
import {
  getAdminAnalytics,
  getInventoryOverview,
  updateInventoryStock,
  getAuditLogs,
} from '../controllers/adminController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect, authorize('ADMIN', 'SUPER_ADMIN'));

router.get('/analytics', getAdminAnalytics);
router.get('/inventory', getInventoryOverview);
router.put('/inventory/:id', updateInventoryStock);
router.get('/audit-logs', getAuditLogs);

export default router;
