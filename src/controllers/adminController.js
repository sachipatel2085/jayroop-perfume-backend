import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { VALID_SALE_FILTER } from '../services/reports/reportData.js';
import { logAdminAction } from '../utils/auditLogger.js';
import { round2, escapeRegex } from '../utils/helpers.js';

const IST_OFFSET = 5.5 * 3600 * 1000;
const istStartOfDay = (daysAgo = 0) => {
  const now = new Date(Date.now() + IST_OFFSET);
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo));
  return new Date(d.getTime() - IST_OFFSET);
};
const istStartOfMonth = () => {
  const now = new Date(Date.now() + IST_OFFSET);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - IST_OFFSET);
};

const revenueSince = async (from) => {
  const r = await Order.aggregate([
    { $match: { ...VALID_SALE_FILTER, createdAt: { $gte: from } } },
    { $group: { _id: null, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
  ]);
  return { revenue: round2(r[0]?.revenue || 0), orders: r[0]?.orders || 0 };
};

// @desc    Dashboard KPIs
// @route   GET /api/v1/admin/analytics
// @access  Private/Admin
export const getAdminAnalytics = async (req, res, next) => {
  try {
    const [
      totalOrders,
      lifetime,
      today,
      last7,
      month,
      totalCustomers,
      totalProducts,
      lowStockCount,
      pendingShipments,
      pendingPayments,
      refundRequests,
      recentOrders,
      series,
    ] = await Promise.all([
      Order.countDocuments(),
      revenueSince(new Date(0)),
      revenueSince(istStartOfDay(0)),
      revenueSince(istStartOfDay(6)),
      revenueSince(istStartOfMonth()),
      User.countDocuments({ role: 'CUSTOMER' }),
      Product.countDocuments({ status: 'ACTIVE' }),
      Product.countDocuments({ status: 'ACTIVE', $expr: { $lte: ['$stock', { $ifNull: ['$lowStockThreshold', 5] }] } }),
      Order.countDocuments({ orderStatus: { $in: ['PAID', 'PROCESSING'] } }),
      Order.countDocuments({ orderStatus: 'PENDING_PAYMENT', createdAt: { $gte: istStartOfDay(1) } }),
      Order.countDocuments({ orderStatus: 'REFUND_REQUESTED' }),
      Order.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(8),
      Order.aggregate([
        { $match: { ...VALID_SALE_FILTER, createdAt: { $gte: istStartOfDay(13) } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } },
            revenue: { $sum: '$total' },
            orders: { $sum: 1 },
          },
        },
      ]),
    ]);

    const map = new Map(series.map((s) => [s._id, s]));
    const last14 = [];
    for (let i = 13; i >= 0; i--) {
      const k = new Date(istStartOfDay(i).getTime() + IST_OFFSET).toISOString().slice(0, 10);
      last14.push({ date: k, revenue: round2(map.get(k)?.revenue || 0), orders: map.get(k)?.orders || 0 });
    }

    res.status(200).json({
      success: true,
      data: {
        totalRevenue: lifetime.revenue,
        paidOrders: lifetime.orders,
        totalOrders,
        today,
        last7Days: last7,
        thisMonth: month,
        averageOrderValue: lifetime.orders ? round2(lifetime.revenue / lifetime.orders) : 0,
        totalCustomers,
        totalProducts,
        lowStockCount,
        pendingShipments,
        pendingPayments,
        refundRequests,
        recentOrders,
        last14,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Inventory overview & low-stock alerts
// @route   GET /api/v1/admin/inventory
export const getInventoryOverview = async (req, res, next) => {
  try {
    const products = await Product.find({ status: { $ne: 'ARCHIVED' } })
      .select('name sku stock price salePrice variants status category lowStockThreshold images totalSold')
      .populate('category', 'name')
      .sort({ stock: 1 });
    res.status(200).json({ success: true, data: products });
  } catch (error) {
    next(error);
  }
};

// @desc    Update stock from inventory sheet (only stock numbers can be changed here)
// @route   PUT /api/v1/admin/inventory/:id   { stock, variants: [{ sku, stock }] }
export const updateInventoryStock = async (req, res, next) => {
  try {
    const { stock, variants } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const before = { stock: product.stock, variants: product.variants.map((v) => ({ sku: v.sku, stock: v.stock })) };

    if (stock !== undefined) product.stock = Math.max(0, Math.floor(Number(stock) || 0));
    if (Array.isArray(variants)) {
      variants.forEach((incoming) => {
        const v = product.variants.find((x) => x.sku === incoming.sku);
        if (v && incoming.stock !== undefined) v.stock = Math.max(0, Math.floor(Number(incoming.stock) || 0));
      });
      if (stock === undefined && product.variants.length) {
        product.stock = product.variants.reduce((s, v) => s + Number(v.stock || 0), 0);
      }
    }
    await product.save();

    await logAdminAction({
      req,
      action: 'INVENTORY_UPDATED',
      resource: 'Product',
      resourceId: String(product._id),
      details: { name: product.name, before, after: { stock: product.stock, variants: product.variants.map((v) => ({ sku: v.sku, stock: v.stock })) } },
    });

    res.status(200).json({ success: true, message: 'Inventory updated successfully', data: product });
  } catch (error) {
    next(error);
  }
};

// @desc    Audit logs
// @route   GET /api/v1/admin/audit-logs?page&limit&action&search
export const getAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 25, action, search } = req.query;
    const lim = Math.min(100, Math.max(1, Number(limit) || 25));
    const filter = {};
    if (action) filter.action = action;
    if (search) filter.$or = [{ adminEmail: { $regex: escapeRegex(search), $options: 'i' } }, { resourceId: { $regex: escapeRegex(search), $options: 'i' } }];
    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter).sort({ createdAt: -1 }).skip((Math.max(1, Number(page)) - 1) * lim).limit(lim),
    ]);
    res.status(200).json({ success: true, total, totalPages: Math.ceil(total / lim), data: logs });
  } catch (error) {
    next(error);
  }
};

