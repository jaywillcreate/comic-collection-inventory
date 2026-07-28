/** Uniform JSON error responses. */
export function notFound(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status =
    err.status ||
    (err.name === 'MulterError' || err.type === 'entity.parse.failed' ? 400 : 500);
  const message =
    status >= 500 ? 'Internal server error' : err.message || 'Bad request';
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
}
