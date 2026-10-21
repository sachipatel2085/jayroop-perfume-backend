import { Order } from '../models/Order.js';
import { Setting } from '../models/Setting.js';
import { logAdminAction } from '../utils/auditLogger.js';
import { httpError } from '../services/pricingService.js';
import { buildOrderFilter } from './orderController.js';
import {
  applyStatusChange,
  applyTracking,
  applyReturnDecision,
  applyCodPayment,
  applyIssueInvoice,
  applyPaymentSync,
  applyAdminNote,
  STATUS_LABEL,
} from '../services/orderActions.js';
import { sendOrderConfirmation, sendShippedMail, sendDeliveredMail } from '../services/mailer.js';

/**
 * Bulk order tools for the admin:
 *   POST /orders/bulk            – one action on many selected orders
 *   GET  /orders/bulk/select     – every order matching the list filters (for "select all N")
 *   GET  /orders/bulk/queues     – work queues (ready to ship, in transit, …) with counts
 *   POST /orders/bulk/lookup     – find orders from pasted order no. / invoice no. / AWB
 *   POST /orders/bulk/dispatch   – courier sheet: order no. + courier + AWB (+ status) per row
 */

export const BULK_MAX = 200;
const SELECT_MAX = 1000;
const isId = (v) => /^[0-9a-fA-F]{24}$/.test(String(v));

// Fields the list / selection needs – keeps "select all 800 orders" light
const LITE_FIELDS =
  'orderNumber createdAt orderStatus paymentMethod paymentStatus total items.quantity shippingAddress.fullName shippingAddress.city shippingAddress.state shippingAddress.phone shippingAddress.postalCode customerEmail invoice.number invoice.status courier trackingId returnRequest.status shippedAt deliveredAt';

// Work queues shown in Admin › Bulk Order Update
const QUEUES = {
  READY_TO_SHIP: {
    label: 'Ready to ship',
    hint: 'Paid PhonePe + COD orders waiting for dispatch',
    filter: () => ({ orderStatus: { $in: ['PAID', 'PROCESSING'] } }),
  },
  NEEDS_INVOICE: {
    label: 'Missing invoice',
    hint: 'Confirmed orders without a GST invoice number',
    filter: () => ({ orderStatus: { $in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] }, 'invoice.number': { $exists: false } }),
  },
  IN_TRANSIT: {
    label: 'In transit',
    hint: 'Shipped – mark delivered when the courier confirms',
    filter: () => ({ orderStatus: 'SHIPPED' }),
  },
  LATE_DELIVERY: {
    label: 'Shipped 10+ days ago',
    hint: 'Check with the courier – may be delivered or stuck',
    filter: () => ({ orderStatus: 'SHIPPED', shippedAt: { $lt: new Date(Date.now() - 10 * 86400000) } }),
  },
  COD_UNCOLLECTED: {
    label: 'COD not collected',
    hint: 'Shipped COD orders where cash is still pending',
    filter: () => ({ paymentMethod: 'COD', paymentStatus: 'PENDING', orderStatus: { $in: ['SHIPPED', 'DELIVERED'] } }),
  },
  PAYMENT_PENDING: {
    label: 'PhonePe payment pending',
    hint: 'Re-check with PhonePe before cancelling',
    filter: () => ({ paymentMethod: 'ONLINE', orderStatus: 'PENDING_PAYMENT' }),
  },
  RETURNS_OPEN: {
    label: 'Open return requests',
    hint: 'Approve, reject or close',
    filter: () => ({ 'returnRequest.status': 'OPEN' }),
  },
  REFUND_PENDING: {
    label: 'Refunds in progress',
    hint: 'Check refund status in each order',
    filter: () => ({ orderStatus: 'REFUND_REQUESTED' }),
  },
};

const ACTIONS = ['STATUS', 'SHIP', 'COD_PAYMENT', 'ISSUE_INVOICE', 'SYNC_PAYMENT', 'RETURN', 'NOTE', 'RESEND_EMAIL'];

