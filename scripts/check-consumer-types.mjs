#!/usr/bin/env node

// Packs this package and type-checks realistic consumer code against the
// tarball across a matrix of package-manager layouts and `ai` versions, with
// `skipLibCheck: false`. Each consumer also runs a runtime smoke test.
//
// Guards against:
//   - TS2307 / silently `any`-typed models when the `.d.ts` files import
//     packages that are not resolvable from the consumer (#621);
//   - TS2322 when our models bind to a different `@ai-sdk/provider` copy than
//     the one `ai` uses (e.g. `finishReason.unified` gaining a new member), so
//     `generateText({ model: openrouter.chat(...) })` stops compiling.
//
// Usage:
//   node scripts/check-consumer-types.mjs [options]
//     --layouts=<list>        default: pnpm-isolated, pnpm-global-virtual-store,
//                             pnpm-hoisted, npm. Extra: pnpm-isolated-no-auto-peers,
//                             npm-legacy-peer-deps
//     --ai=floor,dev,latest   `ai` versions to test. `floor` = minimum of
//                             peerDependencies.ai, `dev` = devDependencies.ai,
//                             anything else is passed to the package manager.
//                             (default: floor,dev,latest)
//     --tarball=<path>        test this tarball instead of packing the repo
//                             (e.g. a published release, for baselines)
//     --concurrency=<n>       parallel consumer installs (default: 3)
//   KEEP_CONSUMER_DIR=1 keeps the generated projects for inspection.
// Requires `pnpm build` to have been run first (unless --tarball is given).

import { execFileSync, spawn } from 'node:child_process';
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
  // The layout from the #621 report: packages are symlinked from a global
  // store, so nothing outside a package's declared deps/peers is reachable.
  'pnpm-global-virtual-store': {
    pm: 'pnpm',
    flags: [
      '--config.enable-global-virtual-store=true',
      '--config.hoist=false',
      '--config.public-hoist-pattern=',
    ],
  },
  'pnpm-hoisted': { pm: 'pnpm', flags: ['--config.node-linker=hoisted'] },
  npm: { pm: 'npm', flags: [] },
};

// Extra layouts, not run by default.
const EXTRA_LAYOUTS = {
  'pnpm-isolated-no-auto-peers': {
    pm: 'pnpm',
    flags: [
      ...LAYOUTS['pnpm-isolated'].flags,
      '--config.auto-install-peers=false',
    ],
  },
  'npm-legacy-peer-deps': { pm: 'npm', flags: ['--legacy-peer-deps'] },
};
const DEFAULT_LAYOUTS = Object.keys(LAYOUTS);
Object.assign(LAYOUTS, EXTRA_LAYOUTS);

// Known upstream issue: `@ai-sdk/provider`'s own `.d.ts` imports `json-schema`
// without declaring `@types/json-schema`, which is unreachable from the store
// under the global virtual store. It affects `ai` itself, not this package.
const UPSTREAM_ERROR =
  /@ai-sdk\/provider\/[^\n]*error TS7016: [^\n]*'json-schema'/;

const options = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (!match) {
      console.error(`Unknown argument "${arg}"`);
      process.exit(2);
    }
    return [match[1], match[2] ?? 'true'];
  }),
);

const layouts = (options.layouts ?? DEFAULT_LAYOUTS.join(',')).split(',');
for (const layout of layouts) {
  if (!(layout in LAYOUTS)) {
    console.error(`Unknown layout "${layout}". Known: ${Object.keys(LAYOUTS)}`);
    process.exit(2);
  }
}

const aiFloor = /(\d+\.\d+\.\d+)/.exec(pkg.peerDependencies.ai)?.[1];
const aiVersions = [
  ...new Set(
    (options.ai ?? 'floor,dev,latest').split(',').map((v) => {
      if (v === 'floor') {
        return aiFloor;
      }
      if (v === 'dev') {
        return pkg.devDependencies.ai;
      }
      return v;
    }),
  ),
];
const concurrency = Number(options.concurrency ?? 3);

