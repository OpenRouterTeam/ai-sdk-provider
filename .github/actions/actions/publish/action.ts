/**
 * Publish Action
 *
 * Handles npm publishing with OIDC authentication for the release workflow.
 * This action performs:
 * - OIDC preflight: scrubs .npmrc files of auth tokens
 * - Verifies npm registry connectivity
 * - Runs pnpm changeset publish
 * - Post-mortem diagnostics on failure
 */

import { Command } from '@effect/cli';
import { ActionUI } from '@openrouter-monorepo/github-action-utils/action-ui';
import { $, $sh } from '@openrouter-monorepo/github-action-utils/exec';
import { Config, Console, Effect, Option } from 'effect';

/**
 * OIDC Preflight - scrub .npmrc and verify registry
 *
 * Removes auth tokens from all potential .npmrc locations to ensure OIDC is used.
 */
const oidcPreflight = Effect.gen(function* () {
  const ui = yield* ActionUI;

  yield* ui.group(
    'OIDC Preflight',
    Effect.gen(function* () {
      yield* Console.log('=== OIDC Preflight ===');

      // Remove auth tokens from all potential .npmrc locations
      yield* $sh`
        for npmrc in "$NPM_CONFIG_USERCONFIG" ~/.npmrc .npmrc; do
          if [ -n "$npmrc" ] && [ -f "$npmrc" ]; then
            echo "Cleaning $npmrc of any existing auth tokens..."
            # Remove registry-scoped tokens (allow optional whitespace around =)
            sed -i -E '/\\/\\/registry\\.npmjs\\.org\\/:(_authToken|_auth)\\s*=/d' "$npmrc"
            # Remove global tokens in any form
            sed -i -E '/^\\s*(_authToken|_auth)\\s*=/d' "$npmrc"
            # Remove global always-auth (case-insensitive, allow spacing)
            sed -i -E '/^\\s*[Aa]lways-[Aa]uth\\s*=/d' "$npmrc"
          fi
        done
      `;

      // Verify npm connectivity
      yield* Console.log('Testing npm registry connectivity...');
      yield* $`npm ping`;

      // Verify no token is active (should fail for OIDC to work)
      yield* Console.log('Verifying no auth token is configured...');
      const whoamiResult = yield* $sh`npm whoami 2>/dev/null || echo "__OIDC_EXPECTED_FAIL__"`;

      if (whoamiResult.includes('__OIDC_EXPECTED_FAIL__')) {
        yield* Console.log('✓ Confirmed: npm whoami failed (OIDC will be used)');
      } else {
        yield* ui.warning('npm whoami succeeded without OIDC token');
      }

      yield* Console.log('');
      yield* Console.log('Registry configuration:');
      const registry = yield* $`npm config get registry`;
      yield* Console.log(`  registry: ${registry.trim()}`);
      const scopeRegistry =
        yield* $sh`npm config get @openrouter:registry || echo "(no @openrouter scope override)"`;
      yield* Console.log(`  @openrouter scope: ${scopeRegistry.trim()}`);
    }),
  );
});

/**
 * Publish packages using OIDC
 *
 * @param tag - Optional npm dist-tag (e.g., "next" for prerelease)
 */
const publish = (tag: Option.Option<string>) =>
  Effect.gen(function* () {
    const ui = yield* ActionUI;

    yield* ui.group(
      'Publish with OIDC',
      Effect.gen(function* () {
        yield* Console.log('Publishing packages...');
        if (Option.isSome(tag)) {
          yield* Console.log(`Using npm dist-tag: ${tag.value}`);
          yield* $sh`pnpm changeset publish --tag ${tag.value}`;
        } else {
          yield* $sh`pnpm changeset publish`;
        }
        yield* Console.log('✓ Publish completed successfully');
      }),
    );
  });

/**
 * Post-mortem diagnostics (run on failure)
 */
const postMortemDiagnostics = Effect.gen(function* () {
  const ui = yield* ActionUI;

  yield* ui.group(
    'Post-mortem Diagnostics',
    Effect.gen(function* () {
      yield* Console.log('=== Post-mortem Diagnostics ===');

      yield* Console.log('Versions:');
      const nodeVersion = yield* $`node --version`;
      const npmVersion = yield* $`npm --version`;
      const pnpmVersion = yield* $`pnpm --version`;
      yield* Console.log(`  Node: ${nodeVersion.trim()}`);
      yield* Console.log(`  npm: ${npmVersion.trim()}`);
      yield* Console.log(`  pnpm: ${pnpmVersion.trim()}`);

      yield* Console.log('');
      yield* Console.log('Registry configuration:');
      const registry = yield* $`npm config get registry`;
      yield* Console.log(`  registry: ${registry.trim()}`);
      const scopeRegistry =
        yield* $sh`npm config get @openrouter:registry || echo "(inherited from global)"`;
      yield* Console.log(`  @openrouter scope: ${scopeRegistry.trim()}`);

      yield* Console.log('');
      yield* Console.log('.npmrc files status:');
      yield* $sh`
        for npmrc in "$NPM_CONFIG_USERCONFIG" ~/.npmrc .npmrc; do
          if [ -n "$npmrc" ] && [ -f "$npmrc" ]; then
            echo "  $npmrc:"
            echo "    Lines: $(wc -l < "$npmrc")"
            echo "    Auth lines: $(grep -c "_auth\\|_token" "$npmrc" || echo "0")"
            echo "    Content (redacted):"
            sed 's/\\(_auth[^=]*=\\).*/\\1***REDACTED***/g; s/\\(_token[^=]*=\\).*/\\1***REDACTED***/g' "$npmrc" | sed 's/^/      /'
          fi
        done
      `;

      yield* Console.log('');
      yield* Console.log('Package availability:');
      const pkgVersion =
        yield* $sh`npm view @openrouter/ai-sdk-provider@latest version 2>&1 || echo "(could not fetch)"`;
      yield* Console.log(`  ${pkgVersion.trim()}`);
    }),
  );
});

export default Command.make(
  'publish',
  {},
  Effect.fnUntraced(function* () {
    yield* Console.log('Starting publish action...');

    // Read optional npm dist-tag from INPUT_NPM_CHANNEL_TAG env var
    const tag = yield* Config.string('NPM_CHANNEL_TAG').pipe(Config.option);

    // Run OIDC preflight
    yield* oidcPreflight;

    // Publish with diagnostics on failure
    yield* publish(tag).pipe(Effect.tapError(() => postMortemDiagnostics));

    yield* Console.log('Publish action completed successfully!');
  }),
);
