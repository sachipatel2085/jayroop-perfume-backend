import nodemailer from 'nodemailer';
import { formatINR, formatDateIN } from '../utils/helpers.js';

/**
 * Transactional e-mail (order confirmation, shipping, cancellation, password reset).
 * Configure with SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / MAIL_FROM
 * (Hostinger: smtp.hostinger.com, port 465, user care@jayrup.in).
 * If SMTP is not configured, e-mails are skipped silently (logged in development).
 */
let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  const port = Number(process.env.SMTP_PORT || 465);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
};

const siteUrl = () => (process.env.CLIENT_URL || 'https://jayrup.in').replace(/\/+$/, '');

const layout = (title, body) => `<!doctype html><html><body style="margin:0;background:#f6f3ec;font-family:Arial,Helvetica,sans-serif;color:#1f1b14">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3ec;padding:24px 0"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #eadfc6">
<tr><td style="background:#0b0b0d;padding:22px 28px;text-align:left">
<img src="${siteUrl()}/logo-512.png" width="44" height="44" alt="Jayrup" style="vertical-align:middle;border:0">
<span style="color:#d4af37;font-size:20px;font-weight:bold;letter-spacing:3px;vertical-align:middle;margin-left:10px">JAYRUP</span>
</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 14px;font-size:20px;color:#1f1b14">${title}</h1>
${body}
</td></tr>
<tr><td style="background:#faf7f0;padding:18px 28px;font-size:12px;color:#7a7060;border-top:1px solid #eee3cb">
Jayrup · G-28, Metropolis Complex, Gambhoi–Bhiloda Road, Gambhoi, Himatnagar, Sabarkantha, Gujarat 383030<br>
care@jayrup.in · +91 94081 33100 · <a href="${siteUrl()}" style="color:#9a7b1c">jayrup.in</a>
</td></tr></table></td></tr></table></body></html>`;

const button = (href, label) =>
  `<a href="${href}" style="display:inline-block;background:#d4af37;color:#111;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px;font-size:14px">${label}</a>`;

const itemsTable = (order) => `
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;margin:16px 0">
${order.items
  .map(
    (i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #f0e8d6">${i.name}${i.variant?.title ? ` <span style="color:#8a7f6a">(${i.variant.title})</span>` : ''} × ${i.quantity}</td>
<td style="padding:8px 0;border-bottom:1px solid #f0e8d6;text-align:right">${formatINR(i.subtotal)}</td></tr>`
  )
  .join('')}
${order.discount ? `<tr><td style="padding:6px 0;color:#2e7d32">Discount${order.appliedCoupon?.code ? ` (${order.appliedCoupon.code})` : ''}</td><td style="text-align:right;color:#2e7d32">−${formatINR(order.discount)}</td></tr>` : ''}
<tr><td style="padding:6px 0">Shipping</td><td style="text-align:right">${order.shipping ? formatINR(order.shipping) : 'FREE'}</td></tr>
${order.codFee ? `<tr><td style="padding:6px 0">COD charges</td><td style="text-align:right">${formatINR(order.codFee)}</td></tr>` : ''}
<tr><td style="padding:10px 0;font-weight:bold;font-size:15px;border-top:2px solid #d4af37">Total</td><td style="text-align:right;font-weight:bold;font-size:15px;border-top:2px solid #d4af37">${formatINR(order.total)}</td></tr>
</table>`;

export const sendMail = async ({ to, subject, html }) => {
  const t = getTransporter();
  if (!t || !to) {
    if (process.env.NODE_ENV !== 'production') console.log(`[Mail skipped] ${subject} → ${to || 'no recipient'}`);
    return false;
  }
  try {
    await t.sendMail({
      from: process.env.MAIL_FROM || `Jayrup <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error(`[Mail error] ${subject}: ${err.message}`);
    return false;
  }
};

