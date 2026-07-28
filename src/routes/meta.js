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

  router.get('/stats', (req, res) => {
    res.json(service.stats());
  });

  router.get('/meta', (req, res) => {
    res.json(service.meta());
  });

  router.post('/admin/seed-reset', writeGuard, (req, res) => {
    resetToSeed(db);
    res.json({ ok: true, ...service.stats() });
  });

  return router;
}
