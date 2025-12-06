/**
 * GitHub Service
 *
 * Provides access to GitHub API operations and event context for actions.
 * Uses effect-octokit-layer for robust API calls with automatic retries and
 * rate-limit handling, falling back to raw Octokit for unsupported operations.
 *
 * @example
 * ```typescript
 * import { GitHub } from '@openrouter-monorepo/github-action-utils'
 * import { Effect } from 'effect'
 *
 * const program = Effect.gen(function* () {
 *   const gh = yield* GitHub
 *
 *   // Type-safe event handling
 *   const payload = yield* gh.whenEvent("pull_request", "pull_request_target")
 *   console.log(payload.action, payload.pull_request.number)
 *
 *   const pr = yield* gh.getPR(123)
 *   const diff = yield* gh.getDiff(pr)
 *   yield* gh.comment(123, "LGTM!")
 * })
 * ```
 *
 * @since 0.0.1
 * @category services
 */

import type { EventPayloadMap, WebhookEventName } from '@octokit/webhooks-types';
import type { LayerErrors } from 'effect-octokit-layer';

import * as ActionsGitHub from '@actions/github';
import { Config, ConfigError, Context, Data, Effect, Layer, Option, Redacted } from 'effect';
import { OctokitLayer, OctokitLayerLive } from 'effect-octokit-layer';
import { ActionEventPayload } from './action-event-payload.js';
import { $ } from './exec.js';

/**
 * Tagged event payload for pattern matching.
 * Wraps the original payload with a `_tag` field set to the event name.
 *
 * @example
 * ```typescript
 * import { Match } from "effect"
 *
 * const event = yield* gh.whenEvent("push", "star")
 *
 * const result = Match.value(event).pipe(
 *   Match.tag("push", ({ ref }) => `Push to ${ref}`),
 *   Match.tag("star", ({ action }) => `Star ${action}`),
 *   Match.exhaustive
 * )
 * ```
 *
 * @since 0.0.2
 * @category models
 */
export type TaggedEventPayload<E extends WebhookEventName> = {
  readonly [K in E]: {
    readonly _tag: K;
  } & EventPayloadMap[K];
}[E];

/**
 * Re-export WebhookEventName for consumers
 *
 * @since 0.0.1
 * @category types
 */
export type {
  EventPayloadMap,
  WebhookEventName,
} from '@octokit/webhooks-types';

/**
 * Minimal PR representation
 *
 * @since 0.0.1
 * @category models
 */
export interface PullRequest {
  readonly number: number;
  readonly title: string;
  readonly body: string | null;
  readonly head: {
    ref: string;
    sha: string;
  };
  readonly base: {
    ref: string;
  };
  readonly author: string;
}

/**
 * Minimal workflow run representation
 *
 * @since 0.0.1
 * @category models
 */
export interface WorkflowRun {
  readonly id: number;
  readonly head_sha: string;
  readonly status: string | null;
  readonly conclusion: string | null;
}

/**
 * GitHub-related errors
 *
 * @since 0.0.1
 * @category errors
 */
export class GitHubError extends Data.TaggedError('GitHubError')<{
  readonly operation: string;
  readonly message: string;
  readonly cause?: unknown;
}> {
  static make = (operation: string, message: string, cause?: unknown) =>
    new GitHubError({
      operation,
      message,
      cause,
    });
}

/**
 * Error when event doesn't match expected events
 *
 * @since 0.0.1
 * @category errors
 */
export class UnexpectedEvent extends Data.TaggedError('UnexpectedEvent')<{
  readonly eventName: string;
  readonly expectedEvents: ReadonlyArray<string>;
}> {
  override get message(): string {
    const expected = this.expectedEvents.join(', ');
    if (this.eventName === 'local') {
      return (
        'Running locally without GitHub event context. ' +
        `This action expects events: ${expected}.`
      );
    }
    return `Event '${this.eventName}' not in expected events: ${expected}`;
  }
}

/**
 * Config for GitHub environment variables.
 *
 * @since 0.0.1
 * @category config
 */
export const GitHubConfig = {
  eventName: Config.string('GITHUB_EVENT_NAME').pipe(Config.withDefault('local')),

  repository: Config.string('GITHUB_REPOSITORY').pipe(Config.withDefault('local/mock-repo')),

  token: Config.redacted('GITHUB_TOKEN').pipe(
    Config.withDescription('GitHub token for API authentication'),
  ),
};

