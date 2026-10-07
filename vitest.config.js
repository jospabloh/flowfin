import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

// Unit tests for src/ (e.g. the mario_style canonical celebrate.test.js).
// Kept apart from vite.config.js so the base44 dev plugin doesn't load under test.
export default defineConfig({
  // import.meta.url, not import.meta.dirname: the latter only exists from Node 20.11.
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    // tests/smoke/ is the Playwright suite against the deployed site (npm run test:smoke).
    exclude: [...configDefaults.exclude, 'tests/smoke/**'],
  },
});
