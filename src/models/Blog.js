import mongoose from 'mongoose';

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please enter blog title'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    excerpt: {
      type: String,
      required: [true, 'Please enter an excerpt'],
      trim: true,
      maxlength: [400, 'Excerpt cannot exceed 400 characters'],
    },
    content: {
      type: String,
      required: [true, 'Please provide blog content'],
    },
    coverImage: {
      url: { type: String, required: true },
      publicId: { type: String, default: '' },
      altText: { type: String, default: '', trim: true },
    },
    author: {
      type: String,
      default: 'Jayrup Editorial House',
    },
    category: {
      type: String,
      default: 'Fragrance & Skincare',
      trim: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    readTime: {
      type: String,
      default: '5 min read',
    },
    status: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED'],
      default: 'PUBLISHED',
      index: true,
    },
    seo: {
      metaTitle: { type: String, default: '', trim: true },
      metaDescription: { type: String, default: '', trim: true },
      metaKeywords: { type: String, default: '', trim: true },
      focusKeyword: { type: String, default: '', trim: true },
      canonicalUrl: { type: String, default: '', trim: true },
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const Blog = mongoose.model('Blog', blogSchema);
