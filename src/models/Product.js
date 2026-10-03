import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true }, // e.g., "50ml", "100ml", "100g", "50g Cream"
  sku: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  salePrice: { type: Number, default: null, min: 0 },
  stock: { type: Number, default: 0, min: 0 },
  attributes: {
    type: Map,
    of: String,
    default: {},
  },
});

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please enter product name'],
      trim: true,
      maxlength: [200, 'Product name cannot exceed 200 characters'],
      index: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Please select a product category'],
      index: true,
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    brand: {
      type: String,
      default: 'Jayrup Special',
      trim: true,
    },
    shortDescription: {
      type: String,
      trim: true,
      maxlength: [500, 'Short description cannot exceed 500 characters'],
    },
    description: {
      type: String,
      required: [true, 'Please enter detailed product description'],
    },
    price: {
      type: Number,
      required: [true, 'Please enter product base price'],
      min: 0,
    },
    salePrice: {
      type: Number,
      default: null,
      min: 0,
    },
    sku: {
      type: String,
      required: [true, 'Please enter SKU'],
      unique: true,
      trim: true,
      index: true,
    },
    stock: {
      type: Number,
      required: [true, 'Please enter inventory stock'],
      default: 0,
      min: 0,
    },
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String, default: '' },
        isPrimary: { type: Boolean, default: false },
      },
    ],
    videos: [
      {
        url: { type: String, required: true },
        publicId: { type: String, default: '' },
        title: { type: String, default: '' },
      },
    ],
    variants: [variantSchema],
    specifications: {
      type: Map,
      of: String,
      default: {},
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    featured: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'DRAFT', 'ARCHIVED'],
      default: 'ACTIVE',
      index: true,
    },
    seo: {
      metaTitle: { type: String, default: '' },
      metaDescription: { type: String, default: '' },
      canonicalUrl: { type: String, default: '' },
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    numReviews: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound text index for powerful search
productSchema.index({ name: 'text', brand: 'text', tags: 'text', shortDescription: 'text' });

export const Product = mongoose.model('Product', productSchema);
