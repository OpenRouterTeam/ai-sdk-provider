import path from 'node:path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';
import packageJson from './package.json';

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
      './vitest.e2e.setup.ts',
    ],
    include: [
      './e2e/**/*.test.ts',
    ],
    // Run e2e test files concurrently for faster CI
    fileParallelism: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        // Run tests within each file concurrently too
        singleThread: false,
      },
    },
  },
  define: {
    __PACKAGE_VERSION__: JSON.stringify(packageJson.version),
  },
}));
