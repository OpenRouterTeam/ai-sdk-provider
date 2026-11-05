/**
 * Regression test for GitHub issues #615 and #625
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/615
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/625
 *
 * Reported error: Unhandled AbortError when a cancelled stream has already
 * errored ("Stopping a chat can crash the process with an unhandled
 * `AbortError`").
 * Affected: 3.1.0, doStream on chat models
 *
 * This test verifies that cancelling a doStream() result after the HTTP
 * response body has errored with an AbortError does not produce an
 * unhandledRejection, for both chat and completion models and for a range of
 * buffered-but-unread SSE chunk depths. Fully offline: a custom `fetch`
 * returns a Response whose body is controlled by the test.
 */
import type {
  LanguageModelV4Prompt,
  LanguageModelV4StreamPart,
} from '@ai-sdk/provider';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.mock('@/src/version', () => ({
  VERSION: '0.0.0-test',
}));

const TEST_PROMPT: LanguageModelV4Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
];

const encoder = new TextEncoder();

function chatChunk(i: number): string {
  return `data: ${JSON.stringify({
    id: 'test-1',
    object: 'chat.completion.chunk',
    created: 1234567890,
    model: 'openai/gpt-4o-mini',
    choices: [
      { index: 0, delta: { content: `token-${i}` }, finish_reason: null },
    ],
  })}\n\n`;
}

function completionChunk(i: number): string {
  return `data: ${JSON.stringify({
    id: 'test-1',
    object: 'text_completion',
    created: 1234567890,
    model: 'openai/gpt-4o-mini',
    choices: [{ index: 0, text: `token-${i}`, finish_reason: null }],
  })}\n\n`;
}

function createControlledFetch() {
  let bodyController!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      bodyController = controller;
    },
  });
  const fetch = vi.fn(
    async () =>
      new Response(body, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      }),
  );
  return {
    fetch: fetch as unknown as typeof globalThis.fetch,
    get body() {
      return bodyController;
    },
  };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Issue #615/#625: cancelling a stream whose source already errored', () => {
  let unhandled: unknown[];
  const onUnhandled = (reason: unknown) => {
    unhandled.push(reason);
  };

  beforeEach(() => {
    unhandled = [];
    process.on('unhandledRejection', onUnhandled);
  });

  afterEach(() => {
    process.off('unhandledRejection', onUnhandled);
  });

  const cases = [
    {
      name: 'chat',
      chunk: chatChunk,
      start: (provider: ReturnType<typeof createOpenRouter>) =>
        provider.chat('openai/gpt-4o-mini').doStream({ prompt: TEST_PROMPT }),
    },
    {
      name: 'completion',
      chunk: completionChunk,
      start: (provider: ReturnType<typeof createOpenRouter>) =>
        provider
          .completion('openai/gpt-4o-mini')
          .doStream({ prompt: TEST_PROMPT }),
    },
  ] as const;

  for (const { name, chunk, start } of cases) {
    for (let queued = 0; queued <= 6; queued++) {
      it(`${name}: no unhandledRejection with ${queued} unread chunk(s) queued`, async () => {
        const controlled = createControlledFetch();
        const provider = createOpenRouter({
          apiKey: 'test-api-key',
          fetch: controlled.fetch,
        });

        const { stream } = await start(provider);
        const typedStream: ReadableStream<LanguageModelV4StreamPart> = stream;

        for (let i = 0; i < queued; i++) {
          controlled.body.enqueue(encoder.encode(chunk(i)));
        }
        // Let the pipeline pull the queued chunks into its internal buffers.
        await tick();
        await tick();

        const abortError = new DOMException(
          'This operation was aborted',
          'AbortError',
        );
        controlled.body.error(abortError);
        // Let the error propagate through the pipe chain so the source the
        // provider wraps is already errored when the consumer cancels.
        await tick();
        await tick();
        await typedStream.cancel(abortError);

        // Give Node a chance to report any unhandled rejection.
        await new Promise((resolve) => setTimeout(resolve, 20));

        expect(unhandled).toEqual([]);
      });
    }
  }
});
