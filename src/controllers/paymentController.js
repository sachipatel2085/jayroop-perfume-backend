import { Order } from '../models/Order.js';
import { Setting } from '../models/Setting.js';
import { User } from '../models/User.js';
import * as phonepe from '../services/phonepe.js';
import { priceCart, httpError } from '../services/pricingService.js';
import {
  commitInventory,
  countCouponUsage,
  syncPaymentStatus,
  refundOrder,
  applyRefundCompletion,
} from '../services/orderLifecycle.js';
import { issueInvoice } from '../services/invoiceService.js';
import { sendOrderConfirmation, sendAdminNewOrderMail } from '../services/mailer.js';
import { logAdminAction } from '../utils/auditLogger.js';
import { generateOrderNumber, isValidGSTIN, isValidIndianPhone, isValidPincode } from '../utils/helpers.js';
import { canonicalStateName, findState } from '../utils/indiaStates.js';

const clientUrl = () => (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
const apiPublicUrl = () => (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/+$/, '');

// ───────────────────────── Validation helpers ─────────────────────────
const cleanAddress = (a = {}) => {
  const address = {
    fullName: String(a.fullName || '').trim().slice(0, 80),
    phone: String(a.phone || '').replace(/[^\d+]/g, '').slice(-13),
    email: String(a.email || '').trim().toLowerCase().slice(0, 120),
    addressLine1: String(a.addressLine1 || '').trim().slice(0, 200),
    addressLine2: String(a.addressLine2 || '').trim().slice(0, 200),
    city: String(a.city || '').trim().slice(0, 60),
    state: canonicalStateName(a.state).slice(0, 60),
    postalCode: String(a.postalCode || '').trim(),
    country: 'India',
  };
  const missing = ['fullName', 'phone', 'addressLine1', 'city', 'state', 'postalCode'].filter((k) => !address[k]);
  if (missing.length) throw httpError(400, 'Please complete your delivery address (name, phone, address, city, state and PIN code).');
  if (!isValidIndianPhone(address.phone)) throw httpError(400, 'Please enter a valid 10-digit Indian mobile number.');
  if (!isValidPincode(address.postalCode)) throw httpError(400, 'Please enter a valid 6-digit PIN code.');
  if (!findState(address.state)) throw httpError(400, 'Please select a valid Indian state.');
  return address;
};

const cleanBilling = (b = {}) => {
  const gstin = String(b.gstin || '').trim().toUpperCase();
  if (gstin && !isValidGSTIN(gstin)) throw httpError(400, 'The GSTIN entered is not valid (format: 22AAAAA0000A1Z5).');
  return { gstin, businessName: String(b.businessName || '').trim().slice(0, 120) };
};

const createOrderWithUniqueNumber = async (data) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await Order.create({ ...data, orderNumber: generateOrderNumber() });
    } catch (err) {
      if (err?.code === 11000 && String(err?.message || '').includes('orderNumber')) continue;
      throw err;
    }
  }
  throw httpError(500, 'Could not allocate an order number. Please try again.');
};

const startPhonePeAttempt = async (order) => {
  const attempt = (order.paymentInfo?.attempts || 0) + 1;
  const merchantOrderId = attempt === 1 ? order.orderNumber : `${order.orderNumber}_${attempt}`;

  const session = await phonepe.createPayment({
    merchantOrderId,
    amountPaise: Math.round(Number(order.total) * 100),
    redirectUrl: `${clientUrl()}/payment/status/${order.orderNumber}`,
    callbackUrl: `${apiPublicUrl()}/api/v1/payments/phonepe/webhook`,
    customer: { userId: String(order.user), phone: order.shippingAddress?.phone },
    meta: { orderNumber: order.orderNumber, customer: order.shippingAddress?.fullName, phone: order.shippingAddress?.phone },
  });

  order.paymentInfo.gateway = 'PHONEPE';
  order.paymentInfo.merchantOrderId = merchantOrderId;
  order.paymentInfo.attemptIds = [...(order.paymentInfo.attemptIds || []), merchantOrderId];
  order.paymentInfo.gatewayOrderId = session.gatewayOrderId || '';
  order.paymentInfo.attempts = attempt;
  order.paymentInfo.state = 'PENDING';
  if (order.paymentStatus === 'FAILED') order.paymentStatus = 'PENDING';
  order.statusHistory.push({
    status: 'PENDING_PAYMENT',
    timestamp: new Date(),
    note: `PhonePe payment session #${attempt} created (${merchantOrderId}).`,
    updatedBy: 'CUSTOMER',
  });
  await order.save();
  return session.redirectUrl;
};

