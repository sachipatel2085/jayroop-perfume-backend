import rateLimit from 'express-rate-limit';

// Standard rate limiter for public API endpoints (300 requests / 15 minutes)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again in 15 minutes.',
  },
});

// Strict limiter for authentication routes (login / register / forgot password)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
});

// Limiter for promotional coupon validation to prevent automated scraping & brute-forcing
export const couponLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // 20 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many coupon validation attempts. Please try again after 15 minutes.',
  },
});

// Limiter for payment and order creation routes to prevent automated gateway abuse
export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40, // 40 payment/checkout requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many checkout or payment requests. Please try again after 15 minutes.',
  },
});
