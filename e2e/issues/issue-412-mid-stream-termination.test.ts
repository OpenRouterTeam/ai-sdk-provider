/**
 * Regression test for GitHub issue #412
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/412
 *
 * Issue: When a TLS socket closes mid-stream during an SSE streaming response,
 * the consumer receives a raw `TypeError: terminated` with no HTTP status code,
 * no error code, and no response body. The error bypasses the TransformStream's
 * transform() and flush() callbacks entirely, so no structured error or finish
 * event is emitted.
 *
 * Reported: February 2026
 * Affected: streamText / doStream with any model
 *
 * Expected behavior after fix: The stream should emit an error event followed
 * by a finish event with finishReason 'error', preserving any partial content
 * already streamed before the connection drop.
 */
import type {
  LanguageModelV3Prompt,
  LanguageModelV3StreamPart,
} from '@ai-sdk/provider';

import { convertReadableStreamToArray } from '@ai-sdk/provider-utils/test';
import { createTestServer, TestResponseController } from '@ai-sdk/test-server';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createOpenRouter } from '@/src';

vi.mock('@/src/version', () => ({
  VERSION: '0.0.0-test',
}));

const TEST_PROMPT: LanguageModelV3Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
];

const provider = createOpenRouter({
  apiKey: 'test-api-key',
  compatibility: 'strict',
});

describe('Issue #412: Mid-stream socket termination should emit error and finish events', () => {
  const server = createTestServer({
    'https://openrouter.ai/api/v1/chat/completions': {
      response: { type: 'json-value', body: {} },
    },
  });

  beforeAll(() => server.server.start());
  afterEach(() => server.server.reset());
  afterAll(() => server.server.stop());

  it('should emit error and finish events when stream terminates mid-response (chat model)', async () => {
    const controller = new TestResponseController();

    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'controlled-stream',
      controller,
    };

    const model = provider.chat('anthropic/claude-3.5-sonnet');

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    await controller.write(
      `data: {"id":"test-1","object":"chat.completion.chunk","created":1234567890,"model":"anthropic/claude-3.5-sonnet","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n`,
    );
    await controller.write(
      `data: {"id":"test-1","object":"chat.completion.chunk","created":1234567890,"model":"anthropic/claude-3.5-sonnet","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n`,
    );
    await controller.write(
      `data: {"id":"test-1","object":"chat.completion.chunk","created":1234567890,"model":"anthropic/claude-3.5-sonnet","choices":[{"index":0,"delta":{"content":" World"},"finish_reason":null}]}\n\n`,
    );

    await controller.error(new TypeError('terminated'));

    const elements = await convertReadableStreamToArray(stream);

    const hasTextDelta = elements.some(
      (e: LanguageModelV3StreamPart) => e.type === 'text-delta',
    );
    const errorEvent = elements.find(
      (e: LanguageModelV3StreamPart) => e.type === 'error',
    );
    const finishEvent = elements.find(
      (e: LanguageModelV3StreamPart) => e.type === 'finish',
    );

    expect(hasTextDelta).toBe(true);
    expect(errorEvent).toBeDefined();
    expect(finishEvent).toBeDefined();
    expect(
      finishEvent!.type === 'finish' && finishEvent!.finishReason.unified,
    ).toBe('error');
  });

  it('should preserve partial text content streamed before the error', async () => {
    const controller = new TestResponseController();

    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'controlled-stream',
      controller,
    };

    const model = provider.chat('anthropic/claude-3.5-sonnet');

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    await controller.write(
      `data: {"id":"test-2","object":"chat.completion.chunk","created":1234567890,"model":"anthropic/claude-3.5-sonnet","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n`,
    );
    await controller.write(
      `data: {"id":"test-2","object":"chat.completion.chunk","created":1234567890,"model":"anthropic/claude-3.5-sonnet","choices":[{"index":0,"delta":{"content":"Partial"},"finish_reason":null}]}\n\n`,
    );

    await controller.error(new TypeError('terminated'));

    const elements = await convertReadableStreamToArray(stream);

    const textDeltas = elements.filter(
      (e: LanguageModelV3StreamPart) => e.type === 'text-delta',
    );

    expect(textDeltas.length).toBeGreaterThan(0);
    expect(
      textDeltas.some(
        (e: LanguageModelV3StreamPart) =>
          e.type === 'text-delta' && e.delta === 'Partial',
      ),
    ).toBe(true);
  });

  it('should handle termination before any content is streamed', async () => {
    const controller = new TestResponseController();

    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'controlled-stream',
      controller,
    };

    const model = provider.chat('anthropic/claude-3.5-sonnet');

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    await controller.error(new TypeError('terminated'));

    const elements = await convertReadableStreamToArray(stream);

    const errorEvent = elements.find(
      (e: LanguageModelV3StreamPart) => e.type === 'error',
    );
    const finishEvent = elements.find(
      (e: LanguageModelV3StreamPart) => e.type === 'finish',
    );

    expect(errorEvent).toBeDefined();
    expect(finishEvent).toBeDefined();
    expect(
      finishEvent!.type === 'finish' && finishEvent!.finishReason.unified,
    ).toBe('error');
  });

  it('should handle termination with usage data already received', async () => {
    const controller = new TestResponseController();

    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'controlled-stream',
      controller,
    };

    const model = provider.chat('anthropic/claude-3.5-sonnet');

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    await controller.write(
      `data: {"id":"test-3","object":"chat.completion.chunk","created":1234567890,"model":"anthropic/claude-3.5-sonnet","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n`,
    );
    await controller.write(
      `data: {"id":"test-3","object":"chat.completion.chunk","created":1234567890,"model":"anthropic/claude-3.5-sonnet","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}\n\n`,
    );
    await controller.write(
      `data: {"id":"test-3","object":"chat.completion.chunk","created":1234567890,"model":"anthropic/claude-3.5-sonnet","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n`,
    );

    await controller.error(new TypeError('terminated'));

    const elements = await convertReadableStreamToArray(stream);

    const finishEvent = elements.find(
      (e: LanguageModelV3StreamPart) => e.type === 'finish',
    );

    expect(finishEvent).toBeDefined();
    expect(
      finishEvent!.type === 'finish' && finishEvent!.finishReason.unified,
    ).toBe('error');
    if (finishEvent!.type === 'finish') {
      expect(finishEvent!.usage.inputTokens.total).toBe(10);
      expect(finishEvent!.usage.outputTokens.total).toBe(5);
    }
  });
});
