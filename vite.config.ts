import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Restrictive Content-Security-Policy (NFR-20).
 * Only GitHub's API may be fetched, only GitHub avatars (and data: URIs) may be
 * shown as images, and fonts come exclusively from Google Fonts.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data: https://avatars.githubusercontent.com",
  "connect-src 'self' https://api.github.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

/**
 * The CSP is injected at build time only: Vite's dev server relies on inline
 * scripts for React Fast Refresh, which a strict `script-src 'self'` would block.
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'inject-content-security-policy',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

export default defineConfig({
  // Relative base so the build works from any sub-path or Express server.
  base: './',
  plugins: [react(), contentSecurityPolicy()],
  server: {
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
    server: {
      deps: {
        external: ['node:sqlite'],
      },
    },
    coverage: {
      provider: 'v8',
      include: ['src/utils/**/*.ts', 'src/api/**/*.ts'],
      exclude: ['**/*.test.ts'],
      reporter: ['text', 'html'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
