import path from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';

// Unit tests for src/ (e.g. the mario_style canonical celebrate.test.js).
// Kept apart from vite.config.js so the base44 dev plugin doesn't load under test.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    // tests/smoke/ is the Playwright suite against the deployed site (npm run test:smoke).
    exclude: [...configDefaults.exclude, 'tests/smoke/**'],
  },
});
