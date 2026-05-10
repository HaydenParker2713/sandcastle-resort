const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_EXT  = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function createUploader(subdir, prefix) {
  const uploadDir = path.join(__dirname, '..', 'public', 'uploads', subdir);
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${prefix}${crypto.randomBytes(8).toString('hex')}${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter(req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext)) {
        return cb(new Error('Only JPEG, PNG, WebP, or GIF images are allowed (max 5 MB).'));
      }
      cb(null, true);
    },
  });
}

module.exports = { createUploader };