export const sendOrderConfirmation = (order) =>
  sendMail({
    to: order.customerEmail,
    subject: `Order confirmed – ${order.orderNumber} | Jayrup`,
    html: layout(
      `Thank you, ${order.shippingAddress?.fullName?.split(' ')[0] || 'there'}! Your order is confirmed.`,
      `<p style="font-size:14px;line-height:1.6;margin:0">Order <b>${order.orderNumber}</b> placed on ${formatDateIN(order.createdAt)}.
       Payment: <b>${order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Paid online via PhonePe'}</b>.</p>
       ${itemsTable(order)}
       <p style="font-size:13px;color:#5d5546;margin:0 0 18px">Delivering to: ${order.shippingAddress?.fullName}, ${order.shippingAddress?.addressLine1}, ${order.shippingAddress?.city}, ${order.shippingAddress?.state} – ${order.shippingAddress?.postalCode}</p>
       ${button(`${siteUrl()}/account/orders/${order.orderNumber}`, 'View order & invoice')}`
    ),
  });

export const sendShippedMail = (order) =>
  sendMail({
    to: order.customerEmail,
    subject: `Your order ${order.orderNumber} has been shipped | Jayrup`,
    html: layout(
      'Your order is on its way 🚚',
      `<p style="font-size:14px;line-height:1.6">Order <b>${order.orderNumber}</b> was handed over to <b>${order.courier || 'our courier partner'}</b>.
       Tracking / AWB: <b>${order.trackingId || '—'}</b>. Tracking can take 24–48 hours to activate.</p>
       ${order.trackingUrl ? `<p>${button(order.trackingUrl, 'Track with courier')}</p>` : ''}
       <p>${button(`${siteUrl()}/track-order/${order.orderNumber}`, 'Track on jayrup.in')}</p>`
    ),
  });

export const sendDeliveredMail = (order) =>
  sendMail({
    to: order.customerEmail,
    subject: `Delivered – ${order.orderNumber} | Jayrup`,
    html: layout(
      'Your order has been delivered ✨',
      `<p style="font-size:14px;line-height:1.6">We hope you love your Jayrup products. If anything is damaged or incorrect, please contact us within 3 days of delivery with photos.</p>
       <p>${button(`${siteUrl()}/account/orders/${order.orderNumber}`, 'Rate your products')}</p>`
    ),
  });

export const sendCancelledMail = (order) =>
  sendMail({
    to: order.customerEmail,
    subject: `Order ${order.orderNumber} cancelled | Jayrup`,
    html: layout(
      'Your order has been cancelled',
      `<p style="font-size:14px;line-height:1.6">Order <b>${order.orderNumber}</b> has been cancelled${order.cancellationReason ? ` (${order.cancellationReason})` : ''}.
      ${order.paymentMethod === 'ONLINE' && order.paymentStatus !== 'PENDING' ? 'Any amount paid online will be refunded to the original payment method; refunds can take up to 15 days to reflect.' : ''}</p>`
    ),
  });

export const sendPasswordResetMail = (user, rawToken) =>
  sendMail({
    to: user.email,
    subject: 'Reset your Jayrup password',
    html: layout(
      'Reset your password',
      `<p style="font-size:14px;line-height:1.6">We received a request to reset the password for ${user.email}. This link is valid for 30 minutes.</p>
       <p>${button(`${siteUrl()}/reset-password/${rawToken}`, 'Choose a new password')}</p>
       <p style="font-size:12px;color:#7a7060">If you did not request this, you can safely ignore this e-mail.</p>`
    ),
  });

export const sendAdminNewOrderMail = (order) => {
  const to = process.env.ADMIN_NOTIFY_EMAIL;
  if (!to) return Promise.resolve(false);
  return sendMail({
    to,
    subject: `🛒 New ${order.paymentMethod} order ${order.orderNumber} – ${formatINR(order.total)}`,
    html: layout(`New order ${order.orderNumber}`, `${itemsTable(order)}<p>${button(`${siteUrl()}/admin/orders?search=${order.orderNumber}`, 'Open in admin')}</p>`),
  });
};
