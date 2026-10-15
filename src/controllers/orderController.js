import { Order, ORDER_STATUSES } from '../models/Order.js';
import { Setting } from '../models/Setting.js';
import { logAdminAction } from '../utils/auditLogger.js';
import { escapeRegex, maskName, maskPhone, parseDateRange } from '../utils/helpers.js';
import { cancelOrder } from '../services/orderLifecycle.js';
import { issueInvoice, previewInvoice } from '../services/invoiceService.js';
import { renderInvoicePdf } from '../services/pdf/invoicePdf.js';
import { renderShippingLabelPdf } from '../services/pdf/labelPdf.js';
import { composeSheets, mergePdfs, PAPER_SIZES, PER_PAGE_OPTIONS } from '../services/pdf/printSheet.js';
import { httpError } from '../services/pricingService.js';
import { sendMail, sendShippedMail, sendDeliveredMail } from '../services/mailer.js';
import { ContactInquiry } from '../models/ContactInquiry.js';
import { RETURN_WINDOW_DAYS, RETURN_REASONS } from '../config/productTypes.js';

const deliveredAtOf = (o) => {
  const h = [...(o.statusHistory || [])].reverse().find((x) => x.status === 'DELIVERED');
  return h ? new Date(h.timestamp) : null;
};
const returnWindowEnd = (o) => {
  const d = deliveredAtOf(o);
  return d ? new Date(d.getTime() + RETURN_WINDOW_DAYS * 86400000) : null;
};

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
  const windowEnd = returnWindowEnd(o);
  o.returnWindowEndsAt = windowEnd;
  o.canRequestReturn = o.orderStatus === 'DELIVERED' && !o.returnRequest && Boolean(windowEnd) && windowEnd > new Date();
  o.items = (o.items || []).map((i) => ({ ...i, returnable: i.returnable !== false }));
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

