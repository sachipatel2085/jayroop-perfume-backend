import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
  secure: true,
});

/**
 * Uploads a file buffer directly to Cloudinary using upload_stream.
 * If Cloudinary credentials are mock/missing and fail, falls back gracefully
 * to saving to public/uploads in development so local testing doesn't break.
 */
export const uploadStreamToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    // Check if Cloudinary credentials appear to be configured
    const isConfigured =
      Boolean(process.env.CLOUDINARY_CLOUD_NAME) &&
      Boolean(process.env.CLOUDINARY_API_KEY) &&
      Boolean(process.env.CLOUDINARY_API_SECRET) &&
      process.env.CLOUDINARY_API_KEY !== '1234567890'; // placeholder check

    const folder = options.folder ? `jayroop-luxury/${options.folder}` : 'jayroop-luxury';

    if (isConfigured) {
      const uploadOptions = {
        folder,
        resource_type: options.resourceType || 'auto',
      };

      const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
        if (error) {
          console.warn('⚠️ Cloudinary stream failed:', error.message || error);
          // Fallback to local disk if Cloudinary service rejected (e.g. 403 permission error)
          fallbackToLocalDisk(buffer, options)
            .then((localResult) => {
              resolve({
                ...localResult,
                warning: `Cloudinary error (${error.message || '403 Forbidden'}). Served via local storage.`,
              });
            })
            .catch(reject);
        } else {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            bytes: result.bytes,
            resourceType: result.resource_type,
            provider: 'cloudinary',
          });
        }
      });

      stream.end(buffer);
    } else {
      // Direct development fallback
      fallbackToLocalDisk(buffer, options)
        .then(resolve)
        .catch(reject);
    }
  });
};

/**
 * Development fallback: stores upload locally in backend/public/uploads
 */
const fallbackToLocalDisk = async (buffer, options) => {
  const uploadsDir = path.join(__dirname, '../../public/uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const ext = options.filename ? path.extname(options.filename) : '.jpg';
  const cleanName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const filePath = path.join(uploadsDir, cleanName);

  await fs.promises.writeFile(filePath, buffer);

  const port = process.env.PORT || 5000;
  const baseUrl = process.env.BACKEND_URL || `http://localhost:${port}`;
  const localUrl = `${baseUrl}/uploads/${cleanName}`;

  return {
    url: localUrl,
    publicId: `local/${cleanName}`,
    format: ext.replace('.', ''),
    bytes: buffer.length,
    resourceType: 'image',
    provider: 'local',
  };
};

export { cloudinary };
