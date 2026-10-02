import { Coupon } from '../models/Coupon.js';
import { logAdminAction } from '../utils/auditLogger.js';

// @desc    Validate a coupon code against an order subtotal
// @route   POST /api/v1/coupons/validate
// @access  Public
export const validateCoupon = async (req, res, next) => {
  try {
    const { code, subtotal = 0 } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a coupon code',
      });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid coupon code',
      });
    }

    const check = coupon.isValid(subtotal);
    if (!check.valid) {
      return res.status(400).json({
        success: false,
        message: check.message,
      });
    }

    const discountAmount = coupon.calculateDiscount(subtotal);

    res.status(200).json({
      success: true,
      data: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount,
        minimumOrder: coupon.minimumOrder,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Get all coupons
// @route   GET /api/v1/coupons
// @access  Private/Admin
export const getCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: coupons,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Create coupon
// @route   POST /api/v1/coupons
// @access  Private/Admin
export const createCoupon = async (req, res, next) => {
  try {
    const {
      code,
      discountType,
      discountValue,
      minimumOrder,
      maximumDiscount,
      expiryDate,
      usageLimit,
      status,
    } = req.body;

    const existing = await Coupon.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code already exists',
      });
    }

    const coupon = await Coupon.create({
      code: code.toUpperCase(),
      discountType,
      discountValue: Number(discountValue),
      minimumOrder: Number(minimumOrder || 0),
      maximumDiscount: maximumDiscount ? Number(maximumDiscount) : null,
      expiryDate: new Date(expiryDate),
      usageLimit: usageLimit ? Number(usageLimit) : null,
      status: status || 'ACTIVE',
    });

    await logAdminAction({
      req,
      action: 'COUPON_CREATED',
      resource: 'Coupon',
      resourceId: coupon._id.toString(),
      details: { code: coupon.code, discountType, discountValue },
    });

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      data: coupon,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Update coupon
// @route   PUT /api/v1/coupons/:id
// @access  Private/Admin
export const updateCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    if (req.body.code) req.body.code = req.body.code.toUpperCase();

    const updated = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    await logAdminAction({
      req,
      action: 'COUPON_UPDATED',
      resource: 'Coupon',
      resourceId: updated._id.toString(),
      details: req.body,
    });

    res.status(200).json({
      success: true,
      message: 'Coupon updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Delete coupon
// @route   DELETE /api/v1/coupons/:id
// @access  Private/Admin
export const deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    await logAdminAction({
      req,
      action: 'COUPON_DELETED',
      resource: 'Coupon',
      resourceId: req.params.id,
      details: { code: coupon.code },
    });

    res.status(200).json({
      success: true,
      message: 'Coupon deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
