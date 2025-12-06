/**
 * Publish Action
 *
 * Publishes packages to npm using OIDC authentication.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Command } from '@effect/cli';
import { ActionUI } from '@openrouter-monorepo/github-action-utils/action-ui';
import { $, $sh } from '@openrouter-monorepo/github-action-utils/exec';
import { GitHub } from '@openrouter-monorepo/github-action-utils/github';
import { Console, Effect } from 'effect';

// ─────────────────────────────────────────────────────────────────────────────
// Command
// ─────────────────────────────────────────────────────────────────────────────

export default Command.make(
  'publish',
  {},
  Effect.fnUntraced(function* () {
    const ui = yield* ActionUI;
    const event = yield* GitHub.whenEvent('push');

    if (event.deleted) {
      yield* ui.notice(`Skipping publish: ${event.ref} was deleted`);
      return;
    }

    const branch = event.ref.replace('refs/heads/', '');
    const tag = branch === 'main' ? 'latest' : branch; // main→latest, next→next, etc.
    const sha = event.after.slice(0, 7);
    const pusher = event.pusher.name ?? event.pusher.email ?? 'unknown';

    const desc = `${branch}@${sha} by ${pusher} → @${tag}`;

    yield* Console.info(`Attempting to publish ${desc}`);
    yield* oidcPreflight();
    yield* publish(tag).pipe(
      Effect.tapError(() => postMortemDiagnostics(tag)),
      Effect.tapError(() => ui.error(`did NOT publish ${desc}`)),
    );

    yield* ui.notice(`publish ${desc}`);

    yield* Console.log('✓ Publish completed');
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Steps
// ─────────────────────────────────────────────────────────────────────────────

const oidcPreflight = Effect.fn('oidcPreflight')(function* () {
  const ui = yield* ActionUI;

  yield* scrubNpmrcAuthTokens();
  yield* $`npm ping`;

  const whoami = yield* $sh`npm whoami 2>/dev/null || echo "__OIDC_EXPECTED_FAIL__"`;
  if (whoami.includes('__OIDC_EXPECTED_FAIL__')) {
    yield* Console.log('✓ npm whoami failed as expected (OIDC will be used)');
  } else {
    yield* ui.warning(`npm whoami succeeded unexpectedly: ${whoami}`);
  }

  const [registry, scope] = yield* Effect.all([
    $`npm config get registry`,
    $sh`npm config get @openrouter:registry || echo "(inherited)"`,
  ]);
  yield* Console.log('registry', registry, '@openrouter:', scope);
}, ActionUI.group('OIDC Preflight'));

const publish = Effect.fn('publish')(function* (tag: string) {
  yield* Console.log('Publishing packages...');
  if (tag !== 'latest') {
    yield* Console.log(`Using npm dist-tag: ${tag}`);
    yield* $sh`pnpm changeset publish --tag ${tag}`;
  } else {
    yield* $sh`pnpm changeset publish`;
  }
  yield* Console.log('✓ Publish completed successfully');
}, ActionUI.group('Publish with OIDC'));

const postMortemDiagnostics = Effect.fn('postMortemDiagnostics')(function* (tag: string) {
  yield* logVersions();
  yield* logRegistryConfig();
  yield* logPackageAvailability(tag);
  yield* logNpmrcStatus();
}, ActionUI.group('Post-mortem Diagnostics'));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const logVersions = Effect.fn('logVersions')(function* () {
  const [node, npm, pnpm, bun] = yield* Effect.all([
    $`node --version`,
    $`npm --version`,
    $`pnpm --version`,
    $`bun --version`,
  ]);
  yield* Console.log('versions', 'node@', node, 'npm@', npm, 'pnpm@', pnpm, 'bun@', bun);
});

const logRegistryConfig = Effect.fn('logRegistryConfig')(function* () {
  const [registry, scope] = yield* Effect.all([
    $`npm config get registry`,
    $sh`npm config get @openrouter:registry || echo "(inherited)"`,
  ]);
  yield* Console.log('registry', registry, '@openrouter:', scope);
});

const logPackageAvailability = Effect.fn('logPackageAvailability')(function* (tag: string) {
  const v = yield* $sh`npm view @openrouter/ai-sdk-provider@${tag} version 2>&1 || echo "?"`;
  yield* Console.log(`@openrouter/ai-sdk-provider@${tag}`, v);
});

const logNpmrcStatus = Effect.fn('logNpmrcStatus')(function* () {
  for (const filepath of NPMRC_PATHS) {
    if (!fs.existsSync(filepath)) {
      continue;
    }

    const content = fs.readFileSync(filepath, 'utf-8');
    const lines = content.split('\n').length;
    const authLines = (content.match(/_auth|_token/gi) || []).length;

    yield* Console.log(`${filepath}: ${lines} lines, ${authLines} auth`);
  }
});

const scrubNpmrcAuthTokens = Effect.fn('scrubNpmrcAuthTokens')(function* () {
  for (const filepath of NPMRC_PATHS) {
    if (!fs.existsSync(filepath)) {
      continue;
    }

    let content = fs.readFileSync(filepath, 'utf-8');
    const original = content;

    for (const pattern of AUTH_PATTERNS) {
      content = content.replace(pattern, '');
    }
    content = content.replace(/\n{3,}/g, '\n\n').trim();

    if (content !== original) {
      fs.writeFileSync(filepath, content + '\n');
      yield* Console.log(`Scrubbed auth tokens from ${filepath}`);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const NPMRC_PATHS = [
  process.env['NPM_CONFIG_USERCONFIG'],
  path.join(os.homedir(), '.npmrc'),
  '.npmrc',
].filter((p): p is string => !!p);

const AUTH_PATTERNS = [
  /\/\/registry\.npmjs\.org\/:(_authToken|_auth)\s*=.*/gi,
  /^\s*(_authToken|_auth)\s*=.*/gim,
  /^\s*always-auth\s*=.*/gim,
];
