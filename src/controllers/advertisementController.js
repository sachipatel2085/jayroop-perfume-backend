import { Advertisement } from '../models/Advertisement.js';
import { logAdminAction } from '../utils/auditLogger.js';

// @desc    Get active advertisements/campaigns for homepage and store sections
// @route   GET /api/v1/advertisements/active
// @access  Public
export const getActiveAdvertisements = async (req, res, next) => {
  try {
    const { location = 'HOMEPAGE_HERO' } = req.query;
    const now = new Date();

    const ads = await Advertisement.find({
      status: 'ACTIVE',
      location,
      startDate: { $lte: now },
      $or: [{ endDate: null }, { endDate: { $gte: now } }],
    }).sort({ priority: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      data: ads,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Get all advertisements
// @route   GET /api/v1/advertisements
// @access  Private/Admin
export const getAllAdvertisements = async (req, res, next) => {
  try {
    const ads = await Advertisement.find().sort({ priority: -1, createdAt: -1 });
    res.status(200).json({
      success: true,
      data: ads,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Create advertisement / campaign video
// @route   POST /api/v1/advertisements
// @access  Private/Admin
export const createAdvertisement = async (req, res, next) => {
  try {
    const {
      title,
      subtitle,
      description,
      mediaType,
      mediaUrl,
      posterUrl,
      ctaText,
      ctaUrl,
      location,
      altText,
      seoTitle,
      priority,
      status,
      startDate,
      endDate,
    } = req.body;

    const ad = await Advertisement.create({
      title,
      subtitle: subtitle || '',
      description: description || '',
      mediaType: mediaType || 'VIDEO',
      mediaUrl,
      posterUrl: posterUrl || '',
      altText: altText || '',
      seoTitle: seoTitle || '',
      ctaText: ctaText || 'EXPLORE COLLECTION',
      ctaUrl: ctaUrl || '/shop',
      location: location || 'HOMEPAGE_HERO',
      priority: Number(priority || 1),
      status: status || 'ACTIVE',
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
    });

    await logAdminAction({
      req,
      action: 'ADVERTISEMENT_CREATED',
      resource: 'Advertisement',
      resourceId: ad._id.toString(),
      details: { title: ad.title, mediaType: ad.mediaType, location: ad.location },
    });

    res.status(201).json({
      success: true,
      message: 'Campaign media created successfully',
      data: ad,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Update advertisement
// @route   PUT /api/v1/advertisements/:id
// @access  Private/Admin
export const updateAdvertisement = async (req, res, next) => {
  try {
    const updated = await Advertisement.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Advertisement not found' });
    }

    await logAdminAction({
      req,
      action: 'ADVERTISEMENT_UPDATED',
      resource: 'Advertisement',
      resourceId: updated._id.toString(),
      details: req.body,
    });

    res.status(200).json({
      success: true,
      message: 'Campaign media updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Delete advertisement
// @route   DELETE /api/v1/advertisements/:id
// @access  Private/Admin
export const deleteAdvertisement = async (req, res, next) => {
  try {
    const ad = await Advertisement.findByIdAndDelete(req.params.id);
    if (!ad) {
      return res.status(404).json({ success: false, message: 'Advertisement not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Campaign media deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
