import mongoose from 'mongoose';

/**
 * Atomic sequence generator.
 * Used for GST-compliant, gap-free invoice / credit-note numbering per financial year
 * (e.g. key "invoice-2026-27" → 1, 2, 3 ...).
 */
const counterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
);

counterSchema.statics.next = async function (key) {
  const doc = await this.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return doc.seq;
};

export const Counter = mongoose.model('Counter', counterSchema);
