import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Fully client-side app — no backend. All scanning, scoring, PQC key
// generation, and AES-256-GCM encryption run in the browser.
export default defineConfig({
  // Pin root to this file's directory so the dev server / build work no matter
  // what working directory they are launched from.
  root: import.meta.dirname,
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
});
