import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const package_ = JSON.parse(
  readFileSync(new URL('package.json', import.meta.url), 'utf8'),
);

// `@ai-sdk/provider` and `@ai-sdk/provider-utils` are optional peers so the
// published `.d.ts` files resolve to the exact copies the consumer's `ai`
// version uses (see #621). They stay bundled at runtime so the JS never depends
// on which (possibly older) copy that is.
const noExternal = ['@ai-sdk/provider', '@ai-sdk/provider-utils'];

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    noExternal,
    define: {
      __PACKAGE_VERSION__: JSON.stringify(package_.version),
    },
  },
  {
    entry: ['src/internal/index.ts'],
    outDir: 'dist/internal',
    format: ['esm'],
    dts: true,
    sourcemap: true,
    noExternal,
    define: {
      __PACKAGE_VERSION__: JSON.stringify(package_.version),
    },
  },
]);
