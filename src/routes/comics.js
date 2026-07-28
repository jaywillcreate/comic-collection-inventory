import { Router } from 'express';

/**
 * /api/comics — the design handoff's core contract:
 *   GET    /            search + facets + sort, server-side
 *   GET    /:id         full record sheet (incl. census bars)
 *   POST   /            accession a book (CMS form submit)
 *   PATCH  /:id         edit record in place
 *   DELETE /:id         immediate delete
 */
export function comicsRouter(service, writeGuard) {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(service.search(req.query));
  });

  router.get('/:id', (req, res) => {
    const record = service.getById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    res.json(record);
  });

  router.post('/', writeGuard, (req, res) => {
    const record = service.create(req.body);
    res.status(201).json(record);
  });

  router.patch('/:id', writeGuard, (req, res) => {
    const record = service.update(req.params.id, req.body);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    res.json(record);
  });

  router.delete('/:id', writeGuard, (req, res) => {
    if (!service.remove(req.params.id)) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.status(204).end();
  });

  return router;
}
