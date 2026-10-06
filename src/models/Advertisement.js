import mongoose from 'mongoose';

const advertisementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please enter advertisement title'],
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    mediaType: {
      type: String,
      enum: ['VIDEO', 'IMAGE'],
      default: 'VIDEO',
    },
    mediaUrl: {
      type: String,
      required: [true, 'Please provide media URL'],
    },
    posterUrl: {
      type: String,
      default: '', // Thumbnail / poster image for instant video placeholder
    },
    altText: {
      type: String,
      default: '',
      trim: true,
    },
    seoTitle: {
      type: String,
      default: '',
      trim: true,
    },
    ctaText: {
      type: String,
      default: 'EXPLORE COLLECTION',
      trim: true,
    },
    ctaUrl: {
      type: String,
      default: '/shop',
      trim: true,
    },
    location: {
      type: String,
      enum: ['HOMEPAGE_HERO', 'HOMEPAGE_CAMPAIGN', 'CATEGORY_HEADER'],
      default: 'HOMEPAGE_HERO',
      index: true,
    },
    priority: {
      type: Number,
      default: 1, // Higher priority displayed first
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const Advertisement = mongoose.model('Advertisement', advertisementSchema);
