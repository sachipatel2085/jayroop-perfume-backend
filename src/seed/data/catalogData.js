/**
 * Jayrup catalogue – the single source for `npm run seed:catalog`.
 *
 * Every field matches the Admin › Products form, so seeded products can be edited in the admin
 * exactly like products created by hand. Facts (ingredients, manufacturer, net quantity, MRP …)
 * are taken from the printed packs. Prices are the pack MRP – change them any time in the admin.
 *
 * Images live in the storefront: jayroop-perfume-frontend/public/images/products/
 */

const MARKETED_BY = 'JAYRUP TRADING COMPANY (brand: Jayrup), G-28 Metropolis Complex, Bhiloda Road, Gambhoi, Himatnagar, Sabarkantha, Gujarat – 383030, India';
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
    key: 'bodysprays',
    name: 'Deodorant Body Sprays',
    slug: 'body-sprays',
    productType: 'DEODORANT',
    hsnCode: '33072000',
    gstRate: 18,
    googleProductCategory: 'Health & Beauty > Personal Care > Deodorant & Anti-Perspirant',
    sortOrder: 2,
    featured: true,
    status: 'ACTIVE',
    image: {
      url: '/images/categories/body-sprays.webp',
      altText: 'Jayrup deodorant body sprays 150 ml – Desert Musk, Thar Bloom for men and Charm for women',
    },
    intro:
      'Everyday freshness with a signature Jayrup scent – 150 ml deodorant body sprays for men and women. Meet Thar Bloom, Desert Musk and Charm.',
    description: `<h2>Deodorant body sprays for men and women</h2>
<p><strong>Jayrup Deodorant Body Sprays</strong> bring the brand’s love of fragrance to your everyday routine. Each 150 ml can combines a <strong>deodorant</strong> that helps you stay fresh with a <strong>signature scent</strong> inspired by the colours and moods of Rajasthan and Gujarat – from desert nights to golden dunes.</p>
<h3>Choose your Jayrup body spray</h3>
<table>
<tbody>
<tr><th>Body spray</th><th>Made for</th><th>Character</th></tr>
<tr><td><strong>Thar Bloom</strong></td><td>Men</td><td>Bold and refined – inspired by evenings in the Thar desert</td></tr>
<tr><td><strong>Desert Musk</strong></td><td>Men</td><td>Warm and musky – inspired by golden desert dunes</td></tr>
<tr><td><strong>Charm</strong></td><td>Women</td><td>Soft and feminine – a graceful everyday scent</td></tr>
</tbody>
</table>
<h3>Body spray vs perfume – which one do you need?</h3>
<p>A <strong>deodorant body spray</strong> is made for the whole body and for frequent use – after a bath, before the gym or when you need a quick refresh. An <strong>Eau de Parfum</strong> such as <a href="/products/jayrup-royal-flora-eau-de-parfum-50ml">Jayrup Royal Flora</a> has a higher fragrance concentration and is applied on pulse points for a longer-lasting signature. Many people use both: a body spray for freshness and a perfume for the finishing touch.</p>
<h3>How to get the best from your body spray</h3>
<ol>
<li>Shake the can well before every use.</li>
<li>Hold it about <strong>15 cm</strong> away from your body.</li>
<li>Spray on underarms, chest, neck and clothes – on clean, dry skin.</li>
<li>Refresh after the gym, travel or a long day.</li>
</ol>
<div data-callout="warning" class="callout callout-warning"><p><strong>Pressurised, flammable container.</strong> Keep away from heat, fire and direct sunlight. Do not puncture or burn, even when empty. Avoid eyes and broken skin.</p></div>`,
    faqs: [
      {
        question: 'Which Jayrup body spray is for men and which is for women?',
        answer: 'Thar Bloom and Desert Musk are made for men, and Charm is made for women. All three are 150 ml deodorant body sprays.',
      },
      {
        question: 'What is the difference between a body spray and a perfume?',
        answer: 'A deodorant body spray is made for the whole body and frequent use, to help you stay fresh with a light scent. A perfume (Eau de Parfum) has a higher fragrance concentration and is applied on pulse points for a longer-lasting signature.',
      },
      {
        question: 'How do I use a deodorant body spray?',
        answer: 'Shake the can well, hold it about 15 cm away and spray on underarms, chest, neck and clothes on clean, dry skin. Avoid the eyes and broken or irritated skin.',
      },
      {
        question: 'Why do body sprays take a little longer to deliver?',
        answer: 'Aerosol cans are pressurised and flammable, so courier companies carry them by surface (road/rail) instead of air. This can add a few business days; the expected delivery time is shown before you pay.',
      },
      {
        question: 'Can I pay by Cash on Delivery?',
        answer: 'Yes. Pay securely with PhonePe (UPI, cards, net banking) or choose Cash on Delivery at checkout, with delivery across India.',
      },
      {
        question: 'Can I return a body spray?',
        answer: 'For hygiene and safety reasons, used body sprays cannot be returned. If your can arrives damaged, leaking or you receive the wrong item, report it within 3 days of delivery from My Orders and we will replace it or refund you.',
      },
    ],
    seo: {
      metaTitle: 'Deodorant Body Spray for Men & Women 150 ml | Jayrup',
      metaDescription:
        'Shop Jayrup deodorant body sprays – Thar Bloom & Desert Musk for men, Charm for women. 150 ml cans for everyday freshness. PhonePe & COD across India.',
      metaKeywords:
        'jayrup body spray, deodorant body spray, body spray for men, body spray for women, deo for men, deo for women, thar bloom, desert musk, charm body spray, 150 ml deodorant',
      focusKeyword: 'deodorant body spray',
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
    sortOrder: 3,
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

// ───────────────────────────── BODY SPRAYS (150 ml) ─────────────────────────────
// Shared facts for the three deodorant body sprays. Fill in from the printed can in Admin › Products:
// manufacturer, ingredients, shelf life and weight (Legal Metrology needs the manufacturer on the listing).
const bodySpray = ({ name, short, slug, sku, gender, forWhom, mood, inspiration, images, highlights, occasion, intro, extraFaqs, tags, seo }) => ({
  categoryKey: 'bodysprays',
  name: `Jayrup ${name} Deodorant Body Spray 150 ml`,
  slug,
  brand: 'Jayrup',
  productType: 'DEODORANT',
  sku,
  price: 249, // MRP incl. of all taxes – edit in Admin › Products
  salePrice: null,
  stock: 100, // set your real stock in Admin › Inventory
  lowStockThreshold: 10,
  maxPerOrder: 10,
  hsnCode: '', // inherits 33072000 from the category
  gstRate: null, // inherits 18 % from the category
  gender,
  featured: true,
  status: 'ACTIVE',
  netQuantity: '150 ml',
  weight: null,
  dimensions: { length: null, width: null, height: null },
  barcode: '',
  countryOfOrigin: 'India',
  shelfLife: '', // as printed on the can
  manufacturerDetails: '', // ← fill in from the can (Mfd. by …)
  marketedBy: MARKETED_BY,
  packerDetails: '',
  importerDetails: '',
  licenseNumber: '',
  customerCareDetails: CUSTOMER_CARE,
  images,
  videos: [],
  variants: [],
  specifications: {
    Type: 'Deodorant body spray',
    'Net volume': '150 ml',
    'Ideal for': forWhom,
    Character: mood,
    Application: 'Shake well, spray from 15 cm',
    Packaging: 'Aerosol can',
  },
  fragranceNotes: { topNotes: '', heartNotes: '', baseNotes: '' },
  fragrance: {
    family: '',
    concentration: 'Deodorant',
    longevity: '',
    sillage: '',
    season: ['All seasons'],
    occasion,
  },
  returnPolicy: { returnable: null, note: '' }, // deodorant default: not returnable once used
  shipping: { surfaceOnly: null, note: '' }, // deodorant default: surface shipping (aerosol)
  highlights,
  shortDescription: short,
  description: `<h2>Jayrup ${name} – ${mood.toLowerCase()} deodorant body spray</h2>
${intro}
<div data-callout="tip" class="callout callout-tip"><p><strong>${inspiration}</strong></p></div>
<h3>Why you’ll love ${name}</h3>
<ul>
<li><strong>Deodorant + fragrance in one</strong> – helps you stay fresh while leaving a pleasant Jayrup scent.</li>
<li><strong>${mood} character</strong> – ${forWhom === 'Women' ? 'graceful and easy to wear every day' : 'confident and easy to wear every day'}.</li>
<li><strong>Generous 150 ml can</strong> – made for everyday use.</li>
<li><strong>Whole-body freshness</strong> – underarms, chest, neck and clothes.</li>
<li><strong>Easy to carry</strong> – ${forWhom === 'Women' ? 'fits your handbag' : 'fits your gym bag'}, office drawer or travel kit.</li>
</ul>
<h3>Perfect for</h3>
<ul>
${occasion.map((o) => `<li>${o}</li>`).join('\n')}
</ul>
<h3>At a glance</h3>
<table>
<tbody>
<tr><th>Product</th><td>Jayrup ${name} Deodorant Body Spray</td></tr>
<tr><th>Type</th><td>Deodorant body spray (aerosol)</td></tr>
<tr><th>Net volume</th><td>150 ml</td></tr>
<tr><th>Ideal for</th><td>${forWhom}</td></tr>
<tr><th>Character</th><td>${mood}</td></tr>
<tr><th>Marketed by</th><td>JAYRUP TRADING COMPANY (Jayrup), Himatnagar, Gujarat</td></tr>
<tr><th>Country of origin</th><td>India</td></tr>
</tbody>
</table>
<h3>Body spray or perfume?</h3>
<p>Use ${name} for everyday freshness from head to toe, and finish with a few sprays of <a href="/products/jayrup-royal-flora-eau-de-parfum-50ml">Jayrup Royal Flora Eau de Parfum</a> on pulse points when you want a longer-lasting signature. Explore the full <a href="/category/body-sprays">Jayrup body spray collection</a>.</p>`,
  benefits: `<ul>
<li><strong>Stay fresh</strong> – deodorant and fragrance in a single spray.</li>
<li><strong>${mood} scent</strong> that suits daily wear.</li>
<li><strong>150 ml</strong> – a generous can for regular use.</li>
<li><strong>Quick refresh</strong> after the gym, travel or a long day.</li>
</ul>`,
  ingredients: '', // ← type the ingredient list exactly as printed on the can
  howToUse: `<ol>
<li><strong>Shake well</strong> before every use.</li>
<li>Hold the can about <strong>15 cm</strong> away from your body.</li>
<li>Spray on underarms, chest, neck and clothes – on clean, dry skin.</li>
<li>Re-apply whenever you want to feel fresh again.</li>
</ol>`,
  precautions: `<div data-callout="warning" class="callout callout-warning"><p><strong>Pressurised container – flammable.</strong> Protect from sunlight and do not expose to temperatures above 50 °C. Do not pierce or burn, even after use. Do not spray on a naked flame or any hot material.</p></div>
<ul>
<li>For external use only. Avoid contact with eyes; do not spray on broken or irritated skin.</li>
<li>Do not inhale deliberately; use in a well-ventilated area.</li>
<li>Do a patch test if you have sensitive skin and stop use if irritation occurs.</li>
<li>Keep out of reach of children.</li>
</ul>`,
  skinTypes: [],
  concerns: ['Body odour', 'Freshness'],
  faqs: [
    {
      question: `Is Jayrup ${name} for ${forWhom === 'Women' ? 'women' : 'men'}?`,
      answer: `Yes. ${name} is made for ${forWhom === 'Women' ? 'women' : 'men'} – a ${mood.toLowerCase()} deodorant body spray for everyday use.`,
    },
    {
      question: `What is the size of ${name}?`,
      answer: `Each can of Jayrup ${name} contains 150 ml of deodorant body spray.`,
    },
    {
      question: 'How do I use it?',
      answer: 'Shake the can well, hold it about 15 cm away and spray on underarms, chest, neck and clothes on clean, dry skin. Avoid the eyes and broken skin.',
    },
    {
      question: 'Is a body spray the same as a perfume?',
      answer: 'No. A deodorant body spray is made for the whole body and frequent use to help you stay fresh, while an Eau de Parfum like Jayrup Royal Flora has a higher fragrance concentration for pulse points. Many people use both together.',
    },
    ...extraFaqs,
    {
      question: 'Why does delivery take a little longer?',
      answer: 'Aerosol cans are pressurised and flammable, so couriers carry them by surface (road/rail) instead of air. This can add a few business days; the expected delivery time is shown before you pay.',
    },
    {
      question: 'Can I return it?',
      answer: 'For hygiene and safety reasons, used body sprays cannot be returned. If the can arrives damaged, leaking or you receive the wrong item, report it within 3 days of delivery from My Orders and we will replace it or refund you.',
    },
  ],
  tags,
  seo: { ...seo, canonicalUrl: '', ogTitle: '', ogDescription: '', ogImage: images[0].url, searchIndexing: 'INDEX_FOLLOW' },
});

const BODY_SPRAYS = [
  bodySpray({
    name: 'Thar Bloom',
    slug: 'jayrup-thar-bloom-deodorant-body-spray-150ml',
    sku: 'JR-TB-DEO-150',
    gender: 'MEN',
    forWhom: 'Men',
    mood: 'Bold and refined',
    inspiration: 'Inspired by evenings in the Thar desert – when the sand cools, the sky turns deep blue and the desert comes into bloom.',
    intro: `<p><strong>Jayrup Thar Bloom</strong> is a deodorant body spray for men who like their freshness with a touch of character. Dressed in a deep midnight-blue can, it brings the calm confidence of a desert evening to your everyday routine – from the morning commute to the late dinner.</p>`,
    short:
      'Jayrup Thar Bloom is a 150 ml deodorant body spray for men – bold, refined and inspired by evenings in the Thar desert. Deodorant and fragrance in one spray for everyday freshness at work, the gym and evenings out.',
    images: [
      { url: '/images/products/thar-bloom-150ml-1.webp', altText: 'Jayrup Thar Bloom deodorant body spray 150 ml for men – midnight blue can in the Thar desert at night' },
      { url: '/images/products/thar-bloom-150ml-2.webp', altText: 'Jayrup Thar Bloom body spray features – deodorant and fragrance in one, 150 ml, made for men' },
      { url: '/images/products/thar-bloom-150ml-3.webp', altText: 'Jayrup Thar Bloom deodorant body spray with lavender and river stone' },
      { url: '/images/products/thar-bloom-150ml-4.webp', altText: 'Jayrup Thar Bloom and Desert Musk deodorant body sprays for men' },
      { url: '/images/products/thar-bloom-150ml-5.webp', altText: 'Jayrup body spray collection – Desert Musk, Thar Bloom and Charm 150 ml' },
      { url: '/images/products/thar-bloom-150ml-6.webp', altText: 'How to use Jayrup Thar Bloom body spray – shake well, hold 15 cm away, spray' },
    ],
    highlights: [
      'Deodorant body spray for men – 150 ml',
      'Bold, refined character inspired by Thar desert evenings',
      'Deodorant + fragrance in one spray',
      'For office, gym, travel and evenings out',
      'Pairs well with Royal Flora Eau de Parfum',
    ],
    occasion: ['Daily wear', 'Office', 'Gym & sports', 'Evening', 'Travel'],
    extraFaqs: [
      {
        question: 'What is the difference between Thar Bloom and Desert Musk?',
        answer: 'Both are 150 ml deodorant body sprays for men. Thar Bloom has a bold, refined character inspired by desert evenings, while Desert Musk is warmer and musky, inspired by golden dunes. Many customers keep one for the day and one for the evening.',
      },
    ],
    tags: ['thar bloom', 'jayrup body spray', 'deodorant for men', 'body spray for men', 'deo for men', '150 ml deodorant', 'jayrup deo', 'men deodorant india'],
    seo: {
      metaTitle: 'Jayrup Thar Bloom Deodorant Body Spray for Men 150ml',
      metaDescription:
        'Buy Jayrup Thar Bloom deodorant body spray for men, 150 ml – bold, refined freshness inspired by Thar desert evenings. Fast delivery, PhonePe & COD.',
      metaKeywords: 'jayrup thar bloom, thar bloom body spray, deodorant body spray for men, body spray for men, deo for men 150 ml, jayrup deodorant',
      focusKeyword: 'Thar Bloom',
    },
  }),
  bodySpray({
    name: 'Desert Musk',
    slug: 'jayrup-desert-musk-deodorant-body-spray-150ml',
    sku: 'JR-DM-DEO-150',
    gender: 'MEN',
    forWhom: 'Men',
    mood: 'Warm and musky',
    inspiration: 'Inspired by golden desert dunes at sunrise – warm, calm and quietly confident.',
    intro: `<p><strong>Jayrup Desert Musk</strong> is a deodorant body spray for men with a warm, musky character. Its sand-coloured can reflects the golden dunes of the desert – a scent mood that feels relaxed by day and quietly confident by night.</p>`,
    short:
      'Jayrup Desert Musk is a 150 ml deodorant body spray for men – warm and musky, inspired by golden desert dunes. Deodorant and fragrance in one spray for everyday freshness from day to night.',
    images: [
      { url: '/images/products/desert-musk-150ml-1.webp', altText: 'Jayrup Desert Musk deodorant body spray 150 ml for men – sand coloured can on golden desert dunes' },
      { url: '/images/products/desert-musk-150ml-2.webp', altText: 'Jayrup Desert Musk body spray features – warm musky character, 150 ml, made for men' },
      { url: '/images/products/desert-musk-150ml-3.webp', altText: 'Jayrup Desert Musk and Thar Bloom deodorant body sprays for men' },
      { url: '/images/products/desert-musk-150ml-4.webp', altText: 'Jayrup body spray collection – Desert Musk, Thar Bloom and Charm 150 ml' },
      { url: '/images/products/desert-musk-150ml-5.webp', altText: 'How to use Jayrup Desert Musk body spray – shake well, hold 15 cm away, spray' },
    ],
    highlights: [
      'Deodorant body spray for men – 150 ml',
      'Warm, musky character inspired by golden desert dunes',
      'Deodorant + fragrance in one spray',
      'From office hours to festive evenings',
      'Pairs well with Royal Flora Eau de Parfum',
    ],
    occasion: ['Daily wear', 'Office', 'Evening', 'Wedding / festive', 'Travel'],
    extraFaqs: [
      {
        question: 'Is Desert Musk good for evenings?',
        answer: 'Yes. Its warm, musky character works well for evenings and festive occasions, and it is light enough for everyday wear too.',
      },
    ],
    tags: ['desert musk', 'jayrup body spray', 'musk deodorant', 'deodorant for men', 'body spray for men', 'deo for men', '150 ml deodorant', 'jayrup deo'],
    seo: {
      metaTitle: 'Jayrup Desert Musk Deodorant Body Spray for Men 150ml',
      metaDescription:
        'Buy Jayrup Desert Musk deodorant body spray for men, 150 ml – warm, musky freshness inspired by golden desert dunes. Delivery across India, PhonePe & COD.',
      metaKeywords: 'jayrup desert musk, desert musk body spray, musk deodorant for men, body spray for men, deo for men 150 ml, jayrup deodorant',
      focusKeyword: 'Desert Musk',
    },
  }),
  bodySpray({
    name: 'Charm',
    slug: 'jayrup-charm-deodorant-body-spray-150ml',
    sku: 'JR-CH-DEO-150',
    gender: 'WOMEN',
    forWhom: 'Women',
    mood: 'Soft and feminine',
    inspiration: 'Made for her – a graceful everyday scent for college, work and every plan in between.',
    intro: `<p><strong>Jayrup Charm</strong> is a deodorant body spray for women – soft, feminine and easy to love. In a graceful violet can, Charm keeps you feeling fresh and confident from the first class or meeting of the day to the evening plans with friends.</p>`,
    short:
      'Jayrup Charm is a 150 ml deodorant body spray for women – soft, feminine and graceful. Deodorant and fragrance in one spray for everyday freshness at college, work and outings.',
    images: [
      { url: '/images/products/charm-150ml-1.webp', altText: 'Jayrup Charm deodorant body spray 150 ml for women – violet can on a soft pastel backdrop' },
      { url: '/images/products/charm-150ml-2.webp', altText: 'Jayrup Charm body spray features – soft feminine character, 150 ml, made for women' },
      { url: '/images/products/charm-150ml-3.webp', altText: 'Jayrup Charm deodorant body spray for women on a sunlit terrace with lavender' },
      { url: '/images/products/charm-150ml-4.webp', altText: 'Jayrup body spray collection – Desert Musk, Thar Bloom and Charm 150 ml' },
      { url: '/images/products/charm-150ml-5.webp', altText: 'How to use Jayrup Charm body spray – shake well, hold 15 cm away, spray' },
    ],
    highlights: [
      'Deodorant body spray for women – 150 ml',
      'Soft, feminine and graceful character',
      'Deodorant + fragrance in one spray',
      'For college, work, outings and travel',
      'Handbag-friendly can',
    ],
    occasion: ['Daily wear', 'College', 'Office', 'Outings', 'Gifting'],
    extraFaqs: [
      {
        question: 'Is Charm a good gift?',
        answer: 'Yes. Charm is a popular everyday gift for sisters, friends and colleagues – for birthdays, Raksha Bandhan or just because. You can also pair it with Thar Bloom or Desert Musk as a his-and-hers gift.',
      },
    ],
    tags: ['charm', 'jayrup charm', 'jayrup body spray', 'deodorant for women', 'body spray for women', 'deo for women', 'women deodorant india', '150 ml deodorant'],
    seo: {
      metaTitle: 'Jayrup Charm Deodorant Body Spray for Women 150ml',
      metaDescription:
        'Buy Jayrup Charm deodorant body spray for women, 150 ml – soft, feminine everyday freshness for college, work and outings. PhonePe & COD across India.',
      metaKeywords: 'jayrup charm, charm body spray, deodorant body spray for women, body spray for women, deo for women 150 ml, jayrup deodorant',
      focusKeyword: 'Charm body spray',
    },
  }),
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
<tr><th>Marketed by</th><td>JAYRUP TRADING COMPANY (Jayrup), Himatnagar, Gujarat</td></tr>
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
        answer: 'Yes. Royal Flora is sold directly by Jayrup. It is manufactured and packed by Hulo Fashion Private Limited, Jaipur, and marketed by JAYRUP TRADING COMPANY (brand: Jayrup), Himatnagar (Gujarat). Batch number, date of manufacture and MRP are printed on every pack.',
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
<tr><th>Marketed by</th><td>JAYRUP TRADING COMPANY (Jayrup), Himatnagar, Gujarat</td></tr>
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
  // ═══════════════════════ 3–5. DEODORANT BODY SPRAYS 150 ML ═══════════════════════
  ...BODY_SPRAYS,
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
