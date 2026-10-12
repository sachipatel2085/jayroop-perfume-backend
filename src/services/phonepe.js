/**
 * PhonePe Payment Gateway service
 * ------------------------------------------------------------------
 * Supports both PhonePe PG generations behind ONE normalised interface:
 *
 *  • v2 "Standard Checkout" (default, all merchants onboarded 2024+)
 *      OAuth (client_id / client_secret / client_version) → O-Bearer token
 *      POST /checkout/v2/pay   GET /checkout/v2/order/{id}/status
 *      POST /payments/v2/refund   GET /payments/v2/refund/{id}/status
 *      Webhook auth header = SHA256(username:password)
 *
 *  • v1 "PG Pay Page" (legacy salt-key credentials, e.g. older WooCommerce setups)
 *      X-VERIFY = SHA256(base64Payload + apiPath + saltKey) + "###" + saltIndex
 *
 * Every function returns a normalised object so controllers never care which version is live:
 *   { state: 'COMPLETED' | 'FAILED' | 'PENDING', amount (paise), transactionId, paymentMode, gatewayOrderId, raw }
 *
 * ENV
 *   PHONEPE_ENV=SANDBOX | PRODUCTION
 *   PHONEPE_API_VERSION=v2 | v1                (default v2)
 *   PHONEPE_CLIENT_ID / PHONEPE_CLIENT_SECRET / PHONEPE_CLIENT_VERSION      (v2)
 *   PHONEPE_MERCHANT_ID / PHONEPE_SALT_KEY / PHONEPE_SALT_INDEX             (v1)
 *   PHONEPE_WEBHOOK_USERNAME / PHONEPE_WEBHOOK_PASSWORD                     (v2 webhook)
 *   PHONEPE_MOCK=true   → local simulator, refused when NODE_ENV=production
 */
import crypto from 'crypto';

const env = () => (process.env.PHONEPE_ENV || 'SANDBOX').toUpperCase();
const isProd = () => env() === 'PRODUCTION';
export const apiVersion = () => (process.env.PHONEPE_API_VERSION || 'v2').toLowerCase();

const HOSTS = {
  v2: {
    SANDBOX: {
      auth: 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token',
      pg: 'https://api-preprod.phonepe.com/apis/pg-sandbox',
    },
    PRODUCTION: {
      auth: 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token',
      pg: 'https://api.phonepe.com/apis/pg',
    },
  },
  v1: {
    SANDBOX: { pg: 'https://api-preprod.phonepe.com/apis/pg-sandbox' },
    PRODUCTION: { pg: 'https://api.phonepe.com/apis/hermes' },
  },
};

const hosts = () => HOSTS[apiVersion()]?.[isProd() ? 'PRODUCTION' : 'SANDBOX'] || HOSTS.v2.SANDBOX;

export const isMockMode = () =>
  String(process.env.PHONEPE_MOCK || '').toLowerCase() === 'true' && process.env.NODE_ENV !== 'production';

export const isConfigured = () => {
  if (isMockMode()) return true;
  if (apiVersion() === 'v1') {
    return Boolean(process.env.PHONEPE_MERCHANT_ID && process.env.PHONEPE_SALT_KEY);
  }
  return Boolean(process.env.PHONEPE_CLIENT_ID && process.env.PHONEPE_CLIENT_SECRET);
};

export class PhonePeError extends Error {
  constructor(message, { status = 502, code = 'PHONEPE_ERROR', details = null } = {}) {
    super(message);
    this.name = 'PhonePeError';
    this.statusCode = status;
    this.code = code;
    this.details = details;
  }
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

const safeEqual = (a, b) => {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
};

const httpJson = async (url, { method = 'GET', headers = {}, body, timeoutMs = 20000 } = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method, headers, body, signal: controller.signal });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    throw new PhonePeError(
      err.name === 'AbortError' ? 'PhonePe gateway timed out. Please try again.' : `PhonePe unreachable: ${err.message}`,
      { status: 504, code: 'PHONEPE_NETWORK' }
    );
  } finally {
    clearTimeout(timer);
  }
};

// ════════════════════════════ v2 — OAuth token cache ════════════════════════════
let tokenCache = { token: null, expiresAt: 0 };

