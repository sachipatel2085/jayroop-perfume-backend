/**
 * Jayrup catalogue – the single source for `npm run seed:catalog`.
 *
 * Every field matches the Admin › Products form, so seeded products can be edited in the admin
 * exactly like products created by hand. Facts (ingredients, manufacturer, net quantity, MRP …)
 * are taken from the printed packs. Prices are the pack MRP – change them any time in the admin.
 *
 * Images live in the storefront: jayroop-perfume-frontend/public/images/products/
 */

const MARKETED_BY = 'Jayrup, G-28 Metropolis Complex, Bhiloda Road, Gambhoi, Himatnagar, Sabarkantha, Gujarat – 383030, India';
const CUSTOMER_CARE = '+91 63594 95647 · care@jayrup.in · jayrup.in';

// ───────────────────────────── CATEGORIES ─────────────────────────────
// image  → wide banner (1600×560) in jayroop-perfume-frontend/public/images/categories/
// intro  → one plain sentence shown in the category banner
// description → rich "About" text shown under the products (the long-form SEO content)
// faqs   → shown on the page and published as FAQPage structured data
export const CATEGORIES = [
  {
    key: 'perfumes',
    name: 'Luxury Perfumes',
    slug: 'perfumes',
    productType: 'FRAGRANCE',
    hsnCode: '3303',
    gstRate: 18,
    googleProductCategory: 'Health & Beauty > Personal Care > Cosmetics > Perfume & Cologne',
    sortOrder: 1,
    featured: true,
    status: 'ACTIVE',
    image: {
      url: '/images/categories/luxury-perfumes.webp',
      altText: 'Jayrup luxury perfumes for men – Royal Flora Eau de Parfum 50 ml bottle with gift tube',
    },
    intro:
      'Long-lasting Eau de Parfum made in India, in premium gift-ready packs. Meet Royal Flora – Marwad ka Pahla Luxury Perfume and the royal man’s first choice.',
    description: `<h2>Luxury perfumes for men, made in India</h2>
<p><strong>Jayrup Luxury Perfumes</strong> are created for people who like to be remembered. Every fragrance is an <strong>Eau de Parfum (EDP)</strong> – a higher concentration of perfume oil than a deodorant or body mist – so a few sprays carry you through the day.</p>
<h3>Why choose a Jayrup perfume</h3>
<ul>
<li><strong>Long lasting:</strong> Eau de Parfum strength for all-day presence.</li>
<li><strong>Gift-ready:</strong> a premium bottle in a matching gift tube – ideal for birthdays, weddings and festivals.</li>
<li><strong>Cruelty free</strong> and made in India.</li>
<li><strong>Value:</strong> luxury feel at an everyday price, with secure PhonePe and Cash on Delivery checkout.</li>
</ul>
<h3>Royal Flora Eau de Parfum 50 ml</h3>
<p><strong>Royal Flora</strong> is our signature scent – <em>Marwad ka Pahla Luxury Perfume</em> – a confident, royal fragrance for men that works for office, evenings and celebrations.</p>
<h3>How to make your perfume last longer</h3>
<ol>
<li>Spray on pulse points – neck, wrists and behind the ears – from about 15 cm away.</li>
<li>Apply right after a shower, on clean and moisturised skin.</li>
<li>Don’t rub your wrists together; let the perfume settle on its own.</li>
<li>Store the bottle in a cool, dry place away from direct sunlight.</li>
</ol>`,
    faqs: [
      {
        question: 'How long does Jayrup perfume last?',
        answer: 'Jayrup perfumes are Eau de Parfum (EDP), which has a higher perfume-oil concentration than deodorants or body mists, so the fragrance lasts for many hours. Longevity varies with skin type and weather – applying on moisturised skin and pulse points helps it last longer.',
      },
      {
        question: 'Is Jayrup Royal Flora a perfume for men?',
        answer: 'Yes. Royal Flora is crafted as a royal, confident fragrance for men – “Royal man’s first choice”. Many people also buy it as a gift.',
      },
      {
        question: 'Is the perfume original and cruelty free?',
        answer: 'Yes. Every Jayrup perfume sold on jayrup.in is a genuine product shipped directly by Jayrup, and our perfumes are cruelty free.',
      },
      {
        question: 'Do you offer Cash on Delivery for perfumes?',
        answer: 'Yes. You can pay securely online with PhonePe (UPI, cards, net banking) or choose Cash on Delivery at checkout, with delivery across India.',
      },
      {
        question: 'Can I return a perfume?',
        answer: 'For hygiene and safety reasons, opened perfumes cannot be returned. If your order arrives damaged or wrong, contact us within the return window shown in our Return & Refund Policy and we will make it right.',
      },
    ],
    seo: {
      metaTitle: 'Luxury Perfumes for Men – Long Lasting Eau de Parfum | Jayrup',
      metaDescription:
        'Shop Jayrup luxury perfumes for men – long-lasting Eau de Parfum made in India in premium gift packs. Royal Flora EDP 50 ml. PhonePe & COD, delivery across India.',
      metaKeywords:
        'jayrup perfume, luxury perfume for men, long lasting perfume for men, eau de parfum india, royal flora perfume, perfume gift for men, best perfume for men in india',
      focusKeyword: 'luxury perfume for men',
      canonicalUrl: '',
    },
  },
  {
    key: 'ayurvedic',
    name: 'Ayurvedic Skin Care',
    slug: 'skincare',
    productType: 'AYURVEDIC',
    hsnCode: '30049011',
    gstRate: 5,
    googleProductCategory: 'Health & Beauty > Personal Care > Cosmetics > Skin Care > Acne Treatments & Kits',
    sortOrder: 2,
    featured: true,
    status: 'ACTIVE',
    image: {
      url: '/images/categories/ayurvedic-skin-care.webp',
      altText: 'Jayrup Ayurvedic skin care – Jayrup Pimples Cream 20 g Ayurvedic proprietary medicine jar',
    },
    intro:
      'Classical Ayurvedic herbs for everyday skin concerns – made in a licensed, GMP-certified facility. Discover Jayrup Pimples Cream for pimple-prone skin.',
    description: `<h2>Ayurvedic care for pimple-prone skin</h2>
<p><strong>Jayrup Ayurvedic Skin Care</strong> brings time-tested Ayurvedic herbs to modern skin concerns. Our products are licensed <strong>Ayurvedic proprietary medicines</strong>, made in a GMP-certified facility, and are meant for <strong>external use only</strong>.</p>
<h3>Jayrup Pimples Cream – 20 g</h3>
<p>An Ayurvedic cream with a herbal base of <strong>Neem (Azadirachta indica)</strong> and <strong>Karanj (Pongamia pinnata)</strong> oils, with <strong>Manjistha, Daruhaldi, Bakuchi, Chirata</strong>, <strong>Camphor</strong> and <strong>Sulphur</strong> – a classical Ayurvedic formula for skin care.</p>
<h3>Why Jayrup Ayurvedic skin care</h3>
<ul>
<li><strong>Licensed Ayurvedic medicine</strong> – Mfg. Lic. No. 518 D.</li>
<li><strong>Herbal formula</strong> based on classical Ayurvedic ingredients.</li>
<li><strong>Small, travel-friendly 20 g jar</strong> – easy to carry.</li>
<li>Secure PhonePe and Cash on Delivery checkout, delivery across India.</li>
</ul>
<h3>How to use</h3>
<ol>
<li>Wash your face with a mild cleanser and pat dry.</li>
<li>Apply a thin layer only on the affected area, as directed on the pack or by your physician.</li>
<li>Do a patch test first if you have sensitive skin. Avoid contact with eyes.</li>
</ol>
<div data-callout="warning" class="callout callout-warning"><p>For external use only. Keep out of reach of children. Store in a cool, dry place away from direct sunlight. If irritation occurs, stop use and consult a doctor.</p></div>`,
    faqs: [
      {
        question: 'What is Jayrup Pimples Cream?',
        answer: 'Jayrup Pimples Cream is an Ayurvedic proprietary medicine for external use on pimple-prone skin. It is made in a licensed, GMP-certified facility (Mfg. Lic. No. 518 D).',
      },
      {
        question: 'What are the main ingredients?',
        answer: 'The cream has a herbal base of Neem (Azadirachta indica) and Karanj (Pongamia pinnata) oils with Manjistha, Daruhaldi, Bakuchi, Chirata, Camphor and Sulphur. The full ingredient list is printed on the pack and on the product page.',
      },
      {
        question: 'How do I apply the Ayurvedic pimple cream?',
        answer: 'Cleanse and dry the skin, then apply a thin layer only on the affected area as directed on the pack or by your physician. Do a patch test first if your skin is sensitive, and avoid the eyes.',
      },
      {
        question: 'Is it suitable for all skin types?',
        answer: 'It is meant for external use on pimple-prone skin. Because everyone’s skin is different, we recommend a patch test before regular use. If irritation occurs, stop use and consult a doctor.',
      },
      {
        question: 'Do you deliver across India with Cash on Delivery?',
        answer: 'Yes. Pay securely with PhonePe (UPI, cards, net banking) or choose Cash on Delivery, with delivery across India.',
      },
    ],
    seo: {
      metaTitle: 'Ayurvedic Cream for Pimples & Acne-Prone Skin | Jayrup',
      metaDescription:
        'Jayrup Ayurvedic skin care – Pimples Cream 20 g with Neem, Karanj, Manjistha & Daruhaldi for pimple-prone skin. Licensed Ayurvedic medicine, GMP made. COD available.',
      metaKeywords:
        'ayurvedic pimple cream, ayurvedic cream for pimples, herbal pimple cream, ayurvedic acne cream, neem pimple cream, jayrup pimples cream, pimple cream for oily skin',
      focusKeyword: 'ayurvedic pimple cream',
      canonicalUrl: '',
    },
  },
];

