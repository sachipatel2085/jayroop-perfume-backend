/**
 * Product types – the ONLY place where "what kind of product is this" knowledge lives.
 *
 * Nothing in invoices, GST, reports, SEO or checkout is tied to a specific product (cream, perfume …).
 * Every product gets a `productType`; the type supplies sensible defaults that the admin can override
 * per category and per product:
 *
 *   HSN code  : product.hsnCode → category.hsnCode → type.hsnCode → Settings › Invoices fallback
 *   GST rate  : product.gstRate → category.gstRate → Settings › Invoices default
 *               (the type's `suggestedGstRate` only pre-fills the admin form – confirm rates with your CA)
 *
 * To sell a new kind of product later, add an entry here (and the same key in the frontend
 * src/config/productTypes.js) – no other code needs to change.
 */
export const PRODUCT_TYPES = {
  SKINCARE: {
    label: 'Skincare',
    hsnCode: '3304',
    hsnDescription: 'Beauty, make-up & skin-care preparations',
    suggestedGstRate: 18,
    googleCategory: 'Health & Beauty > Personal Care > Cosmetics > Skin Care',
    schemaCategory: 'Skin Care',
    sections: ['benefits', 'ingredients', 'howToUse', 'precautions', 'skinTypes', 'concerns'],
    defaultReturnable: true,
    hazmat: false,
  },
  FRAGRANCE: {
    label: 'Perfume & Fragrance',
    hsnCode: '3303',
    hsnDescription: 'Perfumes and toilet waters',
    suggestedGstRate: 18,
    googleCategory: 'Health & Beauty > Personal Care > Cosmetics > Perfume & Cologne',
    schemaCategory: 'Perfume',
    sections: ['fragrance', 'ingredients', 'howToUse', 'precautions'],
    // Opened / used perfume cannot be resold – only damaged, leaking or wrong items are returned.
    defaultReturnable: false,
    // Alcohol-based perfumes are flammable: most couriers move them by surface only.
    hazmat: true,
  },
  HAIR_CARE: {
    label: 'Hair care',
    hsnCode: '3305',
    hsnDescription: 'Preparations for use on the hair',
    // Hair oil & shampoo moved to 5 % from 22-Sep-2025 (GST 2.0); hair colour/gel etc. may differ – confirm with CA.
    suggestedGstRate: 5,
    googleCategory: 'Health & Beauty > Personal Care > Hair Care',
    schemaCategory: 'Hair Care',
    sections: ['benefits', 'ingredients', 'howToUse', 'precautions', 'concerns'],
    defaultReturnable: true,
    hazmat: false,
  },
  BODY_CARE: {
    label: 'Bath & body',
    hsnCode: '3307',
    hsnDescription: 'Deodorants, bath preparations & other perfumery/toilet preparations',
    suggestedGstRate: 18,
    googleCategory: 'Health & Beauty > Personal Care > Cosmetics > Bath & Body',
    schemaCategory: 'Bath & Body',
    sections: ['benefits', 'ingredients', 'howToUse', 'precautions', 'fragrance'],
    defaultReturnable: true,
    hazmat: false,
  },
  SOAP: {
    label: 'Soap & cleanser',
    hsnCode: '3401',
    hsnDescription: 'Soap & organic surface-active products',
    // Toilet soap bars moved to 5 % from 22-Sep-2025 (GST 2.0); liquid face-wash may differ – confirm with CA.
    suggestedGstRate: 5,
    googleCategory: 'Health & Beauty > Personal Care > Cosmetics > Bath & Body > Bar Soap',
    schemaCategory: 'Soap',
    sections: ['benefits', 'ingredients', 'howToUse', 'precautions', 'skinTypes'],
    defaultReturnable: true,
    hazmat: false,
  },
  GIFT_SET: {
    label: 'Gift set / combo',
    hsnCode: '',
    hsnDescription: 'Mixed set – set HSN of the principal item',
    suggestedGstRate: 18,
    googleCategory: 'Health & Beauty > Personal Care > Cosmetics',
    schemaCategory: 'Gift Set',
    sections: ['benefits', 'ingredients', 'howToUse', 'precautions', 'fragrance'],
    defaultReturnable: false,
    hazmat: false,
  },
  GENERAL: {
    label: 'Other',
    hsnCode: '',
    hsnDescription: '',
    suggestedGstRate: 18,
    googleCategory: 'Health & Beauty > Personal Care',
    schemaCategory: '',
    sections: ['benefits', 'ingredients', 'howToUse', 'precautions'],
    defaultReturnable: true,
    hazmat: false,
  },
};

