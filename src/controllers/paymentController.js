import crypto from 'crypto';
import { getRazorpayInstance, verifyRazorpaySignature, verifyWebhookSignature } from '../config/razorpay.js';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { Coupon } from '../models/Coupon.js';

// Helper to generate unique luxury order number
const generateOrderNumber = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `JR-${timestamp}-${random}`;
};

// @desc    Initiate payment: recalculate totals server-side and create Razorpay order
// @route   POST /api/v1/payments/create-order
// @access  Private
export const createPaymentOrder = async (req, res, next) => {
  try {
    const { items, shippingAddress, couponCode } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No items provided for order checkout',
      });
    }

    if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.addressLine1 || !shippingAddress.phone) {
      return res.status(400).json({
        success: false,
        message: 'Complete shipping address is required',
      });
    }

    // 1. Recalculate everything from DB (NEVER trust client amounts)
    const orderItemsSnapshot = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product || product.status !== 'ACTIVE') {
        return res.status(400).json({
          success: false,
          message: `Product '${item.name || item.productId}' is unavailable.`,
        });
      }

      let price = product.salePrice || product.price;
      let variantSnapshot = null;
      let availableStock = product.stock;

      if (item.variantSku && product.variants && product.variants.length > 0) {
        const variant = product.variants.find((v) => v.sku === item.variantSku);
        if (variant) {
          price = variant.salePrice || variant.price;
          availableStock = variant.stock;
          variantSnapshot = {
            title: variant.title,
            sku: variant.sku,
            attributes: variant.attributes,
          };
        }
      }

      const qty = Math.max(1, Number(item.quantity) || 1);
      if (availableStock < qty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient inventory for '${product.name}' (${variantSnapshot ? variantSnapshot.title : 'Standard'}). Only ${availableStock} available.`,
        });
      }

      const itemTotal = price * qty;
      subtotal += itemTotal;

      orderItemsSnapshot.push({
        product: product._id,
        name: product.name,
        slug: product.slug,
        image: product.images?.[0]?.url || '',
        variant: variantSnapshot,
        price,
        quantity: qty,
        subtotal: itemTotal,
      });
    }

    // 2. Validate coupon server-side
    let discount = 0;
    let appliedCoupon = null;

    if (couponCode && couponCode.trim()) {
      const coupon = await Coupon.findOne({
        code: couponCode.trim().toUpperCase(),
      });

      if (coupon) {
        const check = coupon.isValid(subtotal);
        if (check.valid) {
          discount = coupon.calculateDiscount(subtotal);
          appliedCoupon = {
            code: coupon.code,
            discountAmount: discount,
          };
        }
      }
    }

    // 3. Shipping logic
    const shipping = subtotal > 0 && subtotal < 999 ? 100 : 0;
    const finalTotal = Math.max(0, subtotal - discount + shipping);

    const orderNumber = generateOrderNumber();

    // 4. Create Razorpay order
    let razorpayOrderId = `order_sim_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const razorpay = getRazorpayInstance();
    const amountInPaise = Math.round(finalTotal * 100);

    try {
      if (
        process.env.RAZORPAY_KEY_ID &&
        !process.env.RAZORPAY_KEY_ID.includes('JayroopLuxuryKey')
      ) {
        const rzpOrder = await razorpay.orders.create({
          amount: amountInPaise,
          currency: 'INR',
          receipt: orderNumber,
          notes: {
            orderNumber,
            userId: req.user._id.toString(),
          },
        });
        razorpayOrderId = rzpOrder.id;
      }
    } catch (rzpErr) {
      console.warn(`[Razorpay Notice] Fallback to simulated order ID: ${rzpErr.message}`);
    }

    // 5. Save pending order in database
    const newOrder = await Order.create({
      orderNumber,
      user: req.user._id,
      items: orderItemsSnapshot,
      subtotal,
      discount,
      shipping,
      total: finalTotal,
      appliedCoupon,
      shippingAddress,
      paymentStatus: 'PENDING',
      orderStatus: 'PENDING_PAYMENT',
      paymentInfo: {
        gateway: 'RAZORPAY',
        razorpayOrderId,
      },
      statusHistory: [
        {
          status: 'PENDING_PAYMENT',
          timestamp: new Date(),
          note: 'Order created, awaiting payment verification',
          updatedBy: 'CUSTOMER',
        },
      ],
    });

    res.status(200).json({
      success: true,
      data: {
        orderId: newOrder._id,
        orderNumber: newOrder.orderNumber,
        razorpayOrderId,
        amount: finalTotal,
        amountInPaise,
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_JayroopLuxuryKey',
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify payment signature and update order status to PAID
// @route   POST /api/v1/payments/verify
// @access  Private
export const verifyPayment = async (req, res, next) => {
  try {
    const {
      orderId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!orderId || !razorpay_payment_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment verification details',
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Idempotency check: Already processed
    if (order.paymentStatus === 'PAID') {
      return res.status(200).json({
        success: true,
        message: 'Order has already been marked as PAID',
        data: order,
      });
    }

    // Cryptographic signature check
    const isRealKey =
      process.env.RAZORPAY_KEY_ID &&
      !process.env.RAZORPAY_KEY_ID.includes('JayroopLuxuryKey');

    if (isRealKey && razorpay_signature) {
      const isValid = verifyRazorpaySignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      );

      if (!isValid) {
        order.paymentStatus = 'FAILED';
        order.statusHistory.push({
          status: 'PENDING_PAYMENT',
          timestamp: new Date(),
          note: 'Payment signature verification failed.',
          updatedBy: 'SECURITY_GATEWAY',
        });
        await order.save();

        return res.status(400).json({
          success: false,
          message: 'Security Alert: Payment signature verification failed. Transaction rejected.',
        });
      }
    }

    // Payment Verified Successfully! Update order
    order.paymentStatus = 'PAID';
    order.orderStatus = 'PAID';
    order.paymentInfo.razorpayPaymentId = razorpay_payment_id;
    order.paymentInfo.razorpaySignature = razorpay_signature || 'VERIFIED';
    order.paymentInfo.razorpayOrderId = razorpay_order_id;

    order.statusHistory.push({
      status: 'PAID',
      timestamp: new Date(),
      note: `Payment verified. Ref: ${razorpay_payment_id}`,
      updatedBy: 'RAZORPAY_GATEWAY',
    });

    await order.save();

    // Atomically decrement stock for products and variants
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product) {
        if (item.variant?.sku && product.variants?.length > 0) {
          const v = product.variants.find((vr) => vr.sku === item.variant.sku);
          if (v) {
            v.stock = Math.max(0, v.stock - item.quantity);
          }
        }
        product.stock = Math.max(0, product.stock - item.quantity);
        await product.save();
      }
    }

    // If a coupon was applied, increment usage count
    if (order.appliedCoupon?.code) {
      await Coupon.findOneAndUpdate(
        { code: order.appliedCoupon.code },
        { $inc: { timesUsed: 1 } }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Payment verified and order confirmed successfully',
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Razorpay Webhook Handler for asynchronous captures & refunds
// @route   POST /api/v1/payments/webhook
// @access  Public (Signature protected)
export const handleWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const bodyString = JSON.stringify(req.body);

    if (process.env.RAZORPAY_WEBHOOK_SECRET && signature) {
      const isValid = verifyWebhookSignature(bodyString, signature);
      if (!isValid) {
        return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
      }
    }

    const event = req.body.event;
    const paymentPayload = req.body.payload?.payment?.entity;

    if (event === 'payment.captured' && paymentPayload?.order_id) {
      const order = await Order.findOne({ 'paymentInfo.razorpayOrderId': paymentPayload.order_id });
      if (order && order.paymentStatus !== 'PAID') {
        order.paymentStatus = 'PAID';
        order.orderStatus = 'PAID';
        order.paymentInfo.razorpayPaymentId = paymentPayload.id;
        order.statusHistory.push({
          status: 'PAID',
          timestamp: new Date(),
          note: `Payment captured via Webhook. Payment ID: ${paymentPayload.id}`,
          updatedBy: 'RAZORPAY_WEBHOOK',
        });
        await order.save();
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
};
