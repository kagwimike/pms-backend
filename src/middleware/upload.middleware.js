const multer = require('multer');
const path = require('path');

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure this directory exists or create it dynamically in a real setup
    cb(null, path.join(__dirname, '../../../media/property_images'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed!'), false);
    }
  }
});

module.exports = upload;
