import { AuditLog } from '../models/AuditLog.js';

export const logAdminAction = async ({
  req,
  action,
  resource,
  resourceId = '',
  details = {},
}) => {
  try {
    if (!req.user) return;
    await AuditLog.create({
      admin: req.user._id,
      adminEmail: req.user.email,
      action,
      resource,
      resourceId,
      details,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
    });
  } catch (err) {
    console.error(`[Audit Log Failed]: ${err.message}`);
  }
};
