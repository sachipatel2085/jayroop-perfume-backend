import mongoose from 'mongoose';

export const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUND_REQUESTED',
  'REFUNDED',
];

export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'];

const orderItemSnapshotSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  name: { type: String, required: true }, // Locked at order time
  slug: { type: String, required: true },
  sku: { type: String, default: '' },
  image: { type: String, default: '' },
  variant: {
    title: { type: String, default: '' },
    sku: { type: String, default: '' },
    attributes: { type: Map, of: String, default: {} },
  },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  categoryName: { type: String, default: '' }, // Locked for category-wise reports
  productType: { type: String, default: '' }, // SKINCARE, FRAGRANCE … (config/productTypes.js)
  returnable: { type: Boolean, default: true }, // locked return eligibility at time of sale
  hsnCode: { type: String, default: '' }, // Locked tax classification
  gstRate: { type: Number, default: 18 },
  mrp: { type: Number, default: 0 }, // Locked MRP (for "you saved")
  price: { type: Number, required: true }, // Locked unit selling price (GST inclusive)
  quantity: { type: Number, required: true, min: 1 },
  subtotal: { type: Number, required: true },
});

const statusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ORDER_STATUSES,
    required: true,
  },
  timestamp: { type: Date, default: Date.now },
  note: { type: String, default: '' },
  updatedBy: { type: String, default: 'SYSTEM' },
});

const addressSnapshotSchema = {
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, default: '' },
  addressLine1: { type: String, required: true },
  addressLine2: { type: String, default: '' },
  city: { type: String, required: true },
  state: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, default: 'India' },
};

const taxLineSchema = new mongoose.Schema(
  {
    description: String,
    hsnCode: String,
    quantity: Number,
    unitPrice: Number, // GST-inclusive unit price after discount allocation
    grossAmount: Number, // GST-inclusive line value before discount
    discount: Number, // allocated coupon discount
    taxableValue: Number,
    gstRate: Number,
    cgst: Number,
    sgst: Number,
    igst: Number,
    total: Number, // taxable + tax
    isService: { type: Boolean, default: false }, // shipping / COD handling lines
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    number: { type: String },
    sequence: Number,
    financialYear: String,
    date: Date,
    type: { type: String, enum: ['TAX_INVOICE', 'BILL_OF_SUPPLY', 'INVOICE'], default: 'TAX_INVOICE' },
    status: { type: String, enum: ['ISSUED', 'CANCELLED'], default: 'ISSUED' },
    seller: { type: mongoose.Schema.Types.Mixed, default: {} }, // business snapshot at issue time
    placeOfSupply: String,
    placeOfSupplyCode: String,
    isInterState: Boolean,
    lines: [taxLineSchema],
    totalTaxable: Number,
    totalCgst: Number,
    totalSgst: Number,
    totalIgst: Number,
    totalTax: Number,
    roundOff: Number,
    grandTotal: Number,
    creditNote: {
      number: String,
      sequence: Number,
      date: Date,
      reason: String,
      amount: Number,
    },
  },
  { _id: false }
);

