import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { Coupon } from '../models/Coupon.js';
import { logAdminAction } from '../utils/auditLogger.js';

// Helper to generate unique luxury order number
const generateOrderNumber = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `JR-${timestamp}-${random}`;
};

// Helper for standard courier tracking links
const buildCourierTrackingUrl = (courier, trackingId) => {
  if (!trackingId) return null;
  const c = (courier || '').toLowerCase();
  if (c.includes('bluedart')) {
    return `https://www.bluedart.com/tracking?trackNumber=${trackingId}`;
  } else if (c.includes('delhivery')) {
    return `https://www.delhivery.com/track/package/${trackingId}`;
  } else if (c.includes('dtdc')) {
    return `https://www.dtdc.in/tracking/tracking_results.asp?trk_type=cn&strCnNo=${trackingId}`;
  } else if (c.includes('shiprocket')) {
    return `https://shiprocket.co/tracking/${trackingId}`;
  }
  return null;
};

// @desc    Get user's personal orders
// @route   GET /api/v1/orders/my-orders
// @access  Private
export const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get order details by orderNumber or ID (For confirmation & tracking page)
// @route   GET /api/v1/orders/:identifier
// @access  Public / Private (Public with orderNumber & phone verification if needed, or by ID)
export const getOrderByIdentifier = async (req, res, next) => {
  try {
    const { identifier } = req.params;
    let order;

    if (identifier.startsWith('JR-')) {
      order = await Order.findOne({ orderNumber: identifier });
    } else if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
      order = await Order.findById(identifier);
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found with the provided identifier',
      });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Get all orders with filter & pagination
// @route   GET /api/v1/orders
// @access  Private/Admin
export const getAllOrders = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 15 } = req.query;
    const filter = {};

    if (status) {
      filter.orderStatus = status;
    }

    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { trackingId: { $regex: search, $options: 'i' } },
        { 'shippingAddress.fullName': { $regex: search, $options: 'i' } },
        { 'shippingAddress.phone': { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Order.countDocuments(filter);

    const orders = await Order.find(filter)
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      count: orders.length,
      total,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      data: orders,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Update order status
// @route   PUT /api/v1/orders/:id/status
// @access  Private/Admin
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, note, paymentStatus } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const validStatuses = [
      'PENDING_PAYMENT',
      'PAID',
      'PROCESSING',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
      'REFUND_REQUESTED',
      'REFUNDED',
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid order status. Allowed: ${validStatuses.join(', ')}`,
      });
    }

    const oldStatus = order.orderStatus;
    order.orderStatus = status;

    if (paymentStatus && ['PENDING', 'PAID', 'FAILED', 'REFUNDED'].includes(paymentStatus)) {
      order.paymentStatus = paymentStatus;
    } else if (status === 'DELIVERED' && order.paymentMethod === 'COD') {
      // Auto-mark COD as PAID upon successful delivery
      order.paymentStatus = 'PAID';
    }

    if (status === 'DELIVERED') {
      order.deliveredAt = new Date();
    } else if (status === 'SHIPPED' && !order.shippedAt) {
      order.shippedAt = new Date();
    }

    order.statusHistory.push({
      status,
      timestamp: new Date(),
      note: note || `Order status updated from ${oldStatus} to ${status}`,
      updatedBy: req.user.email,
    });

    await order.save();

    await logAdminAction({
      req,
      action: 'ORDER_STATUS_UPDATED',
      resource: 'Order',
      resourceId: order._id.toString(),
      details: { orderNumber: order.orderNumber, from: oldStatus, to: status, note },
    });

    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Update Manual Tracking ID & Courier
// @route   PUT /api/v1/orders/:id/tracking
// @access  Private/Admin
export const updateOrderTracking = async (req, res, next) => {
  try {
    const { courier, trackingId, trackingUrl, note } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (!courier || !trackingId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both courier partner and tracking ID',
      });
    }

    order.courier = courier.trim();
    order.trackingId = trackingId.trim();
    order.trackingUrl =
      trackingUrl || buildCourierTrackingUrl(order.courier, order.trackingId);

    // If order was in PAID or PROCESSING, auto-promote to SHIPPED upon entering tracking details
    if (order.orderStatus === 'PAID' || order.orderStatus === 'PROCESSING') {
      order.orderStatus = 'SHIPPED';
      order.shippedAt = new Date();
    }

    order.statusHistory.push({
      status: order.orderStatus,
      timestamp: new Date(),
      note:
        note ||
        `Dispatched via ${order.courier}. Tracking ID: ${order.trackingId}`,
      updatedBy: req.user.email,
    });

    await order.save();

    await logAdminAction({
      req,
      action: 'TRACKING_ID_UPDATED',
      resource: 'Order',
      resourceId: order._id.toString(),
      details: {
        orderNumber: order.orderNumber,
        courier: order.courier,
        trackingId: order.trackingId,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Tracking details updated successfully',
      data: order,
    });
  } catch (error) {
    next(error);
  }
};
