import { config } from 'dotenv';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';
import packageJson from './package.json';

const envPath = new URL('./.env.e2e', import.meta.url);

/**
 * Vitest config for issue-specific regression tests.
 * These tests are separated from the main e2e suite because they:
 * - May hit different models/APIs that could be slow or rate-limited
 * - Serve a different purpose (regression monitoring vs feature testing)
 * - Can be run on-demand or in a separate CI job
 *
 * Run with: pnpm test:issues
 */
export default defineConfig(() => ({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    env: config({ path: envPath.pathname }).parsed,
    include: ['./e2e/issues/**/*.test.ts'],
  },
  define: {
    __PACKAGE_VERSION__: JSON.stringify(packageJson.version),
  },
}));
