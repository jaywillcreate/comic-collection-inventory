/**
 * Vercel serverless entry — the whole Express API runs as one function.
 * vercel.json rewrites /api/* here; the original URL is preserved, so the
 * app's /api/... routes match unchanged.
 *
 * The app (and its Postgres pool) is built once per instance and reused
 * across warm invocations — but a FAILED init (e.g. a transient database
 * connection error on cold start) is never cached: the next request retries
 * instead of poisoning the instance until recycling.
 */
import { createApp } from '../server/src/app.js';

let ready = null;

function getApp() {
  if (!ready) {
    ready = createApp().catch((err) => {
      ready = null; // don't cache the failure — retry on the next request
      throw err;
    });
  }
  return ready;
}

export default async function handler(req, res) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (err) {
    console.error('App init failed:', err);
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.setHeader('retry-after', '2');
    res.end(JSON.stringify({ error: 'Service is starting up — retry in a moment' }));
  }
}
