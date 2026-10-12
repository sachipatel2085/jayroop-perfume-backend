import mongoose from 'mongoose';
import { PRODUCT_TYPE_KEYS } from '../config/productTypes.js';

const variantSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true }, // e.g. "15 g", "50 ml", "Pack of 2"
  sku: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 }, // MRP / regular price (tax inclusive)
  salePrice: { type: Number, default: null, min: 0 }, // selling price (tax inclusive)
  stock: { type: Number, default: 0, min: 0 },
  weight: { type: Number, default: null, min: 0 }, // grams (shipping weight)
  netQuantity: { type: String, default: '', trim: true }, // Legal Metrology net quantity of this pack: "15 g", "50 ml"
  barcode: { type: String, default: '', trim: true }, // GTIN / EAN
  attributes: {
    type: Map,
    of: String,
    default: {},
  },
});

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true, maxlength: 300 },
    answer: { type: String, required: true, trim: true, maxlength: 3000 },
  },
  { _id: false }
);

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
      default: 'Jayrup',
      trim: true,
    },
    // Drives tax defaults (HSN), PDP sections, return rules, shipping mode and SEO category.
    // See src/config/productTypes.js – add new kinds of products there.
    productType: { type: String, enum: [...PRODUCT_TYPE_KEYS, ''], default: '', index: true },
    shortDescription: {
      type: String,
      trim: true,
      maxlength: [500, 'Short description cannot exceed 500 characters'],
    },
    // Long-form rich HTML (written with the admin block editor)
    description: {
      type: String,
      required: [true, 'Please enter detailed product description'],
    },

    // ───────────── Pricing (all prices are GST-inclusive) ─────────────
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
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    maxPerOrder: { type: Number, default: 10, min: 1 },

    // ───────────── Tax (GST) ─────────────
    // Empty → category → product type → Settings › Invoices (see resolveTax in config/productTypes.js)
    hsnCode: { type: String, default: '', trim: true },
    gstRate: { type: Number, default: null, min: 0, max: 40 },

    // ───────────── Media ─────────────
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String, default: '' },
        altText: { type: String, default: '', trim: true },
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
    // ───────────── Fragrance details (perfumes, attars, mists, scented body care) ─────────────
    fragranceNotes: {
      topNotes: { type: String, default: '', trim: true },
      heartNotes: { type: String, default: '', trim: true },
      baseNotes: { type: String, default: '', trim: true },
    },
    fragrance: {
      family: { type: String, default: '', trim: true }, // Floral, Woody, Oriental/Amber, Fresh, Citrus, Gourmand, Aquatic, Musky
      concentration: { type: String, default: '', trim: true }, // Eau de Parfum, Eau de Toilette, Parfum, Attar, Body Mist
      longevity: { type: String, default: '', trim: true }, // "6–8 hours"
      sillage: { type: String, default: '', trim: true }, // Soft, Moderate, Strong
      season: [{ type: String, trim: true }], // Summer, Winter, Monsoon, All seasons
      occasion: [{ type: String, trim: true }], // Daily wear, Office, Evening, Wedding
    },

    // ───────────── Rich product information (shown as PDP sections + used in SEO) ─────────────
    highlights: [{ type: String, trim: true, maxlength: 200 }], // key benefit bullets above the fold
    benefits: { type: String, default: '' }, // rich HTML
    ingredients: { type: String, default: '' }, // rich HTML / plain list
    howToUse: { type: String, default: '' }, // rich HTML
    precautions: { type: String, default: '' }, // rich HTML (external use only, patch test …)
    skinTypes: [{ type: String, trim: true }], // skin / hair types the product suits
    concerns: [{ type: String, trim: true }], // concerns it addresses (any product type)
    gender: { type: String, enum: ['UNISEX', 'MEN', 'WOMEN', ''], default: 'UNISEX' },
    faqs: [faqSchema],

    // ───────────── Legal Metrology (Packaged Commodities) Rules 2011 – e-commerce declarations ─────────────
    netQuantity: { type: String, default: '', trim: true }, // "15 g", "50 ml"
    weight: { type: Number, default: null, min: 0 }, // shipping weight in grams
    dimensions: {
      length: { type: Number, default: null, min: 0 }, // cm
      width: { type: Number, default: null, min: 0 },
      height: { type: Number, default: null, min: 0 },
    },
    barcode: { type: String, default: '', trim: true }, // GTIN / EAN-13
    countryOfOrigin: { type: String, default: 'India', trim: true },
    shelfLife: { type: String, default: '', trim: true }, // "24 months from manufacturing"
    manufacturerDetails: { type: String, default: '', trim: true },
    marketedBy: { type: String, default: '', trim: true },
    packerDetails: { type: String, default: '', trim: true },
    importerDetails: { type: String, default: '', trim: true },
    licenseNumber: { type: String, default: '', trim: true }, // cosmetic manufacturing licence
    customerCareDetails: { type: String, default: '', trim: true },

    // ───────────── Per-product policy & shipping overrides (null → product-type default) ─────────────
    returnPolicy: {
      returnable: { type: Boolean, default: null }, // e.g. perfumes default to non-returnable once opened
      note: { type: String, default: '', trim: true, maxlength: 500 }, // shown on the product page
    },
    shipping: {
      surfaceOnly: { type: Boolean, default: null }, // flammable (perfume) → courier ships by surface
      note: { type: String, default: '', trim: true, maxlength: 300 },
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
      metaTitle: { type: String, default: '', trim: true },
      metaDescription: { type: String, default: '', trim: true },
      metaKeywords: { type: String, default: '', trim: true },
      focusKeyword: { type: String, default: '', trim: true },
      canonicalUrl: { type: String, default: '', trim: true },
      ogTitle: { type: String, default: '', trim: true },
      ogDescription: { type: String, default: '', trim: true },
      ogImage: { type: String, default: '', trim: true },
      searchIndexing: {
        type: String,
        enum: ['INDEX_FOLLOW', 'NOINDEX_NOFOLLOW'],
        default: 'INDEX_FOLLOW',
      },
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
    totalSold: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
  }
);

// Effective selling price helper (GST inclusive)
productSchema.methods.effectivePrice = function () {
  return this.salePrice && this.salePrice < this.price ? this.salePrice : this.price;
};

// Compound text index for powerful search
productSchema.index({ name: 'text', brand: 'text', tags: 'text', shortDescription: 'text' });

export const Product = mongoose.model('Product', productSchema);