/** Send queued e-mails one by one after the response, so 200 mails don't hit SMTP at once. */
const createMailQueue = () => {
  const jobs = [];
  return {
    add: (fn) => jobs.push(fn),
    flush: () => {
      if (!jobs.length) return;
      (async () => {
        for (const job of jobs) {
          try {
            await job();
          } catch {
            /* one failed mail must not stop the rest */
          }
          await new Promise((r) => setTimeout(r, 400));
        }
      })();
    },
    get size() {
      return jobs.length;
    },
  };
};

const runOne = async (order, action, p, ctx) => {
  const common = { by: ctx.by, settings: ctx.settings, notify: p.notify !== false, mail: ctx.mail.add };
  switch (action) {
    case 'STATUS':
      return applyStatusChange(order, { ...common, status: p.status, note: p.note });
    case 'SHIP': {
      const awb = String(p.tracking?.[String(order._id)] || p.tracking?.[order.orderNumber] || '').trim();
      if (awb) return applyTracking(order, { ...common, courier: p.courier || order.courier, trackingId: awb, trackingUrl: p.trackingUrlTemplate ? p.trackingUrlTemplate.replace('{awb}', encodeURIComponent(awb)) : '', note: p.note });
      if (p.requireAwb) throw httpError(400, 'AWB / tracking number missing');
      if (p.courier && !order.trackingId) order.courier = String(p.courier).trim().slice(0, 60);
      return applyStatusChange(order, { ...common, status: 'SHIPPED', note: p.note || (p.courier ? `Dispatched via ${p.courier}` : '') });
    }
    case 'COD_PAYMENT':
      return applyCodPayment(order, { ...common, paymentStatus: p.paymentStatus, note: p.note });
    case 'ISSUE_INVOICE':
      return applyIssueInvoice(order, common);
    case 'SYNC_PAYMENT':
      return applyPaymentSync(order, common);
    case 'RETURN':
      return applyReturnDecision(order, { ...common, status: p.returnStatus, resolution: p.resolution });
    case 'NOTE':
      return applyAdminNote(order, { ...common, note: p.note, mode: p.mode });
    case 'RESEND_EMAIL': {
      if (!order.customerEmail) throw httpError(400, 'No customer e-mail on this order');
      const kind = p.emailType;
      if (kind === 'CONFIRMATION') {
        if (order.orderStatus === 'PENDING_PAYMENT' || order.orderStatus === 'CANCELLED') throw httpError(400, 'Order is not confirmed');
        ctx.mail.add(() => sendOrderConfirmation(order));
      } else if (kind === 'SHIPPED') {
        if (!['SHIPPED', 'DELIVERED'].includes(order.orderStatus)) throw httpError(400, 'Order is not shipped yet');
        ctx.mail.add(() => sendShippedMail(order));
      } else if (kind === 'DELIVERED') {
        if (order.orderStatus !== 'DELIVERED') throw httpError(400, 'Order is not delivered');
        ctx.mail.add(() => sendDeliveredMail(order));
      } else throw httpError(400, 'Choose which e-mail to send');
      return { changed: true, message: `${kind.toLowerCase()} e-mail queued to ${order.customerEmail}` };
    }
    default:
      throw httpError(400, 'Unknown action');
  }
};

const validatePayload = (action, p) => {
  if (!ACTIONS.includes(action)) throw httpError(400, `Unknown bulk action. Use one of: ${ACTIONS.join(', ')}`);
  if (action === 'STATUS') {
    if (!STATUS_LABEL[p.status] || p.status === 'REFUNDED' || p.status === 'PENDING_PAYMENT') throw httpError(400, 'Choose a valid new status.');
    if (p.status === 'CANCELLED' && p.confirm !== 'CANCEL') throw httpError(400, 'Type CANCEL to confirm cancelling orders in bulk.');
  }
  if (action === 'SHIP' && p.courier && String(p.courier).length > 60) throw httpError(400, 'Courier name is too long.');
  if (action === 'COD_PAYMENT' && !['PAID', 'PENDING', 'FAILED'].includes(p.paymentStatus)) throw httpError(400, 'Choose a payment status.');
  if (action === 'RETURN' && !['APPROVED', 'REJECTED', 'CLOSED'].includes(p.returnStatus)) throw httpError(400, 'Choose approve, reject or close.');
  if (action === 'NOTE' && !String(p.note || '').trim()) throw httpError(400, 'Write the note to add.');
  if (action === 'SYNC_PAYMENT' && p.ids?.length > 50) throw httpError(400, 'Check up to 50 PhonePe payments at a time.');
};

