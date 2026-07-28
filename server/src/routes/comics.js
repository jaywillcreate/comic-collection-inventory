import { Router } from 'express';

/**
 * /api/comics — the design handoff's core contract:
 *   GET    /            search + facets + sort, server-side
 *   GET    /:id         full record sheet (incl. census bars)
 *   POST   /            accession a book (CMS form submit)
 *   PATCH  /:id         edit record in place
 *   DELETE /:id         immediate delete
 *
 * Handlers are async — Express 5 forwards rejections to the error middleware.
 */
export function comicsRouter(service, writeGuard) {
  const router = Router();

  router.get('/', async (req, res) => {
    res.json(await service.search(req.query));
  });

  router.get('/:id', async (req, res) => {
    const record = await service.getById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    res.json(record);
  });

  router.post('/', writeGuard, async (req, res) => {
    const record = await service.create(req.body);
    res.status(201).json(record);
  });

  router.patch('/:id', writeGuard, async (req, res) => {
    const record = await service.update(req.params.id, req.body);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    res.json(record);
  });

  router.delete('/:id', writeGuard, async (req, res) => {
    if (!(await service.remove(req.params.id))) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.status(204).end();
  });

  return router;
}
