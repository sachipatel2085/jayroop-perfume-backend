import Razorpay from 'razorpay';
import crypto from 'crypto';

let razorpayInstance = null;

export const getRazorpayInstance = () => {
  if (!razorpayInstance) {
    const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_JayroopLuxuryKey';
    const key_secret = process.env.RAZORPAY_KEY_SECRET || 'JayroopLuxurySecretPass123';

    razorpayInstance = new Razorpay({
      key_id,
      key_secret,
    });
  }
  return razorpayInstance;
};

/**
 * Server-side Razorpay HMAC SHA256 Signature Verification
 * @param {string} orderId - Razorpay order ID (e.g. order_9A33XWu170gUtm)
 * @param {string} paymentId - Razorpay payment ID (e.g. pay_29QQoUBi66xm2f)
 * @param {string} signature - Razorpay signature received from client
 * @returns {boolean} True if signature is cryptographically valid
 */
export const verifyRazorpaySignature = (orderId, paymentId, signature) => {
  const secret = process.env.RAZORPAY_KEY_SECRET || 'JayroopLuxurySecretPass123';
  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return generatedSignature === signature;
};

/**
 * Webhook signature verification
 */
export const verifyWebhookSignature = (bodyString, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'JayroopWebhookSecret123';
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(bodyString)
    .digest('hex');

  return expectedSignature === signature;
};
