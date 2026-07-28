import { mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

const name = (ext) =>
  `${Date.now().toString(36)}-${randomBytes(8).toString('hex')}${ext}`;

/**
 * Where cover scans live.
 *
 * - Vercel Blob when a store is connected (BLOB_READ_WRITE_TOKEN present) —
 *   returns absolute public URLs.
 * - Local disk under UPLOAD_DIR otherwise — returns /uploads/… paths served
 *   statically by the Express app.
 * - "disabled" on Vercel without a Blob store (the filesystem is read-only):
 *   uploads fail with a clear remediation message instead of an EROFS crash.
 */
export function createCoverStorage(uploadDir) {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      mode: 'blob',
      async save(buffer, ext, contentType) {
        const { put } = await import('@vercel/blob');
        const blob = await put(`covers/${name(ext)}`, buffer, {
          access: 'public',
          contentType,
          addRandomSuffix: false,
        });
        return blob.url;
      },
    };
  }

  if (process.env.VERCEL) {
    return {
      mode: 'disabled',
      async save() {
        const err = new Error(
          'Cover uploads need a Vercel Blob store — add one under Storage → Create → Blob, then redeploy'
        );
        err.status = 501;
        throw err;
      },
    };
  }

  const dir = path.join(uploadDir, 'covers');
  return {
    mode: 'disk',
    async save(buffer, ext) {
      mkdirSync(dir, { recursive: true });
      const file = name(ext);
      writeFileSync(path.join(dir, file), buffer);
      return `/uploads/covers/${file}`;
    },
  };
}
