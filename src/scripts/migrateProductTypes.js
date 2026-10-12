/**
 * One-time catalogue check: assigns a product type to existing categories / products and flags
 * HSN codes that don't match the kind of product (e.g. a perfume saved with skincare HSN 3304).
 *
 *   npm run migrate:types              → dry run, prints what would change (nothing is written)
 *   npm run migrate:types -- --apply   → saves the product types
 *   npm run migrate:types -- --apply --fix-hsn
 *                                      → also clears mismatching product HSN codes so they inherit the
 *                                        correct one from category / product type
 *
 * Safe to run more than once. Orders and invoices already issued are never changed.
 */
import "../config/env.js"; // must stay first: loads .env + MongoDB DNS fix
import mongoose from "mongoose";
import { Category } from "../models/Category.js";
import { Product } from "../models/Product.js";
import { Setting } from "../models/Setting.js";
import {
  PRODUCT_TYPES,
  inferProductType,
  resolveTax,
} from "../config/productTypes.js";


const APPLY = process.argv.includes("--apply");
const FIX_HSN = process.argv.includes("--fix-hsn");

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set in .env");
  await mongoose.connect(process.env.MONGO_URI);
  const settings = await Setting.getStoreSettings();
  console.log(
    `\nJayrup catalogue check – ${APPLY ? "APPLYING changes" : "DRY RUN (add --apply to save)"}\n`,
  );

  // 1) Categories
  const categories = await Category.find();
  for (const c of categories) {
    if (c.productType) continue;
    const t = inferProductType({ name: `${c.name} ${c.slug}` }, null);
    if (t === "GENERAL") {
      console.log(
        `  ? Category "${c.name}" – type unknown, set it in Admin › Categories`,
      );
      continue;
    }
    console.log(`  ✓ Category "${c.name}" → ${PRODUCT_TYPES[t].label}`);
    if (APPLY)
      await Category.updateOne({ _id: c._id }, { $set: { productType: t } });
  }

  // 2) Products
  const products = await Product.find().populate(
    "category",
    "name slug productType hsnCode gstRate",
  );
  let mismatches = 0;
  for (const p of products) {
    const cat =
      p.category && typeof p.category === "object" ? p.category : null;
    const type = p.productType || inferProductType(p, cat);
    const typeHsn = PRODUCT_TYPES[type]?.hsnCode;
    const set = {};
    if (!p.productType && type !== "GENERAL") set.productType = type;

    const ownHsn = String(p.hsnCode || "").slice(0, 4);
    if (ownHsn && typeHsn && ownHsn !== typeHsn) {
      mismatches += 1;
      console.log(
        `  ⚠ "${p.name}" is ${PRODUCT_TYPES[type].label} but has HSN ${p.hsnCode} (expected ${typeHsn}).${FIX_HSN ? " → clearing so it inherits" : " Run with --fix-hsn to correct."}`,
      );
      if (FIX_HSN) set.hsnCode = "";
    }
    if (Object.keys(set).length) {
      if (set.productType)
        console.log(`  ✓ "${p.name}" → ${PRODUCT_TYPES[type].label}`);
      if (APPLY) await Product.updateOne({ _id: p._id }, { $set: set });
    }
    const after = resolveTax({ ...p.toObject(), ...set }, cat, settings);
    console.log(
      `      invoice will use HSN ${after.hsnCode || "—"} @ ${after.gstRate}%`,
    );
  }

  console.log(
    `\nDone. ${products.length} products checked, ${mismatches} HSN mismatch(es).${APPLY ? "" : " Nothing was saved (dry run)."}\n`,
  );
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error("Migration failed:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
