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
