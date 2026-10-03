import mongoose from 'mongoose';

const influencerVideoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please enter video title / headline'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    sectionType: {
      type: String,
      enum: ['INSPIRATIONS', 'SCENT_FLUENCER'],
      default: 'SCENT_FLUENCER',
      index: true,
    },
    influencerName: {
      type: String,
      required: [true, 'Please enter influencer / celebrity name'],
      trim: true,
    },
    caption: {
      type: String,
      trim: true,
      default: '',
    },
    videoUrl: {
      type: String,
      required: [true, 'Please provide video MP4 URL'],
      trim: true,
    },
    posterUrl: {
      type: String,
      required: [true, 'Please provide video poster / thumbnail image URL'],
      trim: true,
    },
    altText: {
      type: String,
      required: [true, 'Please provide SEO Alt Text for Google search ranking'],
      trim: true,
    },
    seoDescription: {
      type: String,
      required: [true, 'Please provide rich Video SEO description for schema.org indexing'],
      trim: true,
    },
    seoKeywords: [
      {
        type: String,
        trim: true,
      },
    ],
    videoDuration: {
      type: String,
      default: '0:45',
      trim: true,
    },
    viewsCount: {
      type: String,
      default: '2.4k',
      trim: true,
    },
    taggedProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    externalUrl: {
      type: String,
      default: '',
      trim: true,
    },
    priority: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for high-performance storefront queries
influencerVideoSchema.index({ sectionType: 1, status: 1, priority: -1 });

export const InfluencerVideo = mongoose.model('InfluencerVideo', influencerVideoSchema);
