import express from 'express';
import {
  getAdminAnalytics,
  getInventoryOverview,
  updateInventoryStock,
  getAuditLogs,
  getCustomers,
  setCustomerStatus,
} from '../controllers/adminController.js';
import { getReportTypes, getReportOverview, previewReport, exportReport } from '../controllers/reportController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect, authorize('ADMIN', 'SUPER_ADMIN'));

router.get('/analytics', getAdminAnalytics);
router.get('/inventory', getInventoryOverview);
router.put('/inventory/:id', updateInventoryStock);
router.get('/audit-logs', getAuditLogs);
router.get('/customers', getCustomers);
router.put('/customers/:id/status', setCustomerStatus);

// Reports & exports (Excel / PDF / GST)
router.get('/reports/types', getReportTypes);
router.get('/reports/overview', getReportOverview);
router.get('/reports/:type/export', exportReport);
router.get('/reports/:type', previewReport);

export default router;