/**
 * Parse owner/repo from repository string
 */
const parseRepo = (repository: string) => {
  const [owner = '', repo = ''] = repository.split('/');
  return {
    owner,
    repo,
  };
};

/**
 * Map effect-octokit-layer errors to our GitHubError type
 */
const mapLayerError = (operation: string) => (error: LayerErrors) =>
  new GitHubError({
    operation,
    message:
      error._tag === 'GithubApiError' ? (error.message ?? 'GitHub API error') : `${error._tag}`,
    cause: error,
  });

/**
 * Opaque type for Octokit client to avoid complex type inference issues
 */
type OctokitClient = ReturnType<typeof ActionsGitHub.getOctokit>;

/**
 * GitHub service interface
 *
 * @since 0.0.1
 * @category models
 */
export interface GitHubService {
  /**
   * Type-safe event handler with tagged payloads for pattern matching.
   * Returns a tagged payload (with `_tag` field) if the current event matches.
   * Fails with UnexpectedEvent if the event doesn't match.
   */
  readonly whenEvent: <E extends Array<WebhookEventName>>(
    ...events: E
  ) => Effect.Effect<TaggedEventPayload<E[number]>, UnexpectedEvent | GitHubError>;

  /**
   * Get the current PR from the GitHub event context.
   * Fails if not running in a PR context.
   */
  readonly getCurrentPR: Effect.Effect<PullRequest, GitHubError>;

  /**
   * Get a specific PR by number
   */
  readonly getPR: (number: number) => Effect.Effect<PullRequest, GitHubError>;

  /**
   * Get the diff for a PR
   */
  readonly getDiff: (pr: PullRequest) => Effect.Effect<string, GitHubError>;

  /**
   * Post a comment on a PR/issue
   */
  readonly comment: (issueNumber: number, body: string) => Effect.Effect<void, GitHubError>;

  /**
   * Get workflow runs for a specific workflow file.
   */
  readonly getWorkflowRuns: (
    workflowFile: string,
    options?: {
      status?: 'completed' | 'in_progress' | 'queued';
      conclusion?: 'success' | 'failure' | 'cancelled' | 'skipped';
      perPage?: number;
    },
  ) => Effect.Effect<ReadonlyArray<WorkflowRun>, GitHubError>;

  /**
   * Get the current event name
   */
  readonly eventName: WebhookEventName | 'local';

  /**
   * Get the repository in owner/repo format
   */
  readonly repository: string;

  /**
   * Get owner and repo as separate values
   */
  readonly repo: {
    owner: string;
    repo: string;
  };

  /**
   * Access the raw Octokit client for advanced use cases.
   * Note: This exposes the Promise-based API, not Effect.
   */
  readonly octokit: OctokitClient;
}

/**
 * GitHub service tag
 *
 * @since 0.0.1
 * @category services
 */
export class GitHub extends Context.Tag('@openrouter/GitHub')<GitHub, GitHubService>() {
  /**
   * Static event handler for use without service access.
   *
   * @example
   * ```typescript
   * const program = Effect.gen(function* () {
   *   const event = yield* GitHub.whenEvent("push", "pull_request")
   *   // event is TaggedEventPayload<"push" | "pull_request">
   * })
   * ```
   */
  static whenEvent<E extends Array<WebhookEventName>>(...events: E) {
    return Effect.flatMap(GitHub, (gh) => gh.whenEvent(...events));
  }
}

/**
 * Get token from GITHUB_TOKEN env var, falling back to `gh auth token` CLI
 */
const getToken = Effect.gen(function* () {
  const envToken = yield* Config.option(GitHubConfig.token);

  if (Option.isSome(envToken)) {
    return envToken.value;
  }

  // Fallback to gh CLI
  const ghToken = yield* $`gh auth token`.pipe(
    Effect.map((output) => Redacted.make(output.trim())),
    Effect.mapError((cause) =>
      ConfigError.MissingData(
        [
          'GITHUB_TOKEN',
        ],
        `GITHUB_TOKEN not set and 'gh auth token' failed: ${cause.cause.message}`,
      ),
    ),
  );

  return ghToken;
});

/**
 * Create the live GitHub service implementation
 */
