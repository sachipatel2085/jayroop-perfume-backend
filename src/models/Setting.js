import mongoose from 'mongoose';
import { HOME_SEO } from '../seo/homeContent.js';

/**
 * Store-wide configuration singleton (key = "store_settings").
 * Everything an admin may need to change without a code deploy lives here:
 * payments, shipping rules, business / GST identity, invoice preferences and SEO defaults.
 */
const settingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'store_settings',
    },

    // ───────────── Cash on Delivery ─────────────
    codEnabled: { type: Boolean, default: true },
    codExtraFee: { type: Number, default: 0, min: 0 },
    codMinOrderAmount: { type: Number, default: 0, min: 0 },
    codMaxOrderAmount: { type: Number, default: 50000, min: 0 },

    // ───────────── Online payments (PhonePe PG) ─────────────
    onlinePaymentEnabled: { type: Boolean, default: true },

    // ───────────── Shipping rules ─────────────
    freeShippingThreshold: { type: Number, default: 999, min: 0 },
    flatShippingFee: { type: Number, default: 100, min: 0 },
    estimatedDeliveryText: { type: String, default: '7–10 business days', trim: true },
    // Used when the bag contains a surface-only item (alcohol-based perfume, aerosol …)
    surfaceDeliveryText: { type: String, default: '8–12 business days', trim: true },

    // ───────────── Advanced shipping (zones, pincodes, delivery promise) ─────────────
    // freeShippingThreshold / flatShippingFee above stay the "simple" defaults. Turn on zone rates to
    // charge differently inside your state, across India and in remote regions.
    shipping: {
      freeShippingEnabled: { type: Boolean, default: true },
      additionalItemFee: { type: Number, default: 0, min: 0 }, // charged per extra unit after the first
      dispatchDays: { type: Number, default: 1, min: 0, max: 15 }, // packing / handover time
      surfaceExtraDays: { type: Number, default: 2, min: 0, max: 15 }, // extra days for surface-only items
      zoneRatesEnabled: { type: Boolean, default: false },
      zones: {
        type: [
          {
            _id: false,
            key: { type: String, enum: ['LOCAL', 'NATIONAL', 'REMOTE'], required: true },
            label: { type: String, trim: true },
            fee: { type: Number, min: 0, default: 0 },
            freeAbove: { type: Number, min: 0, default: null }, // null → use the store-wide free-shipping limit
            minDays: { type: Number, min: 0, default: 3 },
            maxDays: { type: Number, min: 0, default: 7 },
            codAvailable: { type: Boolean, default: true },
          },
        ],
        default: () => [
          { key: 'LOCAL', label: 'Within home state', fee: 60, freeAbove: null, minDays: 2, maxDays: 4, codAvailable: true },
          { key: 'NATIONAL', label: 'Rest of India', fee: 100, freeAbove: null, minDays: 4, maxDays: 7, codAvailable: true },
          { key: 'REMOTE', label: 'North-East, J&K, Ladakh & islands', fee: 150, freeAbove: null, minDays: 7, maxDays: 12, codAvailable: true },
        ],
      },
      remoteStates: {
        type: [String],
        default: () => [
          'Arunachal Pradesh', 'Assam', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Sikkim', 'Tripura',
          'Jammu and Kashmir', 'Ladakh', 'Andaman and Nicobar Islands', 'Lakshadweep',
        ],
      },
      // PIN codes / prefixes (e.g. "744" for all of Andaman) – checked at checkout
      blockedPincodes: { type: [String], default: () => [] }, // we don't deliver here
      codBlockedPincodes: { type: [String], default: () => [] }, // prepaid only here
      shippingPolicyNote: { type: String, default: '', trim: true, maxlength: 300 }, // shown at checkout
    },

    // ───────────── Business identity (printed on invoices, schema.org, footer) ─────────────
    business: {
      brandName: { type: String, default: 'Jayrup', trim: true },
      tradeName: { type: String, default: 'Jayrup', trim: true }, // must match the trade name on the GST certificate
      tagline: { type: String, default: 'Skincare · Fragrances · Personal Care', trim: true, maxlength: 80 }, // printed on invoices & reports
      legalName: { type: String, default: 'FITJAYESH', trim: true },
      registrationNote: { type: String, default: 'MSME Registered', trim: true },
      gstin: { type: String, default: '', trim: true, uppercase: true },
      pan: { type: String, default: '', trim: true, uppercase: true },
      udyamNumber: { type: String, default: '', trim: true, uppercase: true },
      addressLine1: { type: String, default: 'G-28, Metropolis Complex', trim: true },
      addressLine2: { type: String, default: 'Gambhoi–Bhiloda Road, Gambhoi', trim: true },
      city: { type: String, default: 'Himatnagar', trim: true },
      district: { type: String, default: 'Sabarkantha', trim: true },
      state: { type: String, default: 'Gujarat', trim: true },
      stateCode: { type: String, default: '24', trim: true },
      postalCode: { type: String, default: '383030', trim: true },
      country: { type: String, default: 'India', trim: true },
      phone: { type: String, default: '+91 94081 33100', trim: true },
      whatsapp: { type: String, default: '+91 94081 33100', trim: true },
      email: { type: String, default: 'care@jayrup.in', trim: true, lowercase: true },
      website: { type: String, default: 'https://jayrup.in', trim: true },
      instagram: { type: String, default: '', trim: true },
      facebook: { type: String, default: '', trim: true },
      youtube: { type: String, default: '', trim: true },
    },

    // ───────────── Tax & invoice preferences ─────────────
    invoice: {
      prefix: { type: String, default: 'JR', trim: true, uppercase: true, maxlength: 6 },
      creditNotePrefix: { type: String, default: 'CN', trim: true, uppercase: true, maxlength: 6 },
      // true  → product prices are GST-inclusive (MRP); GST is back-calculated on the invoice
      // false → product prices are before GST; GST is added at checkout (B2B / future pricing)
      pricesIncludeTax: { type: Boolean, default: true },
      // REGULAR → Tax Invoice with CGST/SGST/IGST · COMPOSITION → Bill of Supply, no GST collected
      gstScheme: { type: String, enum: ['REGULAR', 'COMPOSITION'], default: 'REGULAR' },
      showGstinOnSite: { type: Boolean, default: true }, // footer, contact page, checkout
      // Last-resort HSN – normally the product / category / product type supplies it
      defaultHsnCode: { type: String, default: '3304', trim: true },
      defaultGstRate: { type: Number, default: 18, min: 0, max: 40 },
      // HIGHEST_ITEM_RATE: shipping & COD charges follow the highest GST rate of the goods in the order
      // (composite supply). FIXED: always use shippingGstRate.
      shippingTaxMode: { type: String, enum: ['HIGHEST_ITEM_RATE', 'FIXED'], default: 'HIGHEST_ITEM_RATE' },
      shippingGstRate: { type: Number, default: 18, min: 0, max: 40 },
      shippingSacCode: { type: String, default: '996812', trim: true },
      termsText: {
        type: String,
        default:
          'Goods once sold are subject to our Return & Refund Policy available at jayrup.in/refund-return-policy. Subject to Sabarkantha (Gujarat) jurisdiction.',
        trim: true,
      },
      footerNote: {
        type: String,
        default: 'Thank you for choosing Jayrup. For support write to care@jayrup.in',
        trim: true,
      },
      signatoryName: { type: String, default: 'Authorised Signatory', trim: true },
      autoGenerateForCodOn: {
        type: String,
        enum: ['PLACED', 'SHIPPED', 'DELIVERED'],
        default: 'SHIPPED',
      },
    },

    // ───────────── Global storefront SEO & webmaster ─────────────
    defaultMetaTitle: {
      type: String,
      default: HOME_SEO.title,
      trim: true,
    },
    defaultMetaDescription: {
      type: String,
      default: HOME_SEO.description,
      trim: true,
    },
    defaultMetaKeywords: {
      type: String,
      default: HOME_SEO.keywords,
      trim: true,
    },
    googleSiteVerification: { type: String, default: '', trim: true },
    bingSiteVerification: { type: String, default: '', trim: true },
    googleAnalyticsId: { type: String, default: '', trim: true },
    metaPixelId: { type: String, default: '', trim: true },
    ogDefaultImage: { type: String, default: '', trim: true },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

