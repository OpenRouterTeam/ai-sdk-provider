import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
  ],
  format: [
    'cjs',
    'esm',
  ],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  treeshake: true,
  external: [],
  noExternal: [],
  target: 'node18',
  platform: 'node',
  outDir: 'dist',
  bundle: true,
});
