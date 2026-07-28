import process from 'node:process';
import { createApp } from './app.js';

const port = Number(process.env.PORT) || 4000;
const app = await createApp();

const server = app.listen(port, () => {
  console.log(`Longbox Archive API listening on http://localhost:${port}`);
  console.log(`  Catalog search : GET  /api/comics`);
  console.log(`  Record sheet   : GET  /api/comics/:id`);
  console.log(`  Accession      : POST /api/comics`);
  console.log(`  Cover upload   : POST /api/uploads/covers`);
  if (!process.env.ADMIN_API_KEY) {
    console.warn(
      '  ⚠ ADMIN_API_KEY not set — write endpoints are unprotected (dev only).'
    );
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
