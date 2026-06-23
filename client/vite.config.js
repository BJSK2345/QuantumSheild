import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite dev server proxies /api to the Express backend on :3001,
// so the frontend can call same-origin paths with no CORS fuss.
export default defineConfig({
  // Pin root to this file's directory so the dev server works no matter
  // what working directory it is launched from.
  root: import.meta.dirname,
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