const refundSchema = new mongoose.Schema(
  {
    merchantRefundId: { type: String, required: true },
    gatewayRefundId: { type: String, default: '' },
    amount: { type: Number, required: true }, // rupees
    state: { type: String, enum: ['PENDING', 'COMPLETED', 'FAILED', 'MANUAL'], default: 'PENDING' },
    reason: { type: String, default: '' },
    initiatedBy: { type: String, default: 'SYSTEM' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customerEmail: { type: String, default: '', lowercase: true, trim: true },
    items: [orderItemSnapshotSchema],
    subtotal: { type: Number, required: true, min: 0 }, // Σ item subtotals (GST inclusive)
    discount: { type: Number, default: 0, min: 0 },
    shipping: { type: Number, default: 0, min: 0 }, // shipping charge only
    codFee: { type: Number, default: 0, min: 0 },
    // GST added on top of the prices (only when Settings › GST › "Prices include GST" is OFF)
    taxAmount: { type: Number, default: 0, min: 0 },
    pricesIncludeTax: { type: Boolean, default: true }, // snapshot of the pricing mode used for this order
    shippingZone: { type: String, default: '' }, // LOCAL | NATIONAL | REMOTE (zone rates) – '' in simple mode
    total: { type: Number, required: true, min: 0 },
    appliedCoupon: {
      code: { type: String, default: null },
      discountAmount: { type: Number, default: 0 },
    },
    shippingAddress: addressSnapshotSchema,
    // Optional B2B details so business buyers can claim GST input tax credit
    billingDetails: {
      businessName: { type: String, default: '', trim: true },
      gstin: { type: String, default: '', trim: true, uppercase: true },
    },
    paymentMethod: {
      type: String,
      enum: ['ONLINE', 'COD'],
      default: 'ONLINE',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: 'PENDING',
      index: true,
    },
    orderStatus: {
      type: String,
      enum: ORDER_STATUSES,
      default: 'PENDING_PAYMENT',
      index: true,
    },
    paymentInfo: {
      gateway: { type: String, default: 'PHONEPE' }, // PHONEPE | COD (legacy: RAZORPAY)
      merchantOrderId: { type: String, index: true }, // our id sent to PhonePe (latest attempt)
      attemptIds: [{ type: String }], // every merchantOrderId ever created for this order
      gatewayOrderId: { type: String, default: '' }, // PhonePe orderId (OMO…)
      transactionId: { type: String, default: '' }, // PhonePe transactionId of the successful attempt
      paymentMode: { type: String, default: '' }, // UPI_INTENT, CARD, NET_BANKING …
      state: { type: String, default: '' }, // last known gateway state
      attempts: { type: Number, default: 0 },
      paidAt: { type: Date, default: null },
      lastCheckedAt: { type: Date, default: null },
      // legacy Razorpay fields (kept read-only for historical orders)
      razorpayOrderId: { type: String },
      razorpayPaymentId: { type: String },
    },
    refunds: [refundSchema],
    refundedAmount: { type: Number, default: 0, min: 0 },

    // Inventory / coupon bookkeeping (prevents double counting on webhook + redirect races)
    inventoryCommitted: { type: Boolean, default: false },
    couponCounted: { type: Boolean, default: false },

    // Courier & Tracking Integration
    courier: { type: String, default: null, trim: true },
    trackingId: { type: String, default: null, trim: true, index: true },
    trackingUrl: { type: String, default: null },
    shippedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String, default: '' },
    customerNote: { type: String, default: '', maxlength: 500 },
    // Customer return / replacement / issue request (policy: within RETURN_WINDOW_DAYS of delivery)
    returnRequest: {
      type: new mongoose.Schema(
        {
          reason: { type: String, required: true },
          message: { type: String, default: '', maxlength: 1500 },
          preferredResolution: { type: String, enum: ['REPLACEMENT', 'REFUND'], default: 'REPLACEMENT' },
          items: [{ sku: String, name: String, quantity: Number, _id: false }],
          status: { type: String, enum: ['OPEN', 'APPROVED', 'REJECTED', 'CLOSED'], default: 'OPEN' },
          resolution: { type: String, default: '', maxlength: 1000 },
          requestedAt: { type: Date, default: Date.now },
          resolvedAt: Date,
        },
        { _id: false }
      ),
      default: undefined,
    },
    adminNote: { type: String, default: '' },

    invoice: { type: invoiceSchema, default: undefined },
    statusHistory: [statusHistorySchema],
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'paymentInfo.attemptIds': 1 });
orderSchema.index({ 'refunds.merchantRefundId': 1 });
orderSchema.index({ 'invoice.date': 1 });
orderSchema.index({ 'invoice.number': 1 }, { unique: true, sparse: true });
orderSchema.index({ 'appliedCoupon.code': 1, user: 1 });

export const Order = mongoose.model('Order', orderSchema);