// Values written by earlier versions that were specific to a single product. If the admin never
// changed them, they are upgraded to the product-neutral defaults automatically (once).
const LEGACY_DEFAULTS = [
  ['business.tradeName', ['Jayrup Pimples Cream']],
  ['defaultMetaTitle', ['Jayrup | Pimples Cream, Ayurvedic Skincare & Luxury Perfumes Online India', 'Jayrup | Skincare & Luxury Perfumes – Shop Online in India', 'Jayrup | Luxury Perfume for Men & Ayurvedic Pimple Cream India']],
  [
    'defaultMetaDescription',
    [
      'Shop Jayrup online – Ayurvedic-inspired Pimples Cream for acne & marks, skincare and long-lasting luxury perfumes. Made in India. Secure PhonePe & COD checkout, delivery across India.',
      'Shop Jayrup online – effective skincare and long-lasting luxury perfumes, made in India. Genuine products, secure PhonePe & COD checkout, delivery across India.',
      'Shop Jayrup – Royal Flora long-lasting Eau de Parfum for men & Ayurvedic Pimples Cream with Neem & Karanj. Made in India. PhonePe & COD, delivery across India.',
    ],
  ],
  [
    'defaultMetaKeywords',
    [
      'jayrup, jayrup pimples cream, pimple cream, anti acne cream, acne marks cream, ayurvedic skincare, luxury perfume india, eau de parfum, jayrup perfume',
      'jayrup, jayrup perfume, jayrup skincare, luxury perfume india, eau de parfum, long lasting perfume, skincare india, jayrup pimples cream',
      'jayrup, jayrup perfume, royal flora perfume, luxury perfume for men, long lasting perfume for men, eau de parfum india, ayurvedic pimple cream, jayrup pimples cream, herbal pimple cream',
    ],
  ],
  ['invoice.termsText', ['Goods once sold are subject to our Return & Refund Policy available at jayrup.in/return-policy. Subject to Sabarkantha (Gujarat) jurisdiction.']],
];

// Get-or-create singleton
settingSchema.statics.getStoreSettings = async function () {
  let settings = await this.findOne({ key: 'store_settings' });
  if (!settings) {
    settings = await this.create({ key: 'store_settings', codEnabled: true });
    return settings;
  }
  const $set = {};
  for (const [path, oldValues] of LEGACY_DEFAULTS) {
    if (oldValues.includes(settings.get(path))) {
      const fresh = this.schema.path(path)?.defaultValue;
      if (fresh !== undefined) {
        settings.set(path, fresh);
        $set[path] = fresh;
      }
    }
  }
  if (Object.keys($set).length) await this.updateOne({ _id: settings._id }, { $set });
  return settings;
};

export const Setting = mongoose.model('Setting', settingSchema);
