import { config } from 'dotenv';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';
import packageJson from './package.json';

const envPath = new URL('./.env.e2e', import.meta.url);

// https://vitejs.dev/config/
export default defineConfig(() => ({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    env: config({ path: envPath.pathname }).parsed,
    include: ['./e2e/**/*.test.ts'],
  },
  define: {
    __PACKAGE_VERSION__: JSON.stringify(packageJson.version),
  },
}));
