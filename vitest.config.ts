import path from 'node:path';
import { config } from 'dotenv';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';
import packageJson from './package.json';

// Load .env.e2e into process.env immediately (before any test imports)
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
    include: [
      './src/**/*.test.ts',
      './e2e/**/*.test.ts',
    ],
  },
  define: {
    __PACKAGE_VERSION__: JSON.stringify(packageJson.version),
  },
}));
