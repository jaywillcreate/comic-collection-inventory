import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';

import { openDatabase } from './db/connection.js';
import { ComicsService } from './services/comics-service.js';
import { comicsRouter } from './routes/comics.js';
import { uploadsRouter } from './routes/uploads.js';
import { metaRouter } from './routes/meta.js';
import { requireApiKey } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errors.js';

/**
 * Build the Express app. Options are injectable so tests can run against
 * an in-memory database and a throwaway upload directory.
 */
export function createApp({
  dbPath = process.env.DB_PATH || 'data/longbox.db',
  uploadDir = process.env.UPLOAD_DIR || 'uploads',
  corsOrigin = process.env.CORS_ORIGIN || '*',
  apiKey = process.env.ADMIN_API_KEY || '',
} = {}) {
  const db = openDatabase(dbPath);
  const service = new ComicsService(db);
  const writeGuard = requireApiKey(apiKey);

  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: corsOrigin === '*' ? true : corsOrigin.split(',') }));
  app.use(express.json({ limit: '256kb' }));
  app.use(
    '/api',
    rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false })
  );

  // Cover scans are immutable (opaque random filenames) — cache hard.
  app.use(
    '/uploads',
    express.static(path.resolve(uploadDir), {
      immutable: true,
      maxAge: '365d',
      fallthrough: true,
    })
  );

  app.get('/api/health', (req, res) =>
    res.json({ ok: true, service: 'longbox-archive-api' })
  );
  app.use('/api/comics', comicsRouter(service, writeGuard));
  app.use('/api/uploads', uploadsRouter(uploadDir, writeGuard));
  app.use('/api', metaRouter(service, db, writeGuard));

  app.use(notFound);
  app.use(errorHandler);

  app.locals.db = db;
  return app;
}