// @desc    Customers list for admin
// @route   GET /api/v1/admin/customers?search&page
export const getCustomers = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 25 } = req.query;
    const lim = Math.min(100, Number(limit) || 25);
    const filter = { role: 'CUSTOMER' };
    if (search) {
      const rx = { $regex: escapeRegex(search), $options: 'i' };
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
    }
    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter).select('name email phone createdAt isActive lastLoginAt').sort({ createdAt: -1 }).skip((Math.max(1, Number(page)) - 1) * lim).limit(lim).lean(),
    ]);
    const stats = await Order.aggregate([
      { $match: { user: { $in: users.map((u) => u._id) }, ...VALID_SALE_FILTER } },
      { $group: { _id: '$user', orders: { $sum: 1 }, spent: { $sum: '$total' }, last: { $max: '$createdAt' } } },
    ]);
    const sMap = new Map(stats.map((s) => [String(s._id), s]));
    res.status(200).json({
      success: true,
      total,
      totalPages: Math.ceil(total / lim),
      data: users.map((u) => ({ ...u, orders: sMap.get(String(u._id))?.orders || 0, spent: round2(sMap.get(String(u._id))?.spent || 0), lastOrder: sMap.get(String(u._id))?.last || null })),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Activate / deactivate customer
// @route   PUT /api/v1/admin/customers/:id/status  { isActive }
export const setCustomerStatus = async (req, res, next) => {
  try {
    const user = await User.findOneAndUpdate({ _id: req.params.id, role: 'CUSTOMER' }, { isActive: Boolean(req.body.isActive) }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'Customer not found' });
    await logAdminAction({ req, action: 'CUSTOMER_STATUS', resource: 'User', resourceId: String(user._id), details: { isActive: user.isActive } });
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};