export const PRODUCT_TYPE_KEYS = Object.keys(PRODUCT_TYPES);

/** HSN → description (used in invoices / GSTR-1 HSN summary). */
export const HSN_DESCRIPTIONS = {
  ...Object.fromEntries(
    Object.values(PRODUCT_TYPES)
      .filter((t) => t.hsnCode)
      .map((t) => [t.hsnCode, t.hsnDescription])
  ),
  3306: 'Preparations for oral or dental hygiene',
  3302: 'Mixtures of odoriferous substances',
  3301: 'Essential oils',
  3305: 'Preparations for use on the hair',
  9616: 'Scent sprays & mounts',
  4202: 'Bags, pouches & cases',
  996812: 'Courier / shipping services',
};

export const typeOf = (key) => PRODUCT_TYPES[key] || PRODUCT_TYPES.GENERAL;

/** Best guess of a type for legacy products that were created before productType existed. */
export const inferProductType = (product = {}, category = null) => {
  if (product.productType && PRODUCT_TYPES[product.productType]) return product.productType;
  if (category?.productType && PRODUCT_TYPES[category.productType]) return category.productType;
  const hsn = String(product.hsnCode || category?.hsnCode || '').slice(0, 4);
  const byHsn = Object.entries(PRODUCT_TYPES).find(([, t]) => t.hsnCode && t.hsnCode === hsn);
  if (byHsn) return byHsn[0];
  const text = `${product.name || ''} ${category?.name || ''}`.toLowerCase();
  if (/perfume|parfum|attar|itr|fragrance|cologne|eau de|edp|edt|body mist/.test(text)) return 'FRAGRANCE';
  if (/cream|serum|face|skin|gel|lotion|pimple|acne|sunscreen/.test(text)) return 'SKINCARE';
  if (/hair|shampoo|conditioner/.test(text)) return 'HAIR_CARE';
  if (/soap|cleanser|face ?wash/.test(text)) return 'SOAP';
  if (/deo|body wash|scrub|bath/.test(text)) return 'BODY_CARE';
  if (/combo|gift|set|kit/.test(text)) return 'GIFT_SET';
  return 'GENERAL';
};

/**
 * Resolve the tax classification for a product.
 * @returns {{ hsnCode: string, gstRate: number, productType: string }}
 */
export const resolveTax = (product = {}, category = null, settings = {}) => {
  const inv = settings.invoice || {};
  const productType = inferProductType(product, category);
  const t = typeOf(productType);
  const hsnCode = String(product.hsnCode || category?.hsnCode || t.hsnCode || inv.defaultHsnCode || '').trim();
  const pick = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const gstRate = pick(product.gstRate) ?? pick(category?.gstRate) ?? pick(inv.defaultGstRate) ?? 18;
  return { hsnCode, gstRate, productType };
};

/** Is the product returnable under the "change of mind" clause of the return policy? */
export const isReturnable = (product = {}, category = null) => {
  const explicit = product.returnPolicy?.returnable;
  if (typeof explicit === 'boolean') return explicit;
  return typeOf(inferProductType(product, category)).defaultReturnable;
};

/** Does the product need surface-only shipping (flammable / aerosol)? */
export const isHazmat = (product = {}, category = null) => {
  if (typeof product.shipping?.surfaceOnly === 'boolean') return product.shipping.surfaceOnly;
  return typeOf(inferProductType(product, category)).hazmat;
};

/** Store-wide return window (days after delivery) – keep in sync with the Refund & Return Policy page. */
export const RETURN_WINDOW_DAYS = 3;

/** Reasons a customer can pick. `anyItem` reasons are allowed even for non-returnable products. */
export const RETURN_REASONS = {
  DAMAGED: { label: 'Item arrived damaged / broken', anyItem: true },
  LEAKING: { label: 'Leaking or spilled product', anyItem: true },
  WRONG_ITEM: { label: 'Received a wrong item / size', anyItem: true },
  MISSING_ITEM: { label: 'Item missing from the package', anyItem: true },
  SEAL_BROKEN: { label: 'Seal broken / tampered on arrival', anyItem: true },
  NOT_AS_DESCRIBED: { label: 'Not as shown on the website', anyItem: true },
  CHANGED_MIND: { label: 'No longer needed (unused, sealed)', anyItem: false },
};
