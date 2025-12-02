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

import { Command, Options } from '@effect/cli';
import { ActionUI } from '@openrouter-monorepo/github-action-utils/ActionUI';
import { GitHub } from '@openrouter-monorepo/github-action-utils/GitHub';
import { Config, Console, Effect, Match, pipe } from 'effect';

/**
 * Enforces that this command will only run for expected action events
 */
const assertExpectedEvent = pipe(
  GitHub,
  Effect.flatMap((github) => github.whenEvent('push', 'star')),
  Effect.flatMap(
    Match.valueTags({
      push: ({ ref }) => Console.info(`Push event detected: ${ref}`),
      star: ({ action, sender }) =>
        Console.info(`Star event by: ${sender.login} with action ${action}`),
    }),
  ),
  // Allow running locally or with other events for testing
  // Effect.catchTag('UnexpectedEvent', () => Effect.void),
);

export default Command.make(
  'ui-demo',
  {
    name: Options.text('name').pipe(
      Options.withDescription('Name to use in demo output'),
      Options.withFallbackConfig(Config.string('NAME')),
      Options.withDefault('World'),
    ),
  },
  Effect.fnUntraced(function* (inputs) {
    yield* assertExpectedEvent;

    const ui = yield* ActionUI;
    const github = yield* GitHub;

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
        yield* ui.notice(
          'This is a notice annotation - informational message',
          {
            title: 'Notice Annotation',
            file: '.github/actions/actions/ui-demo/action.ts',
            startLine: 60,
            endLine: 64,
          },
        );
        yield* ui.warning(
          'This is a warning annotation - something to be aware of',
          {
            title: 'Warning Annotation',
            file: '.github/actions/actions/ui-demo/action.ts',
            startLine: 66,
            endLine: 71,
          },
        );
        // Note: We don't emit an error annotation here as it would mark the step as having errors
        yield* ui.info(
          '(Skipping error annotation to keep the workflow green)',
        );
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
  }),
);
