import { Router } from 'express';
import multer from 'multer';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB per cover scan

/**
 * POST /api/uploads/covers — the real upload the prototype's data-URL drop
 * zone stands in for. Accepts one image file (field name "cover"), stores it
 * under an opaque random name, returns { url } to put in the record's image.
 */
export function uploadsRouter(uploadDir, writeGuard) {
  mkdirSync(path.join(uploadDir, 'covers'), { recursive: true });

  const storage = multer.diskStorage({
    destination: path.join(uploadDir, 'covers'),
    filename: (req, file, cb) => {
      const ext = EXTENSIONS[file.mimetype];
      cb(null, `${Date.now().toString(36)}-${randomBytes(8).toString('hex')}${ext}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: MAX_BYTES, files: 1 },
    fileFilter: (req, file, cb) => {
      if (EXTENSIONS[file.mimetype]) return cb(null, true);
      const err = new Error(
        'Unsupported image type — use JPEG, PNG, WebP, GIF or AVIF'
      );
      err.status = 415;
      cb(err);
    },
  });

  const router = Router();

  router.post('/covers', writeGuard, upload.single('cover'), (req, res) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: 'Attach an image file in the "cover" field' });
    }
    res.status(201).json({
      url: `/uploads/covers/${req.file.filename}`,
      bytes: req.file.size,
      mimeType: req.file.mimetype,
    });
  });

  return router;
}