const getAccessToken = async () => {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache.token && tokenCache.expiresAt - 60 > now) return tokenCache.token;

  const form = new URLSearchParams({
    client_id: process.env.PHONEPE_CLIENT_ID || '',
    client_version: String(process.env.PHONEPE_CLIENT_VERSION || '1'),
    client_secret: process.env.PHONEPE_CLIENT_SECRET || '',
    grant_type: 'client_credentials',
  });

  const { ok, status, data } = await httpJson(hosts().auth, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  if (!ok || !data?.access_token) {
    tokenCache = { token: null, expiresAt: 0 };
    throw new PhonePeError('PhonePe authorisation failed. Check PHONEPE_CLIENT_ID / SECRET / VERSION and PHONEPE_ENV.', {
      status: 502,
      code: 'PHONEPE_AUTH',
      details: { httpStatus: status, response: data },
    });
  }

  tokenCache = {
    token: data.access_token,
    expiresAt: Number(data.expires_at) || now + 3000,
  };
  return tokenCache.token;
};

const v2Headers = async () => ({
  'Content-Type': 'application/json',
  Authorization: `O-Bearer ${await getAccessToken()}`,
});

const normaliseV2Status = (data) => {
  const attempts = Array.isArray(data?.paymentDetails) ? data.paymentDetails : [];
  const success = attempts.find((p) => p.state === 'COMPLETED') || attempts[attempts.length - 1] || {};
  return {
    state: data?.state || 'PENDING',
    amount: Number(data?.amount) || 0,
    transactionId: success.transactionId || '',
    paymentMode: success.paymentMode || '',
    gatewayOrderId: data?.orderId || '',
    errorCode: data?.errorCode || success.errorCode || '',
    raw: data,
  };
};

// ════════════════════════════ v1 — salt key helpers ════════════════════════════
const v1Checksum = (payloadOrPath, path = '') =>
  `${sha256(payloadOrPath + path + (process.env.PHONEPE_SALT_KEY || ''))}###${process.env.PHONEPE_SALT_INDEX || '1'}`;

const normaliseV1Status = (data) => {
  const d = data?.data || {};
  let state = d.state || 'PENDING';
  if (!d.state) {
    if (data?.code === 'PAYMENT_SUCCESS') state = 'COMPLETED';
    else if (['PAYMENT_ERROR', 'PAYMENT_DECLINED', 'TIMED_OUT', 'TRANSACTION_NOT_FOUND'].includes(data?.code)) state = 'FAILED';
  }
  return {
    state,
    amount: Number(d.amount) || 0,
    transactionId: d.transactionId || '',
    paymentMode: d.paymentInstrument?.type || '',
    gatewayOrderId: d.merchantTransactionId || '',
    errorCode: data?.code || '',
    raw: data,
  };
};

// ════════════════════════════ Public API ════════════════════════════

/**
 * Create a hosted checkout session.
 * @returns {Promise<{ redirectUrl: string, gatewayOrderId: string, state: string }>}
 */
