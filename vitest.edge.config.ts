import { defineConfig } from 'vitest/config';

// https://vitejs.dev/config/
export default defineConfig(async () => {
  const { default: tsconfigPaths } = await import('vite-tsconfig-paths');

  return {
    plugins: [tsconfigPaths()],
    test: {
      pool: 'threads',
      environment: 'edge-runtime',
      globals: true,
      include: ['./src/**/*.test.ts'],
    },
  };
});