const summarize = (results) => ({
  total: results.length,
  updated: results.filter((r) => r.result === 'updated').length,
  skipped: results.filter((r) => r.result === 'skipped').length,
  failed: results.filter((r) => r.result === 'failed').length,
});

// @desc    Admin: run one action on many orders (each order validated on its own – one failure never stops the rest)
// @route   POST /api/v1/orders/bulk
// @body    { orderIds[], action, status?, note?, notify?, courier?, tracking?{id:awb}, requireAwb?,
//            paymentStatus?, returnStatus?, resolution?, mode?, emailType?, confirm? }
// @access  Private/Admin
export const bulkUpdateOrders = async (req, res, next) => {
  try {
    const b = req.body || {};
    const action = String(b.action || '').toUpperCase();
    const ids = [...new Set((Array.isArray(b.orderIds) ? b.orderIds : []).map(String))].filter(isId);
    if (!ids.length) throw httpError(400, 'Select at least one order.');
    if (ids.length > BULK_MAX) throw httpError(400, `You can update up to ${BULK_MAX} orders at a time.`);
    validatePayload(action, { ...b, ids });

    const found = await Order.find({ _id: { $in: ids } });
    const byId = new Map(found.map((o) => [String(o._id), o]));
    const ctx = { by: req.user.email, settings: await Setting.getStoreSettings(), mail: createMailQueue() };

    const results = [];
    const updatedOrders = [];
    // Sequential on purpose: invoice numbers stay in order and stock updates never race.
    for (const id of ids) {
      const order = byId.get(id);
      if (!order) {
        results.push({ id, orderNumber: '—', result: 'failed', message: 'Order not found' });
        continue;
      }
      const from = order.orderStatus;
      try {
        const r = await runOne(order, action, b, ctx);
        const fresh = r.order || order;
        results.push({ id, orderNumber: fresh.orderNumber, result: r.changed ? 'updated' : 'skipped', message: r.message, from, to: fresh.orderStatus });
        updatedOrders.push(fresh);
      } catch (err) {
        results.push({ id, orderNumber: order.orderNumber, result: 'failed', message: err.message, from, to: order.orderStatus });
      }
    }

    const summary = summarize(results);
    const emails = ctx.mail.size;
    ctx.mail.flush();

    await logAdminAction({
      req,
      action: 'ORDERS_BULK_UPDATED',
      resource: 'Order',
      resourceId: 'bulk',
      details: {
        action,
        status: b.status,
        paymentStatus: b.paymentStatus,
        returnStatus: b.returnStatus,
        courier: b.courier,
        ...summary,
        emails,
        orders: results.filter((r) => r.result === 'updated').map((r) => r.orderNumber).slice(0, 200),
        failures: results.filter((r) => r.result === 'failed').map((r) => `${r.orderNumber}: ${r.message}`).slice(0, 50),
      },
    });

    res.status(200).json({
      success: true,
      message: `${summary.updated} updated · ${summary.skipped} unchanged · ${summary.failed} failed${emails ? ` · ${emails} e-mail(s) queued` : ''}`,
      data: { action, ...summary, emails, results, orders: updatedOrders },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: all orders matching the current list filters or a work queue (for "select all")
// @route   GET /api/v1/orders/bulk/select?status=&paymentMethod=&search=&from=&to= | ?queue=READY_TO_SHIP
// @access  Private/Admin
export const selectOrders = async (req, res, next) => {
  try {
    const q = String(req.query.queue || '');
    if (q && !QUEUES[q]) throw httpError(400, 'Unknown queue');
    const filter = q ? QUEUES[q].filter() : buildOrderFilter(req.query);
    const [total, orders] = await Promise.all([
      Order.countDocuments(filter),
      Order.find(filter).select(LITE_FIELDS).sort({ createdAt: q ? 1 : -1 }).limit(SELECT_MAX).lean(),
    ]);
    res.status(200).json({ success: true, total, limited: total > SELECT_MAX, max: SELECT_MAX, data: orders });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: work queue counts
// @route   GET /api/v1/orders/bulk/queues
// @access  Private/Admin
export const getQueues = async (req, res, next) => {
  try {
    const entries = await Promise.all(
      Object.entries(QUEUES).map(async ([key, qd]) => ({ key, label: qd.label, hint: qd.hint, count: await Order.countDocuments(qd.filter()) }))
    );
    res.status(200).json({ success: true, data: entries, bulkMax: BULK_MAX });
  } catch (error) {
    next(error);
  }
};

const cleanTerms = (list) =>
  [...new Set((Array.isArray(list) ? list : String(list || '').split(/[\s,;]+/)).map((t) => String(t).trim()).filter(Boolean))].slice(0, 500);

const findByRefs = async (terms) => {
  const upper = terms.map((t) => t.toUpperCase());
  const orders = await Order.find({
    $or: [
      { orderNumber: { $in: upper } },
      { 'invoice.number': { $in: [...terms, ...upper] } },
      { trackingId: { $in: terms } },
      { 'paymentInfo.merchantOrderId': { $in: terms } },
      { 'paymentInfo.transactionId': { $in: terms } },
    ],
  });
  const match = (o, t) => {
    const T = t.toUpperCase();
    return (
      o.orderNumber === T ||
      (o.invoice?.number && o.invoice.number.toUpperCase() === T) ||
      o.trackingId === t ||
      o.paymentInfo?.merchantOrderId === t ||
      o.paymentInfo?.transactionId === t
    );
  };
  return { orders, match };
};

// @desc    Admin: find orders from a pasted list (order no., invoice no., AWB, PhonePe ids)
// @route   POST /api/v1/orders/bulk/lookup   { terms: string[] | "JR-1, JR-2 …" }
// @access  Private/Admin
export const lookupOrders = async (req, res, next) => {
  try {
    const terms = cleanTerms(req.body?.terms);
    if (!terms.length) throw httpError(400, 'Paste at least one order number, invoice number or AWB.');
    const { orders, match } = await findByRefs(terms);
    const missing = terms.filter((t) => !orders.some((o) => match(o, t)));
    const ordered = [];
    for (const t of terms) {
      for (const o of orders) if (match(o, t) && !ordered.includes(o)) ordered.push(o);
    }
    const lite = await Order.find({ _id: { $in: ordered.map((o) => o._id) } }).select(LITE_FIELDS).lean();
    const byId = new Map(lite.map((o) => [String(o._id), o]));
    res.status(200).json({ success: true, data: ordered.map((o) => byId.get(String(o._id))).filter(Boolean), missing });
  } catch (error) {
    next(error);
  }
};

const ROW_STATUSES = ['SHIPPED', 'DELIVERED', 'PROCESSING', 'CANCELLED', 'REFUND_REQUESTED'];

// @desc    Admin: courier sheet – every row: order ref + courier + AWB (+ optional status DELIVERED, + COD collected)
// @route   POST /api/v1/orders/bulk/dispatch
// @body    { rows: [{ ref, courier, trackingId, trackingUrl, status, codCollected }], defaultCourier, notify, dryRun }
// @access  Private/Admin
export const bulkDispatch = async (req, res, next) => {
  try {
    const b = req.body || {};
    const rows = (Array.isArray(b.rows) ? b.rows : []).slice(0, 501);
    if (!rows.length) throw httpError(400, 'The sheet has no rows.');
    if (rows.length > 500) throw httpError(400, 'Upload up to 500 rows at a time.');

    const refs = cleanTerms(rows.map((r) => r.ref));
    const { orders, match } = await findByRefs(refs);
    const ctx = { by: req.user.email, settings: await Setting.getStoreSettings(), mail: createMailQueue() };
    const notify = b.notify !== false;
    const results = [];
    const touched = new Set();

    for (const [i, raw] of rows.entries()) {
      const ref = String(raw.ref || '').trim();
      const line = i + 1;
      const order = ref ? orders.find((o) => match(o, ref)) : null;
      const status = String(raw.status || '').trim().toUpperCase().replace(/\s+/g, '_');
      const courier = String(raw.courier || b.defaultCourier || '').trim();
      const awb = String(raw.trackingId || '').trim();
      const base = { line, ref, orderNumber: order?.orderNumber || '—', id: order ? String(order._id) : null };

      if (!ref) {
        results.push({ ...base, result: 'failed', message: 'Order number missing' });
        continue;
      }
      if (!order) {
        results.push({ ...base, result: 'failed', message: 'Order not found' });
        continue;
      }
      if (touched.has(String(order._id))) {
        results.push({ ...base, result: 'skipped', message: 'Duplicate row – order already handled above' });
        continue;
      }
      if (status && !ROW_STATUSES.includes(status)) {
        results.push({ ...base, result: 'failed', message: `Unknown status "${raw.status}" – use ${ROW_STATUSES.join(' / ')}` });
        continue;
      }
      if (status === 'CANCELLED') {
        results.push({ ...base, result: 'failed', message: 'Cancel from the Orders page (needs confirmation)' });
        continue;
      }
      if (awb && !courier) {
        results.push({ ...base, result: 'failed', message: 'Courier missing for this AWB' });
        continue;
      }
      touched.add(String(order._id));
      const from = order.orderStatus;

      if (b.dryRun) {
        results.push({ ...base, result: 'ready', message: [awb ? `${courier} ${awb}` : '', status ? `→ ${STATUS_LABEL[status]}` : ''].filter(Boolean).join(' ') || 'No change', from });
        continue;
      }

      const messages = [];
      let changed = false;
      try {
        if (awb) {
          const r = await applyTracking(order, { courier, trackingId: awb, trackingUrl: raw.trackingUrl, by: ctx.by, settings: ctx.settings, notify, mail: ctx.mail.add });
          changed = changed || r.changed;
          messages.push(r.message);
        }
        if (status && status !== order.orderStatus) {
          const r = await applyStatusChange(order, { status, note: raw.note, by: ctx.by, settings: ctx.settings, notify, mail: ctx.mail.add });
          changed = changed || r.changed;
          messages.push(r.message);
        }
        if (/^(y|yes|true|1|paid|collected)$/i.test(String(raw.codCollected || '')) && order.paymentMethod === 'COD' && order.paymentStatus !== 'PAID') {
          const r = await applyCodPayment(order, { paymentStatus: 'PAID', by: ctx.by, settings: ctx.settings });
          changed = changed || r.changed;
          messages.push(r.message);
        }
        if (!awb && !status && !raw.codCollected) messages.push('Nothing to change on this row');
        results.push({ ...base, result: changed ? 'updated' : 'skipped', message: messages.join(' · ') || 'No change', from, to: order.orderStatus });
      } catch (err) {
        results.push({ ...base, result: 'failed', message: [...messages, err.message].join(' · '), from, to: order.orderStatus });
      }
    }

    const summary = summarize(results.map((r) => ({ ...r, result: r.result === 'ready' ? 'updated' : r.result })));
    const emails = ctx.mail.size;
    ctx.mail.flush();

    if (!b.dryRun) {
      await logAdminAction({
        req,
        action: 'ORDERS_BULK_DISPATCHED',
        resource: 'Order',
        resourceId: 'bulk',
        details: { rows: rows.length, ...summary, emails, failures: results.filter((r) => r.result === 'failed').map((r) => `Row ${r.line} ${r.ref}: ${r.message}`).slice(0, 50) },
      });
    }

    res.status(200).json({
      success: true,
      message: b.dryRun
        ? `${summary.updated} row(s) ready · ${summary.skipped} skipped · ${summary.failed} with problems`
        : `${summary.updated} updated · ${summary.skipped} unchanged · ${summary.failed} failed${emails ? ` · ${emails} e-mail(s) queued` : ''}`,
      data: { dryRun: Boolean(b.dryRun), ...summary, emails, results },
    });
  } catch (error) {
    next(error);
  }
};