// ───────────────────────────── PRODUCTS ─────────────────────────────
export const PRODUCTS = [
  // ═══════════════════════ 1. ROYAL FLORA EAU DE PARFUM 50 ML ═══════════════════════
  {
    categoryKey: 'perfumes',
    name: 'Jayrup Royal Flora Eau De Parfum 50 ml',
    slug: 'jayrup-royal-flora-eau-de-parfum-50ml',
    brand: 'Jayrup',
    productType: 'FRAGRANCE',
    sku: 'JR-RF-EDP-50',
    price: 499, // pack MRP (incl. of all taxes) – edit in Admin › Products
    salePrice: null,
    stock: 50, // set your real stock in Admin › Inventory
    lowStockThreshold: 5,
    maxPerOrder: 10,
    hsnCode: '', // inherits 3303 from category / product type
    gstRate: null, // inherits 18 % from category
    gender: 'MEN',
    featured: true,
    status: 'ACTIVE',
    netQuantity: '50 ml (1.69 fl. oz)',
    weight: null, // shipping weight in grams – weigh one packed unit and fill in
    dimensions: { length: null, width: null, height: null },
    barcode: '',
    countryOfOrigin: 'India',
    shelfLife: 'Best before 36 months from the date of manufacture (printed on the pack)',
    manufacturerDetails: 'Hulo Fashion Private Limited, Jaipur, Rajasthan, India (Mfg. & Pkd. by)',
    marketedBy: MARKETED_BY,
    packerDetails: 'Hulo Fashion Private Limited, Jaipur, Rajasthan, India',
    importerDetails: '',
    licenseNumber: '',
    customerCareDetails: CUSTOMER_CARE,
    images: [
      { url: '/images/products/royal-flora-edp-50ml-1.webp', altText: 'Jayrup Royal Flora Eau de Parfum 50 ml bottle with premium gift tube' },
      { url: '/images/products/royal-flora-edp-50ml-2.webp', altText: 'Jayrup Royal Flora EDP 50 ml perfume bottle close-up' },
      { url: '/images/products/royal-flora-edp-50ml-6.webp', altText: 'Royal Flora Eau de Parfum features – long lasting, cruelty free, made in India' },
      { url: '/images/products/royal-flora-edp-50ml-3.webp', altText: 'Jayrup Royal Flora – Marwad ka Pahla Luxury Perfume campaign' },
      { url: '/images/products/royal-flora-edp-50ml-4.webp', altText: 'Jayrup Royal Flora gift tube – Royal man’s first choice' },
      { url: '/images/products/royal-flora-edp-50ml-5.webp', altText: 'Royal Flora pack label – ingredients, MRP, batch and best-before details' },
    ],
    videos: [],
    variants: [],
    specifications: {
      Concentration: 'Eau de Parfum (EDP)',
      'Net volume': '50 ml | 1.69 fl. oz',
      'Ideal for': 'Men',
      Application: 'Spray from 15–20 cm',
      Packaging: 'Spray bottle in a premium rigid gift tube',
      'Animal testing': 'Cruelty free',
    },
    fragranceNotes: { topNotes: '', heartNotes: '', baseNotes: '' },
    fragrance: {
      family: '',
      concentration: 'Eau de Parfum',
      longevity: 'Long lasting',
      sillage: '',
      season: ['All seasons'],
      occasion: ['Daily wear', 'Office', 'Evening', 'Wedding / festive', 'Gifting'],
    },
    returnPolicy: { returnable: null, note: '' }, // perfume default: not returnable once opened, damaged/leaking replaced
    shipping: { surfaceOnly: null, note: '' }, // perfume default: surface shipping (flammable)
    highlights: [
      'Eau de Parfum concentration for a rich, long-lasting trail',
      'Marwad ka Pahla Luxury Perfume – the royal man’s first choice',
      '50 ml spray in a premium, gift-ready rigid tube',
      'Cruelty free · Made in India',
      'A memorable gift for birthdays, weddings and festivals',
    ],
    shortDescription:
      'Jayrup Royal Flora is a long-lasting Eau de Parfum for men – Marwad ka Pahla Luxury Perfume. A confident, refined signature scent in a 50 ml spray, presented in a premium gift tube. Cruelty free and made in India.',
    description: `<h2>Royal Flora – Marwad ka Pahla Luxury Perfume</h2>
<p><strong>Jayrup Royal Flora Eau de Parfum</strong> is created for the man who walks in with presence and leaves a lasting impression. Born from the royal spirit of Marwad, it is the first luxury perfume from the region – crafted to feel bold, polished and unmistakably regal from the very first spray.</p>
<div data-callout="tip" class="callout callout-tip"><p><strong>Royal man’s first choice.</strong> One fragrance for the office, the evening out and the big celebrations – a signature scent people remember you by.</p></div>
<h3>Why you’ll love Royal Flora</h3>
<ul>
<li><strong>Eau de Parfum strength</strong> – a higher fragrance concentration than everyday deodorants and body sprays, so the scent stays with you longer.</li>
<li><strong>Long lasting</strong> – made to carry from morning meetings into the evening.</li>
<li><strong>Premium presentation</strong> – a weighted glass bottle with gold detailing inside a rigid gift tube.</li>
<li><strong>Cruelty free</strong> – not tested on animals.</li>
<li><strong>Made in India</strong> – manufactured and packed in Jaipur, Rajasthan.</li>
</ul>
<h3>Perfect for</h3>
<ul>
<li>Daily wear and office</li>
<li>Evenings, dates and parties</li>
<li>Weddings, festivals and family functions</li>
<li>Gifting – birthdays, anniversaries, Raksha Bandhan, Diwali and more</li>
</ul>
<h3>At a glance</h3>
<table>
<tbody>
<tr><th>Product</th><td>Jayrup Royal Flora Eau de Parfum</td></tr>
<tr><th>Concentration</th><td>Eau de Parfum (EDP)</td></tr>
<tr><th>Net volume</th><td>50 ml | 1.69 fl. oz</td></tr>
<tr><th>Ideal for</th><td>Men</td></tr>
<tr><th>Manufactured &amp; packed by</th><td>Hulo Fashion Private Limited, Jaipur</td></tr>
<tr><th>Marketed by</th><td>Jayrup, Himatnagar, Gujarat</td></tr>
<tr><th>Country of origin</th><td>India</td></tr>
<tr><th>Shelf life</th><td>Best before 36 months from manufacture</td></tr>
</tbody>
</table>
<h3>How to make your perfume last longer</h3>
<ol>
<li>Apply on clean, moisturised skin – fragrance holds better on hydrated skin.</li>
<li>Spray from a distance of <strong>15–20 cm</strong> on pulse points: neck, behind the ears, wrists and chest.</li>
<li>Do not rub your wrists together – let the perfume settle on its own.</li>
<li>Store the bottle in its tube, in a cool and dry place, away from direct sunlight.</li>
</ol>
<div data-callout="info" class="callout callout-info"><p><strong>Genuine Jayrup.</strong> Every bottle is sold directly by the brand, with batch number, date of manufacture and MRP printed on the pack.</p></div>`,
    benefits: `<ul>
<li><strong>Long-lasting Eau de Parfum</strong> – a rich trail that stays with you through the day.</li>
<li><strong>Confident, royal character</strong> – a refined signature scent for the modern man.</li>
<li><strong>Versatile</strong> – right for work, evenings and celebrations.</li>
<li><strong>Gift-ready</strong> – premium rigid tube, no extra wrapping needed.</li>
<li><strong>Cruelty free &amp; made in India.</strong></li>
</ul>`,
    ingredients: `<p><strong>Ingredients (as printed on the pack):</strong> Denatured Ethyl Alcohol (99.9% v/v), Linalool, Geraniol, Limonene, Eugenol, Fragrance Oil.</p>`,
    howToUse: `<ol>
<li>Hold the bottle <strong>15–20 cm</strong> away from skin or clothing (this also avoids stains).</li>
<li>Spray 2–3 times on pulse points – neck, behind the ears, wrists and chest.</li>
<li>Let it dry naturally; do not rub.</li>
</ol>`,
    precautions: `<div data-callout="warning" class="callout callout-warning"><p><strong>Flammable.</strong> Keep away from fire, flame, heat and sparks. Do not smoke while spraying.</p></div>
<ul>
<li>For external use only.</li>
<li>Avoid contact with eyes; do not spray on broken or irritated skin.</li>
<li>Do a patch test if you have sensitive skin; discontinue use if irritation occurs.</li>
<li>Keep out of reach of children.</li>
<li>Store in a cool and dry place, away from direct sunlight.</li>
</ul>`,
    skinTypes: [],
    concerns: [],
    faqs: [
      {
        question: 'Is Jayrup Royal Flora an Eau de Parfum or Eau de Toilette?',
        answer: 'Royal Flora is an Eau de Parfum (EDP). EDPs have a higher fragrance concentration than Eau de Toilettes and body sprays, so they last longer on the skin.',
      },
      {
        question: 'Is Royal Flora for men?',
        answer: 'Yes. Royal Flora is crafted as the “Royal man’s first choice” – a confident signature scent for men. Many women enjoy wearing it too.',
      },
      {
        question: 'How long does Royal Flora last?',
        answer: 'Royal Flora is a long-lasting Eau de Parfum. Exactly how long any perfume lasts depends on your skin, the weather and where you apply it – for the best result spray on moisturised pulse points and on clothing from 15–20 cm.',
      },
      {
        question: 'What is the size and what comes in the box?',
        answer: 'You get one 50 ml (1.69 fl. oz) spray bottle of Royal Flora Eau de Parfum packed in a premium rigid gift tube.',
      },
      {
        question: 'Is it a good gift?',
        answer: 'Absolutely. Royal Flora comes in a premium gift tube, so it is ready to give for birthdays, anniversaries, weddings, Raksha Bandhan, Diwali and other occasions.',
      },
      {
        question: 'Is Royal Flora original and where is it made?',
        answer: 'Yes. Royal Flora is sold directly by Jayrup. It is manufactured and packed by Hulo Fashion Private Limited, Jaipur, and marketed by Jayrup, Himatnagar (Gujarat). Batch number, date of manufacture and MRP are printed on every pack.',
      },
      {
        question: 'Why does perfume delivery take a little longer?',
        answer: 'Alcohol-based perfumes are classed as flammable by courier companies, so they travel by surface (road/rail) instead of air. This can add 2–3 business days; the expected delivery time is shown before you pay.',
      },
      {
        question: 'Can I return the perfume?',
        answer: 'For hygiene reasons perfumes cannot be returned once the seal is opened or the product is used. If your bottle arrives broken, leaking or you receive the wrong item, report it within 3 days of delivery from My Orders and we will replace it or refund you.',
      },
    ],
    tags: [
      'royal flora',
      'jayrup perfume',
      'royal flora perfume',
      'eau de parfum',
      'perfume for men',
      'luxury perfume',
      'long lasting perfume',
      'marwad perfume',
      'gift for men',
      '50 ml perfume',
      'made in india perfume',
    ],
    seo: {
      metaTitle: 'Jayrup Royal Flora EDP 50ml – Long Lasting Perfume for Men',
      metaDescription:
        'Buy Jayrup Royal Flora Eau De Parfum 50 ml – long-lasting luxury perfume for men, Marwad ka Pahla Luxury Perfume. Made in India, gift-ready tube. COD available.',
      metaKeywords:
        'jayrup royal flora, royal flora perfume, jayrup perfume, eau de parfum for men, long lasting perfume for men, luxury perfume india, perfume gift for men, marwad perfume',
      focusKeyword: 'Royal Flora',
      canonicalUrl: '',
      ogTitle: '',
      ogDescription: '',
      ogImage: '/images/products/royal-flora-edp-50ml-3.webp',
      searchIndexing: 'INDEX_FOLLOW',
    },
  },

  // ═══════════════════════ 2. JAYRUP PIMPLES CREAM 20 G (AYURVEDIC) ═══════════════════════
  {
    categoryKey: 'ayurvedic',
    name: 'Jayrup Pimples Cream – Ayurvedic Cream 20 g',
    slug: 'jayrup-pimples-cream', // same URL as the old WordPress product → keeps Google ranking
    brand: 'Jayrup',
    productType: 'AYURVEDIC',
    sku: 'JR-PC-20',
    price: 499, // pack MRP (incl. of all taxes) – edit in Admin › Products
    salePrice: null,
    stock: 100,
    lowStockThreshold: 10,
    maxPerOrder: 10,
    hsnCode: '', // inherits 30049011 (Ayurvedic medicament) from category
    gstRate: null, // inherits 5 % from category
    gender: 'UNISEX',
    featured: true,
    status: 'ACTIVE',
    netQuantity: '20 g',
    weight: null,
    dimensions: { length: null, width: null, height: null },
    barcode: '',
    countryOfOrigin: 'India',
    shelfLife: '36 months from the date of manufacture – expiry date printed on every pack',
    manufacturerDetails: 'Radha Pharmacy, Behind Arya Samaj, Sheoganj, Rajasthan – 307027, India',
    marketedBy: MARKETED_BY,
    packerDetails: 'Radha Pharmacy, Sheoganj, Rajasthan – 307027, India',
    importerDetails: '',
    licenseNumber: 'Mfg. Lic. No. 518 D (Ayurvedic)',
    customerCareDetails: CUSTOMER_CARE,
    images: [
      { url: '/images/products/pimples-cream-20g-1.webp', altText: 'Jayrup Pimples Cream 20 g Ayurvedic cream jar with Mfg. Lic. No. 518 D label' },
      { url: '/images/products/pimples-cream-20g-4.webp', altText: 'Jayrup Pimples Cream features – Ayurvedic formula, licensed GMP manufacture, made in Bharat' },
      { url: '/images/products/pimples-cream-20g-3.webp', altText: 'Jayrup Pimples Cream ingredients – Neem, Karanj, Manjistha, Daruhaldi, Bakuchi, Chirata, Camphor' },
      { url: '/images/products/pimples-cream-20g-2.webp', altText: 'Jayrup Pimples Cream pack – Ayurvedic proprietary medicine, for external use only' },
    ],
    videos: [],
    variants: [],
    specifications: {
      Type: 'Ayurvedic Proprietary Medicine',
      Use: 'External use only',
      'Net weight': '20 g',
      Form: 'Cream / ointment base',
      'Key herbs': 'Neem, Karanj, Manjistha, Daruhaldi, Bakuchi, Chirata, Chakramard, Camphor',
      Manufacture: 'GMP facility · Mfg. Lic. No. 518 D',
      'For sale in': 'India and Nepal',
    },
    fragranceNotes: { topNotes: '', heartNotes: '', baseNotes: '' },
    fragrance: { family: '', concentration: '', longevity: '', sillage: '', season: [], occasion: [] },
    returnPolicy: { returnable: null, note: '' }, // Ayurvedic medicine default: not returnable once opened
    shipping: { surfaceOnly: null, note: '' },
    highlights: [
      'Ayurvedic proprietary medicine for pimple-prone skin',
      'Neem & Karanj oils with Manjistha, Daruhaldi, Bakuchi and Chirata',
      'Made in a GMP-certified facility – Mfg. Lic. No. 518 D',
      'Easy-to-carry 20 g jar · for external use only',
      'Made in Bharat',
    ],
    shortDescription:
      'Jayrup Pimples Cream is an Ayurvedic proprietary medicine for external use, made with Neem oil, Karanj oil, Manjistha, Daruhaldi, Bakuchi, Chirata, Camphor and Sulphur – a classical herbal formula for pimple-prone skin. 20 g jar, manufactured in a GMP facility (Mfg. Lic. No. 518 D).',
    description: `<h2>Jayrup Pimples Cream – Ayurvedic care for pimple-prone skin</h2>
<p><strong>Jayrup Pimples Cream</strong> is an <strong>Ayurvedic proprietary medicine</strong> made for people who deal with pimples and acne-prone, oily skin. It combines time-tested Ayurvedic herbs and oils – <strong>Neem, Karanj, Manjistha, Daruhaldi, Bakuchi and Chirata</strong> – with Camphor and Sulphur in a smooth, easy-to-apply base.</p>
<div data-callout="info" class="callout callout-info"><p><strong>Ayurvedic medicine, not a cosmetic.</strong> Jayrup Pimples Cream is manufactured under an Ayurvedic drug licence (Mfg. Lic. No. 518 D) in a GMP-certified facility. For external use only.</p></div>
<h3>The herbs inside – and why Ayurveda uses them</h3>
<table>
<thead><tr><th>Ingredient</th><th>Traditional role in Ayurvedic skin care</th></tr></thead>
<tbody>
<tr><td><strong>Neem oil</strong> (<em>Azadirachta indica</em>)</td><td>Known in Ayurveda for its purifying properties; a classic choice for problem-prone skin.</td></tr>
<tr><td><strong>Karanj oil</strong> (<em>Pongamia pinnata</em>)</td><td>Traditionally used in Ayurvedic preparations for skin conditions.</td></tr>
<tr><td><strong>Manjistha</strong> (<em>Rubia cordifolia</em>)</td><td>A well-known Ayurvedic herb for skin clarity and complexion.</td></tr>
<tr><td><strong>Daruhaldi</strong> (<em>Berberis aristata</em>)</td><td>Used in Ayurveda for cleansing and soothing the skin.</td></tr>
<tr><td><strong>Bakuchi</strong> (<em>Psoralea corylifolia</em>)</td><td>A traditional herb in Ayurvedic skin formulations.</td></tr>
<tr><td><strong>Chirata</strong> (<em>Swertia chirata</em>)</td><td>A bitter herb valued in Ayurveda for skin health.</td></tr>
<tr><td><strong>Chakramard</strong> (<em>Cassia tora</em>)</td><td>Traditionally used in Ayurvedic preparations for the skin.</td></tr>
<tr><td><strong>Camphor &amp; Sulphur</strong></td><td>Camphor gives a cooling feel; Sulphur is a long-standing ingredient in preparations for pimples.</td></tr>
</tbody>
</table>
<h3>Who is it for?</h3>
<ul>
<li>Pimple-prone and acne-prone skin</li>
<li>Oily and combination skin</li>
<li>Men and women who prefer an Ayurvedic option</li>
</ul>
<h3>How to use</h3>
<ol>
<li>Wash the affected area with a mild face wash and pat dry.</li>
<li>Take a small quantity and apply a thin layer only on the pimples / affected skin, as directed on the pack or by your physician.</li>
<li>Wash your hands after applying. Avoid the eyes, lips and broken skin.</li>
</ol>
<div data-callout="tip" class="callout callout-tip"><p><strong>Tip:</strong> Use it regularly, keep your face clean and avoid touching or squeezing pimples. Results vary from person to person.</p></div>
<h3>At a glance</h3>
<table>
<tbody>
<tr><th>Product</th><td>Jayrup Pimples Cream</td></tr>
<tr><th>Type</th><td>Ayurvedic Proprietary Medicine – external use only</td></tr>
<tr><th>Net weight</th><td>20 g</td></tr>
<tr><th>Manufactured by</th><td>Radha Pharmacy, Sheoganj (Rajasthan) · Mfg. Lic. No. 518 D</td></tr>
<tr><th>Marketed by</th><td>Jayrup, Himatnagar, Gujarat</td></tr>
<tr><th>Shelf life</th><td>36 months from manufacture (expiry printed on pack)</td></tr>
<tr><th>Country of origin</th><td>India</td></tr>
</tbody>
</table>
<div data-callout="warning" class="callout callout-warning"><p>For external use only. Protect from direct sunlight. Keep out of reach of children. If irritation occurs, stop use and consult a doctor.</p></div>`,
    benefits: `<ul>
<li><strong>Ayurvedic formula</strong> with Neem, Karanj, Manjistha, Daruhaldi, Bakuchi and Chirata.</li>
<li><strong>Made for pimple-prone, oily skin</strong> – apply only where you need it.</li>
<li><strong>Cooling feel</strong> from Camphor.</li>
<li><strong>Licensed &amp; GMP manufactured</strong> – Mfg. Lic. No. 518 D.</li>
<li><strong>Travel-friendly 20 g jar.</strong></li>
</ul>`,
    ingredients: `<p><strong>Active herbs &amp; ingredients (as printed on the pack):</strong></p>
<ul>
<li>Benzoic acid (Pdr.)</li>
<li>Gandhak – Sulphur (Pdr.)</li>
<li>Chakramard – <em>Cassia tora</em> (Pdr.)</li>
<li>Kapur – <em>Cinnamomum camphora</em> Exud. (Pdr.)</li>
<li>Chirayata – <em>Swertia chirata</em> W.P. (Pdr.)</li>
<li>Daruhaldi – <em>Berberis aristata</em> Stem (Pdr.)</li>
<li>Bakuchi – <em>Psoralea corylifolia</em> Fruit (Pdr.)</li>
<li>Manjistha – <em>Rubia cordifolia</em> Stem (Pdr.)</li>
<li>Neem oil – <em>Azadirachta indica</em> Seed oil</li>
<li>Karanj oil – <em>Pongamia pinnata</em> Seed oil</li>
<li>Base: Hard paraffin wax, Petroleum jelly</li>
</ul>
<p><strong>Excipients:</strong> Preservatives – Sodium methyl paraben, Sodium propyl paraben; Sugandhit dravya (fragrance); Colour – Sunset Yellow FCF (CI 15985).</p>
<p><em>Exact quantities of each ingredient are printed on the pack label.</em></p>`,
    howToUse: `<ol>
<li>Clean the affected area with a mild face wash and pat dry.</li>
<li>Apply a thin layer of the cream only on the pimples / affected skin, as directed on the pack or by your physician.</li>
<li>Wash hands after use.</li>
</ol>`,
    precautions: `<div data-callout="warning" class="callout callout-warning"><p><strong>For external use only.</strong> Do not swallow.</p></div>
<ul>
<li>Protect from direct sunlight; store in a cool and dry place with the lid closed.</li>
<li>Avoid contact with eyes, lips and broken or wounded skin.</li>
<li>Do a patch test before first use; stop use if redness, burning or irritation occurs and consult a doctor.</li>
<li>Do not use if you are allergic to any ingredient (e.g. sulphur or parabens).</li>
<li>Pregnant or breastfeeding women and children should use only on medical advice.</li>
<li>Keep out of reach of children. For sale in India and Nepal only.</li>
</ul>`,
    skinTypes: ['Oily', 'Combination', 'Acne-prone'],
    concerns: ['Pimples', 'Acne-prone skin', 'Oily skin'],
    faqs: [
      {
        question: 'What is Jayrup Pimples Cream?',
        answer: 'Jayrup Pimples Cream is an Ayurvedic proprietary medicine for external use, made with Neem oil, Karanj oil, Manjistha, Daruhaldi, Bakuchi, Chirata, Camphor and Sulphur for pimple-prone skin.',
      },
      {
        question: 'Is it a cosmetic or an Ayurvedic medicine?',
        answer: 'It is an Ayurvedic proprietary medicine, not a cosmetic preparation. It is manufactured by Radha Pharmacy, Sheoganj (Rajasthan) under Ayurvedic manufacturing licence No. 518 D in a GMP-certified facility.',
      },
      {
        question: 'How do I use Jayrup Pimples Cream?',
        answer: 'Clean and dry the affected area, then apply a thin layer only on the pimples or affected skin as directed on the pack or by your physician. Wash your hands after use and avoid the eyes and lips.',
      },
      {
        question: 'Which skin types is it suitable for?',
        answer: 'It is made for pimple-prone, oily and combination skin. If you have very sensitive skin, do a patch test on a small area first.',
      },
      {
        question: 'How soon will I see results?',
        answer: 'Results differ from person to person and depend on your skin, how regularly you use it and your skin-care habits. Use it as directed and keep the skin clean. If pimples are severe or painful, please consult a dermatologist.',
      },
      {
        question: 'Are there any side effects?',
        answer: 'It is for external use only. Some people may be sensitive to an ingredient such as sulphur or parabens – do a patch test first and stop use if you notice redness, burning or irritation.',
      },
      {
        question: 'What is the net quantity and shelf life?',
        answer: 'Each jar contains 20 g. The shelf life is 36 months from the date of manufacture; the batch number, manufacturing and expiry dates are printed on every jar.',
      },
      {
        question: 'Can I return it after opening?',
        answer: 'For hygiene and safety reasons, medicines cannot be returned once opened. If the jar arrives damaged, tampered or you receive the wrong item, report it within 3 days of delivery from My Orders and we will replace it or refund you.',
      },
    ],
    tags: [
      'pimples cream',
      'pimple cream',
      'jayrup pimples cream',
      'ayurvedic pimple cream',
      'ayurvedic cream for pimples',
      'acne cream',
      'anti acne cream',
      'herbal pimple cream',
      'neem cream',
      'oily skin',
    ],
    seo: {
      metaTitle: 'Jayrup Pimples Cream 20g – Ayurvedic Cream for Pimples',
      metaDescription:
        'Jayrup Pimples Cream – Ayurvedic medicine with Neem, Karanj, Manjistha & Daruhaldi for pimple-prone, oily skin. 20 g, GMP made (Lic. 518 D). COD available.',
      metaKeywords:
        'jayrup pimples cream, pimples cream, ayurvedic pimple cream, ayurvedic cream for pimples, acne cream, herbal pimple cream, neem cream for pimples',
      focusKeyword: 'pimples cream',
      canonicalUrl: '',
      ogTitle: '',
      ogDescription: '',
      ogImage: '/images/products/pimples-cream-20g-1.webp',
      searchIndexing: 'INDEX_FOLLOW',
    },
  },
];

// ───────────────────────────── HOMEPAGE HERO ─────────────────────────────
export const HERO_AD = {
  title: 'Jayrup Royal Flora – Luxury Perfume',
  subtitle: 'Royal man’s first choice',
  description: 'Long-lasting Eau de Parfum, made in India. Also discover Jayrup Pimples Cream – Ayurvedic care for pimple-prone skin.',
  mediaType: 'IMAGE',
  mediaUrl: '/images/hero/jayrup-hero-2400.webp',
  mobileMediaUrl: '/images/hero/jayrup-hero-mobile-1080.webp',
  posterUrl: '',
  altText: 'Jayrup Royal Flora Eau de Parfum 50 ml – Marwad ka Pahla Luxury Perfume',
  seoTitle: 'Jayrup Royal Flora – Luxury Perfume for Men',
  ctaText: 'Shop Royal Flora',
  ctaUrl: '/products/jayrup-royal-flora-eau-de-parfum-50ml',
  location: 'HOMEPAGE_HERO',
  priority: 10,
  status: 'ACTIVE',
};
