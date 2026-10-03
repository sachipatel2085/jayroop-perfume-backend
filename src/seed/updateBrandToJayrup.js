import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Blog } from '../models/Blog.js';
import { InfluencerVideo } from '../models/InfluencerVideo.js';

dotenv.config();

const updateBrand = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/jayroop_luxury_db';
    await mongoose.connect(mongoUri);
    console.log('[Brand Migration] Connected to MongoDB.');

    // 1. Update Users
    const u1 = await User.updateMany(
      { email: 'admin@jayroop.com' },
      { $set: { email: 'admin@jayrup.com', name: 'Jayrup Administrator' } }
    );
    const u2 = await User.updateMany(
      { email: 'customer@jayroop.com' },
      { $set: { email: 'customer@jayrup.com' } }
    );
    console.log(`[Brand Migration] Users updated: admin (${u1.modifiedCount}), customer (${u2.modifiedCount})`);

    // 2. Update Products
    const prodRes = await Product.updateMany(
      { brand: /jayroop/i },
      { $set: { brand: 'Jayrup Special' } }
    );
    console.log(`[Brand Migration] Products brand updated: ${prodRes.modifiedCount}`);

    // Update Product titles/descriptions if they contain "Jayroop"
    const allProducts = await Product.find({
      $or: [
        { name: /jayroop/i },
        { description: /jayroop/i },
        { slug: /jayroop/i },
      ]
    });
    for (const p of allProducts) {
      p.name = p.name.replace(/Jayroop/gi, 'Jayrup');
      p.description = p.description.replace(/Jayroop/gi, 'Jayrup');
      p.slug = p.slug.replace(/jayroop/gi, 'jayrup');
      await p.save();
    }
    console.log(`[Brand Migration] Updated ${allProducts.length} product descriptions and slugs.`);

    // 3. Update Blogs
    const allBlogs = await Blog.find({
      $or: [
        { title: /jayroop/i },
        { content: /jayroop/i },
        { excerpt: /jayroop/i },
      ]
    });
    for (const b of allBlogs) {
      b.title = b.title.replace(/Jayroop/gi, 'Jayrup');
      b.content = b.content.replace(/Jayroop/gi, 'Jayrup');
      b.excerpt = b.excerpt.replace(/Jayroop/gi, 'Jayrup');
      await b.save();
    }
    console.log(`[Brand Migration] Updated ${allBlogs.length} blogs.`);

    // 4. Update Influencer Videos
    const allVideos = await InfluencerVideo.find({
      $or: [
        { title: /jayroop/i },
        { caption: /jayroop/i },
        { altText: /jayroop/i },
        { seoDescription: /jayroop/i },
      ]
    });
    for (const v of allVideos) {
      v.title = v.title.replace(/Jayroop/gi, 'Jayrup');
      if (v.caption) v.caption = v.caption.replace(/Jayroop/gi, 'Jayrup');
      if (v.altText) v.altText = v.altText.replace(/Jayroop/gi, 'Jayrup');
      if (v.seoDescription) v.seoDescription = v.seoDescription.replace(/Jayroop/gi, 'Jayrup');
      if (Array.isArray(v.seoKeywords)) {
        v.seoKeywords = v.seoKeywords.map((k) => k.replace(/Jayroop/gi, 'Jayrup'));
      }
      await v.save();
    }
    console.log(`[Brand Migration] Updated ${allVideos.length} influencer videos.`);

    console.log('[Brand Migration] Done! Disconnecting...');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[Brand Migration Error]:', err);
    process.exit(1);
  }
};

updateBrand();
