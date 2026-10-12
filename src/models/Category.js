import mongoose from 'mongoose';
import { PRODUCT_TYPE_KEYS } from '../config/productTypes.js';

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please enter category name'],
      trim: true,
      maxlength: [100, 'Category name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Category slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    image: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
      altText: { type: String, default: '', trim: true },
    },
    featured: {
      type: Boolean,
      default: false,
    },
    sortOrder: { type: Number, default: 0 },
    // Defaults inherited by every product in this category (each product can still override)
    productType: { type: String, enum: [...PRODUCT_TYPE_KEYS, ''], default: '' },
    hsnCode: { type: String, default: '', trim: true },
    gstRate: { type: Number, default: null, min: 0, max: 40 },
    googleProductCategory: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true,
    },
    seo: {
      metaTitle: { type: String, default: '', trim: true },
      metaDescription: { type: String, default: '', trim: true },
      metaKeywords: { type: String, default: '', trim: true },
      focusKeyword: { type: String, default: '', trim: true },
      canonicalUrl: { type: String, default: '', trim: true },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for child subcategories
categorySchema.virtual('subcategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent',
});

export const Category = mongoose.model('Category', categorySchema);
