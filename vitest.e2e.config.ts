import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

const envPath = new URL('./.env.e2e', import.meta.url);

// https://vitejs.dev/config/
export default defineConfig(async () => {
  const { default: tsconfigPaths } = await import('vite-tsconfig-paths');

  return {
    plugins: [tsconfigPaths()],
    test: {
      pool: 'threads',
      environment: 'node',
      globals: true,
      env: config({ path: envPath.pathname }).parsed,
      include: ['./e2e/**/*.test.ts'],
    },
  };
});
