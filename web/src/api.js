/**
 * Longbox Archive API client. Host-relative by default — the Vite dev server
 * proxies /api and /uploads to the backend; set VITE_API_BASE for a split
 * deployment, and VITE_ADMIN_KEY when the backend has ADMIN_API_KEY set.
 */
const BASE = import.meta.env.VITE_API_BASE || '';
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || '';

async function http(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  if (ADMIN_KEY && method !== 'GET') headers['x-api-key'] = ADMIN_KEY;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function searchParams({ q, pub, era, genre, keyOnly, priceCap, sort, limit, offset }) {
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  for (const v of pub || []) p.append('publisher', v);
  for (const v of era || []) p.append('era', v);
  for (const v of genre || []) p.append('genre', v);
  if (keyOnly) p.set('keyOnly', 'true');
  if (priceCap != null && priceCap < 100) p.set('priceCap', priceCap);
  if (sort) p.set('sort', sort);
  if (limit) p.set('limit', limit);
  if (offset) p.set('offset', offset);
  return p;
}

export const api = {
  search: (filters) => http(`/api/comics?${searchParams(filters)}`),
  get: (id) => http(`/api/comics/${encodeURIComponent(id)}`),
  summary: (id) => http(`/api/comics/${encodeURIComponent(id)}/summary`),
  value: (id) => http(`/api/comics/${encodeURIComponent(id)}/value`),
  create: (body) => http('/api/comics', { method: 'POST', body }),
  update: (id, body) =>
    http(`/api/comics/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  remove: (id) => http(`/api/comics/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  stats: () => http('/api/stats'),
  meta: () => http('/api/meta'),
  seedReset: () => http('/api/admin/seed-reset', { method: 'POST' }),
  uploadCover: (file) => {
    const form = new FormData();
    form.append('cover', file);
    return http('/api/uploads/covers', { method: 'POST', form });
  },
};
