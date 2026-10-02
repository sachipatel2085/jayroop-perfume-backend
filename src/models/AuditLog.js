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
        'PRODUCT_CREATED',
        'PRODUCT_UPDATED',
        'PRODUCT_DELETED',
        'CATEGORY_CREATED',
        'CATEGORY_UPDATED',
        'CATEGORY_DELETED',
        'ORDER_STATUS_UPDATED',
        'TRACKING_ID_UPDATED',
        'COUPON_CREATED',
        'COUPON_UPDATED',
        'COUPON_DELETED',
        'BLOG_CREATED',
        'BLOG_UPDATED',
        'BLOG_DELETED',
        'ADVERTISEMENT_CREATED',
        'ADVERTISEMENT_UPDATED',
        'REVIEW_MODERATED',
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
