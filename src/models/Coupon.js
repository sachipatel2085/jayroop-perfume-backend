import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Please provide a coupon code'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    discountType: {
      type: String,
      enum: ['PERCENTAGE', 'FIXED'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minimumOrder: {
      type: Number,
      default: 0,
      min: 0,
    },
    maximumDiscount: {
      type: Number,
      default: null, // Only applicable for percentage discounts
      min: 0,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    usageLimit: {
      type: Number,
      default: null, // Total number of times coupon can be used
    },
    timesUsed: {
      type: Number,
      default: 0,
    },
    perUserLimit: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Helper to check validity
couponSchema.methods.isValid = function (orderSubtotal) {
  const now = new Date();
  if (this.status !== 'ACTIVE') return { valid: false, message: 'Coupon is inactive' };
  if (now > this.expiryDate) return { valid: false, message: 'Coupon has expired' };
  if (this.usageLimit && this.timesUsed >= this.usageLimit)
    return { valid: false, message: 'Coupon usage limit reached' };
  if (orderSubtotal < this.minimumOrder)
    return {
      valid: false,
      message: `Minimum order value of ₹${this.minimumOrder} required for this coupon`,
    };

  return { valid: true };
};

// Calculate discount amount
couponSchema.methods.calculateDiscount = function (subtotal) {
  let discount = 0;
  if (this.discountType === 'PERCENTAGE') {
    discount = (subtotal * this.discountValue) / 100;
    if (this.maximumDiscount && discount > this.maximumDiscount) {
      discount = this.maximumDiscount;
    }
  } else if (this.discountType === 'FIXED') {
    discount = Math.min(this.discountValue, subtotal);
  }
  return Math.round(discount);
};

export const Coupon = mongoose.model('Coupon', couponSchema);
