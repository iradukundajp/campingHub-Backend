var express = require('express');
var router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');

// Ensure upload directory exists
const uploadDir = 'public/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp and random string
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, 'camping-' + uniqueSuffix + extension);
  }
});

// File filter for images only
const fileFilter = (req, file, cb) => {
  // Check if file is an image
  if (file.mimetype.startsWith('image/')) {
    // Check file extension
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files with extensions .jpg, .jpeg, .png, .gif, .webp are allowed!'), false);
    }
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 10 // Maximum 10 files at once
  },
  fileFilter: fileFilter
});

// Apply authentication to all upload routes
router.use(authenticateToken);

/* GET /api/upload - API info */
router.get('/', function(req, res, next) {
  res.json({
    message: 'CampingHub Upload API',
    version: '1.0.0',
    endpoints: {
      single: 'POST /api/upload (single image)',
      multiple: 'POST /api/upload/multiple (multiple images)',
      delete: 'DELETE /api/upload/:filename (delete image)'
    },
    limits: {
      maxFileSize: '10MB',
      maxFiles: 10,
      allowedTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp']
    }
  });
});

/* POST /api/upload - Upload single image */
router.post('/', upload.single('image'), async function(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: 'No file uploaded. Please select an image file.',
        code: 'NO_FILE'
      });
    }

    // Generate the public URL for the uploaded image
    const imageUrl = `/uploads/${req.file.filename}`;

    // Log the upload for monitoring
    console.log(`📸 Image uploaded by user ${req.user.userId}: ${req.file.filename} (${req.file.size} bytes)`);

    res.json({
      message: 'Image uploaded successfully',
      imageUrl: imageUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Single upload error:', error);
    res.status(500).json({
      message: 'Error uploading image',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/* POST /api/upload/multiple - Upload multiple images */
router.post('/multiple', upload.array('images', 10), async function(req, res, next) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        message: 'No files uploaded. Please select one or more image files.',
        code: 'NO_FILES'
      });
    }

    // Process all uploaded files
    const uploadedImages = req.files.map(file => {
      const imageUrl = `/uploads/${file.filename}`;
      
      console.log(`📸 Image uploaded by user ${req.user.userId}: ${file.filename} (${file.size} bytes)`);
      
      return {
        imageUrl: imageUrl,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype
      };
    });

    res.json({
      message: `${uploadedImages.length} image(s) uploaded successfully`,
      images: uploadedImages,
      totalFiles: uploadedImages.length,
      totalSize: uploadedImages.reduce((sum, img) => sum + img.size, 0),
      uploadedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Multiple upload error:', error);
    res.status(500).json({
      message: 'Error uploading images',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/* DELETE /api/upload/:filename - Delete uploaded image */
router.delete('/:filename', async function(req, res, next) {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      return res.status(400).json({
        message: 'Filename is required'
      });
    }

    // Validate filename format (security check)
    const safeFilename = path.basename(filename);
    if (safeFilename !== filename || filename.includes('..')) {
      return res.status(400).json({
        message: 'Invalid filename format'
      });
    }

    const filePath = path.join(uploadDir, safeFilename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        message: 'File not found'
      });
    }

    // Delete the file
    fs.unlinkSync(filePath);
    
    console.log(`🗑️ Image deleted by user ${req.user.userId}: ${safeFilename}`);

    res.json({
      message: 'Image deleted successfully',
      filename: safeFilename,
      deletedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Delete upload error:', error);
    res.status(500).json({
      message: 'Error deleting image',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/* GET /api/upload/list - List uploaded images for current user (optional feature) */
router.get('/list', async function(req, res, next) {
  try {
    // This is a basic implementation - in production you might want to track uploads in database
    const files = fs.readdirSync(uploadDir);
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    });

    const images = imageFiles.map(file => {
      const filePath = path.join(uploadDir, file);
      const stats = fs.statSync(filePath);
      
      return {
        filename: file,
        imageUrl: `/uploads/${file}`,
        size: stats.size,
        uploadedAt: stats.birthtime
      };
    });

    res.json({
      message: 'Images retrieved successfully',
      images: images.slice(0, 50), // Limit to 50 most recent
      total: images.length
    });

  } catch (error) {
    console.error('List uploads error:', error);
    res.status(500).json({
      message: 'Error retrieving images',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Error handling middleware specifically for multer errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('Multer error:', error);
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          message: 'File too large. Maximum size is 10MB per file.',
          code: 'FILE_TOO_LARGE',
          maxSize: '10MB'
        });
      
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          message: 'Too many files. Maximum is 10 files at once.',
          code: 'TOO_MANY_FILES',
          maxFiles: 10
        });
      
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          message: 'Unexpected field name. Use "image" for single upload or "images" for multiple.',
          code: 'UNEXPECTED_FIELD'
        });
      
      default:
        return res.status(400).json({
          message: 'Upload error occurred',
          code: error.code || 'UPLOAD_ERROR'
        });
    }
  }
  
  // Handle custom file filter errors
  if (error.message.includes('Only image files')) {
    return res.status(400).json({
      message: error.message,
      code: 'INVALID_FILE_TYPE',
      allowedTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp']
    });
  }

  // Handle other errors
  console.error('Upload middleware error:', error);
  res.status(500).json({
    message: 'Upload error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
});

module.exports = router;