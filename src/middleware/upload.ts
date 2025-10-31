import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { Request } from 'express';
import { AppError } from './errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure storage
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Invalid file type. Only JPEG, PNG and WebP images are allowed.', 400));
  }
};

// Multer configuration
export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter,
});

// Process and save uploaded images
export const processImages = async (
  files: Express.Multer.File[],
  folder: string = 'accommodations'
): Promise<string[]> => {
  const uploadDir = path.join(__dirname, '../../uploads', folder);
  
  // Ensure upload directory exists
  await fs.mkdir(uploadDir, { recursive: true });

  const processedImages: string[] = [];

  for (const file of files) {
    try {
      const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}.webp`;
      const filepath = path.join(uploadDir, filename);

      // Process image with sharp
      await sharp(file.buffer)
        .resize(1200, 800, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 85 })
        .toFile(filepath);

      // Return relative URL path
      processedImages.push(`/uploads/${folder}/${filename}`);
    } catch (error) {
      console.error('Error processing image:', error);
      throw new AppError('Failed to process image', 500);
    }
  }

  return processedImages;
};

// Delete image file
export const deleteImage = async (imageUrl: string): Promise<void> => {
  try {
    const imagePath = path.join(__dirname, '../..', imageUrl);
    await fs.unlink(imagePath);
  } catch (error) {
    console.error('Error deleting image:', error);
    // Don't throw error, just log it
  }
};

// Middleware to handle single image upload
export const uploadSingle = upload.single('image');

// Middleware to handle multiple image uploads
export const uploadMultiple = upload.array('images', 10);

// Middleware to handle accommodation images (including rooms)
export const uploadAccommodationImages = upload.fields([
  { name: 'accommodation_images', maxCount: 10 },
  { name: 'room_images', maxCount: 5 },
]);
