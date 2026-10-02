import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';

// @desc    Get dashboard analytics metrics
// @route   GET /api/v1/admin/analytics
// @access  Private/Admin
export const getAdminAnalytics = async (req, res, next) => {
  try {
    const totalOrders = await Order.countDocuments();
    const paidOrders = await Order.countDocuments({
      paymentStatus: 'PAID',
    });

    const revenueResult = await Order.aggregate([
      { $match: { paymentStatus: 'PAID' } },
      { $group: { _id: null, totalRevenue: { $sum: '$total' } } },
    ]);
    const totalRevenue = revenueResult[0]?.totalRevenue || 0;

    const totalCustomers = await User.countDocuments({ role: 'CUSTOMER' });
    const totalProducts = await Product.countDocuments({ status: 'ACTIVE' });
    const lowStockCount = await Product.countDocuments({
      status: 'ACTIVE',
      stock: { $lte: 5 },
    });

    const pendingShipments = await Order.countDocuments({
      orderStatus: { $in: ['PAID', 'PROCESSING'] },
    });

    // Recent 5 orders
    const recentOrders = await Order.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(6);

    res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        totalOrders,
        paidOrders,
        totalCustomers,
        totalProducts,
        lowStockCount,
        pendingShipments,
        recentOrders,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get inventory status & low-stock alerts
// @route   GET /api/v1/admin/inventory
// @access  Private/Admin
export const getInventoryOverview = async (req, res, next) => {
  try {
    const products = await Product.find({ status: { $ne: 'ARCHIVED' } })
      .select('name sku stock price variants status category')
      .populate('category', 'name')
      .sort({ stock: 1 });

    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product stock directly from inventory sheet
// @route   PUT /api/v1/admin/inventory/:id
// @access  Private/Admin
export const updateInventoryStock = async (req, res, next) => {
  try {
    const { stock, variants } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (stock !== undefined) {
      product.stock = Number(stock);
    }

    if (variants && Array.isArray(variants)) {
      product.variants = variants;
    }

    await product.save();

    res.status(200).json({
      success: true,
      message: 'Inventory updated successfully',
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get audit logs
// @route   GET /api/v1/admin/audit-logs
// @access  Private/Admin
export const getAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 25 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const total = await AuditLog.countDocuments();

    const logs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      total,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
};