export const createPayment = async ({
  merchantOrderId,
  amountPaise,
  redirectUrl,
  callbackUrl,
  customer = {},
  meta = {},
  expireAfterSeconds = 1200,
}) => {
  if (!isConfigured()) {
    throw new PhonePeError('Online payments are not configured yet. Please choose Cash on Delivery or try later.', {
      status: 503,
      code: 'PHONEPE_NOT_CONFIGURED',
    });
  }
  if (!Number.isInteger(amountPaise) || amountPaise < 100) {
    throw new PhonePeError('Invalid payable amount (minimum ₹1).', { status: 400, code: 'PHONEPE_AMOUNT' });
  }

  if (isMockMode()) {
    const url = new URL(redirectUrl);
    url.searchParams.set('mock', '1');
    return { redirectUrl: url.toString(), gatewayOrderId: `MOCK-${merchantOrderId}`, state: 'PENDING' };
  }

  if (apiVersion() === 'v1') {
    const payload = {
      merchantId: process.env.PHONEPE_MERCHANT_ID,
      merchantTransactionId: merchantOrderId,
      merchantUserId: String(customer.userId || 'GUEST').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 36) || 'GUEST',
      amount: amountPaise,
      redirectUrl,
      redirectMode: 'REDIRECT',
      callbackUrl,
      mobileNumber: String(customer.phone || '').replace(/\D/g, '').slice(-10) || undefined,
      paymentInstrument: { type: 'PAY_PAGE' },
    };
    const base64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    const { ok, data } = await httpJson(`${hosts().pg}/pg/v1/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-VERIFY': v1Checksum(base64, '/pg/v1/pay') },
      body: JSON.stringify({ request: base64 }),
    });
    const url = data?.data?.instrumentResponse?.redirectInfo?.url;
    if (!ok || !data?.success || !url) {
      throw new PhonePeError(data?.message || 'Unable to start PhonePe payment.', {
        code: 'PHONEPE_CREATE',
        details: data,
      });
    }
    return { redirectUrl: url, gatewayOrderId: merchantOrderId, state: 'PENDING' };
  }

  // v2 Standard Checkout
  const metaInfo = {};
  const udf = Object.values(meta).slice(0, 5);
  udf.forEach((v, i) => {
    metaInfo[`udf${i + 1}`] = String(v ?? '').slice(0, 256);
  });

  const body = {
    merchantOrderId,
    amount: amountPaise,
    expireAfter: Math.min(Math.max(expireAfterSeconds, 300), 3600),
    metaInfo,
    paymentFlow: {
      type: 'PG_CHECKOUT',
      message: `Payment for order ${meta.orderNumber || merchantOrderId}`,
      merchantUrls: { redirectUrl },
    },
  };

  const { ok, data } = await httpJson(`${hosts().pg}/checkout/v2/pay`, {
    method: 'POST',
    headers: await v2Headers(),
    body: JSON.stringify(body),
  });

  if (!ok || !data?.redirectUrl) {
    throw new PhonePeError(data?.message || 'Unable to start PhonePe payment.', {
      code: data?.code || 'PHONEPE_CREATE',
      details: data,
    });
  }

  return { redirectUrl: data.redirectUrl, gatewayOrderId: data.orderId || '', state: data.state || 'PENDING' };
};

/**
 * Server-to-server authoritative status check. ALWAYS used before marking an order as paid.
 */
export const fetchPaymentStatus = async (merchantOrderId, { mockState } = {}) => {
  if (isMockMode()) {
    return {
      state: mockState || 'COMPLETED',
      amount: null, // filled by caller in mock mode
      transactionId: `MOCKTXN${Date.now()}`,
      paymentMode: 'UPI_MOCK',
      gatewayOrderId: `MOCK-${merchantOrderId}`,
      errorCode: '',
      raw: { mock: true },
    };
  }

  if (apiVersion() === 'v1') {
    const mid = process.env.PHONEPE_MERCHANT_ID;
    const path = `/pg/v1/status/${mid}/${merchantOrderId}`;
    const { data } = await httpJson(`${hosts().pg}${path}`, {
      headers: { 'Content-Type': 'application/json', 'X-VERIFY': v1Checksum(path), 'X-MERCHANT-ID': mid },
    });
    return normaliseV1Status(data);
  }

  const { ok, status, data } = await httpJson(
    `${hosts().pg}/checkout/v2/order/${encodeURIComponent(merchantOrderId)}/status?details=true&errorContext=true`,
    { headers: await v2Headers() }
  );
  if (!ok && status !== 404) {
    throw new PhonePeError(data?.message || 'Unable to fetch payment status.', { code: 'PHONEPE_STATUS', details: data });
  }
  if (status === 404) {
    return { state: 'FAILED', amount: 0, transactionId: '', paymentMode: '', gatewayOrderId: '', errorCode: 'ORDER_NOT_FOUND', raw: data };
  }
  return normaliseV2Status(data);
};

/**
 * Initiate a (full or partial) refund.
 */
export const initiateRefund = async ({ merchantRefundId, originalMerchantOrderId, originalTransactionId, amountPaise, userId, callbackUrl }) => {
  if (isMockMode()) {
    return { refundId: `MOCKRF-${merchantRefundId}`, state: 'COMPLETED', amount: amountPaise, raw: { mock: true } };
  }
  if (!isConfigured()) {
    throw new PhonePeError('PhonePe is not configured.', { status: 503, code: 'PHONEPE_NOT_CONFIGURED' });
  }

  if (apiVersion() === 'v1') {
    const payload = {
      merchantId: process.env.PHONEPE_MERCHANT_ID,
      merchantUserId: String(userId || 'GUEST').slice(0, 36),
      originalTransactionId: originalMerchantOrderId,
      merchantTransactionId: merchantRefundId,
      amount: amountPaise,
      callbackUrl,
    };
    const base64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    const { ok, data } = await httpJson(`${hosts().pg}/pg/v1/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-VERIFY': v1Checksum(base64, '/pg/v1/refund') },
      body: JSON.stringify({ request: base64 }),
    });
    if (!ok || !data?.success) {
      throw new PhonePeError(data?.message || 'Refund request rejected by PhonePe.', { code: 'PHONEPE_REFUND', details: data });
    }
    return { refundId: data?.data?.transactionId || '', state: data?.data?.state || 'PENDING', amount: amountPaise, raw: data };
  }

  const { ok, data } = await httpJson(`${hosts().pg}/payments/v2/refund`, {
    method: 'POST',
    headers: await v2Headers(),
    body: JSON.stringify({ merchantRefundId, originalMerchantOrderId, amount: amountPaise }),
  });
  if (!ok) {
    throw new PhonePeError(data?.message || 'Refund request rejected by PhonePe.', { code: data?.code || 'PHONEPE_REFUND', details: data });
  }
  return { refundId: data?.refundId || '', state: data?.state || 'PENDING', amount: Number(data?.amount) || amountPaise, raw: data };
};

