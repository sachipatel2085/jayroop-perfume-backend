import { Setting } from '../models/Setting.js';
import { logAdminAction } from '../utils/auditLogger.js';

// @desc    Get public store settings (for Storefront & Checkout)
// @route   GET /api/v1/settings/public
// @access  Public
export const getPublicSettings = async (req, res, next) => {
  try {
    const settings = await Setting.getStoreSettings();

    res.status(200).json({
      success: true,
      data: {
        codEnabled: settings.codEnabled,
        codExtraFee: settings.codExtraFee || 0,
        codMinOrderAmount: settings.codMinOrderAmount || 0,
        codMaxOrderAmount: settings.codMaxOrderAmount || 50000,
        onlinePaymentEnabled: settings.onlinePaymentEnabled !== false,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Get all store configuration settings
// @route   GET /api/v1/settings
// @access  Private/Admin
export const getAdminSettings = async (req, res, next) => {
  try {
    const settings = await Setting.getStoreSettings();

    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Update store settings (COD on/off, fees, online payment)
// @route   PUT /api/v1/settings
// @access  Private/Admin
export const updateSettings = async (req, res, next) => {
  try {
    const {
      codEnabled,
      codExtraFee,
      codMinOrderAmount,
      codMaxOrderAmount,
      onlinePaymentEnabled,
    } = req.body;

    const settings = await Setting.getStoreSettings();

    const previousCodStatus = settings.codEnabled;

    if (codEnabled !== undefined) settings.codEnabled = Boolean(codEnabled);
    if (codExtraFee !== undefined) settings.codExtraFee = Math.max(0, Number(codExtraFee) || 0);
    if (codMinOrderAmount !== undefined) settings.codMinOrderAmount = Math.max(0, Number(codMinOrderAmount) || 0);
    if (codMaxOrderAmount !== undefined) settings.codMaxOrderAmount = Math.max(0, Number(codMaxOrderAmount) || 0);
    if (onlinePaymentEnabled !== undefined) settings.onlinePaymentEnabled = Boolean(onlinePaymentEnabled);

    await settings.save();

    await logAdminAction({
      req,
      action: 'STORE_SETTINGS_UPDATED',
      resource: 'Setting',
      resourceId: settings._id.toString(),
      details: {
        codEnabled: settings.codEnabled,
        codExtraFee: settings.codExtraFee,
        previousCodStatus,
        onlinePaymentEnabled: settings.onlinePaymentEnabled,
      },
    });

    res.status(200).json({
      success: true,
      message: `Store settings updated. Cash on Delivery is now ${settings.codEnabled ? 'ENABLED' : 'DISABLED'}.`,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};
