import { priceCart } from '../services/pricingService.js';

// @desc    Price the bag server-side (live prices, stock, coupon, shipping, COD fee)
// @route   POST /api/v1/cart/calculate   { items, couponCode, paymentMethod }
// @access  Public (optional auth enables per-user coupon checks)
export const calculateCart = async (req, res, next) => {
  try {
    const { items = [], couponCode = '', paymentMethod = 'ONLINE' } = req.body;
    const data = await priceCart({
      items,
      couponCode,
      userId: req.user?._id || null,
      paymentMethod: paymentMethod === 'COD' ? 'COD' : 'ONLINE',
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
