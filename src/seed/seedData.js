import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { Coupon } from '../models/Coupon.js';
import { Blog } from '../models/Blog.js';
import { Advertisement } from '../models/Advertisement.js';
import { Review } from '../models/Review.js';

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/jayroop_luxury_db'
    );
    console.log('[Seed] Connected to MongoDB');

    // Clear existing collections
    await User.deleteMany();
    await Category.deleteMany();
    await Product.deleteMany();
    await Coupon.deleteMany();
    await Blog.deleteMany();
    await Advertisement.deleteMany();
    await Review.deleteMany();
    console.log('[Seed] Cleared existing data');

    // 1. Seed Users
    const admin = await User.create({
      name: 'Jayroop Administrator',
      email: 'admin@jayroop.com',
      password: 'Admin@12345',
      role: 'SUPER_ADMIN',
      phone: '+91 98765 43210',
    });

    const customer = await User.create({
      name: 'Rohan Sharma',
      email: 'customer@jayroop.com',
      password: 'Customer@12345',
      role: 'CUSTOMER',
      phone: '+91 91234 56789',
      addresses: [
        {
          fullName: 'Rohan Sharma',
          phone: '+91 91234 56789',
          addressLine1: 'Villa 14, Royal Palm Residency',
          addressLine2: 'Aarey Milk Colony, Goregaon East',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400065',
          country: 'India',
          isDefault: true,
        },
      ],
    });
    console.log('[Seed] Users created: Admin & Customer');

    // 2. Seed Categories (Hierarchical parent & subcategories)
    const perfumesCategory = await Category.create({
      name: 'Perfumes',
      slug: 'perfumes',
      description: 'Handcrafted luxury extraits and elixirs distilled with the rarest botanicals.',
      image: {
        url: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&q=80&w=1000',
      },
      featured: true,
      status: 'ACTIVE',
    });

    const eauDeParfum = await Category.create({
      name: 'Eau De Parfum',
      slug: 'eau-de-parfum',
      parent: perfumesCategory._id,
      description: 'Long-lasting eau de parfum collections crafted for all-day sillage.',
      status: 'ACTIVE',
    });

    const extraitDeParfum = await Category.create({
      name: 'Extrait De Parfum',
      slug: 'extrait-de-parfum',
      parent: perfumesCategory._id,
      description: 'Highest concentration 30%+ oils for regal intensity and unforgettable presence.',
      status: 'ACTIVE',
    });

    const skincareCategory = await Category.create({
      name: 'Skincare',
      slug: 'skincare',
      description: 'Regal therapeutic botanicals and confidence-restoring formulations.',
      image: {
        url: 'https://images.unsplash.com/photo-1608248597359-543321528659?auto=format&fit=crop&q=80&w=1000',
      },
      featured: true,
      status: 'ACTIVE',
    });

    const faceCreams = await Category.create({
      name: 'Face Creams',
      slug: 'face-creams',
      parent: skincareCategory._id,
      description: 'High-efficacy blemish-clearing and rejuvenating face creams.',
      status: 'ACTIVE',
    });

    const soapsCategory = await Category.create({
      name: 'Soaps',
      slug: 'soaps',
      description: 'Cold-processed artisanal bath bars infused with royal saffron and oils.',
      image: {
        url: 'https://images.unsplash.com/photo-1607006314777-624c94fcf134?auto=format&fit=crop&q=80&w=1000',
      },
      featured: false,
      status: 'ACTIVE',
    });

    const groomingCategory = await Category.create({
      name: 'Grooming',
      slug: 'grooming',
      description: 'Gentleman luxury grooming oils and elixirs.',
      image: {
        url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=1000',
      },
      featured: false,
      status: 'ACTIVE',
    });
    console.log('[Seed] Categories and subcategories created');

    // 3. Seed Products (Generic model supporting perfume notes AND skincare specs)
    const product1 = await Product.create({
      name: 'Royal Oud Extrait de Parfum',
      slug: 'royal-oud-extrait-de-parfum',
      category: perfumesCategory._id,
      subCategory: extraitDeParfum._id,
      brand: 'Jayroop Special',
      shortDescription:
        'An opulent blend of dark smoky Cambodian Oud, saffron threads, and royal Bulgarian rose.',
      description: `
        <p>Step into an aura of timeless majesty with <strong>Royal Oud</strong>. Crafted with ultra-rare aged agarwood distilled in limited batches, this Extrait de Parfum delivers exceptional 14+ hour longevity and majestic projection.</p>
        <p>The composition opens with aromatic Sicilian bergamot and hand-harvested Kashmiri saffron before descending into a velvet heart of velvety dark rose and rich amber resin.</p>
      `,
      price: 2499,
      salePrice: 1999,
      sku: 'JR-OUD-001',
      stock: 45,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1547887537-6158d64c35b3?auto=format&fit=crop&q=80&w=1000',
          isPrimary: true,
        },
        {
          url: 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&q=80&w=1000',
          isPrimary: false,
        },
      ],
      variants: [
        {
          title: '50ml',
          sku: 'JR-OUD-50ML',
          price: 2499,
          salePrice: 1999,
          stock: 25,
          attributes: { volume: '50ml', concentration: 'Extrait (32%)' },
        },
        {
          title: '100ml',
          sku: 'JR-OUD-100ML',
          price: 3999,
          salePrice: 3499,
          stock: 20,
          attributes: { volume: '100ml', concentration: 'Extrait (32%)' },
        },
      ],
      specifications: {
        'Top Notes': 'Sicilian Bergamot, Kashmiri Saffron, Green Cardamom',
        'Heart Notes': 'Bulgarian Damask Rose, Smoky Guaiacwood, Warm Amber',
        'Base Notes': 'Royal Cambodian Oud, Sandalwood, Bourbon Vanilla',
        Longevity: '14+ Hours',
        Sillage: 'Intense / Regal',
      },
      tags: ['Oud', 'Luxury', 'Extrait', 'Evening', 'Royal'],
      featured: true,
      status: 'ACTIVE',
      seo: {
        metaTitle: 'Royal Oud Extrait de Parfum | Jayroop Luxury Fragrances',
        metaDescription: 'Shop handcrafted Royal Oud Extrait de Parfum by Jayroop.',
      },
      averageRating: 4.9,
      numReviews: 14,
    });

    const product2 = await Product.create({
      name: 'Imperial Amber Rose',
      slug: 'imperial-amber-rose',
      category: perfumesCategory._id,
      subCategory: eauDeParfum._id,
      brand: 'Jayroop Special',
      shortDescription:
        'A seductive harmony of crimson Taif rose petals wrapped in warm molten golden amber.',
      description: `
        <p><strong>Imperial Amber Rose</strong> marries the regal sensuality of freshly bloomed Taif roses with rich amber tears and sparkling pink pepper.</p>
        <p>A fragrance that commands admiration in boardrooms, gala evenings, and intimate gatherings alike.</p>
      `,
      price: 2199,
      salePrice: 1799,
      sku: 'JR-ROSE-002',
      stock: 38,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&q=80&w=1000',
          isPrimary: true,
        },
      ],
      variants: [
        {
          title: '50ml',
          sku: 'JR-ROSE-50ML',
          price: 2199,
          salePrice: 1799,
          stock: 20,
          attributes: { volume: '50ml' },
        },
        {
          title: '100ml',
          sku: 'JR-ROSE-100ML',
          price: 3499,
          salePrice: 2999,
          stock: 18,
          attributes: { volume: '100ml' },
        },
      ],
      specifications: {
        'Top Notes': 'Pink Peppercorn, Mandarin Zest, Dewy Violet',
        'Heart Notes': 'Taif Crimson Rose, Jasmine Sambac, Orris Butter',
        'Base Notes': 'Golden Amber, White Musk, Patchouli, Benzoin',
        Longevity: '10+ Hours',
        Sillage: 'Moderate to Strong',
      },
      tags: ['Floral', 'Rose', 'Amber', 'Signature'],
      featured: true,
      status: 'ACTIVE',
      averageRating: 4.8,
      numReviews: 9,
    });

    const product3 = await Product.create({
      name: 'Mysore Sandalwood & Saffron',
      slug: 'mysore-sandalwood-and-saffron',
      category: perfumesCategory._id,
      subCategory: extraitDeParfum._id,
      brand: 'Jayroop Special',
      shortDescription:
        'Pure GI-tagged Mysore sandalwood heartwood macerated with golden saffron threads.',
      description: `
        <p>A sacred meditation in fragrance. <strong>Mysore Sandalwood & Saffron</strong> delivers creamy, warm woods harmonized with royal spices.</p>
      `,
      price: 2799,
      salePrice: 2299,
      sku: 'JR-SANDAL-003',
      stock: 18,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1615397349754-cfa2066a298e?auto=format&fit=crop&q=80&w=1000',
          isPrimary: true,
        },
      ],
      variants: [
        {
          title: '50ml',
          sku: 'JR-SANDAL-50ML',
          price: 2799,
          salePrice: 2299,
          stock: 10,
          attributes: { volume: '50ml' },
        },
        {
          title: '100ml',
          sku: 'JR-SANDAL-100ML',
          price: 4499,
          salePrice: 3899,
          stock: 8,
          attributes: { volume: '100ml' },
        },
      ],
      specifications: {
        'Top Notes': 'Kashmiri Saffron, Green Cardamom, Nutmeg',
        'Heart Notes': 'Aged Mysore Sandalwood, Cedar Heart, Cashmeran',
        'Base Notes': 'White Amber, Vanilla Orchid, Clean Musk',
        Longevity: '12+ Hours',
        Sillage: 'Elegant / Sophisticated',
      },
      tags: ['Sandalwood', 'Saffron', 'Artisanal', 'Royal'],
      featured: true,
      status: 'ACTIVE',
      averageRating: 5.0,
      numReviews: 11,
    });

    // 4. Jayroop Special Pimples Cream (Skincare - matches uploaded logo & slogan)
    const pimpleCream = await Product.create({
      name: 'Jayroop Special Pimples Cream',
      slug: 'jayroop-special-pimples-cream',
      category: skincareCategory._id,
      subCategory: faceCreams._id,
      brand: 'Jayroop Special (जयरूप)',
      shortDescription:
        'पिंपल्स भागे, आत्मविश्वास जागे। The time-honored royal herbal formulation designed to clarify blemishes and restore radiant skin confidence.',
      description: `
        <p><strong>जयरूप स्पेशल क्रीम (Jayroop Special Pimples Cream)</strong> is our crown-jewel therapeutic preparation.</p>
        <p>Infused with purified neem extracts, sandalwood oil, wild turmeric, and clove essence, this formulation targets stubborn acne, soothes redness, accelerates skin regeneration, and fades dark marks.</p>
        <p><strong>Tagline:</strong> <em>पिंपल्स भागे, आत्मविश्वास जागे</em> (Free from pimples, awakened with confidence).</p>
      `,
      price: 699,
      salePrice: 499,
      sku: 'JR-SKIN-001',
      stock: 120,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=1000',
          isPrimary: true,
        },
      ],
      variants: [
        {
          title: '25g Jar',
          sku: 'JR-SKIN-25G',
          price: 699,
          salePrice: 499,
          stock: 60,
          attributes: { weight: '25g', formula: 'Herbal Blemish Care' },
        },
        {
          title: '50g Jar',
          sku: 'JR-SKIN-50G',
          price: 1199,
          salePrice: 899,
          stock: 40,
          attributes: { weight: '50g', formula: 'Herbal Blemish Care' },
        },
        {
          title: 'Duo Pack (50g x 2)',
          sku: 'JR-SKIN-DUO',
          price: 2199,
          salePrice: 1599,
          stock: 20,
          attributes: { weight: '100g (2x50g)' },
        },
      ],
      specifications: {
        'Skin Type': 'Acne-Prone, Sensitive, Blemish-Prone Skin',
        'Key Botanicals': 'Neem Bark, Turmeric, Clove Oil, Sandalwood, Lodhra',
        'Ideal For': 'Day & Night Blemish Spot Application',
        Texture: 'Fast-Absorbing Velvet Cream',
        'Country of Origin': 'India',
      },
      tags: ['Skincare', 'Jayroop Special', 'Pimples Cream', 'Acne Care', 'Ayurvedic'],
      featured: true,
      status: 'ACTIVE',
      seo: {
        metaTitle: 'Jayroop Special Pimples Cream | पिंपल्स भागे, आत्मविश्वास जागे',
        metaDescription:
          'Buy original Jayroop Special Pimples Cream online. Guaranteed clear skin and herbal acne defence.',
      },
      averageRating: 4.9,
      numReviews: 42,
    });

    // 5. Luxury Soap
    const soapProduct = await Product.create({
      name: 'Royal Saffron & Goat Milk Artisan Bar',
      slug: 'royal-saffron-and-goat-milk-artisan-bar',
      category: soapsCategory._id,
      brand: 'Jayroop Special',
      shortDescription:
        'Cold-pressed luxury bath bar enriched with fresh farm goat milk and crimson saffron.',
      description: `
        <p>Indulge your skin with a creamy, rich lather that leaves the body delicately fragranced with saffron and warm amber.</p>
      `,
      price: 399,
      salePrice: 299,
      sku: 'JR-SOAP-001',
      stock: 75,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1607006314777-624c94fcf134?auto=format&fit=crop&q=80&w=1000',
          isPrimary: true,
        },
      ],
      variants: [
        {
          title: '125g Bar',
          sku: 'JR-SOAP-125G',
          price: 399,
          salePrice: 299,
          stock: 50,
          attributes: { weight: '125g' },
        },
        {
          title: 'Trio Gift Box (3 x 125g)',
          sku: 'JR-SOAP-TRIO',
          price: 1099,
          salePrice: 799,
          stock: 25,
          attributes: { weight: '375g' },
        },
      ],
      specifications: {
        'Key Ingredients': 'Pure Saffron, Goat Milk, Cold-Pressed Sweet Almond Oil',
        'Skin Type': 'All Skin Types / Dry & Dehydrated',
        'Fragrance Notes': 'Warm Amber and Honeyed Saffron',
      },
      tags: ['Soap', 'Artisan', 'Saffron', 'Luxury Bath'],
      featured: false,
      status: 'ACTIVE',
      averageRating: 4.7,
      numReviews: 6,
    });
    // 6. Royal Flora - Marwad ka Pahla Luxury Perfume
    const royalFlora = await Product.create({
      name: 'Royal Flora Eau De Parfum',
      slug: 'royal-flora-eau-de-parfum',
      category: perfumesCategory._id,
      brand: 'Jayrup Luxury Perfume',
      shortDescription:
        "Marwad ka Pahla Luxury Perfume. Royal man's first choice in an imperial 50ml flacon.",
      description: `
        An imperial olfactory signature distilled with the majestic spirit and royal courts of Marwad. 
        Royal Flora brings forth citrus blossoms, hand-harvested Kannauj damask roses, and a heart of saffron pistils, settling into a velvet sanctuary of white amber, Mysore sandalwood, and cashmere musk. 
        Formulated at concentrated Eau De Parfum strength (50 ml | e 1.69 fl.oz) to provide mesmerizing sillage and timeless prestige.
      `,
      price: 1999,
      salePrice: 1499,
      sku: 'JR-ROYAL-FLORA-50',
      stock: 45,
      images: [
        {
          url: '/uploads/jayrup-hero-banner.jpg',
          isPrimary: true,
        },
      ],
      variants: [
        {
          title: '50ml (1.69 fl.oz)',
          sku: 'JR-FLORA-50ML',
          price: 1999,
          salePrice: 1499,
          stock: 45,
          attributes: { size: '50ml' },
        },
      ],
      specifications: {
        'Top Notes': 'Citrus Bloom, Sweet Bergamot, Pink Peppercorn',
        'Heart Notes': 'Kannauj Damask Rose, Royal Jasmine, Saffron Pistils',
        'Base Notes': 'White Amber, Mysore Sandalwood, Cashmere Musk',
        'Concentration': 'Eau De Parfum (EDP)',
        'Volume': '50 ml | e 1.69 fl.oz',
        'Gender': 'Unisex / Royal Man',
        'Edition': "Royal Man's First Choice • Marwad ka Pahla Luxury Perfume",
      },
      tags: ['Perfume', 'Royal Flora', 'Jayrup', 'Marwad', 'Luxury Perfume', 'EDP'],
      featured: true,
      status: 'ACTIVE',
      averageRating: 5.0,
      numReviews: 24,
      seo: {
        metaTitle: 'Royal Flora Eau De Parfum | Marwad ka Pahla Luxury Perfume',
        metaDescription:
          "Buy Royal Flora Eau De Parfum by Jayrup. Marwad's first luxury perfume and the royal man's first choice.",
      },
    });

    console.log('[Seed] Products created with variants & specifications');

    // 4. Seed Dynamic Advertisement & Promotional Campaign
    await Advertisement.create({
      title: 'JAYRUP',
      subtitle: 'LUXURY PERFUME',
      description:
        "Marwad ka Pahla Luxury Perfume — Royal man's first choice. Experience the sovereign majesty of Royal Flora Eau De Parfum (50ml).",
      mediaType: 'IMAGE',
      mediaUrl: '/uploads/jayrup-hero-banner.jpg',
      posterUrl: '/uploads/jayrup-hero-banner.jpg',
      ctaText: 'EXPLORE ROYAL FLORA',
      ctaUrl: '/products/royal-flora-eau-de-parfum',
      location: 'HOMEPAGE_HERO',
      priority: 10,
      status: 'ACTIVE',
    });

    await Advertisement.create({
      title: 'पिंपल्स भागे, आत्मविश्वास जागे',
      subtitle: 'JAYROOP SPECIAL CLEAR SKIN INITIATIVE',
      description:
        'Pure botanical restoration for flawless clarity. Reclaim radiant skin today with Jayroop Special.',
      mediaType: 'IMAGE',
      mediaUrl:
        'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=1400',
      posterUrl: '',
      ctaText: 'EXPLORE SKINCARE',
      ctaUrl: '/category/skincare',
      location: 'HOMEPAGE_CAMPAIGN',
      priority: 5,
      status: 'ACTIVE',
    });
    console.log('[Seed] Dynamic Hero Advertisements created');

    // 5. Seed Coupons
    await Coupon.create({
      code: 'ROYAL10',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minimumOrder: 999,
      maximumDiscount: 500,
      expiryDate: new Date('2030-12-31'),
      status: 'ACTIVE',
    });

    await Coupon.create({
      code: 'ROYAL500',
      discountType: 'FIXED',
      discountValue: 500,
      minimumOrder: 2500,
      expiryDate: new Date('2030-12-31'),
      status: 'ACTIVE',
    });
    console.log('[Seed] Promotional coupons created (ROYAL10, ROYAL500)');

    // 6. Seed Editorial Blogs
    await Blog.create({
      title: 'The Art of Royal Fragrance Layering: An Olfactory Ritual',
      slug: 'the-art-of-royal-fragrance-layering',
      excerpt:
        'Learn how ancient Maharajas combined pure sandalwood oils with distilled rose and deep oud to create an immortal personal scent trail.',
      content: `
        <p>In traditional Indian royal courts, perfumery was never a singular spray; it was a layered ceremony known as <em>Ittar-Sanskara</em>.</p>
        <h3>Step 1: The Nourishing Base</h3>
        <p>Begin by applying an ultra-pure sandalwood oil or rich unscented balm to pulse points.</p>
        <h3>Step 2: The Heart of Florals</h3>
        <p>Layer Taif Rose or Night-Blooming Jasmine at the chest and collarbones.</p>
        <h3>Step 3: The Smoky Cloak</h3>
        <p>Conclude with a mist of Royal Oud Extrait de Parfum to anchor the aroma for 14+ hours.</p>
      `,
      coverImage: {
        url: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&q=80&w=1200',
      },
      category: 'Fragrance Rituals',
      tags: ['Fragrance Layering', 'Royal Heritage', 'Oud', 'Perfume Tips'],
      readTime: '4 min read',
      status: 'PUBLISHED',
      publishedAt: new Date(),
    });

    await Blog.create({
      title: 'Restoring Skin Confidence: The Ayurvedic Science Behind Jayroop Special',
      slug: 'restoring-skin-confidence-ayurvedic-science',
      excerpt:
        'How ancient cooling herbs like wild turmeric, sandalwood, and neem eliminate toxins, fade acne, and bring back unshakeable radiance.',
      content: `
        <p>Acne is not merely a surface concern; it is a manifestation of inner Pitta imbalance and environmental stressors.</p>
        <p>By blending pure neem with micro-distilled sandalwood, Jayroop Special delivers rapid soothing without peeling or stripping the delicate skin moisture barrier.</p>
      `,
      coverImage: {
        url: 'https://images.unsplash.com/photo-1608248597359-543321528659?auto=format&fit=crop&q=80&w=1200',
      },
      category: 'Skincare Science',
      tags: ['Skincare', 'Ayurveda', 'Acne Care', 'Jayroop Special'],
      readTime: '5 min read',
      status: 'PUBLISHED',
      publishedAt: new Date(),
    });
    console.log('[Seed] Editorial articles created');

    // 7. Seed Sample Product Reviews
    await Review.create({
      product: product1._id,
      user: customer._id,
      rating: 5,
      title: 'Pure Royal Majesty',
      comment:
        'The sillage on Royal Oud is unbelievable! I received compliments from colleagues all evening. True luxury packaging and presentation.',
      verifiedPurchase: true,
      isApproved: true,
    });

    await Review.create({
      product: pimpleCream._id,
      user: customer._id,
      rating: 5,
      title: 'Actually works within 3 days!',
      comment:
        'My redness reduced overnight and old acne marks are fading fast. Truly delivers on "पिंपल्स भागे, आत्मविश्वास जागे"!',
      verifiedPurchase: true,
      isApproved: true,
    });
    console.log('[Seed] Verified reviews seeded');

    console.log('\n===============================================');
    console.log('  JAYROOP LUXURY DATABASE SEEDING COMPLETED!  ');
    console.log('===============================================');
    console.log('Admin Email:    admin@jayroop.com');
    console.log('Admin Password: Admin@12345');
    console.log('Customer Email: customer@jayroop.com');
    console.log('Customer Pass:  Customer@12345');
    console.log('===============================================\n');

    process.exit(0);
  } catch (error) {
    console.error(`[Seed Error] Seeding failed: ${error.message}`);
    process.exit(1);
  }
};

seedDatabase();
