import { ORDER_STATUSES } from '../models/Order.js';
import { Setting } from '../models/Setting.js';
import { cancelOrder, syncPaymentStatus } from './orderLifecycle.js';
import { issueInvoice } from './invoiceService.js';
import { sendMail, sendShippedMail, sendDeliveredMail } from './mailer.js';
import { httpError } from './pricingService.js';

/**
 * Order actions shared by the single-order drawer AND the bulk tools, so one order and
 * 200 orders always follow exactly the same rules (transitions, stock, invoices, e-mails).
 *
 * Every action returns { changed, message } and mutates + saves the order.
 * E-mails are handed to `mail(fn)` – single updates send right away, bulk updates queue
 * them and send one after another so the SMTP server is not flooded.
 */

export const ALLOWED_TRANSITIONS = {
  PENDING_PAYMENT: ['PAID', 'PROCESSING', 'CANCELLED'],
  PAID: ['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUND_REQUESTED'],
  PROCESSING: ['SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUND_REQUESTED'],
  SHIPPED: ['DELIVERED', 'PROCESSING', 'CANCELLED', 'REFUND_REQUESTED'],
  DELIVERED: ['REFUND_REQUESTED', 'SHIPPED'],
  CANCELLED: [],
  REFUND_REQUESTED: ['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
  REFUNDED: [],
};

export const STATUS_LABEL = {
  PENDING_PAYMENT: 'Awaiting payment',
  PAID: 'Confirmed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUND_REQUESTED: 'Refund in progress',
  REFUNDED: 'Refunded',
};

const sendNow = (fn) => {
  Promise.resolve()
    .then(fn)
    .catch(() => {});
};

// Courier tracking deep links
export const buildCourierTrackingUrl = (courier, trackingId) => {
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

const autoInvoice = async (order, status, settings) => {
  if (order.invoice?.number) return false;
  const autoOn = settings?.invoice?.autoGenerateForCodOn || 'SHIPPED';
  const should =
    (order.paymentStatus === 'PAID' && ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(status)) ||
    (order.paymentMethod === 'COD' &&
      ((autoOn === 'SHIPPED' && ['SHIPPED', 'DELIVERED'].includes(status)) || (autoOn === 'DELIVERED' && status === 'DELIVERED')));
  if (!should) return false;
  await issueInvoice(order, { settings });
  return true;
};

/**
 * Change the order status with all side-effects (stock on cancel, invoice, timestamps, e-mails).
 */
export const applyStatusChange = async (
  order,
  { status, note = '', paymentStatus, by = 'ADMIN', settings, notify = true, mail = sendNow } = {}
) => {
  if (!ORDER_STATUSES.includes(status)) throw httpError(400, `Invalid order status. Allowed: ${ORDER_STATUSES.join(', ')}`);
  if (status === 'REFUNDED') throw httpError(400, 'Use the “Refund” action to refund an order (records the refund & credit note).');

  const oldStatus = order.orderStatus;
  if (status === oldStatus) return { changed: false, message: `Already ${STATUS_LABEL[status] || status}` };
  if (!ALLOWED_TRANSITIONS[oldStatus]?.includes(status)) {
    throw httpError(400, `Cannot move from ${STATUS_LABEL[oldStatus] || oldStatus} to ${STATUS_LABEL[status] || status}.`);
  }
  // Loophole fix: an unpaid PhonePe order has no stock reserved and no money received – never fulfil it.
  if (order.paymentMethod === 'ONLINE' && order.paymentStatus !== 'PAID' && status !== 'CANCELLED' && oldStatus === 'PENDING_PAYMENT') {
    throw httpError(400, 'PhonePe payment is not confirmed yet. Use “Check PhonePe status” first.');
  }

  if (status === 'CANCELLED') {
    await cancelOrder(order, {
      reason: note || 'Cancelled by store',
      by,
      allowShipped: oldStatus === 'SHIPPED',
      notify,
    });
    return { changed: true, message: `${STATUS_LABEL[oldStatus]} → Cancelled${order.orderStatus === 'REFUND_REQUESTED' ? ' (refund pending)' : ''}` };
  }

  const cfg = settings || (await Setting.getStoreSettings());
  order.orderStatus = status;
  if (paymentStatus && ['PENDING', 'PAID', 'FAILED'].includes(paymentStatus) && order.paymentMethod === 'COD') {
    order.paymentStatus = paymentStatus;
  }
  if (status === 'SHIPPED' && !order.shippedAt) order.shippedAt = new Date();
  if (status === 'DELIVERED') {
    order.deliveredAt = new Date();
    if (!order.shippedAt) order.shippedAt = order.deliveredAt;
    if (order.paymentMethod === 'COD') order.paymentStatus = 'PAID';
  }
  if (oldStatus === 'DELIVERED' && status !== 'DELIVERED') order.deliveredAt = null;

  const invoiced = await autoInvoice(order, status, cfg);

  order.statusHistory.push({
    status,
    timestamp: new Date(),
    note: note || `Order status updated from ${oldStatus} to ${status}`,
    updatedBy: by,
  });
  await order.save();

  if (notify) {
    if (status === 'SHIPPED' && oldStatus !== 'SHIPPED') mail(() => sendShippedMail(order));
    if (status === 'DELIVERED' && oldStatus !== 'DELIVERED') mail(() => sendDeliveredMail(order));
  }
  return { changed: true, message: `${STATUS_LABEL[oldStatus]} → ${STATUS_LABEL[status]}${invoiced ? ` · invoice ${order.invoice.number}` : ''}` };
};

/**
 * Save courier + AWB. Paid / processing orders move to SHIPPED, the COD invoice is issued, customer e-mailed.
 */
export const applyTracking = async (
  order,
  { courier, trackingId, trackingUrl, note = '', by = 'ADMIN', settings, notify = true, mail = sendNow } = {}
) => {
  if (!courier || !trackingId) throw httpError(400, 'Courier partner and AWB / tracking ID are both required.');
  if (['CANCELLED', 'REFUNDED', 'PENDING_PAYMENT'].includes(order.orderStatus)) {
    throw httpError(400, `Cannot dispatch an order that is ${STATUS_LABEL[order.orderStatus] || order.orderStatus}.`);
  }
  const cleanCourier = String(courier).trim().slice(0, 60);
  const cleanAwb = String(trackingId).trim().slice(0, 60);
  if (order.courier === cleanCourier && order.trackingId === cleanAwb && order.orderStatus !== 'PAID' && order.orderStatus !== 'PROCESSING') {
    return { changed: false, message: `AWB ${cleanAwb} already saved` };
  }

  order.courier = cleanCourier;
  order.trackingId = cleanAwb;
  order.trackingUrl = (trackingUrl && /^https?:\/\//.test(trackingUrl) ? String(trackingUrl).slice(0, 500) : null) || buildCourierTrackingUrl(order.courier, order.trackingId);

  const wasShipped = order.orderStatus === 'SHIPPED';
  if (['PAID', 'PROCESSING'].includes(order.orderStatus)) {
    order.orderStatus = 'SHIPPED';
    order.shippedAt = new Date();
  }
  let invoiced = false;
  if (!order.invoice?.number && order.orderStatus === 'SHIPPED') {
    await issueInvoice(order, { settings: settings || (await Setting.getStoreSettings()) });
    invoiced = true;
  }

  order.statusHistory.push({
    status: order.orderStatus,
    timestamp: new Date(),
    note: note || `Dispatched via ${order.courier}. Tracking ID: ${order.trackingId}`,
    updatedBy: by,
  });
  await order.save();
  if (notify && !wasShipped && order.orderStatus === 'SHIPPED') mail(() => sendShippedMail(order));

  return {
    changed: true,
    message: `${wasShipped ? 'AWB updated' : 'Shipped'} · ${order.courier} ${order.trackingId}${invoiced ? ` · invoice ${order.invoice.number}` : ''}`,
  };
};

/**
 * Approve / reject / close a customer return request.
 */
export const applyReturnDecision = async (order, { status, resolution = '', by = 'ADMIN', notify = true, mail = sendNow } = {}) => {
  if (!order.returnRequest) throw httpError(400, 'This order has no return request.');
  const st = String(status || '').toUpperCase();
  if (!['OPEN', 'APPROVED', 'REJECTED', 'CLOSED'].includes(st)) throw httpError(400, 'Invalid return status');
  if (order.returnRequest.status === st && !resolution) return { changed: false, message: `Return already ${st.toLowerCase()}` };

  order.returnRequest.status = st;
  order.returnRequest.resolution = String(resolution || '').slice(0, 1000);
  if (st !== 'OPEN') order.returnRequest.resolvedAt = new Date();
  order.markModified('returnRequest');
  order.statusHistory.push({
    status: order.orderStatus,
    timestamp: new Date(),
    note: `Return request ${st.toLowerCase()}${order.returnRequest.resolution ? `: ${order.returnRequest.resolution}` : ''}`,
    updatedBy: by,
  });
  await order.save();

  if (notify && order.customerEmail && st !== 'OPEN') {
    const first = String(order.shippingAddress?.fullName || '').split(' ')[0] || 'there';
    const text = order.returnRequest.resolution;
    mail(() =>
      sendMail({
        to: order.customerEmail,
        subject: `Update on your request – ${order.orderNumber}`,
        html: `<p>Hi ${first.replace(/</g, '&lt;')},</p><p>Your return / replacement request for order <b>${order.orderNumber}</b> has been <b>${st.toLowerCase()}</b>.</p>${text ? `<p>${text.replace(/</g, '&lt;')}</p>` : ''}<p>— Team Jayrup · care@jayrup.in</p>`,
      })
    );
  }
  return { changed: true, message: `Return ${st.toLowerCase()}` };
};

/** COD only: record whether the cash was collected / remitted. */
export const applyCodPayment = async (order, { paymentStatus, note = '', by = 'ADMIN', settings } = {}) => {
  if (order.paymentMethod !== 'COD') throw httpError(400, 'Only Cash-on-Delivery orders can be marked this way (PhonePe is confirmed by the gateway).');
  if (!['PENDING', 'PAID', 'FAILED'].includes(paymentStatus)) throw httpError(400, 'Invalid payment status');
  if (['REFUNDED', 'PARTIALLY_REFUNDED'].includes(order.paymentStatus)) throw httpError(400, 'Order already refunded.');
  if (order.orderStatus === 'CANCELLED' && paymentStatus === 'PAID') throw httpError(400, 'Order is cancelled.');
  if (order.paymentStatus === paymentStatus) return { changed: false, message: `Payment already ${paymentStatus.toLowerCase()}` };

  const old = order.paymentStatus;
  order.paymentStatus = paymentStatus;
  let invoiced = false;
  if (paymentStatus === 'PAID') {
    invoiced = await autoInvoice(order, order.orderStatus, settings || (await Setting.getStoreSettings()));
  }
  order.statusHistory.push({
    status: order.orderStatus,
    timestamp: new Date(),
    note: note || (paymentStatus === 'PAID' ? 'COD amount collected / remitted by courier' : `COD payment marked ${paymentStatus.toLowerCase()}`),
    updatedBy: by,
  });
  await order.save();
  return { changed: true, message: `COD ${old.toLowerCase()} → ${paymentStatus.toLowerCase()}${invoiced ? ` · invoice ${order.invoice.number}` : ''}` };
};

export const applyIssueInvoice = async (order, { settings } = {}) => {
  if (order.invoice?.number) return { changed: false, message: `Invoice ${order.invoice.number} already issued` };
  if (['PENDING_PAYMENT', 'CANCELLED'].includes(order.orderStatus)) throw httpError(400, 'Cannot invoice an unpaid or cancelled order.');
  await issueInvoice(order, { settings: settings || (await Setting.getStoreSettings()) });
  await order.save();
  return { changed: true, message: `Invoice ${order.invoice.number} issued` };
};

export const applyPaymentSync = async (order, { by = 'ADMIN' } = {}) => {
  if (order.paymentMethod !== 'ONLINE') throw httpError(400, 'Not a PhonePe order');
  if (['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(order.paymentStatus)) return { changed: false, message: 'Already paid' };
  const before = order.paymentStatus;
  const synced = await syncPaymentStatus(order, { source: `ADMIN:${by}` });
  return {
    changed: synced.paymentStatus !== before,
    message: `PhonePe: ${synced.paymentInfo?.state || synced.paymentStatus}${synced.paymentStatus === 'PAID' ? ' – order confirmed' : ''}`,
    order: synced,
  };
};

export const applyAdminNote = async (order, { note, mode = 'append', by = 'ADMIN' } = {}) => {
  const text = String(note || '').trim().slice(0, 1000);
  if (!text && mode !== 'replace') throw httpError(400, 'Write a note first.');
  if (mode === 'replace') order.adminNote = text;
  else {
    const stamp = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
    order.adminNote = `${order.adminNote ? `${order.adminNote}\n` : ''}[${stamp} · ${String(by).split('@')[0]}] ${text}`.slice(-2000);
  }
  await order.save();
  return { changed: true, message: 'Note saved' };
};
