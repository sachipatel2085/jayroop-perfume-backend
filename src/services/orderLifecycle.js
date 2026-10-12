import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { Coupon } from '../models/Coupon.js';
import { Setting } from '../models/Setting.js';
import { issueInvoice, issueCreditNote } from './invoiceService.js';
import * as phonepe from './phonepe.js';
import { sendOrderConfirmation, sendCancelledMail, sendAdminNewOrderMail } from './mailer.js';
import { round2 } from '../utils/helpers.js';

/**
 * Deduct inventory once per order (guarded by `inventoryCommitted`).
 * Uses conditional updates so concurrent orders cannot push stock below zero silently.
 */
export const commitInventory = async (order) => {
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, inventoryCommitted: { $ne: true } },
    { $set: { inventoryCommitted: true } },
    { new: true }
  );
  if (!claimed) return { committed: false, shortfalls: [] };

  const shortfalls = [];
  for (const item of order.items) {
    const qty = Number(item.quantity) || 1;
    if (item.variant?.sku) {
      const r = await Product.updateOne(
        { _id: item.product, variants: { $elemMatch: { sku: item.variant.sku, stock: { $gte: qty } } } },
        { $inc: { 'variants.$.stock': -qty, stock: -qty, totalSold: qty } }
      );
      if (!r.modifiedCount) {
        shortfalls.push(`${item.name} (${item.variant.title})`);
        await Product.updateOne(
          { _id: item.product, 'variants.sku': item.variant.sku },
          { $set: { 'variants.$.stock': 0 }, $inc: { stock: -qty, totalSold: qty } }
        );
      }
    } else {
      const r = await Product.updateOne(
        { _id: item.product, stock: { $gte: qty } },
        { $inc: { stock: -qty, totalSold: qty } }
      );
      if (!r.modifiedCount) {
        shortfalls.push(item.name);
        await Product.updateOne({ _id: item.product }, { $set: { stock: 0 }, $inc: { totalSold: qty } });
      }
    }
    await Product.updateOne({ _id: item.product, stock: { $lt: 0 } }, { $set: { stock: 0 } });
  }
  order.inventoryCommitted = true;
  return { committed: true, shortfalls };
};

export const restoreInventory = async (order) => {
  const released = await Order.findOneAndUpdate(
    { _id: order._id, inventoryCommitted: true },
    { $set: { inventoryCommitted: false } },
    { new: true }
  );
  if (!released) return false;
  for (const item of order.items) {
    const qty = Number(item.quantity) || 1;
    if (item.variant?.sku) {
      await Product.updateOne(
        { _id: item.product, 'variants.sku': item.variant.sku },
        { $inc: { 'variants.$.stock': qty, stock: qty, totalSold: -qty } }
      );
    } else {
      await Product.updateOne({ _id: item.product }, { $inc: { stock: qty, totalSold: -qty } });
    }
    await Product.updateOne({ _id: item.product, totalSold: { $lt: 0 } }, { $set: { totalSold: 0 } });
  }
  order.inventoryCommitted = false;
  return true;
};

export const countCouponUsage = async (order) => {
  if (!order.appliedCoupon?.code) return;
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, couponCounted: { $ne: true } },
    { $set: { couponCounted: true } }
  );
  if (!claimed) return;
  await Coupon.updateOne({ code: order.appliedCoupon.code }, { $inc: { timesUsed: 1 } });
  order.couponCounted = true;
};

export const releaseCouponUsage = async (order) => {
  if (!order.appliedCoupon?.code) return;
  const released = await Order.findOneAndUpdate({ _id: order._id, couponCounted: true }, { $set: { couponCounted: false } });
  if (!released) return;
  await Coupon.updateOne({ code: order.appliedCoupon.code, timesUsed: { $gt: 0 } }, { $inc: { timesUsed: -1 } });
  order.couponCounted = false;
};

/**
 * Mark an online order as PAID after the gateway CONFIRMED it server-to-server.
 * Idempotent & race-safe (redirect page + webhook may arrive simultaneously).
 */
