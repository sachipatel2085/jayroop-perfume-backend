import { Order, ORDER_STATUSES } from '../models/Order.js';
import { Setting } from '../models/Setting.js';
import { logAdminAction } from '../utils/auditLogger.js';
import { escapeRegex, maskName, maskPhone, parseDateRange } from '../utils/helpers.js';
import { cancelOrder } from '../services/orderLifecycle.js';
import { issueInvoice, previewInvoice } from '../services/invoiceService.js';
import { renderInvoicePdf } from '../services/pdf/invoicePdf.js';
import { renderShippingLabelPdf } from '../services/pdf/labelPdf.js';
import { sendShippedMail, sendDeliveredMail } from '../services/mailer.js';
import { httpError } from '../services/pricingService.js';

// Courier tracking deep links
const buildCourierTrackingUrl = (courier, trackingId) => {
  if (!trackingId) return null;
  const c = (courier || '').toLowerCase();
  const id = encodeURIComponent(trackingId);
  if (c.includes('bluedart')) return `https://www.bluedart.com/tracking?trackNumber=${id}`;
  if (c.includes('delhivery')) return `https://www.delhivery.com/track/package/${id}`;
  if (c.includes('dtdc')) return `https://www.dtdc.in/tracking/tracking_results.asp?trk_type=cn&strCnNo=${id}`;
  if (c.includes('shiprocket')) return `https://shiprocket.co/tracking/${id}`;
  if (c.includes('xpressbees')) return `https://www.xpressbees.com/shipment/tracking?awbNo=${id}`;
  if (c.includes('ekart')) return `https://ekartlogistics.com/shipmenttrack/${id}`;
  if (c.includes('ecom')) return `https://ecomexpress.in/tracking/?awb_field=${id}`;
  if (c.includes('india post') || c.includes('speed post')) return 'https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx';
  return null;
};

const isAdminUser = (user) => user && ['ADMIN', 'SUPER_ADMIN'].includes(user.role);

const sanitizeForCustomer = (order) => {
  const o = order.toObject ? order.toObject() : { ...order };
  delete o.adminNote;
  delete o.inventoryCommitted;
  delete o.couponCounted;
  if (o.paymentInfo) {
    delete o.paymentInfo.razorpaySignature;
    delete o.paymentInfo.attemptIds;
  }
  o.statusHistory = (o.statusHistory || []).map((h) => ({
    ...h,
    updatedBy: String(h.updatedBy || '').includes('@') ? 'Jayrup Team' : h.updatedBy,
  }));
  o.hasInvoice = Boolean(o.invoice?.number);
  o.invoice = o.invoice?.number ? { number: o.invoice.number, date: o.invoice.date, status: o.invoice.status, creditNote: o.invoice.creditNote } : null;
  o.canCancel = ['PENDING_PAYMENT', 'PAID', 'PROCESSING'].includes(o.orderStatus);
  o.canRetryPayment = o.paymentMethod === 'ONLINE' && o.orderStatus === 'PENDING_PAYMENT' && o.paymentStatus !== 'PAID';
  return o;
};

// @desc    Customer: my orders (paginated, filterable)
// @route   GET /api/v1/orders/my-orders?status=&page=&limit=
// @access  Private
export const getMyOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { user: req.user._id };
    if (status === 'active') filter.orderStatus = { $in: ['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED'] };
    else if (status === 'completed') filter.orderStatus = 'DELIVERED';
    else if (status === 'cancelled') filter.orderStatus = { $in: ['CANCELLED', 'REFUND_REQUESTED', 'REFUNDED'] };

    const lim = Math.min(50, Math.max(1, Number(limit) || 20));
    const skip = (Math.max(1, Number(page) || 1) - 1) * lim;
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim),
      Order.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      count: orders.length,
      total,
      totalPages: Math.ceil(total / lim),
      data: orders.map(sanitizeForCustomer),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Customer: one of my orders (full detail)
// @route   GET /api/v1/orders/my-orders/:orderNumber
// @access  Private
export const getMyOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber, user: req.user._id });
    if (!order) throw httpError(404, 'Order not found');
    res.status(200).json({ success: true, data: sanitizeForCustomer(order) });
  } catch (error) {
    next(error);
  }
};

