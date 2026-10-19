import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Hash routing also makes direct links/reloads work on GitHub Pages.
  base: process.env['VITE_BASE_PATH'] ?? '/prime_XI/',
  server: { host: '0.0.0.0', port: 5173, strictPort: true },
  preview: { host: '0.0.0.0', port: 4173, strictPort: true },
});
