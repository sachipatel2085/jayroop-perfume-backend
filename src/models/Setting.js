import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'store_settings',
    },
    // Cash on Delivery Controls
    codEnabled: {
      type: Boolean,
      default: true,
    },
    codExtraFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    codMinOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    codMaxOrderAmount: {
      type: Number,
      default: 50000,
      min: 0,
    },
    // Online Payment Gateway (Razorpay) Controls
    onlinePaymentEnabled: {
      type: Boolean,
      default: true,
    },
    // Global Storefront SEO & Webmaster Defaults
    defaultMetaTitle: {
      type: String,
      default: 'Jayrup (JR) | Royal Luxury Fragrance & Skincare House',
      trim: true,
    },
    defaultMetaDescription: {
      type: String,
      default: 'Jayrup (जयरूप) - Royal Indian Luxury House of High-Potency Extraits de Parfum and Ayurvedic Skincare. पिंपल्स भागे, आत्मविश्वास जागे.',
      trim: true,
    },
    defaultMetaKeywords: {
      type: String,
      default: 'luxury perfume, extrait de parfum, oud, kannauj rose, ayurvedic skincare, pimples soap, jayrup',
      trim: true,
    },
    googleSiteVerification: {
      type: String,
      default: '',
      trim: true,
    },
    ogDefaultImage: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Helper static method to get or create store settings singleton
settingSchema.statics.getStoreSettings = async function () {
  let settings = await this.findOne({ key: 'store_settings' });
  if (!settings) {
    settings = await this.create({ key: 'store_settings', codEnabled: true });
  }
  return settings;
};

export const Setting = mongoose.model('Setting', settingSchema);