const makeLive = Effect.gen(function* () {
  const eventPayload = yield* ActionEventPayload;
  const eventName = yield* GitHubConfig.eventName;
  const repository = yield* GitHubConfig.repository;
  const tokenRedacted = yield* getToken;
  const repo = parseRepo(repository);

  // Raw Octokit client for operations not supported by effect-octokit-layer
  const rawOctokit = ActionsGitHub.getOctokit(Redacted.value(tokenRedacted));

  // Type-safe event handler with tagged payload for pattern matching
  const whenEvent = <E extends Array<WebhookEventName>>(
    ...events: E
  ): Effect.Effect<TaggedEventPayload<E[number]>, UnexpectedEvent | GitHubError> =>
    Effect.gen(function* () {
      if (!events.includes(eventName as E[number])) {
        return yield* Effect.fail(
          new UnexpectedEvent({
            eventName,
            expectedEvents: events,
          }),
        );
      }

      if (Option.isNone(eventPayload.payload)) {
        return yield* Effect.fail(GitHubError.make('whenEvent', 'No event payload available'));
      }

      return {
        _tag: eventName as E[number],
        ...eventPayload.payload.value,
      } as TaggedEventPayload<E[number]>;
    });

  // Get PR by number using effect-octokit-layer
  const getPR = (prNumber: number): Effect.Effect<PullRequest, GitHubError> =>
    OctokitLayer.repo(repo)
      .pull(prNumber)
      .details()
      .pipe(
        Effect.map((pr) => ({
          number: pr.number,
          title: pr.title,
          body: pr.body,
          head: {
            ref: pr.head.ref,
            sha: pr.head.sha,
          },
          base: {
            ref: pr.base.ref,
          },
          author: pr.user?.login ?? 'unknown',
        })),
        Effect.mapError(mapLayerError('getPR')),
        Effect.provide(OctokitLayerLive),
      );

  // Get current PR from event payload
  const getCurrentPR: Effect.Effect<PullRequest, GitHubError> = Effect.gen(function* () {
    const prNumber = eventPayload.prNumber;

    if (Option.isNone(prNumber)) {
      return yield* Effect.fail(GitHubError.make('getCurrentPR', 'Not in a pull request context'));
    }

    return yield* getPR(prNumber.value);
  });

  // Get diff for a PR (uses raw Octokit)
  const getDiff = (pr: PullRequest): Effect.Effect<string, GitHubError> =>
    Effect.gen(function* () {
      if (!rawOctokit) {
        return yield* Effect.fail(GitHubError.make('getDiff', 'GITHUB_TOKEN not available'));
      }

      const response = yield* Effect.tryPromise({
        try: () =>
          rawOctokit.rest.pulls.get({
            ...repo,
            pull_number: pr.number,
            mediaType: {
              format: 'diff',
            },
          }),
        catch: (cause) =>
          GitHubError.make('getDiff', `Failed to get diff for PR #${pr.number}`, cause),
      });

      return response.data as unknown as string;
    });

  // Post comment on issue/PR (uses raw Octokit)
  const comment = (issueNumber: number, body: string): Effect.Effect<void, GitHubError> =>
    Effect.gen(function* () {
      if (!rawOctokit) {
        return yield* Effect.fail(GitHubError.make('comment', 'GITHUB_TOKEN not available'));
      }

      yield* Effect.tryPromise({
        try: () =>
          rawOctokit.rest.issues.createComment({
            ...repo,
            issue_number: issueNumber,
            body,
          }),
        catch: (cause) =>
          GitHubError.make('comment', `Failed to post comment on #${issueNumber}`, cause),
      });
    });

  // Get workflow runs (uses raw Octokit)
  const getWorkflowRuns = (
    workflowFile: string,
    options?: {
      status?: 'completed' | 'in_progress' | 'queued';
      conclusion?: 'success' | 'failure' | 'cancelled' | 'skipped';
      perPage?: number;
    },
  ): Effect.Effect<ReadonlyArray<WorkflowRun>, GitHubError> =>
    Effect.gen(function* () {
      if (!rawOctokit) {
        return yield* Effect.fail(
          GitHubError.make('getWorkflowRuns', 'GITHUB_TOKEN not available'),
        );
      }

      const response = yield* Effect.tryPromise({
        try: () =>
          rawOctokit.rest.actions.listWorkflowRuns({
            ...repo,
            workflow_id: workflowFile,
            status: options?.status,
            per_page: options?.perPage ?? 10,
          }),
        catch: (cause) =>
          GitHubError.make(
            'getWorkflowRuns',
            `Failed to get workflow runs for ${workflowFile}`,
            cause,
          ),
      });

      const runs = response.data.workflow_runs;
      const filtered = options?.conclusion
        ? runs.filter((run) => run.conclusion === options.conclusion)
        : runs;

      return filtered.map((run) => ({
        id: run.id,
        head_sha: run.head_sha,
        status: run.status,
        conclusion: run.conclusion,
      }));
    });

  return {
    whenEvent,
    getCurrentPR,
    getPR,
    getDiff,
    comment,
    getWorkflowRuns,
    eventName: eventName as WebhookEventName | 'local',
    repository,
    repo,
    octokit: rawOctokit,
  } satisfies GitHubService;
});

