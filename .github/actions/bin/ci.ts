#!/usr/bin/env bun

/**
 * GitHub Actions Entrypoint - CI Environment
 *
 * Runs actions in the GitHub Actions environment with real service layers.
 * Reads inputs from INPUT_* environment variables (GitHub Actions convention).
 *
 * The @effect/cli Options in each action use `withFallbackConfig` to read from
 * Effect's Config system. We configure ConfigProvider.nested to add the "INPUT"
 * prefix, so Config.string("MODEL") reads from INPUT_MODEL.
 */

import { Command } from '@effect/cli';
import { FetchHttpClient } from '@effect/platform';
import { BunContext, BunRuntime } from '@effect/platform-bun';
import { ActionEventPayload } from '@openrouter-monorepo/github-action-utils/ActionEventPayload';
import {
  GitHubActionsLayer,
  withActionsErrorReporting,
} from '@openrouter-monorepo/github-action-utils/ActionUI';
import { GitHubLive } from '@openrouter-monorepo/github-action-utils/GitHub';
import { ConfigProvider, Effect, Layer } from 'effect';
import actions from '../actions.js';
import pkg from '../package.json';

// Root command with subcommands for each action
const command = Command.make(
  `pnpm --filter @openrouter-monorepo/github-action-utils act:ci`,
).pipe(Command.withSubcommands(actions));

// Combine all layers for GitHub Actions environment
// BunContext.layer provides FileSystem and CommandExecutor
// GitHubLive depends on ActionEventPayload, so we provide it
const GitHubWithPayloadLayer = GitHubLive.pipe(
  Layer.provide(ActionEventPayload.Default),
);

const CILayer = Layer.mergeAll(
  // GitHubActionsLayer: Console that emits workflow commands + ActionUI service
  GitHubActionsLayer,
  // GitHubWithPayloadLayer: Real GitHub API via @actions/github (with ActionEventPayload)
  GitHubWithPayloadLayer,
  // FetchHttpClient.layer: HttpClient for direct API calls
  FetchHttpClient.layer,
).pipe(Layer.provideMerge(BunContext.layer));

// Run the CLI with real services
const cli = Command.run(command, {
  name: 'github-actions-ci',
  version: pkg.version,
});

// Configure ConfigProvider to read from INPUT_* env vars
// This allows Options.withFallbackConfig(Config.string("MODEL")) to read INPUT_MODEL
const InputConfigProvider = ConfigProvider.nested(
  ConfigProvider.fromEnv(),
  'INPUT',
);

cli(process.argv).pipe(
  Effect.withConfigProvider(InputConfigProvider),
  Effect.provide(CILayer),
  // Report any unexpected errors as GitHub Actions annotations before the default error handler
  withActionsErrorReporting,
  BunRuntime.runMain,
);
