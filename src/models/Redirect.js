import mongoose from 'mongoose';

const redirectSchema = new mongoose.Schema(
  {
    sourceUrl: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    targetUrl: {
      type: String,
      required: true,
      trim: true,
    },
    statusCode: {
      type: Number,
      default: 301,
      enum: [301, 302],
    },
    entityType: {
      type: String,
      enum: ['PRODUCT', 'CATEGORY', 'BLOG', 'MANUAL'],
      default: 'MANUAL',
    },
    hits: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Method to resolve redirect and prevent chains (A -> B -> C becomes A -> C)
redirectSchema.statics.registerRedirect = async function (source, target, entityType = 'MANUAL') {
  if (!source || !target || source === target) return null;

  const normalizedSource = source.toLowerCase().trim();
  const normalizedTarget = target.trim();

  // If target is already a source in another redirect, point directly to target's target
  const existingNext = await this.findOne({ sourceUrl: normalizedTarget.toLowerCase() });
  const finalTarget = existingNext ? existingNext.targetUrl : normalizedTarget;

  // Upsert this redirect
  const redirect = await this.findOneAndUpdate(
    { sourceUrl: normalizedSource },
    { targetUrl: finalTarget, entityType, statusCode: 301 },
    { upsert: true, new: true }
  );

  // Flatten any old redirects that were pointing to normalizedSource to now point to finalTarget
  await this.updateMany(
    { targetUrl: normalizedSource },
    { targetUrl: finalTarget }
  );

  return redirect;
};

export const Redirect = mongoose.model('Redirect', redirectSchema);