// @desc    Order lookup for confirmation & tracking pages
//          Owner/Admin → full detail. Guests → must also send ?phone= (last 10 digits) and get masked PII.
// @route   GET /api/v1/orders/:identifier
// @access  Public / Private
export const getOrderByIdentifier = async (req, res, next) => {
  try {
    const { identifier } = req.params;
    let order = null;
    if (/^JR-[\w-]+$/i.test(identifier)) order = await Order.findOne({ orderNumber: identifier.toUpperCase() });
    else if (/^[0-9a-fA-F]{24}$/.test(identifier)) order = await Order.findById(identifier);

    if (!order) throw httpError(404, 'Order not found. Please check the order number.');

    const isOwner = req.user && String(order.user) === String(req.user._id);
    if (isOwner || isAdminUser(req.user)) {
      return res.status(200).json({ success: true, data: isAdminUser(req.user) ? order : sanitizeForCustomer(order) });
    }

    if (!identifier.toUpperCase().startsWith('JR-')) throw httpError(403, 'Access denied');

    const phone = String(req.query.phone || '').replace(/\D/g, '').slice(-10);
    const orderPhone = String(order.shippingAddress?.phone || '').replace(/\D/g, '').slice(-10);
    if (!phone || phone !== orderPhone) {
      return res.status(401).json({
        success: false,
        requiresVerification: true,
        message: 'Enter the mobile number used for this order to view tracking.',
      });
    }

    const o = order.toObject();
    res.status(200).json({
      success: true,
      data: {
        orderNumber: o.orderNumber,
        createdAt: o.createdAt,
        orderStatus: o.orderStatus,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        total: o.total,
        items: o.items.map((i) => ({ name: i.name, image: i.image, quantity: i.quantity, variant: { title: i.variant?.title }, price: i.price, slug: i.slug })),
        courier: o.courier,
        trackingId: o.trackingId,
        trackingUrl: o.trackingUrl,
        shippedAt: o.shippedAt,
        deliveredAt: o.deliveredAt,
        statusHistory: o.statusHistory.map((h) => ({ status: h.status, timestamp: h.timestamp, note: h.updatedBy === 'CUSTOMER' || h.updatedBy.includes('@') ? '' : h.note })),
        shippingAddress: {
          fullName: maskName(o.shippingAddress?.fullName),
          phone: maskPhone(o.shippingAddress?.phone),
          city: o.shippingAddress?.city,
          state: o.shippingAddress?.state,
          postalCode: o.shippingAddress?.postalCode,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Customer: cancel my order (before dispatch). Online payments are refunded automatically.
// @route   POST /api/v1/orders/my-orders/:orderNumber/cancel  { reason }
// @access  Private
export const cancelMyOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber, user: req.user._id });
    if (!order) throw httpError(404, 'Order not found');
    if (!['PENDING_PAYMENT', 'PAID', 'PROCESSING'].includes(order.orderStatus)) {
      throw httpError(400, 'This order can no longer be cancelled online. Please contact care@jayrup.in.');
    }
    const updated = await cancelOrder(order, {
      reason: `Cancelled by customer${req.body.reason ? `: ${String(req.body.reason).slice(0, 200)}` : ''}`,
      by: 'CUSTOMER',
    });
    res.status(200).json({ success: true, message: 'Your order has been cancelled.', data: sanitizeForCustomer(updated) });
  } catch (error) {
    next(error);
  }
};

const sendPdf = (res, buffer, filename, inline) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${filename}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.end(buffer);
};

// @desc    Download GST invoice PDF (owner or admin)
// @route   GET /api/v1/orders/:id/invoice?inline=1&copy=original|duplicate|triplicate
// @access  Private
export const downloadInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = /^[0-9a-fA-F]{24}$/.test(id) ? await Order.findById(id) : await Order.findOne({ orderNumber: id });
    if (!order) throw httpError(404, 'Order not found');
    const admin = isAdminUser(req.user);
    if (!admin && String(order.user) !== String(req.user._id)) throw httpError(403, 'Access denied');

    if (!order.invoice?.number) {
      if (!admin) {
        throw httpError(
          400,
          order.paymentMethod === 'COD'
            ? 'Your invoice will be available once the order is dispatched.'
            : 'Invoice is generated after successful payment.'
        );
      }
      if (order.orderStatus === 'PENDING_PAYMENT' || order.orderStatus === 'CANCELLED') {
        throw httpError(400, 'Cannot invoice an unpaid or cancelled order.');
      }
      await issueInvoice(order);
      await order.save();
    }

    const settings = await Setting.getStoreSettings();
    const copy = { duplicate: 'DUPLICATE FOR TRANSPORTER', triplicate: 'TRIPLICATE FOR SUPPLIER' }[req.query.copy] || 'ORIGINAL FOR RECIPIENT';
    const pdf = await renderInvoicePdf(order, { copyLabel: copy, settings });
    sendPdf(res, pdf, `Invoice-${order.invoice.number.replace(/\//g, '-')}.pdf`, req.query.inline === '1');
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: shipping label (4x6) PDF
// @route   GET /api/v1/orders/:id/label
// @access  Private/Admin
export const downloadShippingLabel = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) throw httpError(404, 'Order not found');
    const settings = await Setting.getStoreSettings();
    const pdf = await renderShippingLabelPdf(order, { settings });
    sendPdf(res, pdf, `Label-${order.orderNumber}.pdf`, req.query.inline !== '0');
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: issue invoice now (e.g. COD order before dispatch)
// @route   POST /api/v1/orders/:id/invoice
// @access  Private/Admin
export const generateInvoice = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) throw httpError(404, 'Order not found');
    if (order.invoice?.number) return res.status(200).json({ success: true, message: 'Invoice already issued', data: order });
    if (['PENDING_PAYMENT', 'CANCELLED'].includes(order.orderStatus)) throw httpError(400, 'Cannot invoice an unpaid or cancelled order.');
    await issueInvoice(order);
    await order.save();
    await logAdminAction({ req, action: 'INVOICE_ISSUED', resource: 'Order', resourceId: String(order._id), details: { orderNumber: order.orderNumber, invoice: order.invoice.number } });
    res.status(200).json({ success: true, message: `Invoice ${order.invoice.number} issued`, data: order });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: tax preview for an order without invoice