export const markOrderPaid = async (orderId, gatewayStatus, { source = 'PHONEPE' } = {}) => {
  const now = new Date();
  const updated = await Order.findOneAndUpdate(
    { _id: orderId, paymentStatus: { $nin: ['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'] } },
    {
      $set: {
        paymentStatus: 'PAID',
        orderStatus: 'PAID',
        'paymentInfo.transactionId': gatewayStatus.transactionId || '',
        'paymentInfo.paymentMode': gatewayStatus.paymentMode || '',
        'paymentInfo.gatewayOrderId': gatewayStatus.gatewayOrderId || '',
        'paymentInfo.state': 'COMPLETED',
        'paymentInfo.paidAt': now,
        'paymentInfo.lastCheckedAt': now,
        ...(gatewayStatus.merchantOrderId ? { 'paymentInfo.merchantOrderId': gatewayStatus.merchantOrderId } : {}),
      },
      $push: {
        statusHistory: {
          status: 'PAID',
          timestamp: now,
          note: `Payment received via PhonePe${gatewayStatus.paymentMode ? ` (${gatewayStatus.paymentMode})` : ''}. Txn: ${gatewayStatus.transactionId || 'n/a'}`,
          updatedBy: source,
        },
      },
    },
    { new: true }
  );

  if (!updated) {
    return { order: await Order.findById(orderId), alreadyPaid: true };
  }

  // Order may have been auto-cancelled (abandoned) before the late payment arrived → re-open it.
  const { shortfalls } = await commitInventory(updated);
  await countCouponUsage(updated);
  const settings = await Setting.getStoreSettings();
  await issueInvoice(updated, { settings });
  if (shortfalls.length) {
    updated.adminNote = `${updated.adminNote ? `${updated.adminNote}\n` : ''}⚠ Stock shortfall at payment time: ${shortfalls.join(', ')}`;
  }
  await updated.save();

  sendOrderConfirmation(updated).catch(() => {});
  sendAdminNewOrderMail(updated).catch(() => {});
  return { order: updated, alreadyPaid: false };
};

export const markPaymentFailed = async (order, gatewayStatus, { source = 'PHONEPE' } = {}) => {
  if (order.paymentStatus === 'PAID') return order;
  order.paymentStatus = 'FAILED';
  order.paymentInfo.state = gatewayStatus?.state || 'FAILED';
  order.paymentInfo.lastCheckedAt = new Date();
  order.statusHistory.push({
    status: 'PENDING_PAYMENT',
    timestamp: new Date(),
    note: `Payment attempt failed${gatewayStatus?.errorCode ? ` (${gatewayStatus.errorCode})` : ''}. Customer can retry.`,
    updatedBy: source,
  });
  await order.save();
  return order;
};

/**
 * Sync an online order with PhonePe (authoritative). Returns the refreshed order.
 */
