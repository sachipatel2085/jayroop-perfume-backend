import { priceCart } from '../services/pricingService.js';

// @desc    Price the bag server-side (live prices, stock, coupon, shipping, COD fee)
// @route   POST /api/v1/cart/calculate   { items, couponCode, paymentMethod }
// @access  Public (optional auth enables per-user coupon checks)
export const calculateCart = async (req, res, next) => {
  try {
    const { items = [], couponCode = '', paymentMethod = 'ONLINE', shippingAddress = null } = req.body;
    // Only state + PIN are needed for shipping zones / PIN rules (the full address is validated at checkout)
    const addr =
      shippingAddress && typeof shippingAddress === 'object'
        ? { state: String(shippingAddress.state || '').slice(0, 60), postalCode: String(shippingAddress.postalCode || '').replace(/\D/g, '').slice(0, 6) }
        : null;
    const data = await priceCart({
      items,
      couponCode,
      userId: req.user?._id || null,
      paymentMethod: paymentMethod === 'COD' ? 'COD' : 'ONLINE',
      shippingAddress: addr?.state || addr?.postalCode ? addr : null,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
