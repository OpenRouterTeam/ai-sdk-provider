/**
 * ActionEventPayload Service
 *
 * Provides access to the GitHub Actions event payload.
 * Reads from GITHUB_EVENT_PATH environment variable and parses JSON.
 *
 * This service fails loudly when:
 * - GITHUB_EVENT_PATH is set but the file cannot be read
 * - GITHUB_EVENT_PATH is set but the file contains invalid JSON
 *
 * @example
 * ```typescript
 * import { ActionEventPayload } from '@openrouter-monorepo/github-action-utils'
 * import { Effect, Option } from 'effect'
 *
 * const program = Effect.gen(function* () {
 *   const eventPayload = yield* ActionEventPayload
 *
 *   // Get issue number if available
 *   const issueNumber = eventPayload.issueNumber
 *   if (Option.isSome(issueNumber)) {
 *     console.log(`Issue #${issueNumber.value}`)
 *   }
 * })
 * ```
 *
 * @since 0.0.1
 * @category services
 */

import { FileSystem } from '@effect/platform';
import { Data, Effect, Layer, Option } from 'effect';

/**
 * Error when reading or parsing event payload
 *
 * @since 0.0.1
 * @category errors
 */
export class ActionEventPayloadError extends Data.TaggedError('ActionEventPayloadError')<{
  readonly reason: 'ReadFailed' | 'ParseFailed';
  readonly path: string;
  readonly cause?: unknown;
}> {
  override get message(): string {
    return `ActionEventPayload ${this.reason}: ${this.path}${this.cause ? `: ${this.cause}` : ''}`;
  }
}

/**
 * Helper to create the service implementation from a payload
 */
const make = (payload: Option.Option<Record<string, unknown>>) => {
  const get = <T>(path: string): Option.Option<T> => {
    if (Option.isNone(payload)) {
      return Option.none();
    }

    const parts = path.split('.');
    let current: unknown = payload.value;

    for (const part of parts) {
      if (!current || typeof current !== 'object') {
        return Option.none();
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current !== undefined ? Option.some(current as T) : Option.none();
  };

  const issueNumber = Option.orElse(get<number>('issue.number'), () =>
    get<number>('pull_request.number'),
  );
  const prNumber = get<number>('pull_request.number');

  return {
    payload,
    get,
    issueNumber,
    prNumber,
  } as const;
};

/**
 * ActionEventPayload service
 *
 * Provides access to the GitHub Actions event payload parsed from GITHUB_EVENT_PATH.
 *
 * @since 0.0.1
 * @category services
 */
export class ActionEventPayload extends Effect.Service<ActionEventPayload>()(
  '@openrouter/ActionEventPayload',
  {
    effect: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const eventPath = process.env.GITHUB_EVENT_PATH;

      // No event path means no payload (local dev, etc.)
      if (!eventPath) {
        return make(Option.none());
      }

      // Read the event file - fail loudly if it can't be read
      const content = yield* fs.readFileString(eventPath).pipe(
        Effect.mapError(
          (cause) =>
            new ActionEventPayloadError({
              reason: 'ReadFailed',
              path: eventPath,
              cause,
            }),
        ),
      );

      // Parse the JSON - fail loudly if invalid
      const parsed = yield* Effect.try({
        try: () => JSON.parse(content) as Record<string, unknown>,
        catch: (cause) =>
          new ActionEventPayloadError({
            reason: 'ParseFailed',
            path: eventPath,
            cause,
          }),
      });

      return make(Option.some(parsed));
    }),
  },
) {
  /**
   * Mock layer for testing with custom payload
   *
   * @since 0.0.1
   * @category layers
   */
  static readonly Mock = (payload: Record<string, unknown>) =>
    Layer.succeed(ActionEventPayload, new ActionEventPayload(make(Option.some(payload))));

  /**
   * Empty mock layer (no payload, simulates local dev without GITHUB_EVENT_PATH)
   *
   * @since 0.0.1
   * @category layers
   */
  static readonly Empty = Layer.succeed(
    ActionEventPayload,
    new ActionEventPayload(make(Option.none())),
  );
}
