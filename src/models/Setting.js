import mongoose from 'mongoose';

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

    // ───────────── Business identity (printed on invoices, schema.org, footer) ─────────────
    business: {
      brandName: { type: String, default: 'Jayrup', trim: true },
      tradeName: { type: String, default: 'Jayrup Pimples Cream', trim: true },
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
      pricesIncludeTax: { type: Boolean, default: true },
      defaultHsnCode: { type: String, default: '3304', trim: true },
      defaultGstRate: { type: Number, default: 18, min: 0, max: 28 },
      shippingGstRate: { type: Number, default: 18, min: 0, max: 28 },
      shippingSacCode: { type: String, default: '996812', trim: true },
      termsText: {
        type: String,
        default:
          'Goods once sold are subject to our Return & Refund Policy available at jayrup.in/return-policy. Subject to Sabarkantha (Gujarat) jurisdiction.',
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
      default: 'Jayrup | Pimples Cream, Ayurvedic Skincare & Luxury Perfumes Online India',
      trim: true,
    },
    defaultMetaDescription: {
      type: String,
      default:
        'Shop Jayrup online – Ayurvedic-inspired Pimples Cream for acne & marks, skincare and long-lasting luxury perfumes. Made in India. Secure PhonePe & COD checkout, delivery across India.',
      trim: true,
    },
    defaultMetaKeywords: {
      type: String,
      default:
        'jayrup, jayrup pimples cream, pimple cream, anti acne cream, acne marks cream, ayurvedic skincare, luxury perfume india, eau de parfum, jayrup perfume',
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

// Get-or-create singleton
settingSchema.statics.getStoreSettings = async function () {
  let settings = await this.findOne({ key: 'store_settings' });
  if (!settings) {
    settings = await this.create({ key: 'store_settings', codEnabled: true });
  }
  return settings;
};

export const Setting = mongoose.model('Setting', settingSchema);