// Realistic user code. Any TS error here (TS2307, TS2322, ...) fails the check,
// and the `IsAny` assertions catch types that silently degraded to `any`.
const CONSUMER_TS = `import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { OpenRouterChatLanguageModel } from '@openrouter/ai-sdk-provider/internal';
import {
  createProviderRegistry,
  embed,
  embedMany,
  experimental_generateVideo as generateVideo,
  generateImage,
  generateText,
  rerank,
  streamText,
  wrapLanguageModel,
} from 'ai';

type IsAny<T> = 0 extends 1 & T ? true : false;

const openrouter = createOpenRouter({ apiKey: 'sk-or-placeholder' });
const chat = openrouter.chat('openai/gpt-4o-mini');
const completion = openrouter.completion('openai/gpt-3.5-turbo-instruct');
const embedding = openrouter.textEmbeddingModel('openai/text-embedding-3-small');
const reranking = openrouter.rerankingModel('cohere/rerank-v3.5');
const image = openrouter.imageModel('google/gemini-2.5-flash-image');
const video = openrouter.videoModel('google/veo-3.1');
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

export async function userCode() {
  await generateText({ model: chat, prompt: 'hi' });
  await generateText({ model: completion, prompt: 'hi' });
  await generateText({ model: openrouter('openai/gpt-4o-mini'), prompt: 'hi' });
  await generateText({ model: internalChat, prompt: 'hi' });
  streamText({ model: chat, prompt: 'hi' });
  streamText({ model: completion, prompt: 'hi' });
  const wrapped = wrapLanguageModel({ model: chat, middleware: [] });
  await generateText({ model: wrapped, prompt: 'hi' });
  await embed({ model: embedding, value: 'hi' });
  await embedMany({ model: embedding, values: ['a', 'b'] });
  await rerank({ model: reranking, query: 'hi', documents: ['a', 'b'] });
  await generateImage({ model: image, prompt: 'hi' });
  await generateVideo({ model: video, prompt: 'hi' });
  createProviderRegistry({ openrouter });
}

export const notAny: [
  IsAny<typeof openrouter>,
  IsAny<typeof chat>,
  IsAny<typeof completion>,
  IsAny<typeof embedding>,
  IsAny<typeof reranking>,
  IsAny<typeof image>,
  IsAny<typeof video>,
  IsAny<typeof internalChat>,
  IsAny<Awaited<ReturnType<typeof chat.doGenerate>>['finishReason']>,
] = [false, false, false, false, false, false, false, false, false];
`;

// The decision model spec is experimental and changes in `ai` patch releases.
// The peer floor is the first release whose spec the decision model satisfies,
// so this is checked for every tested version.
const DECIDE_TS = `import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { experimental_decide as decide } from 'ai';

type IsAny<T> = 0 extends 1 & T ? true : false;

const openrouter = createOpenRouter({ apiKey: 'sk-or-placeholder' });
const decision = openrouter.decisionModel('typesafe/jev-1.14');

export async function userCode() {
  const result = await decide({
    model: decision,
    state: 'hi',
    questions: {
      ok: { type: 'boolean', instructions: 'Is it?' },
      kind: { type: 'choice', criteria: { a: 'First', b: null } },
      level: { type: 'score', criteria: ['low', 'high'] },
      where: { type: 'box', instructions: 'Locate it' },
    },
  });
  const probability: number = result.answers.ok.probability;
  const choice: 'a' | 'b' = result.answers.kind.choice;
  const score: number = result.answers.level.score;
  const top: number = result.answers.where.box.top;
  return { probability, choice, score, top };
}

export const notAny: [IsAny<typeof decision>] = [false];
`;

// Runtime smoke test: both entry points load, and a real `generateText` call
// through the consumer's \`ai\` copy works end to end against a stub fetch.
// A decision call is run the same way.
const SMOKE_MJS = `import { experimental_decide as decide, generateText } from 'ai';
const main = await import('@openrouter/ai-sdk-provider');
const internal = await import('@openrouter/ai-sdk-provider/internal');
if (typeof main.createOpenRouter !== 'function') throw new Error('main entry');
if (typeof internal.OpenRouterChatLanguageModel !== 'function') throw new Error('internal entry');
const openrouter = main.createOpenRouter({
  apiKey: 'x',
  fetch: async (url) =>
    new Response(
      JSON.stringify(
        String(url).endsWith('/decisions')
          ? {
              id: 'gen-2',
              model: 'typesafe/jev-1.14',
              answers: { ok: { type: 'noul', noul: 0.75 } },
              usage: { input_tokens: 1, output_tokens: 1 },
            }
          : {
              id: 'gen-1',
              object: 'chat.completion',
              created: 0,
              model: 'openai/gpt-4o-mini',
              choices: [{ index: 0, message: { role: 'assistant', content: 'pong' }, finish_reason: 'stop' }],
              usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            },
      ),
      { headers: { 'content-type': 'application/json' } },
    ),
});
const result = await generateText({ model: openrouter.chat('openai/gpt-4o-mini'), prompt: 'ping' });
if (result.text !== 'pong') throw new Error('unexpected text: ' + result.text);
if (result.finishReason !== 'stop') throw new Error('unexpected finishReason: ' + result.finishReason);
const decision = await decide({
  model: openrouter.decisionModel('typesafe/jev-1.14'),
  state: 'hi',
  questions: { ok: { type: 'boolean', instructions: 'Is it?' } },
});
if (decision.answers?.ok?.probability !== 0.75) {
  throw new Error('unexpected decision: ' + JSON.stringify(decision.answers));
}
`;

function runAsync(cmd, args, cwd) {
  return new Promise((resolvePromise) => {
    const child = spawn(cmd, args, { cwd, env: process.env });
    let output = '';
    child.stdout.on('data', (d) => {
      output += d;
    });
    child.stderr.on('data', (d) => {
      output += d;
    });
    child.on('close', (code) => resolvePromise({ code, output }));
    child.on('error', (error) =>
      resolvePromise({ code: 1, output: `${output}\n${error}` }),
    );
  });
}

