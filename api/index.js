/**
 * Vercel serverless entry — the whole Express API runs as one function.
 * vercel.json rewrites /api/* here; the original URL is preserved, so the
 * app's /api/... routes match unchanged. The app (and its Postgres pool)
 * is built once per instance and reused across warm invocations.
 */
import { createApp } from '../server/src/app.js';

const ready = createApp();

export default async function handler(req, res) {
  const app = await ready;
  return app(req, res);
}
