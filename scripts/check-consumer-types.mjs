#!/usr/bin/env node

// Packs this package and type-checks a minimal consumer project against the
// tarball under several package-manager layouts, with `skipLibCheck: false`.
//
// Guards against phantom dependencies in the published `.d.ts` files (#621):
// every module imported by `dist/**/*.d.ts` must be declared in
// `dependencies` or `peerDependencies`, otherwise strict layouts (pnpm
// isolated with `hoist=false`) fail with TS2307, and lenient layouts silently
// bind to whatever copy happens to be hoisted.
//
// Usage: node scripts/check-consumer-types.mjs [layout...]
//   layouts: pnpm-isolated (default), pnpm-hoisted, npm
// Requires `pnpm build` to have been run first.

import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));

const LAYOUTS = {
  // Passed as CLI flags: pnpm >= 11 ignores non-auth settings in `.npmrc`.
  'pnpm-isolated': {
    pm: 'pnpm',
    flags: [
      '--config.node-linker=isolated',
      '--config.hoist=false',
      '--config.public-hoist-pattern=',
    ],
  },
  'pnpm-hoisted': { pm: 'pnpm', flags: ['--config.node-linker=hoisted'] },
  npm: { pm: 'npm', flags: [] },
};

const requested = process.argv.slice(2);
const layouts = requested.length > 0 ? requested : ['pnpm-isolated'];
for (const layout of layouts) {
  if (!(layout in LAYOUTS)) {
    console.error(`Unknown layout "${layout}". Known: ${Object.keys(LAYOUTS)}`);
    process.exit(2);
  }
}

const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, stdio: 'inherit', env: process.env });

const workDir = mkdtempSync(join(tmpdir(), 'openrouter-consumer-types-'));
let failed = false;

try {
  const packDir = join(workDir, 'pack');
  mkdirSync(packDir);
  run('pnpm', ['pack', '--pack-destination', packDir], repoRoot);
  const tarball = readdirSync(packDir).find((f) => f.endsWith('.tgz'));
  if (!tarball) {
    throw new Error('pnpm pack produced no tarball');
  }
  const tarballPath = join(packDir, tarball);

  for (const layout of layouts) {
    const { pm, flags } = LAYOUTS[layout];
    const dir = join(workDir, layout);
    mkdirSync(dir);

    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify(
        {
          name: 'openrouter-consumer-types-check',
          private: true,
          type: 'module',
          dependencies: {
            '@openrouter/ai-sdk-provider': `file:${tarballPath}`,
            ai: pkg.devDependencies.ai,
            zod: '^4.1.8',
          },
          devDependencies: {
            // `@ai-sdk/provider` itself imports `json-schema` types without
            // declaring them; that is upstream and out of scope for this check.
            '@types/json-schema': pkg.devDependencies['@types/json-schema'],
            '@types/node': pkg.devDependencies['@types/node'],
            typescript: pkg.devDependencies.typescript,
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            strict: true,
            noEmit: true,
            skipLibCheck: false,
            types: ['node'],
          },
          include: ['index.ts'],
        },
        null,
        2,
      ),
    );
    // `IsAny` assertions fail if a phantom import degrades types to `any`.
    writeFileSync(
      join(dir, 'index.ts'),
      `import type { LanguageModelV4 } from '@openrouter/ai-sdk-provider';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { OpenRouterChatLanguageModel } from '@openrouter/ai-sdk-provider/internal';

type IsAny<T> = 0 extends 1 & T ? true : false;

const openrouter = createOpenRouter({ apiKey: 'sk-or-placeholder' });
const chat = openrouter.chat('openai/gpt-4o-mini');
const internalChat = new OpenRouterChatLanguageModel(
  'openai/gpt-4o-mini',
  {},
  {
    provider: 'openrouter.chat',
    compatibility: 'strict',
    headers: () => ({}),
    url: () => 'https://openrouter.ai/api/v1/chat/completions',
  },
);

export const model: LanguageModelV4 = chat;
export const internalModel: LanguageModelV4 = internalChat;
export const chatIsNotAny: IsAny<typeof chat> = false;
export const internalIsNotAny: IsAny<typeof internalChat> = false;
export const modelIsNotAny: IsAny<LanguageModelV4> = false;
export const finishReasonIsNotAny: IsAny<
  Awaited<ReturnType<LanguageModelV4['doGenerate']>>['finishReason']
> = false;
`,
    );
    // Runtime smoke test: externalized dependencies must resolve too.
    writeFileSync(
      join(dir, 'smoke.mjs'),
      `const main = await import('@openrouter/ai-sdk-provider');
const internal = await import('@openrouter/ai-sdk-provider/internal');
if (typeof main.createOpenRouter !== 'function') throw new Error('main entry');
if (typeof internal.OpenRouterChatLanguageModel !== 'function') throw new Error('internal entry');
main.createOpenRouter({ apiKey: 'x' }).chat('openai/gpt-4o-mini');
`,
    );

    console.log(`\n=== ${layout}: installing with ${pm} ===`);
    try {
      if (pm === 'pnpm') {
        run('pnpm', ['install', '--ignore-workspace', ...flags], dir);
        run(join(dir, 'node_modules', '.bin', 'tsc'), ['-p', '.'], dir);
      } else {
        run('npm', ['install', '--no-audit', '--no-fund'], dir);
        run(join(dir, 'node_modules', '.bin', 'tsc'), ['-p', '.'], dir);
      }
      run('node', ['smoke.mjs'], dir);
      console.log(`=== ${layout}: OK ===`);
    } catch {
      console.error(`=== ${layout}: FAILED ===`);
      failed = true;
    }
  }
} finally {
  if (process.env.KEEP_CONSUMER_DIR) {
    console.log(`Kept consumer projects in ${workDir}`);
  } else {
    rmSync(workDir, { recursive: true, force: true });
  }
}

process.exit(failed ? 1 : 0);
