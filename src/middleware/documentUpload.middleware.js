const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ApiError = require('../utils/ApiError');

const documentDir = path.join(__dirname, '../../../media/documents');

if (!fs.existsSync(documentDir)) {
  fs.mkdirSync(documentDir, { recursive: true });
}

const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.doc',
  '.docx',
  '.odt',
  '.rtf',
  '.txt',
  '.xls',
  '.xlsx',
  '.csv',
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, documentDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = crypto.randomBytes(12).toString('hex');
    const filename = `${Date.now()}-${safeBase}${ext}`;
    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, `Unsupported file type "${ext}". Allowed formats: PDF, Images, Word, Excel, CSV, TXT.`), false);
  }
};

const documentUpload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB limit
  },
  fileFilter,
});

module.exports = {
  documentUpload,
  documentDir,
};
