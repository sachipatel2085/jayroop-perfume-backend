import { uploadStreamToCloudinary } from '../config/cloudinary.js';

/**
 * @desc    Upload a single media file (Image or Video) to Cloudinary
 * @route   POST /api/v1/upload
 * @access  Private/Admin
 */
export const uploadSingleMedia = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No media file provided. Please attach a file to upload.',
      });
    }

    const folder = req.body.folder || req.query.folder || 'general';
    const isVideo = req.file.mimetype.startsWith('video/');

    const uploadResult = await uploadStreamToCloudinary(req.file.buffer, {
      folder,
      filename: req.file.originalname,
      resourceType: isVideo ? 'video' : 'image',
    });

    return res.status(200).json({
      success: true,
      message: 'Media uploaded successfully',
      url: uploadResult.url,
      publicId: uploadResult.publicId,
      format: uploadResult.format,
      bytes: uploadResult.bytes,
      provider: uploadResult.provider,
      data: {
        url: uploadResult.url,
        publicId: uploadResult.publicId,
        format: uploadResult.format,
        bytes: uploadResult.bytes,
        provider: uploadResult.provider,
      },
    });
  } catch (error) {
    console.error('Upload Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload media file',
    });
  }
};

/**
 * @desc    Upload multiple media files to Cloudinary in parallel
 * @route   POST /api/v1/upload/multiple
 * @access  Private/Admin
 */
export const uploadMultipleMedia = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No media files provided. Please attach at least one file.',
      });
    }

    const folder = req.body.folder || req.query.folder || 'general';

    const uploadPromises = req.files.map((file) => {
      const isVideo = file.mimetype.startsWith('video/');
      return uploadStreamToCloudinary(file.buffer, {
        folder,
        filename: file.originalname,
        resourceType: isVideo ? 'video' : 'image',
      });
    });

    const results = await Promise.all(uploadPromises);

    return res.status(200).json({
      success: true,
      message: `${results.length} files uploaded successfully`,
      files: results.map((r) => ({
        url: r.url,
        publicId: r.publicId,
        format: r.format,
        bytes: r.bytes,
        provider: r.provider,
      })),
    });
  } catch (error) {
    console.error('Multiple Upload Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload media files',
    });
  }
};
