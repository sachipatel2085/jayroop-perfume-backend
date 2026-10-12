import { Product } from '../models/Product.js';
import { Coupon } from '../models/Coupon.js';
import { Order } from '../models/Order.js';
import { Setting } from '../models/Setting.js';

/**
 * Single source of truth for cart / checkout pricing.
 * The browser NEVER decides prices: cart preview, COD orders and PhonePe orders all call this.
 *
 * @param {Object}   opts
 * @param {Array}    opts.items          [{ productId, variantSku, quantity }]
 * @param {string}   opts.couponCode
 * @param {string}   opts.userId         used for per-user coupon limits
 * @param {string}   opts.paymentMethod  'ONLINE' | 'COD'
 * @param {boolean}  opts.strict         throw on any problem (used when creating an order)
 */
export const priceCart = async ({ items = [], couponCode = '', userId = null, paymentMethod = 'ONLINE', strict = false, settings = null }) => {
  const store = settings || (await Setting.getStoreSettings());
  const errors = [];

  if (!Array.isArray(items) || items.length === 0) {
    if (strict) throw httpError(400, 'Your bag is empty.');
    return emptyResult();
  }
  if (items.length > 50) throw httpError(400, 'Too many items in a single order.');

  // Merge duplicate lines (same product + variant)
  const merged = new Map();
  for (const raw of items) {
    if (!raw?.productId || !/^[0-9a-fA-F]{24}$/.test(String(raw.productId))) {
      errors.push('An item in your bag is invalid and was skipped.');
      continue;
    }
    const key = `${raw.productId}::${raw.variantSku || ''}`;
    const qty = Math.max(1, Math.floor(Number(raw.quantity) || 1));
    const prev = merged.get(key);
    merged.set(key, { productId: String(raw.productId), variantSku: raw.variantSku || '', quantity: (prev?.quantity || 0) + qty, name: raw.name });
  }

  const productIds = [...new Set([...merged.values()].map((m) => m.productId))];
  const products = await Product.find({ _id: { $in: productIds } });
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const defaultGst = store.invoice?.defaultGstRate ?? 18;
  const defaultHsn = store.invoice?.defaultHsnCode || '3304';

  const lines = [];
  let subtotal = 0;
  let mrpTotal = 0;

  for (const item of merged.values()) {
    const product = byId.get(item.productId);
    if (!product || product.status !== 'ACTIVE') {
      errors.push(`'${item.name || 'A product'}' is no longer available.`);
      continue;
    }

    let mrp = product.price;
    let price = product.effectivePrice();
    let availableStock = product.stock;
    let variantSnapshot = null;

    if (item.variantSku) {
      const variant = product.variants?.find((v) => v.sku === item.variantSku);
      if (!variant) {
        errors.push(`The selected size of '${product.name}' is no longer available.`);
        continue;
      }
      mrp = variant.price;
      price = variant.salePrice && variant.salePrice < variant.price ? variant.salePrice : variant.price;
      availableStock = variant.stock;
      variantSnapshot = { title: variant.title, sku: variant.sku, attributes: variant.attributes };
    }

    let qty = item.quantity;
    const maxPerOrder = product.maxPerOrder || 10;
    if (qty > maxPerOrder) {
      errors.push(`Maximum ${maxPerOrder} units of '${product.name}' allowed per order.`);
      qty = maxPerOrder;
    }

    const inStock = availableStock >= qty;
    if (!inStock) {
      errors.push(
        availableStock > 0
          ? `Only ${availableStock} left for '${product.name}'${variantSnapshot ? ` (${variantSnapshot.title})` : ''}.`
          : `'${product.name}'${variantSnapshot ? ` (${variantSnapshot.title})` : ''} is out of stock.`
      );
    }

    const lineSubtotal = price * qty;
    subtotal += lineSubtotal;
    mrpTotal += mrp * qty;

    lines.push({
      product: product._id,
      name: product.name,
      slug: product.slug,
      sku: variantSnapshot?.sku || product.sku,
      image: product.images?.find((i) => i.isPrimary)?.url || product.images?.[0]?.url || '',
      variant: variantSnapshot,
      hsnCode: product.hsnCode || defaultHsn,
      gstRate: typeof product.gstRate === 'number' ? product.gstRate : defaultGst,
      mrp,
      price,
      quantity: qty,
      subtotal: lineSubtotal,
      inStock,
      availableStock,
    });
  }

  // ───── Coupon ─────
  let discount = 0;
  let coupon = null;
  const code = String(couponCode || '').trim().toUpperCase();
  if (code) {
    const c = await Coupon.findOne({ code });
    if (!c) {
      errors.push(`Invalid coupon code '${code}'.`);
    } else {
      const check = c.isValid(subtotal);
      if (!check.valid) {
        errors.push(`Coupon: ${check.message}`);
      } else {
        let perUserOk = true;
        if (userId && c.perUserLimit) {
          const used = await Order.countDocuments({
            user: userId,
            'appliedCoupon.code': c.code,
            orderStatus: { $nin: ['CANCELLED'] },
            paymentStatus: { $ne: 'FAILED' },
            $or: [{ paymentMethod: 'COD' }, { paymentStatus: { $in: ['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'] } }],
          });
          if (used >= c.perUserLimit) {
            perUserOk = false;
            errors.push(`Coupon '${c.code}' has already been used on your account.`);
          }
        }
        if (perUserOk) {
          discount = Math.min(c.calculateDiscount(subtotal), subtotal);
          coupon = { code: c.code, discountType: c.discountType, discountValue: c.discountValue, discountAmount: discount };
        }
      }
    }
  }

  // ───── Shipping & COD fee ─────
  const threshold = Number(store.freeShippingThreshold ?? 999);
  const flatFee = Number(store.flatShippingFee ?? 100);
  const shipping = subtotal > 0 && subtotal < threshold ? flatFee : 0;
  const codFee = paymentMethod === 'COD' ? Number(store.codExtraFee || 0) : 0;
  const total = Math.max(0, Math.round((subtotal - discount + shipping + codFee) * 100) / 100);

  const result = {
    items: lines,
    subtotal,
    mrpTotal,
    savings: Math.max(0, mrpTotal - subtotal) + discount,
    discount,
    shipping,
    codFee,
    total,
    freeShippingThreshold: threshold,
    amountToFreeShipping: subtotal > 0 && subtotal < threshold ? threshold - subtotal : 0,
    coupon,
    errors,
  };

  if (strict) {
    if (lines.length === 0) throw httpError(400, errors[0] || 'No purchasable items in your bag.');
    const blocking = errors.filter(Boolean);
    if (blocking.length) throw httpError(400, blocking.join(' '));
  }

  return result;
};

const emptyResult = () => ({
  items: [],
  subtotal: 0,
  mrpTotal: 0,
  savings: 0,
  discount: 0,
  shipping: 0,
  codFee: 0,
  total: 0,
  coupon: null,
  errors: [],
});

export const httpError = (statusCode, message) => {
  const e = new Error(message);
  e.statusCode = statusCode;
  return e;
};