// @desc    Unified checkout: price server-side, create order, start PhonePe or confirm COD
// @route   POST /api/v1/payments/checkout   (aliases: /create-order → ONLINE, /create-cod-order → COD)
// @access  Private
export const checkout = (forcedMethod = null) => async (req, res, next) => {
  try {
    const paymentMethod = forcedMethod || (String(req.body.paymentMethod || 'ONLINE').toUpperCase() === 'COD' ? 'COD' : 'ONLINE');
    const settings = await Setting.getStoreSettings();
    const shippingAddress = cleanAddress(req.body.shippingAddress);
    const billingDetails = cleanBilling(req.body.billingDetails);

    if (paymentMethod === 'ONLINE') {
      if (settings.onlinePaymentEnabled === false) throw httpError(400, 'Online payment is temporarily unavailable. Please choose Cash on Delivery.');
      if (!phonepe.isConfigured()) throw httpError(503, 'Online payment is not configured yet. Please choose Cash on Delivery.');
    } else if (!settings.codEnabled) {
      throw httpError(400, 'Cash on Delivery is currently unavailable. Please pay securely online with PhonePe.');
    }

    const pricing = await priceCart({
      items: req.body.items,
      couponCode: req.body.couponCode,
      userId: req.user._id,
      paymentMethod,
      strict: true,
      settings,
    });

    if (paymentMethod === 'COD') {
      if (settings.codMinOrderAmount > 0 && pricing.subtotal < settings.codMinOrderAmount) {
        throw httpError(400, `Minimum order amount for Cash on Delivery is ₹${settings.codMinOrderAmount}.`);
      }
      if (settings.codMaxOrderAmount > 0 && pricing.subtotal > settings.codMaxOrderAmount) {
        throw httpError(400, `Cash on Delivery is available up to ₹${settings.codMaxOrderAmount}. Please pay online for larger orders.`);
      }
    }

    const isCod = paymentMethod === 'COD';
    const order = await createOrderWithUniqueNumber({
      user: req.user._id,
      customerEmail: req.user.email,
      items: pricing.items.map(({ inStock, availableStock, ...line }) => line),
      subtotal: pricing.subtotal,
      discount: pricing.discount,
      shipping: pricing.shipping,
      codFee: pricing.codFee,
      total: pricing.total,
      appliedCoupon: pricing.coupon ? { code: pricing.coupon.code, discountAmount: pricing.coupon.discountAmount } : undefined,
      shippingAddress: { ...shippingAddress, email: shippingAddress.email || req.user.email },
      billingDetails,
      customerNote: String(req.body.customerNote || '').slice(0, 500),
      paymentMethod,
      paymentStatus: 'PENDING',
      orderStatus: isCod ? 'PROCESSING' : 'PENDING_PAYMENT',
      paymentInfo: { gateway: isCod ? 'COD' : 'PHONEPE', attempts: 0 },
      statusHistory: [
        {
          status: isCod ? 'PROCESSING' : 'PENDING_PAYMENT',
          timestamp: new Date(),
          note: isCod
            ? `Order placed with Cash on Delivery. ₹${pricing.total} to be collected on delivery.`
            : 'Order created. Awaiting PhonePe payment.',
          updatedBy: 'CUSTOMER',
        },
      ],
    });

    // Remember the address for next time (optional)
    if (req.body.saveAddress) {
      try {
        const user = await User.findById(req.user._id);
        const exists = user.addresses.some(
          (a) => a.addressLine1 === shippingAddress.addressLine1 && a.postalCode === shippingAddress.postalCode
        );
        if (!exists && user.addresses.length < 10) {
          user.addresses.forEach((a) => (a.isDefault = false));
          user.addresses.push({ ...shippingAddress, isDefault: true });
          if (!user.phone) user.phone = shippingAddress.phone;
          await user.save();
        }
      } catch (err) {
        console.warn('[Checkout] Could not save address:', err.message);
      }
    }

    if (isCod) {
      await commitInventory(order);
      await countCouponUsage(order);
      if (settings.invoice?.autoGenerateForCodOn === 'PLACED') await issueInvoice(order, { settings });
      await order.save();
      sendOrderConfirmation(order).catch(() => {});
      sendAdminNewOrderMail(order).catch(() => {});
      return res.status(201).json({
        success: true,
        message: 'Order placed successfully with Cash on Delivery',
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          total: order.total,
          paymentMethod: 'COD',
          paymentStatus: 'PENDING',
        },
      });
    }

    let redirectUrl;
    try {
      redirectUrl = await startPhonePeAttempt(order);
    } catch (err) {
      order.paymentStatus = 'FAILED';
      order.statusHistory.push({ status: 'PENDING_PAYMENT', timestamp: new Date(), note: `Could not start PhonePe: ${err.message}`, updatedBy: 'SYSTEM' });
      await order.save();
      throw err;
    }

    res.status(200).json({
      success: true,
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        amount: order.total,
        currency: 'INR',
        gateway: 'PHONEPE',
        redirectUrl,
      },
    });
  } catch (error) {
    next(error);
  }
};

