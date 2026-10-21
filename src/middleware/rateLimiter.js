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

// Public catalogue reads (products, categories, blogs, reviews, store settings, ads, influencer videos).
// Every storefront page view makes several of these – and so does Googlebot when it renders a page –
// so they get a higher limit than the rest of the API. Only GET/HEAD; never admin sub-routes.
const PUBLIC_READ = /^\/api\/v1\/(products|categories|blogs|reviews\/product|settings\/public|advertisements|influencers|seo)(\/|\?|$)/;
const PRIVATE_READ = /^\/api\/v1\/(products\/admin|influencers\/admin|reviews\/admin)|\/mine(\?|$)/;
export const isPublicCatalogRead = (req) =>
  (req.method === 'GET' || req.method === 'HEAD') && PUBLIC_READ.test(req.originalUrl) && !PRIVATE_READ.test(req.originalUrl);

export const publicReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again in a few minutes.',
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

// Public order-tracking lookups (prevents order-number / phone enumeration)
export const trackingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many tracking requests. Please try again in a few minutes.',
  },
});

// Password reset requests
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many password reset requests. Please try again later.',
  },
});
