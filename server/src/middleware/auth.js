/**
 * Optional write protection for the CMS surface.
 *
 * When ADMIN_API_KEY is set (or an apiKey option is passed to createApp),
 * every mutating route — accession, edit, delete, uploads, seed restore —
 * requires a matching `x-api-key` header. Left unset, writes are open,
 * which is only appropriate for local development.
 */
import { timingSafeEqual } from 'node:crypto';

export function requireApiKey(apiKey) {
  return function apiKeyGuard(req, res, next) {
    if (!apiKey) return next();
    const provided = String(req.get('x-api-key') || '');
    const a = Buffer.from(provided);
    const b = Buffer.from(apiKey);
    if (a.length === b.length && timingSafeEqual(a, b)) return next();
    res.status(401).json({ error: 'Invalid or missing API key' });
  };
}