const loadOwnedOrder = async (req, orderNumber) => {
  const order = await Order.findOne({ orderNumber });
  if (!order) throw httpError(404, 'Order not found');
  const isOwner = String(order.user) === String(req.user._id);
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role);
  if (!isOwner && !isAdmin) throw httpError(403, 'You do not have access to this order');
  return order;
};

// @desc    Retry payment for an unpaid online order (new PhonePe session)
// @route   POST /api/v1/payments/:orderNumber/retry
// @access  Private (owner)
export const retryPayment = async (req, res, next) => {
  try {
    let order = await loadOwnedOrder(req, req.params.orderNumber);
    if (order.paymentMethod !== 'ONLINE') throw httpError(400, 'This is a Cash on Delivery order.');

    // Make sure the previous attempt didn't actually succeed
    order = await syncPaymentStatus(order, { source: 'RETRY_CHECK' }).catch(() => order);
    if (order.paymentStatus === 'PAID') {
      return res.status(200).json({ success: true, data: { alreadyPaid: true, orderNumber: order.orderNumber } });
    }
    if (order.orderStatus === 'CANCELLED') throw httpError(400, 'This order was cancelled. Please place a new order.');
    if ((order.paymentInfo?.attempts || 0) >= 6) throw httpError(429, 'Too many payment attempts for this order. Please place a new order.');

    // Prices may have changed / stock may be gone since the first attempt
    const pricing = await priceCart({
      items: order.items.map((i) => ({ productId: i.product, variantSku: i.variant?.sku, quantity: i.quantity, name: i.name })),
      couponCode: order.appliedCoupon?.code,
      userId: req.user._id,
      paymentMethod: 'ONLINE',
    });
    const blocking = pricing.errors.filter((e) => !e.startsWith('Coupon'));
    if (blocking.length) throw httpError(400, blocking.join(' '));

    const redirectUrl = await startPhonePeAttempt(order);
    res.status(200).json({ success: true, data: { orderNumber: order.orderNumber, redirectUrl, amount: order.total } });
  } catch (error) {
    next(error);
  }
};

