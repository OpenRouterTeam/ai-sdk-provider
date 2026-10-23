/**
 * Probe suite config. Run from the built repo root:
 *   pnpm exec vitest --config live-verify/probes/vitest.probes.config.ts --run
 * `node_modules` next to this file is a symlink into $WT/node_modules
 * (created by run.sh), and `@openrouter/ai-sdk-provider` resolves to the
 * worktree's built `dist`.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

const here = dirname(fileURLToPath(import.meta.url));
const wt = process.env.WT || join(here, '..', '..');

// Load the key from the worktree's .env.e2e (if present), like the repo's
// e2e configs do. Values already in the environment win.
const parsed = config({ path: join(wt, '.env.e2e'), quiet: true }).parsed ?? {};

export default defineConfig({
  root: here,
  resolve: {
    alias: {
      '@openrouter/ai-sdk-provider': join(wt, 'dist', 'index.js'),
    },
  },
  test: {
    environment: 'node',
    include: [join(here, '*.test.ts')],
    env: parsed,
    globalSetup: [join(here, 'lib', 'global-setup.ts')],
    // Sequential: keeps the file-based budget counter exact and spend bounded.
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 30_000,
  },
});
