import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dataEntry = fileURLToPath(new URL('./src/data/index.ts', import.meta.url));
const browserEntry = fileURLToPath(new URL('./src/data/browser.ts', import.meta.url));

export default defineConfig({
  plugins: [
    {
      name: 'prime-xi-production-security-policy',
      apply: 'build',
      transformIndexHtml: {
        order: 'post',
        handler: () => [
          {
            tag: 'meta',
            attrs: {
              'http-equiv': 'Content-Security-Policy',
              content:
                "default-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; form-action 'none'; manifest-src 'self'",
            },
            injectTo: 'head-prepend',
          },
        ],
      },
    },
    {
      name: 'prime-xi-browser-catalog',
      enforce: 'pre',
      resolveId(source, importer) {
        if (
          source === dataEntry ||
          (importer &&
            source.startsWith('.') &&
            resolve(dirname(importer.split('?')[0]!), source) === dataEntry)
        )
          return browserEntry;
      },
    },
    react(),
  ],
  build: { manifest: true },
  // Hash routing also makes direct links/reloads work on GitHub Pages.
  base: process.env['VITE_BASE_PATH'] ?? '/prime_XI/',
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
});
