import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    adminEmail: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'ADVERTISEMENT_CREATED',
        'ADVERTISEMENT_UPDATED',
        'BLOG_CREATED',
        'BLOG_DELETED',
        'BLOG_UPDATED',
        'CATEGORY_CREATED',
        'CATEGORY_DELETED',
        'CATEGORY_UPDATED',
        'COUPON_CREATED',
        'COUPON_DELETED',
        'COUPON_UPDATED',
        'CUSTOMER_STATUS',
        'INFLUENCER_VIDEO_CREATED',
        'INFLUENCER_VIDEO_DELETED',
        'INFLUENCER_VIDEO_UPDATED',
        'INVENTORY_UPDATED',
        'INVOICE_ISSUED',
        'ORDERS_BULK_DISPATCHED',
        'ORDERS_BULK_PRINTED',
        'ORDERS_BULK_UPDATED',
        'ORDER_REFUNDED',
        'ORDER_STATUS_UPDATED',
        'PAYMENT_SYNCED',
        'PRODUCT_CREATED',
        'PRODUCT_DELETED',
        'PRODUCT_DELETED_PERMANENTLY',
        'PRODUCT_UPDATED',
        'REPORT_EXPORTED',
        'RETURN_REQUEST_UPDATED',
        'REVIEW_DELETED',
        'REVIEW_MODERATED',
        'STORE_SETTINGS_UPDATED',
        'TRACKING_ID_UPDATED',
      ],
      index: true,
    },
    resource: {
      type: String,
      required: true,
    },
    resourceId: {
      type: String,
      default: '',
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
