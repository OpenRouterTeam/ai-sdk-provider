/**
 * ActionUI Demo Action
 *
 * Demonstrates the ActionUI service capabilities:
 * - Annotations (error, warning, notice)
 * - Groups (collapsible log sections)
 * - Outputs
 * - Debug logging
 *
 * Used as a smoke test to verify the GitHub Actions integration works.
 */

import type * as CommandModule from '@effect/cli/Command';

import { Command, Options } from '@effect/cli';
import { ActionUI } from '@openrouter-monorepo/github-action-utils/ActionUI';
import { GitHub } from '@openrouter-monorepo/github-action-utils/GitHub';
import { Config, Console, Effect, Match } from 'effect';

// =============================================================================
// CLI Options
// =============================================================================

const Inputs = {
  name: Options.text('name').pipe(
    Options.withDescription('Name to use in demo output'),
    Options.withFallbackConfig(Config.string('NAME')),
    Options.withDefault('World'),
  ),
};

type Inputs = CommandModule.Command.ParseConfig<typeof Inputs>;

/**
 * The action program - demonstrates ActionUI features
 */
export const runActionUIDemo = Effect.fn('ActionUI Demo Action')(function* (
  inputs: Inputs,
) {
  const ui = yield* ActionUI;
  const github = yield* GitHub;

  yield* github.whenEvent('push', 'star').pipe(
    Effect.flatMap((event) =>
      Match.value(event).pipe(
        Match.tag('push', ({ ref }) => ui.info(`Push event detected: ${ref}`)),
        Match.tag('star', ({ action, sender }) =>
          ui.info(`Star event by: ${sender.login} with action ${action}`),
        ),
        Match.exhaustive,
      ),
    ),
    // uncomment the following line to let this action run for any arbitrary event
    // Effect.catchTag("UnexpectedEvent", () => Effect.void)
  );

  // Basic info
  yield* Console.log(`ActionUI Demo - Hello, ${inputs.name}!`);
  yield* Console.log(`Event: ${github.eventName}`);
  yield* Console.log(`Repository: ${github.repository}`);

  // Group: Environment info
  yield* ui.group(
    'Environment Info',
    Effect.gen(function* () {
      yield* ui.info(`Actor: ${process.env.GITHUB_ACTOR ?? 'local'}`);
      yield* ui.info(`Runner OS: ${process.env.RUNNER_OS ?? 'unknown'}`);
      yield* ui.info(`Node version: ${process.version}`);
    }),
  );

  // Group: Annotation demo
  yield* ui.group(
    'Annotation Demo',
    Effect.gen(function* () {
      yield* ui.notice('This is a notice annotation - informational message', {
        title: 'Notice Annotation',
        file: 'packages/github-actions/actions/action-ui-demo/index.ts',
        startLine: 60,
        endLine: 64,
      });
      yield* ui.warning(
        'This is a warning annotation - something to be aware of',
        {
          title: 'Warning Annotation',
          file: 'packages/github-actions/actions/action-ui-demo/index.ts',
          startLine: 66,
          endLine: 71,
        },
      );
      // Note: We don't emit an error annotation here as it would mark the step as having errors
      yield* ui.info('(Skipping error annotation to keep the workflow green)');
    }),
  );

  // Debug logging (only visible when ACTIONS_STEP_DEBUG is set)
  yield* ui.debug(
    'This debug message is only visible when debug logging is enabled',
  );

  // Set an output
  yield* ui.setOutput('demo_output', `Hello from ${inputs.name}`);
  yield* ui.info('Set output: demo_output');

  // Summary
  yield* Console.log('');
  yield* Console.log('ActionUI Demo completed successfully!');
});

/**
 * CLI Command for the action
 */
export const ActionUIDemoCommand = Command.make(
  'action-ui-demo',
  Inputs,
  runActionUIDemo,
);
