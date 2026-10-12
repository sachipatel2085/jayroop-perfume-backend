import { Setting } from '../models/Setting.js';
import { logAdminAction } from '../utils/auditLogger.js';
import { publicGatewayInfo } from '../services/phonepe.js';
import { isValidGSTIN } from '../utils/helpers.js';
import { stateCodeOf, INDIA_STATES } from '../utils/indiaStates.js';

const pick = (obj = {}, keys = []) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

// @desc    Public store settings (storefront, checkout, footer, schema.org)
// @route   GET /api/v1/settings/public
// @access  Public
export const getPublicSettings = async (req, res, next) => {
  try {
    const s = await Setting.getStoreSettings();
    const gateway = publicGatewayInfo();
    const b = s.business || {};
    res.set('Cache-Control', 'public, max-age=120');
    res.status(200).json({
      success: true,
      data: {
        codEnabled: s.codEnabled,
        codExtraFee: s.codExtraFee || 0,
        codMinOrderAmount: s.codMinOrderAmount || 0,
        codMaxOrderAmount: s.codMaxOrderAmount || 0,
        onlinePaymentEnabled: s.onlinePaymentEnabled !== false && gateway.configured,
        paymentGateway: 'PHONEPE',
        gatewayEnvironment: gateway.environment,
        freeShippingThreshold: s.freeShippingThreshold ?? 999,
        flatShippingFee: s.flatShippingFee ?? 100,
        estimatedDeliveryText: s.estimatedDeliveryText,
        surfaceDeliveryText: s.surfaceDeliveryText || s.estimatedDeliveryText,
        business: {
          brandName: b.brandName,
          tradeName: b.tradeName,
          tagline: b.tagline,
          legalName: b.legalName,
          registrationNote: b.registrationNote,
          gstin: b.gstin,
          addressLine1: b.addressLine1,
          addressLine2: b.addressLine2,
          city: b.city,
          district: b.district,
          state: b.state,
          postalCode: b.postalCode,
          country: b.country,
          phone: b.phone,
          whatsapp: b.whatsapp,
          email: b.email,
          website: b.website,
          instagram: b.instagram,
          facebook: b.facebook,
          youtube: b.youtube,
        },
        defaultMetaTitle: s.defaultMetaTitle,
        defaultMetaDescription: s.defaultMetaDescription || '',
        defaultMetaKeywords: s.defaultMetaKeywords || '',
        googleSiteVerification: s.googleSiteVerification || '',
        bingSiteVerification: s.bingSiteVerification || '',
        googleAnalyticsId: s.googleAnalyticsId || '',
        metaPixelId: s.metaPixelId || '',
        ogDefaultImage: s.ogDefaultImage || '',
        states: INDIA_STATES.map((st) => st.name),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: all settings (+ gateway status, never secrets)
// @route   GET /api/v1/settings
export const getAdminSettings = async (req, res, next) => {
  try {
    const settings = await Setting.getStoreSettings();
    res.status(200).json({ success: true, data: { ...settings.toObject(), gateway: publicGatewayInfo() } });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: update settings (payments, shipping, business/GST, invoice, SEO)
// @route   PUT /api/v1/settings
export const updateSettings = async (req, res, next) => {
  try {
    const body = req.body || {};
    const settings = await Setting.getStoreSettings();
    const previousCodStatus = settings.codEnabled;

    const num = (v, min = 0) => Math.max(min, Number(v) || 0);
    if (body.codEnabled !== undefined) settings.codEnabled = Boolean(body.codEnabled);
    if (body.codExtraFee !== undefined) settings.codExtraFee = num(body.codExtraFee);
    if (body.codMinOrderAmount !== undefined) settings.codMinOrderAmount = num(body.codMinOrderAmount);
    if (body.codMaxOrderAmount !== undefined) settings.codMaxOrderAmount = num(body.codMaxOrderAmount);
    if (body.onlinePaymentEnabled !== undefined) settings.onlinePaymentEnabled = Boolean(body.onlinePaymentEnabled);
    if (body.freeShippingThreshold !== undefined) settings.freeShippingThreshold = num(body.freeShippingThreshold);
    if (body.flatShippingFee !== undefined) settings.flatShippingFee = num(body.flatShippingFee);
    if (body.estimatedDeliveryText !== undefined) settings.estimatedDeliveryText = String(body.estimatedDeliveryText).slice(0, 80);
    if (body.surfaceDeliveryText !== undefined) settings.surfaceDeliveryText = String(body.surfaceDeliveryText).slice(0, 80);

    const strKeys = ['defaultMetaTitle', 'defaultMetaDescription', 'defaultMetaKeywords', 'googleSiteVerification', 'bingSiteVerification', 'googleAnalyticsId', 'metaPixelId', 'ogDefaultImage'];
    strKeys.forEach((k) => {
      if (body[k] !== undefined) settings[k] = String(body[k] || '').trim();
    });

    if (body.business && typeof body.business === 'object') {
      const b = pick(body.business, [
        'brandName', 'tradeName', 'tagline', 'legalName', 'registrationNote', 'gstin', 'pan', 'udyamNumber', 'addressLine1', 'addressLine2',
        'city', 'district', 'state', 'postalCode', 'country', 'phone', 'whatsapp', 'email', 'website', 'instagram', 'facebook', 'youtube',
      ]);
      if (b.gstin && !isValidGSTIN(b.gstin)) {
        return res.status(400).json({ success: false, message: 'Invalid GSTIN format (e.g. 24ABCDE1234F1Z5).' });
      }
      Object.entries(b).forEach(([k, v]) => {
        settings.business[k] = String(v ?? '').trim();
      });
      settings.business.stateCode = stateCodeOf(settings.business.state) || settings.business.stateCode;
      if (settings.business.gstin && settings.business.stateCode && settings.business.gstin.slice(0, 2) !== settings.business.stateCode) {
        return res.status(400).json({ success: false, message: `GSTIN state code (${settings.business.gstin.slice(0, 2)}) does not match business state (${settings.business.state} – ${settings.business.stateCode}).` });
      }
      settings.markModified('business');
    }

    if (body.invoice && typeof body.invoice === 'object') {
      const inv = pick(body.invoice, [
        'prefix', 'creditNotePrefix', 'pricesIncludeTax', 'defaultHsnCode', 'defaultGstRate', 'shippingTaxMode', 'shippingGstRate', 'shippingSacCode',
        'termsText', 'footerNote', 'signatoryName', 'autoGenerateForCodOn',
      ]);
      ['defaultGstRate', 'shippingGstRate'].forEach((k) => {
        if (inv[k] !== undefined) inv[k] = Math.min(40, Math.max(0, num(inv[k])));
      });
      if (inv.shippingTaxMode !== undefined) inv.shippingTaxMode = inv.shippingTaxMode === 'FIXED' ? 'FIXED' : 'HIGHEST_ITEM_RATE';
      if (inv.defaultHsnCode !== undefined) inv.defaultHsnCode = String(inv.defaultHsnCode).replace(/\D/g, '').slice(0, 8);
      if (inv.prefix !== undefined) inv.prefix = String(inv.prefix).replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6) || 'JR';
      if (inv.creditNotePrefix !== undefined) inv.creditNotePrefix = String(inv.creditNotePrefix).replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6) || 'CN';
      if (inv.pricesIncludeTax !== undefined) inv.pricesIncludeTax = true; // storefront prices are always MRP (tax inclusive)
      Object.entries(inv).forEach(([k, v]) => {
        settings.invoice[k] = v;
      });
      settings.markModified('invoice');
    }

    await settings.save();

    await logAdminAction({
      req,
      action: 'STORE_SETTINGS_UPDATED',
      resource: 'Setting',
      resourceId: settings._id.toString(),
      details: {
        codEnabled: settings.codEnabled,
        previousCodStatus,
        onlinePaymentEnabled: settings.onlinePaymentEnabled,
        sections: Object.keys(body),
      },
    });

    res.status(200).json({
      success: true,
      message: 'Store settings saved.',
      data: { ...settings.toObject(), gateway: publicGatewayInfo() },
    });
  } catch (error) {
    next(error);
  }
};
