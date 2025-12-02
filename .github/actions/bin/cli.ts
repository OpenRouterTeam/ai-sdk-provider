#!/usr/bin/env bun

/**
 * CLI-based dispatcher for TypeScript GitHub Actions.
 */

import { Command } from '@effect/cli';
import { FetchHttpClient } from '@effect/platform';
import { BunContext, BunRuntime } from '@effect/platform-bun';
import { ActionEventPayload } from '@openrouter-monorepo/github-action-utils/ActionEventPayload';
import { ActionUI } from '@openrouter-monorepo/github-action-utils/ActionUI';
import { GitHubLive } from '@openrouter-monorepo/github-action-utils/GitHub';
import { Effect, Layer } from 'effect';
import { ActionUIDemoCommand } from '../action-ui-demo/index.js';
import pkg from '../package.json';

// Root command with subcommands for each action
const command = Command.make('github-actions').pipe(
  Command.withSubcommands([ActionUIDemoCommand]),
);

const CLILayer = Layer.mergeAll(
  ActionUI.Mock,
  GitHubLive.pipe(Layer.provide(ActionEventPayload.Empty)),
  FetchHttpClient.layer,
  BunContext.layer,
);

// Run the CLI with mock services
const cli = Command.run(command, {
  name: 'github-actions-cli',
  version: pkg.version,
});

cli(process.argv).pipe(Effect.provide(CLILayer), BunRuntime.runMain);
