import { Router } from 'express';
import multer from 'multer';

const EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

// Vercel caps request bodies at ~4.5 MB, so 4 MB is the practical ceiling.
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * POST /api/uploads/covers — the real upload the prototype's data-URL drop
 * zone stands in for. Accepts one image file (field name "cover"), hands it
 * to the configured cover storage (Vercel Blob in production, local disk in
 * dev), returns { url } to put in the record's image field.
 */
export function uploadsRouter(storage, writeGuard) {
  const upload = multer({
    storage: multer.memoryStorage(),
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

  router.post('/covers', writeGuard, upload.single('cover'), async (req, res) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: 'Attach an image file in the "cover" field' });
    }
    const url = await storage.save(
      req.file.buffer,
      EXTENSIONS[req.file.mimetype],
      req.file.mimetype
    );
    res.status(201).json({
      url,
      bytes: req.file.size,
      mimeType: req.file.mimetype,
    });
  });

  return router;
}
