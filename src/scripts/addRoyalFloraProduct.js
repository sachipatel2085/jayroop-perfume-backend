import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';

dotenv.config();

const run = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/jayroop_luxury_db';
    await mongoose.connect(mongoUri);
    console.log('[Script] Connected to MongoDB');

    // 1. Find or create Perfumes Category
    let perfumeCategory = await Category.findOne({ slug: 'perfumes' });
    if (!perfumeCategory) {
      perfumeCategory = await Category.findOne({ name: /perfume/i });
    }
    if (!perfumeCategory) {
      perfumeCategory = await Category.create({
        name: 'Perfumes',
        slug: 'perfumes',
        description: 'Handcrafted luxury extraits and elixirs distilled with the rarest botanicals.',
        image: {
          url: '/uploads/jayrup-royal-flora-edp-50ml.jpg',
          altText: 'Jayrup Royal Perfumes Collection',
        },
        featured: true,
        status: 'ACTIVE',
      });
      console.log('[Script] Created Perfumes Category');
    }

    // 2. Find or create Eau De Parfum Subcategory
    let edpSubCategory = await Category.findOne({ slug: 'eau-de-parfum' });
    if (!edpSubCategory) {
      edpSubCategory = await Category.create({
        name: 'Eau De Parfum',
        slug: 'eau-de-parfum',
        parent: perfumeCategory._id,
        description: 'Long-lasting eau de parfum collections crafted for all-day sillage.',
        status: 'ACTIVE',
      });
      console.log('[Script] Created Eau De Parfum Subcategory');
    }

    // 3. Upsert Royal Flora Product
    const productData = {
      name: 'Royal Flora Eau De Parfum',
      slug: 'royal-flora-eau-de-parfum',
      category: perfumeCategory._id,
      subCategory: edpSubCategory._id,
      brand: 'Jayrup',
      shortDescription:
        "Marwad ka Pahla Luxury Perfume — Royal man's first choice. Experience Royal Flora Eau De Parfum (50ml), an opulent blend of royal floral blossoms, sparkling citrus, and warm regal amber.",
      description: `
        <p>Introducing <strong>Royal Flora Eau De Parfum</strong> — Marwad ka Pahla Luxury Perfume and the royal man's first choice.</p>
        <p>Housed in an exquisite cobalt royal blue flacon with high-gloss gold trim and accompanied by our signature cylindrical presentation vault, Royal Flora embodies royal prestige, charisma, and timeless distinction.</p>
        <p>The fragrance opens with an invigorating burst of sparkling Mediterranean bergamot and fresh mandarin blossom. The heart unveils a magnificent bouquet of hand-harvested royal rose petals, night-blooming jasmine, and velvety neroli. Finally, the dry-down settles into an intoxicating, warm sillage of golden amber, royal Mysore sandalwood, and refined white oud.</p>
      `,
      price: 1999,
      salePrice: 1499,
      sku: 'JR-RF-EDP-50ML',
      stock: 50,
      images: [
        {
          url: '/uploads/jayrup-royal-flora-edp-50ml.jpg',
          altText: "Jayrup Royal Flora Eau De Parfum 50ml bottle and cylindrical packaging box - Royal man's first choice",
          isPrimary: true,
        },
      ],
      variants: [
        {
          title: '50ml',
          sku: 'JR-RF-EDP-50ML',
          price: 1999,
          salePrice: 1499,
          stock: 35,
          attributes: { volume: '50ml', concentration: 'Eau De Parfum (20%)' },
        },
        {
          title: '100ml',
          sku: 'JR-RF-EDP-100ML',
          price: 2999,
          salePrice: 2499,
          stock: 15,
          attributes: { volume: '100ml', concentration: 'Eau De Parfum (20%)' },
        },
      ],
      fragranceNotes: {
        topNotes: 'Sparkling Bergamot, Fresh Mandarin, Crisp Citrus',
        heartNotes: 'Velvety Royal Rose, Night-Blooming Jasmine, Neroli',
        baseNotes: 'Golden Amber, Mysore Sandalwood, Royal White Oud',
      },
      specifications: {
        'Volume': '50 ml | e 1.69 fl.oz',
        'Fragrance Family': 'Floral Amber Woody',
        'Concentration': 'Eau De Parfum (EDP)',
        'Top Notes': 'Sparkling Bergamot, Fresh Mandarin, Crisp Citrus',
        'Heart Notes': 'Velvety Royal Rose, Night-Blooming Jasmine, Neroli',
        'Base Notes': 'Golden Amber, Mysore Sandalwood, Royal White Oud',
        'Longevity': '12+ Hours Royal Sillage',
        'Occasion': 'Evening Gatherings, Royal Celebrations, Daily Distinction',
        'Gender': "Unisex / Men (Royal Man's First Choice)",
      },
      tags: [
        'Royal Flora',
        'Jayrup',
        'Luxury Perfume',
        'EDP',
        '50ml',
        'Royal Man',
        'Marwad Perfume',
        'Bestseller',
      ],
      featured: true,
      status: 'ACTIVE',
      averageRating: 5.0,
      numReviews: 12,
      seo: {
        metaTitle: "Royal Flora Eau De Parfum 50ml | Jayrup Royal Luxury",
        metaDescription:
          "Experience Royal Flora Eau De Parfum (50ml) by Jayrup. Marwad ka Pahla Luxury Perfume — Royal man's first choice with royal rose, bergamot & golden amber.",
        metaKeywords:
          'royal flora perfume, jayrup royal flora, luxury perfume 50ml, royal mans first choice, edp perfume, marwad luxury perfume',
        focusKeyword: 'royal flora perfume',
        canonicalUrl: 'https://jayrup.com/products/royal-flora-eau-de-parfum',
        searchIndexing: 'INDEX_FOLLOW',
      },
    };

    const existingProduct = await Product.findOne({ slug: 'royal-flora-eau-de-parfum' });
    if (existingProduct) {
      await Product.findByIdAndUpdate(existingProduct._id, productData);
      console.log(`[Script] Updated existing product: Royal Flora (${existingProduct._id})`);
    } else {
      const created = await Product.create(productData);
      console.log(`[Script] Successfully created product: Royal Flora (${created._id})`);
    }

    await mongoose.disconnect();
    console.log('[Script] Done');
    process.exit(0);
  } catch (err) {
    console.error('[Script Error]', err);
    process.exit(1);
  }
};

run();