/**
 * Live GitHub layer that provides real API operations.
 * Uses effect-octokit-layer for robust API calls with automatic retries
 * and rate-limit handling. Falls back to raw Octokit for unsupported
 * operations (diffs with custom mediaType, issue comments).
 *
 * Requires GITHUB_TOKEN environment variable for API calls.
 *
 * @since 0.0.1
 * @category layers
 */
export const GitHubLive = Layer.effect(GitHub, makeLive);

/**
 * Create the mock GitHub service implementation
 * Always uses 'local' event name to ensure predictable test behavior
 * regardless of CI environment variables.
 */
const makeMock = Effect.gen(function* () {
  const eventName = 'local' as const;
  const repository = yield* Effect.orDie(GitHubConfig.repository);
  const repo = parseRepo(repository);

  const mockPR: PullRequest = {
    number: 123,
    title: 'Mock PR for local testing',
    body: 'This is a mock PR body for local development',
    head: {
      ref: 'feature/test',
      sha: 'abc123',
    },
    base: {
      ref: 'main',
    },
    author: 'local-dev',
  };

  const mockPayload = {
    action: 'opened',
    number: 123,
    pull_request: {
      number: 123,
      title: mockPR.title,
      body: mockPR.body,
      head: mockPR.head,
      base: mockPR.base,
      user: {
        login: mockPR.author,
      },
    },
  };

  return {
    whenEvent: <E extends Array<WebhookEventName>>(...events: E) => {
      if (!events.includes(eventName as E[number]) && eventName !== 'local') {
        return Effect.fail(
          new UnexpectedEvent({
            eventName,
            expectedEvents: events,
          }),
        );
      }
      const tag = eventName === 'local' ? events[0] : eventName;
      return Effect.succeed({
        _tag: tag,
        ...mockPayload,
      } as unknown as TaggedEventPayload<E[number]>);
    },

    getCurrentPR: Effect.succeed(mockPR),

    getPR: (number: number) =>
      Effect.succeed({
        ...mockPR,
        number,
        title: `Mock PR #${number}`,
        body: `This is mock PR #${number}`,
      }),

    getDiff: (_pr: PullRequest) =>
      Effect.succeed(`diff --git a/example.ts b/example.ts
index 1234567..abcdefg 100644
--- a/example.ts
+++ b/example.ts
@@ -1,5 +1,7 @@
 function hello() {
-  console.log("Hello")
+  console.log("Hello, World!")
+  // Added a comment
+  return true
 }
`),

    comment: (prNumber: number, body: string) =>
      Effect.gen(function* () {
        yield* Effect.log(`[Mock GitHub] Would post comment to PR #${prNumber}:`);
        yield* Effect.log(body.slice(0, 200) + (body.length > 200 ? '...' : ''));
      }),

    getWorkflowRuns: (
      _workflowFile: string,
      _options?: {
        status?: 'completed' | 'in_progress' | 'queued';
        conclusion?: 'success' | 'failure' | 'cancelled' | 'skipped';
        perPage?: number;
      },
    ) =>
      Effect.succeed([
        {
          id: 100,
          head_sha: 'abc123def456',
          status: 'completed',
          conclusion: 'success',
        },
        {
          id: 99,
          head_sha: 'def456abc789',
          status: 'completed',
          conclusion: 'success',
        },
      ] as const),

    eventName: eventName as WebhookEventName | 'local',
    repository,
    repo,
    get octokit(): never {
      throw new Error('Mock GitHub does not support octokit');
    },
  } satisfies GitHubService;
});

/**
 * Mock GitHub layer for local development
 *
 * @since 0.0.1
 * @category layers
 */
export const GitHubMock = Layer.effect(GitHub, makeMock);
