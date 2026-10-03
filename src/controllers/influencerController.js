import { InfluencerVideo } from '../models/InfluencerVideo.js';
import { AuditLog } from '../models/AuditLog.js';

/**
 * @desc    Get active influencer videos for storefront (Inspirations & Scent-Fluencers)
 * @route   GET /api/v1/influencers
 * @access  Public
 */
export const getActiveInfluencerVideos = async (req, res, next) => {
  try {
    const { sectionType, limit = 20 } = req.query;

    const filter = { status: 'ACTIVE' };
    if (sectionType && ['INSPIRATIONS', 'SCENT_FLUENCER'].includes(sectionType.toUpperCase())) {
      filter.sectionType = sectionType.toUpperCase();
    }

    const videos = await InfluencerVideo.find(filter)
      .populate({
        path: 'taggedProduct',
        select: '_id name slug price salePrice sku images stock brand averageRating',
      })
      .sort({ priority: -1, createdAt: -1 })
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      count: videos.length,
      data: videos,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all influencer videos for admin management
 * @route   GET /api/v1/influencers/admin
 * @access  Private/Admin
 */
export const getAdminInfluencerVideos = async (req, res, next) => {
  try {
    const { sectionType, status, search, page = 1, limit = 20 } = req.query;

    const query = {};
    if (sectionType) query.sectionType = sectionType;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { influencerName: { $regex: search, $options: 'i' } },
        { altText: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await InfluencerVideo.countDocuments(query);

    const videos = await InfluencerVideo.find(query)
      .populate({
        path: 'taggedProduct',
        select: '_id name slug price salePrice sku images stock',
      })
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: videos,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new influencer video with SEO metadata
 * @route   POST /api/v1/influencers
 * @access  Private/Admin
 */
export const createInfluencerVideo = async (req, res, next) => {
  try {
    const {
      title,
      sectionType,
      influencerName,
      caption,
      videoUrl,
      posterUrl,
      altText,
      seoDescription,
      seoKeywords,
      videoDuration,
      viewsCount,
      taggedProduct,
      externalUrl,
      priority,
      status,
    } = req.body;

    const keywordsArray = Array.isArray(seoKeywords)
      ? seoKeywords
      : typeof seoKeywords === 'string'
      ? seoKeywords.split(',').map((k) => k.trim()).filter(Boolean)
      : [];

    const video = await InfluencerVideo.create({
      title,
      sectionType: sectionType || 'SCENT_FLUENCER',
      influencerName,
      caption: caption || '',
      videoUrl,
      posterUrl,
      altText: altText || `${influencerName} reviews ${title} - Jayroop Royal Perfume`,
      seoDescription: seoDescription || `${influencerName} showcases ${title} with rich royal fragrant notes.`,
      seoKeywords: keywordsArray,
      videoDuration: videoDuration || '0:45',
      viewsCount: viewsCount || '2.4k',
      taggedProduct: taggedProduct || null,
      externalUrl: externalUrl || '',
      priority: Number(priority) || 0,
      status: status || 'ACTIVE',
    });

    await video.populate({
      path: 'taggedProduct',
      select: '_id name slug price salePrice sku images',
    });

    // Record audit log
    if (req.user) {
      await AuditLog.create({
        user: req.user._id,
        userEmail: req.user.email,
        action: 'INFLUENCER_VIDEO_CREATED',
        resource: 'InfluencerVideo',
        resourceId: video._id.toString(),
        details: { title: video.title, sectionType: video.sectionType, influencerName: video.influencerName },
      });
    }

    res.status(201).json({
      success: true,
      message: 'Influencer video created successfully',
      data: video,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update an influencer video
 * @route   PUT /api/v1/influencers/:id
 * @access  Private/Admin
 */
export const updateInfluencerVideo = async (req, res, next) => {
  try {
    const video = await InfluencerVideo.findById(req.params.id);
    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Influencer video not found',
      });
    }

    const {
      title,
      sectionType,
      influencerName,
      caption,
      videoUrl,
      posterUrl,
      altText,
      seoDescription,
      seoKeywords,
      videoDuration,
      viewsCount,
      taggedProduct,
      externalUrl,
      priority,
      status,
    } = req.body;

    if (title !== undefined) video.title = title;
    if (sectionType !== undefined) video.sectionType = sectionType;
    if (influencerName !== undefined) video.influencerName = influencerName;
    if (caption !== undefined) video.caption = caption;
    if (videoUrl !== undefined) video.videoUrl = videoUrl;
    if (posterUrl !== undefined) video.posterUrl = posterUrl;
    if (altText !== undefined) video.altText = altText;
    if (seoDescription !== undefined) video.seoDescription = seoDescription;
    if (seoKeywords !== undefined) {
      video.seoKeywords = Array.isArray(seoKeywords)
        ? seoKeywords
        : typeof seoKeywords === 'string'
        ? seoKeywords.split(',').map((k) => k.trim()).filter(Boolean)
        : [];
    }
    if (videoDuration !== undefined) video.videoDuration = videoDuration;
    if (viewsCount !== undefined) video.viewsCount = viewsCount;
    if (taggedProduct !== undefined) video.taggedProduct = taggedProduct || null;
    if (externalUrl !== undefined) video.externalUrl = externalUrl;
    if (priority !== undefined) video.priority = Number(priority);
    if (status !== undefined) video.status = status;

    await video.save();

    await video.populate({
      path: 'taggedProduct',
      select: '_id name slug price salePrice sku images',
    });

    if (req.user) {
      await AuditLog.create({
        user: req.user._id,
        userEmail: req.user.email,
        action: 'INFLUENCER_VIDEO_UPDATED',
        resource: 'InfluencerVideo',
        resourceId: video._id.toString(),
        details: { title: video.title, sectionType: video.sectionType },
      });
    }

    res.status(200).json({
      success: true,
      message: 'Influencer video updated successfully',
      data: video,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete an influencer video
 * @route   DELETE /api/v1/influencers/:id
 * @access  Private/Admin
 */
export const deleteInfluencerVideo = async (req, res, next) => {
  try {
    const video = await InfluencerVideo.findById(req.params.id);
    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Influencer video not found',
      });
    }

    await video.deleteOne();

    if (req.user) {
      await AuditLog.create({
        user: req.user._id,
        userEmail: req.user.email,
        action: 'INFLUENCER_VIDEO_DELETED',
        resource: 'InfluencerVideo',
        resourceId: req.params.id,
        details: { title: video.title },
      });
    }

    res.status(200).json({
      success: true,
      message: 'Influencer video deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
