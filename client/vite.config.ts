/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The Express API. Proxying /api keeps the browser same-origin, so the server needs no CORS.
// 127.0.0.1 rather than localhost: the server binds IPv4 loopback, and localhost may resolve to ::1.
const apiTarget = process.env.API_URL ?? 'http://127.0.0.1:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': apiTarget },
  },
  preview: {
    proxy: { '/api': apiTarget },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