function summarizeTsErrors(output) {
  const codes = {};
  for (const [, code] of output.matchAll(/error (TS\d+)/g)) {
    codes[code] = (codes[code] ?? 0) + 1;
  }
  return Object.entries(codes)
    .map(([code, n]) => `${code}x${n}`)
    .join(' ');
}

async function checkConsumer(workDir, tarballPath, layout, aiVersion) {
  const { pm, flags } = LAYOUTS[layout];
  const dir = join(workDir, `${layout}-ai-${aiVersion}`);
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
          ai: aiVersion,
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
        include: ['index.ts', 'decide.ts'],
      },
      null,
      2,
    ),
  );
  writeFileSync(join(dir, 'index.ts'), CONSUMER_TS);
  writeFileSync(join(dir, 'decide.ts'), DECIDE_TS);
  writeFileSync(join(dir, 'smoke.mjs'), SMOKE_MJS);

  const result = { layout, ai: aiVersion, install: 'ok', tsc: '', smoke: '' };
  const log = [];
  const install =
    pm === 'pnpm'
      ? await runAsync('pnpm', ['install', '--ignore-workspace', ...flags], dir)
      : await runAsync(
          'npm',
          ['install', '--no-audit', '--no-fund', ...flags],
          dir,
        );
  if (install.code !== 0) {
    result.install = 'FAILED';
    log.push(install.output);
    return { ...result, ok: false, log, dir };
  }
  const tsc = await runAsync(
    join(dir, 'node_modules', '.bin', 'tsc'),
    ['-p', '.'],
    dir,
  );
  const tscErrors = tsc.output
    .split('\n')
    .filter((line) => /error TS\d+/.test(line));
  const upstream = tscErrors.filter((line) => UPSTREAM_ERROR.test(line));
  const relevant = tscErrors.filter((line) => !UPSTREAM_ERROR.test(line));
  const tscOk =
    tsc.code === 0 || (tscErrors.length > 0 && relevant.length === 0);
  if (tscOk) {
    result.tsc =
      upstream.length > 0 ? 'ok (upstream json-schema TS7016)' : 'ok';
  } else {
    result.tsc = summarizeTsErrors(relevant.join('\n')) || 'FAIL';
    log.push(tsc.output);
  }
  const smoke = await runAsync('node', ['smoke.mjs'], dir);
  result.smoke = smoke.code === 0 ? 'ok' : 'FAIL';
  if (smoke.code !== 0) {
    log.push(smoke.output);
  }
  return { ...result, ok: tscOk && smoke.code === 0, log, dir };
}

const workDir = mkdtempSync(join(tmpdir(), 'openrouter-consumer-types-'));
let failed = false;

try {
  let tarballPath = options.tarball && resolve(options.tarball);
  if (!tarballPath) {
    const packDir = join(workDir, 'pack');
    mkdirSync(packDir);
    execFileSync('pnpm', ['pack', '--pack-destination', packDir], {
      cwd: repoRoot,
      stdio: 'inherit',
    });
    const tarball = readdirSync(packDir).find((f) => f.endsWith('.tgz'));
    if (!tarball) {
      throw new Error('pnpm pack produced no tarball');
    }
    tarballPath = join(packDir, tarball);
  }

  const jobs = layouts.flatMap((layout) =>
    aiVersions.map(
      (ai) => () => checkConsumer(workDir, tarballPath, layout, ai),
    ),
  );
  console.log(
    `Checking ${jobs.length} consumers (layouts: ${layouts.join(', ')}; ai: ${aiVersions.join(', ')})`,
  );
  const results = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        const result = await job();
        console.log(
          `${result.ok ? 'PASS' : 'FAIL'} ${result.layout} ai@${result.ai}`,
        );
        results.push(result);
      }
    }),
  );

  results.sort((a, b) =>
    `${a.layout}${a.ai}`.localeCompare(`${b.layout}${b.ai}`),
  );
  for (const result of results.filter((r) => !r.ok)) {
    console.error(`\n=== ${result.layout} ai@${result.ai}: FAILED ===`);
    console.error(result.log.join('\n').trim());
  }
  console.log('\n| layout | ai | install | tsc | runtime |');
  console.log('| --- | --- | --- | --- | --- |');
  for (const r of results) {
    console.log(
      `| ${r.layout} | ${r.ai} | ${r.install} | ${r.tsc || '-'} | ${r.smoke || '-'} |`,
    );
  }
  failed = results.some((r) => !r.ok);
} finally {
  if (process.env.KEEP_CONSUMER_DIR) {
    console.log(`Kept consumer projects in ${workDir}`);
  } else {
    rmSync(workDir, { recursive: true, force: true });
  }
}

process.exit(failed ? 1 : 0);