// @desc    Customer: report a problem / request return or replacement (within the policy window)
// @route   POST /api/v1/orders/my-orders/:orderNumber/return-request
// @access  Private
export const requestReturn = async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber, user: req.user._id });
    if (!order) throw httpError(404, 'Order not found');
    if (order.orderStatus !== 'DELIVERED') throw httpError(400, 'Returns can be requested once the order is delivered.');
    if (order.returnRequest) throw httpError(400, 'A request is already open for this order. Our team will contact you shortly.');
    const end = returnWindowEnd(order);
    if (!end || end < new Date()) {
      throw httpError(400, `The ${RETURN_WINDOW_DAYS}-day return window for this order has ended. For help, write to care@jayrup.in.`);
    }

    const reason = String(req.body.reason || '').toUpperCase();
    if (!RETURN_REASONS[reason]) throw httpError(400, 'Please choose a reason.');
    const message = String(req.body.message || '').trim().slice(0, 1500);
    const preferredResolution = req.body.preferredResolution === 'REFUND' ? 'REFUND' : 'REPLACEMENT';

    const wanted = Array.isArray(req.body.items) && req.body.items.length ? req.body.items.map(String) : order.items.map((i) => i.variant?.sku || i.sku);
    const items = order.items.filter((i) => wanted.includes(i.variant?.sku || i.sku));
    if (!items.length) throw httpError(400, 'Please select at least one item.');

    if (!RETURN_REASONS[reason].anyItem) {
      const blocked = items.filter((i) => i.returnable === false);
      if (blocked.length) {
        throw httpError(
          400,
          `${blocked.map((i) => i.name).join(', ')} ${blocked.length > 1 ? 'are' : 'is'} not returnable once delivered (hygiene / sealed product). Returns for these are accepted only if damaged, leaking or wrong.`
        );
      }
    }
    if (['DAMAGED', 'LEAKING', 'SEAL_BROKEN', 'WRONG_ITEM'].includes(reason) && message.length < 10) {
      throw httpError(400, 'Please describe the problem (and keep photos / unboxing video ready – our team will ask for them).');
    }

    order.returnRequest = {
      reason,
      message,
      preferredResolution,
      items: items.map((i) => ({ sku: i.variant?.sku || i.sku, name: `${i.name}${i.variant?.title ? ` (${i.variant.title})` : ''}`, quantity: i.quantity })),
      status: 'OPEN',
      requestedAt: new Date(),
    };
    order.statusHistory.push({ status: order.orderStatus, timestamp: new Date(), note: `Customer requested ${preferredResolution.toLowerCase()}: ${RETURN_REASONS[reason].label}`, updatedBy: 'CUSTOMER' });
    await order.save();

    const contact = order.shippingAddress || {};
    ContactInquiry.create({
      name: contact.fullName || req.user.name || 'Customer',
      email: order.customerEmail || contact.email || req.user.email,
      phone: contact.phone || '',
      orderNumber: order.orderNumber,
      subject: 'Return & Replacement Request',
      message: `[${RETURN_REASONS[reason].label}] Wants: ${preferredResolution}\nItems: ${order.returnRequest.items.map((i) => `${i.name} × ${i.quantity}`).join(', ')}\n\n${message || '(no message)'}`,
    }).catch(() => {});
    sendMail({
      to: process.env.ADMIN_NOTIFY_EMAIL || process.env.SMTP_USER,
      subject: `Return request – ${order.orderNumber} (${RETURN_REASONS[reason].label})`,
      html: `<p><b>${order.orderNumber}</b> – ${RETURN_REASONS[reason].label}<br/>Wants: ${preferredResolution}<br/>Items: ${order.returnRequest.items.map((i) => `${i.name} × ${i.quantity}`).join(', ')}</p><p>${message.replace(/</g, '&lt;')}</p>`,
    }).catch(() => {});

    res.status(200).json({
      success: true,
      message: 'Request received. Our team will contact you within 24–48 hours with the next steps.',
      data: sanitizeForCustomer(order),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: update a return request (approve / reject / close)
// @route   PUT /api/v1/orders/:id/return-request
// @access  Private/Admin
export const updateReturnRequest = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) throw httpError(404, 'Order not found');
    if (!order.returnRequest) throw httpError(400, 'This order has no return request.');
    const status = String(req.body.status || '').toUpperCase();
    if (!['OPEN', 'APPROVED', 'REJECTED', 'CLOSED'].includes(status)) throw httpError(400, 'Invalid status');
    order.returnRequest.status = status;
    order.returnRequest.resolution = String(req.body.resolution || '').slice(0, 1000);
    if (status !== 'OPEN') order.returnRequest.resolvedAt = new Date();
    order.markModified('returnRequest');
    order.statusHistory.push({
      status: order.orderStatus,
      timestamp: new Date(),
      note: `Return request ${status.toLowerCase()}${order.returnRequest.resolution ? `: ${order.returnRequest.resolution}` : ''}`,
      updatedBy: req.user.email,
    });
    await order.save();
    await logAdminAction({ req, action: 'RETURN_REQUEST_UPDATED', resource: 'Order', resourceId: order._id.toString(), details: { status } });
    if (order.customerEmail && status !== 'OPEN') {
      sendMail({
        to: order.customerEmail,
        subject: `Update on your request – ${order.orderNumber}`,
        html: `<p>Hi ${String(order.shippingAddress?.fullName || '').split(' ')[0] || 'there'},</p><p>Your return / replacement request for order <b>${order.orderNumber}</b> has been <b>${status.toLowerCase()}</b>.</p>${order.returnRequest.resolution ? `<p>${order.returnRequest.resolution.replace(/</g, '&lt;')}</p>` : ''}<p>— Team Jayrup · care@jayrup.in</p>`,
      }).catch(() => {});
    }
    res.status(200).json({ success: true, message: `Return request ${status.toLowerCase()}.`, data: order });
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

// @desc    Admin: print options for the bulk print dialog
// @route   GET /api/v1/orders/print/options
// @access  Private/Admin
export const getPrintOptions = (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      papers: Object.entries(PAPER_SIZES).map(([key, p]) => ({ key, label: p.label, widthPt: p.size[0], heightPt: p.size[1] })),
      perPage: PER_PAGE_OPTIONS,
      maxOrders: BULK_PRINT_MAX,
    },
  });
};

const BULK_PRINT_MAX = 200;
const COPY_LABELS = { ORIGINAL: 'ORIGINAL FOR RECIPIENT', DUPLICATE: 'DUPLICATE FOR TRANSPORTER', TRIPLICATE: 'TRIPLICATE FOR SUPPLIER' };

