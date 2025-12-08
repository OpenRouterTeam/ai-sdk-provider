import { describe, it } from '@effect/vitest';
import { Effect, Match } from 'effect';
import { expect } from 'vitest';
import { GitHub, GitHubMock } from './github.js';

describe('GitHub Service', () => {
  it.layer(GitHubMock)('GitHubMock', (it) => {
    it.effect('provides getCurrentPR', () =>
      Effect.gen(function* () {
        const github = yield* GitHub;
        const pr = yield* github.getCurrentPR;

        expect(pr.number).toBe(123);
        expect(pr.title).toBe('Mock PR for local testing');
        expect(pr.head.ref).toBe('feature/test');
        expect(pr.base.ref).toBe('main');
      }),
    );

    it.effect('provides getPR', () =>
      Effect.gen(function* () {
        const github = yield* GitHub;
        const pr = yield* github.getPR(456);

        expect(pr.number).toBe(456);
        expect(pr.title).toBe('Mock PR #456');
      }),
    );

    it.effect('provides getDiff', () =>
      Effect.gen(function* () {
        const github = yield* GitHub;
        const pr = yield* github.getCurrentPR;
        const diff = yield* github.getDiff(pr);

        expect(diff).toContain('diff --git');
        expect(diff).toContain('Hello, World!');
      }),
    );

    it.effect('provides comment', () =>
      Effect.gen(function* () {
        const github = yield* GitHub;
        // Should not throw
        yield* github.comment(123, 'Test comment');
      }),
    );

    it.effect('provides getWorkflowRuns', () =>
      Effect.gen(function* () {
        const github = yield* GitHub;
        const runs = yield* github.getWorkflowRuns('release.yaml');

        expect(runs.length).toBeGreaterThan(0);
        expect(runs[0]?.id).toBeDefined();
        expect(runs[0]?.head_sha).toBeDefined();
        expect(runs[0]?.conclusion).toBe('success');
      }),
    );
  });

  it.layer(GitHubMock)('whenEvent', (it) => {
    it.effect('returns tagged payload when event matches', () =>
      Effect.gen(function* () {
        const github = yield* GitHub;
        // In mock layer with 'local' event, it accepts any events
        const event = yield* github.whenEvent('pull_request');

        expect(event).toBeDefined();
        expect(event._tag).toBe('pull_request');
        expect(event.action).toBe('opened');
      }),
    );

    it.effect('returns tagged payload for multiple event types', () =>
      Effect.gen(function* () {
        const github = yield* GitHub;
        // Should work with multiple events
        const event = yield* github.whenEvent('pull_request', 'issue_comment');

        expect(event).toBeDefined();
        // Tag should be the first event when running locally
        expect(event._tag).toBe('pull_request');
      }),
    );

    it.effect('supports Match.tag pattern matching', () =>
      Effect.gen(function* () {
        const github = yield* GitHub;
        const event = yield* github.whenEvent('push', 'star');

        const result = Match.value(event).pipe(
          Match.tag('push', (e) => `Push event: ${e._tag}`),
          Match.tag('star', (e) => `Star event: ${e._tag}`),
          Match.exhaustive,
        );

        // Mock returns first event type as tag
        expect(result).toBe('Push event: push');
      }),
    );
  });

  it.layer(GitHubMock)('repo', (it) => {
    it.effect('provides owner and repo', () =>
      Effect.gen(function* () {
        const github = yield* GitHub;

        expect(github.repo.owner).toBeDefined();
        expect(github.repo.repo).toBeDefined();
        expect(github.repository).toBe(`${github.repo.owner}/${github.repo.repo}`);
      }),
    );
  });
});
