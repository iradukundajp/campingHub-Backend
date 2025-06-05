const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { generateUniqueFilename, isAllowedFileType } = require('./helpers');
const { logger } = require('../middleware/logger');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
const imagesDir = path.join(uploadsDir, 'images');
const thumbnailsDir = path.join(uploadsDir, 'thumbnails');

[uploadsDir, imagesDir, thumbnailsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, imagesDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = generateUniqueFilename(file.originalname);
    cb(null, uniqueName);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Check file type
  const allowedTypes = ['jpg', 'jpeg', 'png', 'gif'];
  const isAllowed = isAllowedFileType(file.originalname, allowedTypes);
  
  if (isAllowed) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, JPEG, PNG, and GIF files are allowed.'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
    files: 10 // Maximum 10 files
  },
  fileFilter: fileFilter
});

// Image processing function
const processImage = async (inputPath, outputPath, options = {}) => {
  try {
    const {
      width = 800,
      height = 600,
      quality = 80,
      format = 'jpeg'
    } = options;

    await sharp(inputPath)
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality })
      .toFormat(format)
      .toFile(outputPath);

    return outputPath;
  } catch (error) {
    logger.error('Image processing failed', { error: error.message, inputPath });
    throw error;
  }
};

// Generate thumbnail
const generateThumbnail = async (inputPath, filename) => {
  try {
    const thumbnailPath = path.join(thumbnailsDir, filename);
    
    await sharp(inputPath)
      .resize(200, 200, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 70 })
      .toFile(thumbnailPath);

    return thumbnailPath;
  } catch (error) {
    logger.error('Thumbnail generation failed', { error: error.message, inputPath });
    throw error;
  }
};

// Upload middleware for single image
const uploadSingleImage = (fieldName = 'image') => {
  return async (req, res, next) => {
    upload.single(fieldName)(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              message: 'File too large. Maximum size is 5MB.'
            });
          }
        }
        return res.status(400).json({
          message: err.message
        });
      }

      if (!req.file) {
        return next();
      }

      try {
        // Process the uploaded image
        const processedPath = path.join(imagesDir, `processed_${req.file.filename}`);
        await processImage(req.file.path, processedPath);

        // Generate thumbnail
        const thumbnailPath = await generateThumbnail(processedPath, `thumb_${req.file.filename}`);

        // Remove original unprocessed file
        fs.unlinkSync(req.file.path);

        // Update file info
        req.file.path = processedPath;
        req.file.url = `/uploads/images/processed_${req.file.filename}`;
        req.file.thumbnailUrl = `/uploads/thumbnails/thumb_${req.file.filename}`;

        logger.info('Image uploaded and processed', {
          filename: req.file.filename,
          size: req.file.size,
          userId: req.user?.userId
        });

        next();
      } catch (error) {
        logger.error('Image processing failed', { error: error.message });
        
        // Clean up files
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(500).json({
          message: 'Error processing image',
          error: error.message
        });
      }
    });
  };
};

// Upload middleware for multiple images
const uploadMultipleImages = (fieldName = 'images', maxCount = 10) => {
  return async (req, res, next) => {
    upload.array(fieldName, maxCount)(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              message: 'One or more files are too large. Maximum size is 5MB per file.'
            });
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
              message: `Too many files. Maximum ${maxCount} files allowed.`
            });
          }
        }
        return res.status(400).json({
          message: err.message
        });
      }

      if (!req.files || req.files.length === 0) {
        return next();
      }

      try {
        const processedFiles = [];

        for (const file of req.files) {
          // Process each image
          const processedPath = path.join(imagesDir, `processed_${file.filename}`);
          await processImage(file.path, processedPath);

          // Generate thumbnail
          const thumbnailPath = await generateThumbnail(processedPath, `thumb_${file.filename}`);

          // Remove original unprocessed file
          fs.unlinkSync(file.path);

          // Update file info
          processedFiles.push({
            ...file,
            path: processedPath,
            url: `/uploads/images/processed_${file.filename}`,
            thumbnailUrl: `/uploads/thumbnails/thumb_${file.filename}`
          });
        }

        req.files = processedFiles;

        logger.info('Multiple images uploaded and processed', {
          count: req.files.length,
          userId: req.user?.userId
        });

        next();
      } catch (error) {
        logger.error('Multiple image processing failed', { error: error.message });
        
        // Clean up files
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });

        return res.status(500).json({
          message: 'Error processing images',
          error: error.message
        });
      }
    });
  };
};

// Delete image file
const deleteImage = async (filename) => {
  try {
    const imagePath = path.join(imagesDir, filename);
    const thumbnailPath = path.join(thumbnailsDir, filename.replace('processed_', 'thumb_'));

    // Delete main image
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    // Delete thumbnail
    if (fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath);
    }

    logger.info('Image deleted', { filename });
  } catch (error) {
    logger.error('Error deleting image', { error: error.message, filename });
    throw error;
  }
};

// Clean up orphaned files (files not referenced in database)
const cleanupOrphanedFiles = async (prisma) => {
  try {
    // Get all image URLs from database
    const spots = await prisma.campingSpot.findMany({
      select: { images: true }
    });

    const usedImages = new Set();
    spots.forEach(spot => {
      if (spot.images) {
        const images = typeof spot.images === 'string' ? JSON.parse(spot.images) : spot.images;
        images.forEach(imageUrl => {
          const filename = path.basename(imageUrl);
          usedImages.add(filename);
        });
      }
    });

    // Get all files in uploads directory
    const imageFiles = fs.readdirSync(imagesDir);
    const thumbnailFiles = fs.readdirSync(thumbnailsDir);

    let deletedCount = 0;

    // Delete unused image files
    imageFiles.forEach(filename => {
      if (!usedImages.has(filename)) {
        const filePath = path.join(imagesDir, filename);
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    });

    // Delete unused thumbnail files
    thumbnailFiles.forEach(filename => {
      const originalName = filename.replace('thumb_', 'processed_');
      if (!usedImages.has(originalName)) {
        const filePath = path.join(thumbnailsDir, filename);
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    });

    logger.info('Orphaned files cleanup completed', { deletedCount });
    return deletedCount;
  } catch (error) {
    logger.error('Orphaned files cleanup failed', { error: error.message });
    throw error;
  }
};

// Get image info
const getImageInfo = async (imagePath) => {
  try {
    const metadata = await sharp(imagePath).metadata();
    const stats = fs.statSync(imagePath);

    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime
    };
  } catch (error) {
    logger.error('Error getting image info', { error: error.message, imagePath });
    throw error;
  }
};

module.exports = {
  uploadSingleImage,
  uploadMultipleImages,
  deleteImage,
  cleanupOrphanedFiles,
  getImageInfo,
  processImage,
  generateThumbnail
};