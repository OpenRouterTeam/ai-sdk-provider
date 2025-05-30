import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'edge-runtime',
    globals: true,
    include: ['./src/**/*.test.ts'],
  },
});
