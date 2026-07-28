import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server proxies API calls and uploaded cover scans to the backend
// (server/, default port 4000), so the frontend can use host-relative URLs.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
});