// @desc    Payment status (called by the redirect page). Always verified server-to-server with PhonePe.
// @route   GET /api/v1/payments/status/:orderNumber
// @access  Private (owner / admin)
export const getPaymentStatus = async (req, res, next) => {
  try {
    let order = await loadOwnedOrder(req, req.params.orderNumber);
    let mockState;
    if (phonepe.isMockMode() && req.query.mock) mockState = req.query.mock === 'failed' ? 'FAILED' : 'COMPLETED';

    if (order.paymentMethod === 'ONLINE' && !['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(order.paymentStatus)) {
      order = await syncPaymentStatus(order, { source: 'REDIRECT', mockState });
    }

    res.status(200).json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        gatewayState: order.paymentInfo?.state || '',
        total: order.total,
        attempts: order.paymentInfo?.attempts || 0,
        transactionId: order.paymentInfo?.transactionId || '',
        paymentMode: order.paymentInfo?.paymentMode || '',
        invoiceNumber: order.invoice?.number || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    PhonePe webhook / S2S callback (payment + refund events)
// @route   POST /api/v1/payments/phonepe/webhook
// @access  Public (Authorization / X-VERIFY protected)
export const phonePeWebhook = async (req, res) => {
  try {
    const v = phonepe.verifyWebhook(req.headers, req.body);
    if (!v.valid) {
      // An unverified callback is treated only as a hint to re-check the order with PhonePe's
      // Status API (authenticated with our own credentials). Nothing in the body is trusted, so a
      // misconfigured webhook (e.g. HMAC type, wrong password) can never mark an order paid – but
      // genuine payments still update instantly instead of waiting for the background checker.
      console.warn(`[PhonePe Webhook] Unverified callback (${v.reason || 'invalid signature'}) – re-checking with Status API`);
      if (v.merchantOrderId && !String(v.event).startsWith('pg.refund')) {
        const order = await Order.findOne({
          $or: [{ 'paymentInfo.merchantOrderId': v.merchantOrderId }, { 'paymentInfo.attemptIds': v.merchantOrderId }],
          orderStatus: 'PENDING_PAYMENT',
        });
        const last = order?.paymentInfo?.lastCheckedAt ? new Date(order.paymentInfo.lastCheckedAt).getTime() : 0;
        if (order && Date.now() - last > 20 * 1000) {
          await syncPaymentStatus(order, { source: 'PHONEPE_WEBHOOK_UNVERIFIED', merchantOrderId: v.merchantOrderId }).catch(() => {});
        }
      }
      return res.status(200).json({ success: true });
    }

    const event = String(v.event || '');
    if (event.startsWith('pg.refund') && v.merchantRefundId) {
      const order = await Order.findOne({ 'refunds.merchantRefundId': v.merchantRefundId });
      if (order) {
        const refund = order.refunds.find((r) => r.merchantRefundId === v.merchantRefundId);
        if (refund && refund.state === 'PENDING') {
          const status = await phonepe.fetchRefundStatus(v.merchantRefundId).catch(() => ({ state: v.state }));
          if (status.state === 'COMPLETED') {
            refund.state = 'COMPLETED';
            applyRefundCompletion(order, refund.amount);
          } else if (status.state === 'FAILED') {
            refund.state = 'FAILED';
            order.orderStatus = 'REFUND_REQUESTED';
          }
          refund.updatedAt = new Date();
          order.statusHistory.push({ status: order.orderStatus, timestamp: new Date(), note: `Refund ${refund.merchantRefundId}: ${refund.state}`, updatedBy: 'PHONEPE_WEBHOOK' });
          await order.save();
        }
      }
      return res.status(200).json({ success: true });
    }

    if (v.merchantOrderId) {
      const order = await Order.findOne({
        $or: [{ 'paymentInfo.merchantOrderId': v.merchantOrderId }, { 'paymentInfo.attemptIds': v.merchantOrderId }],
      });
      if (order) {
        // Never trust the webhook body for money – re-verify with PhonePe status API.
        await syncPaymentStatus(order, { source: 'PHONEPE_WEBHOOK', merchantOrderId: v.merchantOrderId });
      }
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[PhonePe Webhook] Error:', error.message);
    // 200 avoids PhonePe retry storms for permanent errors; reconciler will catch up.
    return res.status(200).json({ success: false });
  }
};

// @desc    Admin: force re-check of a payment with PhonePe
// @route   POST /api/v1/payments/admin/:id/sync
// @access  Private/Admin
export const adminSyncPayment = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) throw httpError(404, 'Order not found');
    const synced = await syncPaymentStatus(order, { source: `ADMIN:${req.user.email}` });
    await logAdminAction({ req, action: 'PAYMENT_SYNCED', resource: 'Order', resourceId: String(order._id), details: { orderNumber: order.orderNumber, paymentStatus: synced.paymentStatus } });
    res.status(200).json({ success: true, message: `Payment status: ${synced.paymentStatus}`, data: synced });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: refund (full / partial) via PhonePe, or record a manual refund
// @route   POST /api/v1/payments/admin/:id/refund   { amount?, reason, manual? }
// @access  Private/Admin
export const adminRefund = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) throw httpError(404, 'Order not found');
    if (!['PAID', 'PARTIALLY_REFUNDED'].includes(order.paymentStatus)) {
      throw httpError(400, 'Only paid orders can be refunded.');
    }
    const updated = await refundOrder(order, {
      amount: req.body.amount === '' || req.body.amount === undefined ? null : Number(req.body.amount),
      reason: String(req.body.reason || '').slice(0, 300),
      manual: Boolean(req.body.manual),
      initiatedBy: req.user.email,
    });
    await logAdminAction({ req, action: 'ORDER_REFUNDED', resource: 'Order', resourceId: String(order._id), details: { orderNumber: order.orderNumber, amount: req.body.amount ?? 'FULL', manual: Boolean(req.body.manual) } });
    res.status(200).json({ success: true, message: 'Refund processed', data: updated });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: check a pending refund with PhonePe
// @route   POST /api/v1/payments/admin/:id/refunds/:refundId/sync
// @access  Private/Admin
export const adminSyncRefund = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) throw httpError(404, 'Order not found');
    const refund = order.refunds.find((r) => r.merchantRefundId === req.params.refundId);
    if (!refund) throw httpError(404, 'Refund not found');
    if (refund.state === 'PENDING') {
      const s = await phonepe.fetchRefundStatus(refund.merchantRefundId);
      if (s.state === 'COMPLETED') {
        refund.state = 'COMPLETED';
        applyRefundCompletion(order, refund.amount);
      } else if (s.state === 'FAILED') refund.state = 'FAILED';
      refund.updatedAt = new Date();
      await order.save();
    }
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: gateway configuration status (no secrets)
// @route   GET /api/v1/payments/admin/gateway
export const gatewayInfo = async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      ...phonepe.publicGatewayInfo(),
      redirectUrlPattern: `${clientUrl()}/payment/status/{orderNumber}`,
      webhookUrl: `${apiPublicUrl()}/api/v1/payments/phonepe/webhook`,
    },
  });
};
