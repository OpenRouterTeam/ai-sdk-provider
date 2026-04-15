/**
 * Regression test for GitHub issue #413 (reasoning metadata bloat)
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/413
 *
 * Issue: Each reasoning-delta SSE event carried a full snapshot of all
 * accumulatedReasoningDetails in its providerMetadata. For N reasoning
 * chunks, total serialized payload grew O(N²) instead of O(N).
 *
 * Fix: reasoning-start and reasoning-delta events no longer carry
 * providerMetadata. The full accumulated reasoning_details are still
 * available on reasoning-end, tool-call, and finish events.
 */
import type {
  LanguageModelV3Prompt,
  LanguageModelV3StreamPart,
} from '@ai-sdk/provider';

import { convertReadableStreamToArray } from '@ai-sdk/provider-utils/test';
import { createTestServer } from '@ai-sdk/test-server';
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
import { ReasoningDetailType } from '@/src/schemas/reasoning-details';

vi.mock('@/src/version', () => ({
  VERSION: '0.0.0-test',
}));

const TEST_PROMPT: LanguageModelV3Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'Think step by step.' }] },
];

const provider = createOpenRouter({
  apiKey: 'test-api-key',
  compatibility: 'strict',
});

describe('Issue #413: reasoning metadata bloat in streaming', () => {
  const server = createTestServer({
    'https://openrouter.ai/api/v1/chat/completions': {
      response: { type: 'json-value', body: {} },
    },
  });

  beforeAll(() => server.server.start());
  afterEach(() => server.server.reset());
  afterAll(() => server.server.stop());

  /**
   * Build SSE chunks that simulate N reasoning_details deltas followed by
   * a text delta and a finish event.
   */
  function buildReasoningChunks(count: number): string[] {
    const id = 'chatcmpl-413-bloat';
    const base = `"object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-3.5-sonnet","system_fingerprint":"fp_test"`;
    const chunks: string[] = [];

    for (let i = 0; i < count; i++) {
      const isFirst = i === 0;
      const rolePart = isFirst ? `"role":"assistant","content":"",` : '';
      chunks.push(
        `data: {"id":"${id}",${base},"choices":[{"index":0,"delta":{${rolePart}"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":"Step ${i + 1}. "}]},"logprobs":null,"finish_reason":null}]}\n\n`,
      );
    }

    // Text content delta
    chunks.push(
      `data: {"id":"${id}",${base},"choices":[{"index":0,"delta":{"content":"The answer is 42."},"logprobs":null,"finish_reason":null}]}\n\n`,
    );

    // Finish
    chunks.push(
      `data: {"id":"${id}",${base},"choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"stop"}]}\n\n`,
    );
    chunks.push(
      `data: {"id":"${id}",${base},"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":${count + 5},"total_tokens":${count + 15}}}\n\n`,
    );
    chunks.push('data: [DONE]\n\n');

    return chunks;
  }

  it('should not attach providerMetadata to reasoning-delta events', async () => {
    const N = 20;
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: buildReasoningChunks(N),
    };

    const model = provider.chat('anthropic/claude-3.5-sonnet');
    const { stream } = await model.doStream({ prompt: TEST_PROMPT });
    const elements = await convertReadableStreamToArray(stream);

    const reasoningDeltas = elements.filter(
      (el: LanguageModelV3StreamPart) => el.type === 'reasoning-delta',
    );

    expect(reasoningDeltas).toHaveLength(N);

    // No reasoning-delta should carry providerMetadata
    for (const delta of reasoningDeltas) {
      expect(delta.providerMetadata).toBeUndefined();
    }
  });

  it('should not attach providerMetadata to reasoning-start events', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: buildReasoningChunks(5),
    };

    const model = provider.chat('anthropic/claude-3.5-sonnet');
    const { stream } = await model.doStream({ prompt: TEST_PROMPT });
    const elements = await convertReadableStreamToArray(stream);

    const reasoningStart = elements.find(
      (el: LanguageModelV3StreamPart) => el.type === 'reasoning-start',
    );

    expect(reasoningStart).toBeDefined();
    expect(reasoningStart?.providerMetadata).toBeUndefined();
  });

  it('should preserve accumulated reasoning_details on reasoning-end', async () => {
    const N = 5;
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: buildReasoningChunks(N),
    };

    const model = provider.chat('anthropic/claude-3.5-sonnet');
    const { stream } = await model.doStream({ prompt: TEST_PROMPT });
    const elements = await convertReadableStreamToArray(stream);

    const reasoningEnd = elements.find(
      (el: LanguageModelV3StreamPart) => el.type === 'reasoning-end',
    );

    expect(reasoningEnd).toBeDefined();
    expect(reasoningEnd?.providerMetadata).toBeDefined();

    const details = (
      reasoningEnd?.providerMetadata?.openrouter as {
        reasoning_details?: Array<{ type: string; text?: string }>;
      }
    )?.reasoning_details;

    // All N reasoning chunks should be merged into accumulated details
    expect(details).toBeDefined();
    // Consecutive text details are merged, so we get 1 merged entry
    expect(details).toHaveLength(1);
    expect(details?.[0]?.type).toBe(ReasoningDetailType.Text);
  });

  it('should preserve accumulated reasoning_details on finish event', async () => {
    const N = 5;
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: buildReasoningChunks(N),
    };

    const model = provider.chat('anthropic/claude-3.5-sonnet');
    const { stream } = await model.doStream({ prompt: TEST_PROMPT });
    const elements = await convertReadableStreamToArray(stream);

    const finishEvent = elements.find(
      (el: LanguageModelV3StreamPart) => el.type === 'finish',
    );

    expect(finishEvent).toBeDefined();
    expect(finishEvent?.providerMetadata).toBeDefined();

    const details = (
      finishEvent?.providerMetadata?.openrouter as {
        reasoning_details?: Array<{ type: string; text?: string }>;
      }
    )?.reasoning_details;

    expect(details).toBeDefined();
    // Consecutive text details are merged
    expect(details).toHaveLength(1);
    expect(details?.[0]?.type).toBe(ReasoningDetailType.Text);
  });

  it('should produce total payload proportional to N, not N²', async () => {
    const N = 20;
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: buildReasoningChunks(N),
    };

    const model = provider.chat('anthropic/claude-3.5-sonnet');
    const { stream } = await model.doStream({ prompt: TEST_PROMPT });
    const elements = await convertReadableStreamToArray(stream);

    // Serialize all stream parts to measure total payload size
    const totalBytes = elements.reduce(
      (sum: number, el: LanguageModelV3StreamPart) =>
        sum + JSON.stringify(el).length,
      0,
    );

    // With the fix, total size should be roughly linear in N.
    // Each reasoning-delta is ~80 bytes, plus overhead for start/end/finish/text.
    // A generous linear threshold: 300 * N bytes should be plenty.
    // Before the fix, 20 chunks produced ~10,500 bytes (quadratic).
    // After the fix, 20 chunks produce ~3,000 bytes (linear).
    const linearThreshold = 300 * N;
    expect(totalBytes).toBeLessThan(linearThreshold);
  });

  it('should handle single reasoning chunk without metadata bloat', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: buildReasoningChunks(1),
    };

    const model = provider.chat('anthropic/claude-3.5-sonnet');
    const { stream } = await model.doStream({ prompt: TEST_PROMPT });
    const elements = await convertReadableStreamToArray(stream);

    const reasoningDeltas = elements.filter(
      (el: LanguageModelV3StreamPart) => el.type === 'reasoning-delta',
    );

    expect(reasoningDeltas).toHaveLength(1);
    expect(reasoningDeltas[0]?.providerMetadata).toBeUndefined();

    // reasoning-end should still have metadata
    const reasoningEnd = elements.find(
      (el: LanguageModelV3StreamPart) => el.type === 'reasoning-end',
    );
    expect(reasoningEnd?.providerMetadata).toBeDefined();
  });

  it('should handle mixed reasoning detail types without metadata on deltas', async () => {
    const id = 'chatcmpl-413-mixed';
    const base = `"object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-3.5-sonnet","system_fingerprint":"fp_test"`;

    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // Text reasoning
        `data: {"id":"${id}",${base},"choices":[{"index":0,"delta":{"role":"assistant","content":"","reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":"Thinking..."}]},"logprobs":null,"finish_reason":null}]}\n\n`,
        // Summary reasoning
        `data: {"id":"${id}",${base},"choices":[{"index":0,"delta":{"reasoning_details":[{"type":"${ReasoningDetailType.Summary}","summary":"Summarized thought"}]},"logprobs":null,"finish_reason":null}]}\n\n`,
        // Encrypted reasoning (no delta emitted, just accumulated)
        `data: {"id":"${id}",${base},"choices":[{"index":0,"delta":{"reasoning_details":[{"type":"${ReasoningDetailType.Encrypted}","data":"opaque"}]},"logprobs":null,"finish_reason":null}]}\n\n`,
        // Text content
        `data: {"id":"${id}",${base},"choices":[{"index":0,"delta":{"content":"Done."},"logprobs":null,"finish_reason":null}]}\n\n`,
        // Finish
        `data: {"id":"${id}",${base},"choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"${id}",${base},"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":15,"total_tokens":25}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const model = provider.chat('anthropic/claude-3.5-sonnet');
    const { stream } = await model.doStream({ prompt: TEST_PROMPT });
    const elements = await convertReadableStreamToArray(stream);

    // Text + Summary produce deltas; Encrypted does not
    const reasoningDeltas = elements.filter(
      (el: LanguageModelV3StreamPart) => el.type === 'reasoning-delta',
    );
    expect(reasoningDeltas).toHaveLength(2);

    // No delta should carry providerMetadata
    for (const delta of reasoningDeltas) {
      expect(delta.providerMetadata).toBeUndefined();
    }

    // reasoning-end should have all 3 types accumulated
    const reasoningEnd = elements.find(
      (el: LanguageModelV3StreamPart) => el.type === 'reasoning-end',
    );
    const details = (
      reasoningEnd?.providerMetadata?.openrouter as {
        reasoning_details?: Array<{ type: string }>;
      }
    )?.reasoning_details;

    expect(details).toHaveLength(3);
  });
});