// @desc    Admin: many invoices / shipping labels in ONE printable PDF, several per sheet
// @route   POST /api/v1/orders/print
// @body    { orderIds[], documents: INVOICE|LABEL|BOTH, copies: [ORIGINAL,DUPLICATE,TRIPLICATE],
//            paper, orientation: auto|portrait|landscape, perPage, labelPaper, labelsPerPage,
//            margin (mm), gap (mm), cutLines, issueMissing, sort: selected|date|invoice }
// @access  Private/Admin
export const bulkPrint = async (req, res, next) => {
  try {
    const b = req.body || {};
    const ids = [...new Set((Array.isArray(b.orderIds) ? b.orderIds : []).map(String))].filter((id) => /^[0-9a-fA-F]{24}$/.test(id));
    if (!ids.length) throw httpError(400, 'Select at least one order to print.');
    if (ids.length > BULK_PRINT_MAX) throw httpError(400, `You can print up to ${BULK_PRINT_MAX} orders at a time.`);

    const documents = ['INVOICE', 'LABEL', 'BOTH'].includes(b.documents) ? b.documents : 'INVOICE';
    const wantInvoices = documents !== 'LABEL';
    const wantLabels = documents !== 'INVOICE';
    const copies = (Array.isArray(b.copies) ? b.copies : ['ORIGINAL']).filter((c) => COPY_LABELS[c]);
    if (!copies.length) copies.push('ORIGINAL');
    const paper = PAPER_SIZES[b.paper] ? b.paper : 'A4';
    const labelPaper = PAPER_SIZES[b.labelPaper] ? b.labelPaper : paper;
    const orientation = ['auto', 'portrait', 'landscape'].includes(b.orientation) ? b.orientation : 'auto';
    const perPage = PER_PAGE_OPTIONS.includes(Number(b.perPage)) ? Number(b.perPage) : 1;
    const labelsPerPage = PER_PAGE_OPTIONS.includes(Number(b.labelsPerPage)) ? Number(b.labelsPerPage) : perPage;
    const margin = Math.min(25, Math.max(0, Number(b.margin ?? 6)));
    const gap = Math.min(20, Math.max(0, Number(b.gap ?? 4)));
    const cutLines = b.cutLines !== false;

    const found = await Order.find({ _id: { $in: ids } });
    const byId = new Map(found.map((o) => [String(o._id), o]));
    let orders = ids.map((id) => byId.get(id)).filter(Boolean);
    if (b.sort === 'date') orders.sort((x, y) => new Date(x.createdAt) - new Date(y.createdAt));
    if (b.sort === 'invoice') orders.sort((x, y) => (x.invoice?.sequence || 1e12) - (y.invoice?.sequence || 1e12));

    const settings = await Setting.getStoreSettings();
    const skipped = [];
    const issued = [];
    const invoicePdfs = [];
    const labelPdfs = [];

    for (const order of orders) {
      if (wantInvoices) {
        if (!order.invoice?.number) {
          if (!b.issueMissing) {
            skipped.push(`${order.orderNumber}: no invoice yet`);
          } else if (['PENDING_PAYMENT', 'CANCELLED'].includes(order.orderStatus)) {
            skipped.push(`${order.orderNumber}: ${order.orderStatus === 'CANCELLED' ? 'cancelled' : 'not paid'}`);
          } else {
            await issueInvoice(order, { settings });
            await order.save();
            issued.push(order.invoice.number);
          }
        }
        if (order.invoice?.number) {
          for (const c of copies) invoicePdfs.push(await renderInvoicePdf(order, { copyLabel: COPY_LABELS[c], settings }));
        }
      }
      if (wantLabels) labelPdfs.push(await renderShippingLabelPdf(order, { settings }));
    }

    if (!invoicePdfs.length && !labelPdfs.length) {
      throw httpError(400, skipped.length ? `Nothing to print – ${skipped.join('; ')}. Tick “Issue missing invoices” to create them.` : 'Nothing to print.');
    }

    const parts = [];
    if (invoicePdfs.length) parts.push(await composeSheets(invoicePdfs, { paper, orientation, perPage, margin, gap, cutLines, title: 'Jayrup invoices' }));
    if (labelPdfs.length) parts.push(await composeSheets(labelPdfs, { paper: labelPaper, orientation, perPage: labelsPerPage, margin, gap, cutLines, title: 'Jayrup shipping labels' }));
    const pdf = parts.length === 1 ? parts[0] : await mergePdfs(parts, 'Jayrup invoices & labels');

    await logAdminAction({
      req,
      action: 'ORDERS_BULK_PRINTED',
      resource: 'Order',
      resourceId: 'bulk',
      details: { orders: orders.length, documents, copies, paper, perPage, issued, skipped: skipped.length },
    });

    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    res.set('X-Print-Summary', encodeURIComponent(JSON.stringify({ orders: orders.length, invoices: invoicePdfs.length, labels: labelPdfs.length, issued: issued.length, skipped })));
    sendPdf(res, pdf, `Jayrup-${documents === 'LABEL' ? 'labels' : 'invoices'}-${stamp}.pdf`, true);
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
    if (status === 'RETURN_OPEN') filter['returnRequest.status'] = 'OPEN';
    else if (status && ORDER_STATUSES.includes(status)) filter.orderStatus = status;
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
    const [total, orders, counts, openReturns] = await Promise.all([
      Order.countDocuments(filter),
      Order.find(filter).populate('user', 'name email phone').sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim),
      Order.aggregate([{ $group: { _id: '$orderStatus', n: { $sum: 1 } } }]),
      Order.countDocuments({ 'returnRequest.status': 'OPEN' }),
    ]);

    res.status(200).json({
      success: true,
      count: orders.length,
      total,
      totalPages: Math.ceil(total / lim),
      currentPage: pg,
      statusCounts: { ...Object.fromEntries(counts.map((c) => [c._id, c.n])), RETURN_OPEN: openReturns },
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