export const syncPaymentStatus = async (order, { source = 'STATUS_CHECK', mockState, merchantOrderId } = {}) => {
  if (order.paymentMethod !== 'ONLINE' || !order.paymentInfo?.merchantOrderId) return order;
  if (['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(order.paymentStatus)) return order;

  const attemptId = merchantOrderId || order.paymentInfo.merchantOrderId;
  const status = await phonepe.fetchPaymentStatus(attemptId, { mockState });
  status.merchantOrderId = attemptId;
  if (phonepe.isMockMode() && status.amount === null) status.amount = Math.round(order.total * 100);

  if (status.state === 'COMPLETED') {
    const expected = Math.round(Number(order.total) * 100);
    if (status.amount && status.amount !== expected) {
      order.adminNote = `${order.adminNote ? `${order.adminNote}\n` : ''}⚠ Amount mismatch: gateway ₹${status.amount / 100} vs order ₹${order.total}`;
      order.paymentInfo.state = 'AMOUNT_MISMATCH';
      await order.save();
      return order;
    }
    const { order: paid } = await markOrderPaid(order._id, status, { source });
    return paid;
  }
  if (status.state === 'FAILED') {
    // A failure of an older attempt must not override a newer pending attempt
    if (attemptId !== order.paymentInfo.merchantOrderId) return order;
    return markPaymentFailed(order, status, { source });
  }
  order.paymentInfo.state = 'PENDING';
  order.paymentInfo.lastCheckedAt = new Date();
  await order.save();
  return order;
};

/**
 * Initiate a refund through PhonePe (or record a manual one for COD / offline settlements).
 */
export const refundOrder = async (order, { amount = null, reason = '', initiatedBy = 'SYSTEM', manual = false } = {}) => {
  const refundable = round2(Number(order.total) - Number(order.refundedAmount || 0) - pendingRefundTotal(order));
  const value = round2(amount === null || amount === undefined ? refundable : Number(amount));
  if (!(value > 0)) throw httpErr(400, 'Nothing left to refund on this order.');
  if (value > refundable) throw httpErr(400, `Maximum refundable amount is ₹${refundable}.`);

  const merchantRefundId = `${order.orderNumber}-RF${(order.refunds?.length || 0) + 1}`;
  let state = 'MANUAL';
  let gatewayRefundId = '';

  const canUseGateway = order.paymentMethod === 'ONLINE' && order.paymentStatus !== 'PENDING' && order.paymentInfo?.merchantOrderId && !manual;
  if (canUseGateway) {
    const res = await phonepe.initiateRefund({
      merchantRefundId,
      originalMerchantOrderId: order.paymentInfo.merchantOrderId,
      originalTransactionId: order.paymentInfo.transactionId,
      amountPaise: Math.round(value * 100),
      userId: String(order.user),
      callbackUrl: `${(process.env.API_PUBLIC_URL || '').replace(/\/+$/, '')}/api/v1/payments/phonepe/webhook`,
    });
    state = res.state === 'COMPLETED' ? 'COMPLETED' : res.state === 'FAILED' ? 'FAILED' : 'PENDING';
    gatewayRefundId = res.refundId || '';
  }

  order.refunds.push({ merchantRefundId, gatewayRefundId, amount: value, state, reason, initiatedBy });
  if (state === 'COMPLETED' || state === 'MANUAL') applyRefundCompletion(order, value);
  else order.orderStatus = 'REFUND_REQUESTED';

  order.statusHistory.push({
    status: order.orderStatus,
    timestamp: new Date(),
    note: `Refund of ₹${value} ${state === 'MANUAL' ? 'recorded (manual)' : `initiated via PhonePe (${state})`}${reason ? ` – ${reason}` : ''}`,
    updatedBy: initiatedBy,
  });

  if (order.invoice?.number) {
    await issueCreditNote(order, { reason: reason || 'Refund', amount: value });
  }
  await order.save();
  return order;
};

export const applyRefundCompletion = (order, value) => {
  order.refundedAmount = round2(Number(order.refundedAmount || 0) + Number(value));
  if (order.refundedAmount >= round2(order.total)) {
    order.paymentStatus = 'REFUNDED';
    order.orderStatus = 'REFUNDED';
  } else {
    order.paymentStatus = 'PARTIALLY_REFUNDED';
  }
};

const pendingRefundTotal = (order) =>
  (order.refunds || []).filter((r) => r.state === 'PENDING').reduce((s, r) => s + Number(r.amount || 0), 0);

/**
 * Cancel an order: restore stock, release coupon, raise credit note, auto-refund online payments.
 */
export const cancelOrder = async (order, { reason = '', by = 'SYSTEM', refund = true, allowShipped = false } = {}) => {
  if (order.orderStatus === 'DELIVERED' || (order.orderStatus === 'SHIPPED' && !allowShipped)) {
    throw httpErr(400, 'Shipped orders cannot be cancelled. Please request a return after delivery.');
  }
  if (['CANCELLED', 'REFUNDED'].includes(order.orderStatus)) return order;

  await restoreInventory(order);
  await releaseCouponUsage(order);

  order.orderStatus = 'CANCELLED';
  order.cancelledAt = new Date();
  order.cancellationReason = reason;
  if (order.paymentStatus === 'PENDING') order.paymentStatus = order.paymentMethod === 'COD' ? 'PENDING' : 'FAILED';
  order.statusHistory.push({ status: 'CANCELLED', timestamp: new Date(), note: reason || 'Order cancelled', updatedBy: by });

  if (order.invoice?.number && !order.invoice?.creditNote?.number) {
    await issueCreditNote(order, { reason: reason || 'Order cancelled' });
  }
  await order.save();

  if (refund && order.paymentStatus === 'PAID' && order.paymentMethod === 'ONLINE') {
    try {
      await refundOrder(order, { reason: reason || 'Order cancelled', initiatedBy: by });
    } catch (err) {
      order.orderStatus = 'REFUND_REQUESTED';
      order.statusHistory.push({
        status: 'REFUND_REQUESTED',
        timestamp: new Date(),
        note: `Automatic refund failed: ${err.message}. Will be processed manually.`,
        updatedBy: 'SYSTEM',
      });
      await order.save();
    }
  }

  sendCancelledMail(order).catch(() => {});
  return order;
};

/**
 * Background housekeeping: re-check abandoned PhonePe payments and cancel the ones that expired.
 */
export const reconcilePendingPayments = async () => {
  const cutoff = new Date(Date.now() - 25 * 60 * 1000); // expireAfter is 20 min
  const stale = await Order.find({
    paymentMethod: 'ONLINE',
    paymentStatus: { $in: ['PENDING', 'FAILED'] },
    orderStatus: 'PENDING_PAYMENT',
    createdAt: { $lt: cutoff },
  }).limit(25);

  for (const order of stale) {
    try {
      const synced = await syncPaymentStatus(order, { source: 'RECONCILER' });
      if (synced.paymentStatus !== 'PAID' && synced.orderStatus === 'PENDING_PAYMENT') {
        const ageHours = (Date.now() - new Date(order.createdAt).getTime()) / 3600000;
        if (synced.paymentStatus === 'FAILED' || ageHours > 2) {
          synced.orderStatus = 'CANCELLED';
          synced.cancelledAt = new Date();
          synced.cancellationReason = 'Payment not completed';
          synced.statusHistory.push({ status: 'CANCELLED', timestamp: new Date(), note: 'Auto-cancelled: payment was not completed.', updatedBy: 'RECONCILER' });
          await synced.save();
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.warn(`[Reconcile] ${order.orderNumber}: ${err.message}`);
    }
  }
};

const httpErr = (statusCode, message) => {
  const e = new Error(message);
  e.statusCode = statusCode;
  return e;
};
