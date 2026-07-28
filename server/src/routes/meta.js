import { Router } from 'express';
import { resetToSeed } from '../db/connection.js';

/**
 * Read-model chrome + admin actions:
 *   GET  /api/stats       hero stats & CMS stat cards
 *   GET  /api/meta        genre/era/sort/publisher option lists + ticker feed
 *   POST /api/admin/seed-reset   "Restore seed data"
 */
export function metaRouter(service, db, writeGuard) {
  const router = Router();

  router.get('/stats', async (req, res) => {
    res.json(await service.stats());
  });

  router.get('/meta', async (req, res) => {
    res.json(await service.meta());
  });

  router.post('/admin/seed-reset', writeGuard, async (req, res) => {
    await resetToSeed(db);
    res.json({ ok: true, ...(await service.stats()) });
  });

  return router;
}
