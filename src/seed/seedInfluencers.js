import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { InfluencerVideo } from '../models/InfluencerVideo.js';
import { Product } from '../models/Product.js';

dotenv.config();

export const seedInfluencerVideos = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/jayroop_luxury_db';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    console.log('[Seed] Seeding Influencer Videos...');

    // Find products to tag
    const products = await Product.find({}).limit(5);
    const prod1 = products[0]?._id || null;
    const prod2 = products[1]?._id || null;
    const prod3 = products[2]?._id || null;
    const prod4 = products[3]?._id || null;

    // Remove existing influencer videos to avoid duplicates
    await InfluencerVideo.deleteMany({});

    // 1. INSPIRATIONS (16:9 Landscape Celebrity / Brand Ambassador Campaigns)
    const inspirationsData = [
      {
        title: 'Unleash The Power Of Carbon',
        sectionType: 'INSPIRATIONS',
        influencerName: 'Varun Dhawan',
        caption: 'The Grooming For My Success • Choice 1st',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-perfume-bottle-and-flowers-42617-large.mp4',
        posterUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=1000',
        altText: 'Varun Dhawan showcasing Jayroop Royal Grooming and Fragrance',
        seoDescription: 'Bollywood star Varun Dhawan shares his uncompromising standard for luxury grooming and signature fragrance aura.',
        seoKeywords: ['Varun Dhawan', 'Men Grooming', 'Luxury Fragrance', 'Power of Carbon', 'Jayrup'],
        videoDuration: '1:15',
        viewsCount: '48.2k',
        taggedProduct: prod1,
        externalUrl: 'https://www.youtube.com',
        priority: 10,
        status: 'ACTIVE',
      },
      {
        title: "SRK's Humbleness Radiates Even Through His Success",
        sectionType: 'INSPIRATIONS',
        influencerName: 'Shah Rukh Khan',
        caption: 'The Scent of My Success • Dignity & Grace',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-spraying-perfume-on-a-black-background-40018-large.mp4',
        posterUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=1000',
        altText: 'Shah Rukh Khan on royal elegance, humility, and the scent of true success',
        seoDescription: 'An inspiring exploration into timeless charisma and why pure distillation of character is the greatest luxury.',
        seoKeywords: ['Shah Rukh Khan', 'Scent of Success', 'Royal Oud', 'Oud Extrait', 'King of Bollywood'],
        videoDuration: '2:05',
        viewsCount: '142.5k',
        taggedProduct: prod2,
        externalUrl: 'https://www.youtube.com',
        priority: 9,
        status: 'ACTIVE',
      },
      {
        title: 'Work Hard. Stay Humble | Mahesh Babu',
        sectionType: 'INSPIRATIONS',
        influencerName: 'Mahesh Babu',
        caption: 'The Scent of My Success • Royal Flora',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-putting-perfume-on-the-skin-40019-large.mp4',
        posterUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=1000',
        altText: 'Mahesh Babu reveals his signature daily perfume formulation',
        seoDescription: 'Mahesh Babu on unwavering daily work ethic and his signature scent of success — Royal Flora Eau De Parfum.',
        seoKeywords: ['Mahesh Babu', 'Royal Flora', 'Scent of Success', 'Tollywood Superstar', 'Marwad Perfume'],
        videoDuration: '1:30',
        viewsCount: '95.1k',
        taggedProduct: prod3,
        externalUrl: 'https://www.youtube.com',
        priority: 8,
        status: 'ACTIVE',
      },
    ];

    // 2. OUR SCENT-FLUENCER (9:16 Vertical Shoppable Video Reels)
    const scentFluencersData = [
      {
        title: 'Signature Series Premium Perfume Saturday Sunset',
        sectionType: 'SCENT_FLUENCER',
        influencerName: 'Aarav Sharma',
        caption: 'Sunset Fragrance Notes Breakdown',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-putting-perfume-on-the-skin-40019-large.mp4',
        posterUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=600',
        altText: 'Aarav Sharma reviewing Royal Flora Eau De Parfum on Instagram Reel',
        seoDescription: 'Aarav reviews the citrus bloom and white amber base notes of Royal Flora in high humidity.',
        seoKeywords: ['Scentfluencer', 'Royal Flora', 'Saturday Sunset', 'Fragrance Review'],
        videoDuration: '0:35',
        viewsCount: '2.4k',
        taggedProduct: prod1,
        priority: 10,
        status: 'ACTIVE',
      },
      {
        title: 'SRK Autograph White Leather Premium Perfume',
        sectionType: 'SCENT_FLUENCER',
        influencerName: 'Kabir Oberoi',
        caption: 'Black Suit & White Leather Pairing',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-perfume-bottle-and-flowers-42617-large.mp4',
        posterUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=600',
        altText: 'Kabir testing Royal Oud Extrait longevity for evening galas',
        seoDescription: 'Why aged Cambodian Oud and Taif Rose command instant respect in any boardroom or private salon.',
        seoKeywords: ['White Leather', 'Royal Oud', 'Oud Extrait', 'Men Fashion'],
        videoDuration: '0:42',
        viewsCount: '3.2k',
        taggedProduct: prod2,
        priority: 9,
        status: 'ACTIVE',
      },
      {
        title: '8:00 AM Morning Ice Protocol & Skin Healing',
        sectionType: 'SCENT_FLUENCER',
        influencerName: 'Dr. Devansh Gupta',
        caption: 'Ayurvedic Acne Defeat with Jayroop Special',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-spraying-perfume-on-a-black-background-40018-large.mp4',
        posterUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=600',
        altText: 'Dr. Devansh explains the herbal mechanism of Jayroop Special Pimples Cream',
        seoDescription: 'Dermatological review of pure neem bark, turmeric, and clove oil in eradicating hormonal acne without peeling.',
        seoKeywords: ['Pimples Cream', 'Acne Care', 'Skincare Routine', 'Natural Clear Skin'],
        videoDuration: '0:48',
        viewsCount: '5.8k',
        taggedProduct: prod3,
        priority: 8,
        status: 'ACTIVE',
      },
      {
        title: 'If you want to be a classy and well-groomed man',
        sectionType: 'SCENT_FLUENCER',
        influencerName: 'Siddharth Roy',
        caption: 'Resort Wear & Royal Sillage',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-putting-perfume-on-the-skin-40019-large.mp4',
        posterUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=600',
        altText: 'Siddharth demonstrating 3-spray technique with Royal Flora 50ml',
        seoDescription: 'Pulse point application tips for 14-hour longevity with Marwad ka Pahla Luxury Perfume.',
        seoKeywords: ['Well Groomed', 'Classy Men', 'Royal Flora', 'Scent Projection'],
        videoDuration: '0:50',
        viewsCount: '4.6k',
        taggedProduct: prod4 || prod1,
        priority: 7,
        status: 'ACTIVE',
      },
    ];

    await InfluencerVideo.insertMany([...inspirationsData, ...scentFluencersData]);
    console.log(`[Seed] Successfully seeded ${inspirationsData.length + scentFluencersData.length} influencer videos!`);
  } catch (err) {
    console.error('[Seed Error] Failed to seed influencer videos:', err);
  }
};

seedInfluencerVideos().then(() => {
  console.log('[Seed] Done. Disconnecting...');
  mongoose.disconnect();
  process.exit(0);
}).catch((err) => {
  console.error('[Seed Error]', err);
  process.exit(1);
});

