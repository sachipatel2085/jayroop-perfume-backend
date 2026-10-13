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
    const inv = s.invoice || {};
    const sh = s.shipping || {};
    const gstRegistered = isValidGSTIN(b.gstin);
    const showGstin = inv.showGstinOnSite !== false && gstRegistered;
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
        shipping: {
          freeShippingEnabled: sh.freeShippingEnabled !== false,
          zoneRatesEnabled: Boolean(sh.zoneRatesEnabled),
          dispatchDays: sh.dispatchDays ?? 1,
          additionalItemFee: sh.additionalItemFee || 0,
          zones: sh.zoneRatesEnabled ? (sh.zones || []).map((z) => ({ key: z.key, label: z.label, fee: z.fee, freeAbove: z.freeAbove, minDays: z.minDays, maxDays: z.maxDays, codAvailable: z.codAvailable })) : [],
          shippingPolicyNote: sh.shippingPolicyNote || '',
        },
        // GST display: prices inclusive (MRP) or GST added at checkout
        gst: {
          pricesIncludeTax: inv.pricesIncludeTax !== false,
          applicable: gstRegistered && (inv.gstScheme || 'REGULAR') === 'REGULAR',
          scheme: gstRegistered ? inv.gstScheme || 'REGULAR' : 'UNREGISTERED',
          gstin: showGstin ? b.gstin : '',
        },
        business: {
          brandName: b.brandName,
          tradeName: b.tradeName,
          tagline: b.tagline,
          legalName: b.legalName,
          registrationNote: b.registrationNote,
          gstin: showGstin ? b.gstin : '',
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

    if (body.shipping && typeof body.shipping === 'object') {
      const sh = body.shipping;
      const cur = settings.shipping || {};
      const pins = (v) =>
        [...new Set((Array.isArray(v) ? v : String(v || '').split(/[\s,;]+/)).map((x) => String(x).replace(/\D/g, '')).filter((x) => x.length >= 2 && x.length <= 6))].slice(0, 2000);
      if (sh.freeShippingEnabled !== undefined) cur.freeShippingEnabled = Boolean(sh.freeShippingEnabled);
      if (sh.additionalItemFee !== undefined) cur.additionalItemFee = num(sh.additionalItemFee);
      if (sh.dispatchDays !== undefined) cur.dispatchDays = Math.min(15, num(sh.dispatchDays));
      if (sh.surfaceExtraDays !== undefined) cur.surfaceExtraDays = Math.min(15, num(sh.surfaceExtraDays));
      if (sh.zoneRatesEnabled !== undefined) cur.zoneRatesEnabled = Boolean(sh.zoneRatesEnabled);
      if (sh.shippingPolicyNote !== undefined) cur.shippingPolicyNote = String(sh.shippingPolicyNote || '').trim().slice(0, 300);
      if (sh.blockedPincodes !== undefined) cur.blockedPincodes = pins(sh.blockedPincodes);
      if (sh.codBlockedPincodes !== undefined) cur.codBlockedPincodes = pins(sh.codBlockedPincodes);
      if (Array.isArray(sh.remoteStates)) {
        const valid = new Set(INDIA_STATES.map((st) => st.name));
        cur.remoteStates = sh.remoteStates.filter((st) => valid.has(st));
      }
      if (Array.isArray(sh.zones)) {
        const keys = ['LOCAL', 'NATIONAL', 'REMOTE'];
        cur.zones = keys.map((key) => {
          const z = sh.zones.find((x) => x?.key === key) || (cur.zones || []).find((x) => x.key === key) || {};
          const minDays = Math.min(60, num(z.minDays));
          return {
            key,
            label: String(z.label || key).trim().slice(0, 60),
            fee: num(z.fee),
            freeAbove: z.freeAbove === '' || z.freeAbove === null || z.freeAbove === undefined ? null : num(z.freeAbove),
            minDays,
            maxDays: Math.max(minDays, Math.min(60, num(z.maxDays))),
            codAvailable: z.codAvailable !== false,
          };
        });
      }
      settings.shipping = cur;
      settings.markModified('shipping');
    }

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
        'prefix', 'creditNotePrefix', 'pricesIncludeTax', 'gstScheme', 'showGstinOnSite', 'defaultHsnCode', 'defaultGstRate', 'shippingTaxMode', 'shippingGstRate', 'shippingSacCode',
        'termsText', 'footerNote', 'signatoryName', 'autoGenerateForCodOn',
      ]);
      ['defaultGstRate', 'shippingGstRate'].forEach((k) => {
        if (inv[k] !== undefined) inv[k] = Math.min(40, Math.max(0, num(inv[k])));
      });
      if (inv.shippingTaxMode !== undefined) inv.shippingTaxMode = inv.shippingTaxMode === 'FIXED' ? 'FIXED' : 'HIGHEST_ITEM_RATE';
      if (inv.defaultHsnCode !== undefined) inv.defaultHsnCode = String(inv.defaultHsnCode).replace(/\D/g, '').slice(0, 8);
      if (inv.prefix !== undefined) inv.prefix = String(inv.prefix).replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6) || 'JR';
      if (inv.creditNotePrefix !== undefined) inv.creditNotePrefix = String(inv.creditNotePrefix).replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6) || 'CN';
      // Inclusive = product prices are MRP incl. GST (B2C, today). Exclusive = GST added at checkout.
      // Only new orders are affected – every order stores the mode it was priced with.
      if (inv.pricesIncludeTax !== undefined) inv.pricesIncludeTax = inv.pricesIncludeTax !== false && inv.pricesIncludeTax !== 'false';
      if (inv.gstScheme !== undefined) inv.gstScheme = inv.gstScheme === 'COMPOSITION' ? 'COMPOSITION' : 'REGULAR';
      if (inv.showGstinOnSite !== undefined) inv.showGstinOnSite = Boolean(inv.showGstinOnSite);
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
