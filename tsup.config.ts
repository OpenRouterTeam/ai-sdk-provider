import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const package_ = JSON.parse(
  readFileSync(new URL('package.json', import.meta.url), 'utf8'),
);

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    define: {
      __PACKAGE_VERSION__: JSON.stringify(package_.version),
    },
  },
  {
    entry: ['src/internal/index.ts'],
    outDir: 'dist/internal',
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    define: {
      __PACKAGE_VERSION__: JSON.stringify(package_.version),
    },
  },
]);