export const fetchRefundStatus = async (merchantRefundId) => {
  if (isMockMode()) return { state: 'COMPLETED', raw: { mock: true } };

  if (apiVersion() === 'v1') {
    const mid = process.env.PHONEPE_MERCHANT_ID;
    const s = normaliseV1Status(
      (
        await httpJson(`${hosts().pg}/pg/v1/status/${mid}/${merchantRefundId}`, {
          headers: {
            'Content-Type': 'application/json',
            'X-VERIFY': v1Checksum(`/pg/v1/status/${mid}/${merchantRefundId}`),
            'X-MERCHANT-ID': mid,
          },
        })
      ).data
    );
    return { state: s.state, raw: s.raw };
  }

  const { data } = await httpJson(`${hosts().pg}/payments/v2/refund/${encodeURIComponent(merchantRefundId)}/status`, {
    headers: await v2Headers(),
  });
  return { state: data?.state || 'PENDING', refundId: data?.refundId || '', raw: data };
};

/**
 * Verify an incoming webhook / S2S callback and return the normalised event.
 * v2: header `Authorization` must equal SHA256("username:password") configured in PhonePe dashboard.
 * v1: header `X-VERIFY` must equal SHA256(base64Response + saltKey) ### saltIndex.
 * @returns {{ valid: boolean, event?: string, merchantOrderId?: string, merchantRefundId?: string, state?: string }}
 */
export const verifyWebhook = (headers = {}, body = {}) => {
  if (apiVersion() === 'v1') {
    const xVerify = headers['x-verify'] || headers['X-VERIFY'];
    const base64 = body?.response;
    if (!xVerify || !base64) return { valid: false };
    const expected = `${sha256(base64 + (process.env.PHONEPE_SALT_KEY || ''))}###${process.env.PHONEPE_SALT_INDEX || '1'}`;
    if (!safeEqual(xVerify, expected)) return { valid: false };
    let decoded = {};
    try {
      decoded = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
    } catch {
      return { valid: false };
    }
    const n = normaliseV1Status(decoded);
    return {
      valid: true,
      event: n.state === 'COMPLETED' ? 'checkout.order.completed' : n.state === 'FAILED' ? 'checkout.order.failed' : 'checkout.order.pending',
      merchantOrderId: decoded?.data?.merchantTransactionId,
      state: n.state,
    };
  }

  const username = process.env.PHONEPE_WEBHOOK_USERNAME;
  const password = process.env.PHONEPE_WEBHOOK_PASSWORD;
  if (!username || !password) return { valid: false, reason: 'WEBHOOK_CREDENTIALS_NOT_SET' };

  const received = String(headers.authorization || headers.Authorization || '')
    .replace(/^SHA256\s+/i, '')
    .trim()
    .toLowerCase();
  const expected = sha256(`${username}:${password}`);
  if (!safeEqual(received, expected)) return { valid: false };

  const payload = body?.payload || {};
  return {
    valid: true,
    event: body?.event || body?.type || '',
    merchantOrderId: payload.merchantOrderId || payload.originalMerchantOrderId,
    merchantRefundId: payload.merchantRefundId,
    state: payload.state,
  };
};

export const publicGatewayInfo = () => ({
  provider: 'PHONEPE',
  environment: isMockMode() ? 'MOCK' : env(),
  apiVersion: apiVersion(),
  configured: isConfigured(),
  webhookConfigured:
    apiVersion() === 'v1'
      ? Boolean(process.env.PHONEPE_SALT_KEY)
      : Boolean(process.env.PHONEPE_WEBHOOK_USERNAME && process.env.PHONEPE_WEBHOOK_PASSWORD),
});
