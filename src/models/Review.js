import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    rating: {
      type: Number,
      required: [true, 'Please provide a rating between 1 and 5'],
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      trim: true,
      default: '',
    },
    comment: {
      type: String,
      required: [true, 'Please write your review comment'],
      trim: true,
    },
    verifiedPurchase: {
      type: Boolean,
      default: false,
    },
    // Moderation workflow. `isApproved` is kept in sync for older code (true only when APPROVED).
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    isApproved: {
      type: Boolean,
      default: false,
      index: true,
    },
    rejectionReason: { type: String, trim: true, default: '', maxlength: 300 },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    moderatedAt: { type: Date, default: null },
    // Public reply from the brand, shown under the review
    reply: {
      text: { type: String, trim: true, default: '', maxlength: 1500 },
      by: { type: String, trim: true, default: '' },
      at: { type: Date, default: null },
    },
    featured: { type: Boolean, default: false, index: true }, // pinned to the top of the product's reviews
    helpfulCount: { type: Number, default: 0 },
    helpfulVoters: { type: [mongoose.Schema.Types.ObjectId], default: [], select: false },
    reviewerName: { type: String, trim: true, default: '' }, // public display name (e.g. "Asha P.")
    reviewerCity: { type: String, trim: true, default: '' },
    edited: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

reviewSchema.pre('save', function () {
  // Only when status was loaded – never guess from a partially selected document
  if (!this.isNew && !this.isSelected('status')) return;
  // records created before the status field existed
  if (!this.status) this.status = this.isApproved ? 'APPROVED' : 'PENDING';
  this.isApproved = this.status === 'APPROVED';
});

reviewSchema.index({ product: 1, status: 1, createdAt: -1 });

/** Query filter for reviews that are visible on the website (also matches records from before `status`). */
export const APPROVED_FILTER = { $or: [{ status: 'APPROVED' }, { status: { $exists: false }, isApproved: true }] };

// Prevent user from reviewing same product multiple times per order
reviewSchema.index({ product: 1, user: 1, order: 1 }, { unique: true });

export const Review = mongoose.model('Review', reviewSchema);