// @route   GET /api/v1/orders/:id/tax-preview
export const taxPreview = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) throw httpError(404, 'Order not found');
    res.status(200).json({ success: true, data: order.invoice?.number ? order.invoice : await previewInvoice(order) });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: list orders with filters & pagination
// @route   GET /api/v1/orders?status=&paymentMethod=&paymentStatus=&search=&from=&to=&page=&limit=
// @access  Private/Admin
export const getAllOrders = async (req, res, next) => {
  try {
    const { status, paymentMethod, paymentStatus, search, from, to, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status && ORDER_STATUSES.includes(status)) filter.orderStatus = status;
    if (paymentMethod && ['ONLINE', 'COD'].includes(paymentMethod)) filter.paymentMethod = paymentMethod;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (from || to) {
      const range = parseDateRange(from, to);
      filter.createdAt = { $gte: range.from, $lte: range.to };
    }
    if (search) {
      const rx = { $regex: escapeRegex(search.trim()), $options: 'i' };
      filter.$or = [
        { orderNumber: rx },
        { trackingId: rx },
        { 'invoice.number': rx },
        { 'shippingAddress.fullName': rx },
        { 'shippingAddress.phone': rx },
        { customerEmail: rx },
        { 'paymentInfo.transactionId': rx },
      ];
    }

    const lim = Math.min(100, Math.max(1, Number(limit) || 20));
    const pg = Math.max(1, Number(page) || 1);
    const [total, orders, counts] = await Promise.all([
      Order.countDocuments(filter),
      Order.find(filter).populate('user', 'name email phone').sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim),
      Order.aggregate([{ $group: { _id: '$orderStatus', n: { $sum: 1 } } }]),
    ]);

    res.status(200).json({
      success: true,
      count: orders.length,
      total,
      totalPages: Math.ceil(total / lim),
      currentPage: pg,
      statusCounts: Object.fromEntries(counts.map((c) => [c._id, c.n])),
      data: orders,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: single order
// @route   GET /api/v1/orders/admin/:id
export const getAdminOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email phone createdAt');
    if (!order) throw httpError(404, 'Order not found');
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

const ALLOWED_TRANSITIONS = {
  PENDING_PAYMENT: ['PAID', 'PROCESSING', 'CANCELLED'],
  PAID: ['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUND_REQUESTED'],
  PROCESSING: ['SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUND_REQUESTED'],
  SHIPPED: ['DELIVERED', 'PROCESSING', 'CANCELLED', 'REFUND_REQUESTED'],
  DELIVERED: ['REFUND_REQUESTED', 'SHIPPED'],
  CANCELLED: [],
  REFUND_REQUESTED: ['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
  REFUNDED: [],
};

// @desc    Admin: update order status (validated transitions, stock & invoice side-effects)
// @route   PUT /api/v1/orders/:id/status   { status, note, paymentStatus }
// @access  Private/Admin
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, note, paymentStatus } = req.body;
    let order = await Order.findById(req.params.id);
    if (!order) throw httpError(404, 'Order not found');

    if (!ORDER_STATUSES.includes(status)) throw httpError(400, `Invalid order status. Allowed: ${ORDER_STATUSES.join(', ')}`);
    if (status === 'REFUNDED') throw httpError(400, 'Use the “Refund” action to refund an order (records the refund & credit note).');

    const oldStatus = order.orderStatus;
    if (status !== oldStatus && !ALLOWED_TRANSITIONS[oldStatus]?.includes(status)) {
      throw httpError(400, `Cannot move an order from ${oldStatus} to ${status}.`);
    }
    if (status === 'PAID' && order.paymentMethod === 'ONLINE' && order.paymentStatus !== 'PAID') {
      throw httpError(400, 'Online payments are confirmed by PhonePe. Use “Check payment status” instead.');
    }

    if (status === 'CANCELLED') {
      order = await cancelOrder(order, {
        reason: note || 'Cancelled by store',
        by: req.user.email,
        allowShipped: oldStatus === 'SHIPPED',
      });
    } else {
      order.orderStatus = status;
      if (paymentStatus && ['PENDING', 'PAID', 'FAILED'].includes(paymentStatus) && order.paymentMethod === 'COD') {
        order.paymentStatus = paymentStatus;
      }
      if (status === 'DELIVERED') {
        order.deliveredAt = new Date();
        if (order.paymentMethod === 'COD') order.paymentStatus = 'PAID';
      }
      if (status === 'SHIPPED' && !order.shippedAt) order.shippedAt = new Date();

      const settings = await Setting.getStoreSettings();
      const autoOn = settings.invoice?.autoGenerateForCodOn || 'SHIPPED';
      const shouldInvoice =
        !order.invoice?.number &&
        ((order.paymentStatus === 'PAID' && ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(status)) ||
          (order.paymentMethod === 'COD' && ((autoOn === 'SHIPPED' && ['SHIPPED', 'DELIVERED'].includes(status)) || (autoOn === 'DELIVERED' && status === 'DELIVERED'))));
      if (shouldInvoice) await issueInvoice(order, { settings });

      order.statusHistory.push({
        status,
        timestamp: new Date(),
        note: note || `Order status updated from ${oldStatus} to ${status}`,
        updatedBy: req.user.email,
      });
      await order.save();

      if (status === 'SHIPPED' && oldStatus !== 'SHIPPED') sendShippedMail(order).catch(() => {});
      if (status === 'DELIVERED' && oldStatus !== 'DELIVERED') sendDeliveredMail(order).catch(() => {});
    }

    await logAdminAction({
      req,
      action: 'ORDER_STATUS_UPDATED',
      resource: 'Order',
      resourceId: order._id.toString(),
      details: { orderNumber: order.orderNumber, from: oldStatus, to: status, note },
    });

    res.status(200).json({ success: true, message: `Order status updated to ${status}`, data: order });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: courier & tracking ID (auto-promotes to SHIPPED, issues COD invoice, emails customer)
// @route   PUT /api/v1/orders/:id/tracking
// @access  Private/Admin
export const updateOrderTracking = async (req, res, next) => {
  try {
    const { courier, trackingId, trackingUrl, note } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) throw httpError(404, 'Order not found');
    if (!courier || !trackingId) throw httpError(400, 'Please provide both courier partner and tracking ID');
    if (['CANCELLED', 'REFUNDED', 'PENDING_PAYMENT'].includes(order.orderStatus)) {
      throw httpError(400, `Cannot dispatch an order that is ${order.orderStatus}.`);
    }

    order.courier = String(courier).trim().slice(0, 60);
    order.trackingId = String(trackingId).trim().slice(0, 60);
    order.trackingUrl = (trackingUrl && /^https?:\/\//.test(trackingUrl) ? trackingUrl : null) || buildCourierTrackingUrl(order.courier, order.trackingId);

    const wasShipped = order.orderStatus === 'SHIPPED';
    if (['PAID', 'PROCESSING'].includes(order.orderStatus)) {
      order.orderStatus = 'SHIPPED';
      order.shippedAt = new Date();
    }

    if (!order.invoice?.number && order.orderStatus === 'SHIPPED') {
      await issueInvoice(order);
    }

    order.statusHistory.push({
      status: order.orderStatus,
      timestamp: new Date(),
      note: note || `Dispatched via ${order.courier}. Tracking ID: ${order.trackingId}`,
      updatedBy: req.user.email,
    });
    await order.save();
    if (!wasShipped && order.orderStatus === 'SHIPPED') sendShippedMail(order).catch(() => {});

    await logAdminAction({
      req,
      action: 'TRACKING_ID_UPDATED',
      resource: 'Order',
      resourceId: order._id.toString(),
      details: { orderNumber: order.orderNumber, courier: order.courier, trackingId: order.trackingId },
    });

    res.status(200).json({ success: true, message: 'Tracking details updated successfully', data: order });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: private note on order
// @route   PUT /api/v1/orders/:id/note
export const updateAdminNote = async (req, res, next) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, { adminNote: String(req.body.adminNote || '').slice(0, 2000) }, { new: true });
    if (!order) throw httpError(404, 'Order not found');
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};
