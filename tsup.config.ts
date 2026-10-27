import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const package_ = JSON.parse(
  readFileSync(new URL('package.json', import.meta.url), 'utf8'),
);

// `@ai-sdk/provider` and `@ai-sdk/provider-utils` are declared as optional
// peer dependencies so that the emitted `.d.ts` files resolve their imports to
// the same copies `ai` uses, including under strict installs (e.g. pnpm with
// `hoist=false`). tsup externalizes peer dependencies by default; keep bundling
// their runtime code into the JS output, as before.
const noExternal = ['@ai-sdk/provider', '@ai-sdk/provider-utils'];

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    noExternal,
    dts: true,
    sourcemap: true,
    define: {
      __PACKAGE_VERSION__: JSON.stringify(package_.version),
    },
  },
  {
    entry: ['src/internal/index.ts'],
    outDir: 'dist/internal',
    format: ['esm'],
    noExternal,
    dts: true,
    sourcemap: true,
    define: {
      __PACKAGE_VERSION__: JSON.stringify(package_.version),
    },
  },
]);
