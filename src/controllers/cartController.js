import { Product } from '../models/Product.js';
import { Coupon } from '../models/Coupon.js';

// @desc    Calculate and validate cart items with database prices & stock
// @route   POST /api/v1/cart/calculate
// @access  Public
export const calculateCart = async (req, res, next) => {
  try {
    const { items = [], couponCode = '' } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          items: [],
          subtotal: 0,
          discount: 0,
          shipping: 0,
          total: 0,
          coupon: null,
        },
      });
    }

    const calculatedItems = [];
    let subtotal = 0;
    const errors = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product || product.status !== 'ACTIVE') {
        errors.push(`Product '${item.name || item.productId}' is no longer available.`);
        continue;
      }

      let price = product.salePrice || product.price;
      let availableStock = product.stock;
      let variantSnapshot = null;

      // If item has a specific variant selected
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

      const requestedQty = Math.max(1, Number(item.quantity) || 1);
      const isStockAvailable = availableStock >= requestedQty;

      if (!isStockAvailable) {
        errors.push(
          `Insufficient stock for '${product.name}' (${variantSnapshot ? variantSnapshot.title : 'Standard'}). Only ${availableStock} left.`
        );
      }

      const itemSubtotal = price * requestedQty;
      subtotal += itemSubtotal;

      calculatedItems.push({
        product: product._id,
        name: product.name,
        slug: product.slug,
        image: product.images?.[0]?.url || '',
        variant: variantSnapshot,
        price,
        quantity: requestedQty,
        subtotal: itemSubtotal,
        inStock: isStockAvailable,
        availableStock,
      });
    }

    // Coupon validation & calculation
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
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            discountAmount: discount,
          };
        } else {
          errors.push(`Coupon error: ${check.message}`);
        }
      } else {
        errors.push(`Invalid coupon code: '${couponCode}'`);
      }
    }

    // Shipping rules: Free shipping over ₹999, else ₹100
    const shippingThreshold = 999;
    const shipping = subtotal > 0 && subtotal < shippingThreshold ? 100 : 0;
    const total = Math.max(0, subtotal - discount + shipping);

    res.status(200).json({
      success: true,
      data: {
        items: calculatedItems,
        subtotal,
        discount,
        shipping,
        total,
        coupon: appliedCoupon,
        errors,
      },
    });
  } catch (error) {
    next(error);
  }
};
