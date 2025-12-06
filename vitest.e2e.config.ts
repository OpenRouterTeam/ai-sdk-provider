import path from 'node:path';
import { config } from 'dotenv';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';
import packageJson from './package.json';

// Load .env.e2e if it exists (merges into process.env, doesn't override existing vars)
config({
  path: '.env.e2e',
});

// https://vitejs.dev/config/
export default defineConfig(() => ({
  plugins: [
    tsconfigPaths(),
  ],
  resolve: {
    alias: {
      '@/src': path.resolve(__dirname, './src/index'),
      '@/e2e': path.resolve(__dirname, './e2e'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: [
      './vitest.setup.ts',
    ],
    include: [
      './e2e/**/*.test.ts',
    ],
    // Ensure environment variables are passed to test workers
    env: {
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? '',
    },
  },
  define: {
    __PACKAGE_VERSION__: JSON.stringify(packageJson.version),
  },
}));
