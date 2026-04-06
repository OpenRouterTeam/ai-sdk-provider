/**
 * Regression test for GitHub issue #413
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/413
 *
 * Issue: When tool call arguments are streamed across multiple SSE chunks,
 * the provider emits tool-input-start and tool-input-delta events but omits
 * the tool-input-end event before the tool-call event. This breaks the
 * expected lifecycle: tool-input-start -> tool-input-delta(s) -> tool-input-end -> tool-call.
 *
 * The same issue affects the flush path: when unsent tool calls are forwarded
 * at stream end, the full tool-input lifecycle is missing.
 *
 * Reported: January 2026
 * Affected: streamText / doStream with any model that streams tool call arguments
 *
 * Expected behavior after fix: Every tool-call event is preceded by a
 * tool-input-end event, and unsent tool calls in the flush path emit the
 * full tool-input-start -> tool-input-delta -> tool-input-end -> tool-call sequence.
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

vi.mock('@/src/version', () => ({
  VERSION: '0.0.0-test',
}));

const TEST_PROMPT: LanguageModelV3Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'What is the weather?' }] },
];

const provider = createOpenRouter({
  apiKey: 'test-api-key',
  compatibility: 'strict',
});

describe('Issue #413: tool-input-end missing in streaming tool calls', () => {
  const server = createTestServer({
    'https://openrouter.ai/api/v1/chat/completions': {
      response: { type: 'json-value', body: {} },
    },
  });

  beforeAll(() => server.server.start());
  afterEach(() => server.server.reset());
  afterAll(() => server.server.stop());

  it('should emit tool-input-end before tool-call when arguments stream across multiple chunks', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-413","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1","system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"role":"assistant","content":null,"tool_calls":[{"index":0,"id":"call_413_001","type":"function","function":{"name":"get_weather","arguments":""}}]},"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-413","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1","system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"city"}}]},"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-413","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1","system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\":\\"Tokyo\\"}"}}]},"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-413","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1","system_fingerprint":"fp_test","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-413","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1","system_fingerprint":"fp_test","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":15,"total_tokens":25}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const model = provider.chat('gpt-4.1');
    const { stream } = await model.doStream({ prompt: TEST_PROMPT });
    const elements = await convertReadableStreamToArray(stream);

    const toolEvents = elements.filter((el: LanguageModelV3StreamPart) =>
      [
        'tool-input-start',
        'tool-input-delta',
        'tool-input-end',
        'tool-call',
      ].includes(el.type),
    );

    expect(toolEvents.map((e: LanguageModelV3StreamPart) => e.type)).toEqual([
      'tool-input-start',
      'tool-input-delta',
      'tool-input-delta',
      'tool-input-end',
      'tool-call',
    ]);
  });

  it('should emit full tool-input lifecycle in flush path for unsent tool calls', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-413b","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1","system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"role":"assistant","content":null,"tool_calls":[{"index":0,"id":"call_413_002","type":"function","function":{"name":"get_weather","arguments":"{\\"city\\":\\"London\\"}"}}]},"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-413b","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1","system_fingerprint":"fp_test","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-413b","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1","system_fingerprint":"fp_test","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":15,"total_tokens":25}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const model = provider.chat('gpt-4.1');
    const { stream } = await model.doStream({ prompt: TEST_PROMPT });
    const elements = await convertReadableStreamToArray(stream);

    const toolEvents = elements.filter((el: LanguageModelV3StreamPart) =>
      [
        'tool-input-start',
        'tool-input-delta',
        'tool-input-end',
        'tool-call',
      ].includes(el.type),
    );

    // Single-chunk tool call: complete in first chunk, so full lifecycle is
    // emitted immediately (start -> delta -> end -> call)
    expect(toolEvents.map((e: LanguageModelV3StreamPart) => e.type)).toEqual([
      'tool-input-start',
      'tool-input-delta',
      'tool-input-end',
      'tool-call',
    ]);
  });

  it('should emit tool-input-end in flush path when tool call was partially streamed but not completed', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // Tool call start with empty arguments
        `data: {"id":"chatcmpl-413c","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1","system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"role":"assistant","content":null,"tool_calls":[{"index":0,"id":"call_413_003","type":"function","function":{"name":"search","arguments":""}}]},"logprobs":null,"finish_reason":null}]}\n\n`,
        // Partial arguments (not valid JSON yet)
        `data: {"id":"chatcmpl-413c","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1","system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"query\\""}}]},"logprobs":null,"finish_reason":null}]}\n\n`,
        // Stream ends with tool_calls finish reason but incomplete arguments
        `data: {"id":"chatcmpl-413c","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1","system_fingerprint":"fp_test","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-413c","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1","system_fingerprint":"fp_test","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":8,"total_tokens":18}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const model = provider.chat('gpt-4.1');
    const { stream } = await model.doStream({ prompt: TEST_PROMPT });
    const elements = await convertReadableStreamToArray(stream);

    const toolEvents = elements.filter((el: LanguageModelV3StreamPart) =>
      [
        'tool-input-start',
        'tool-input-delta',
        'tool-input-end',
        'tool-call',
      ].includes(el.type),
    );

    // Partially streamed (inputStarted=true): flush should only add end + call
    expect(toolEvents.map((e: LanguageModelV3StreamPart) => e.type)).toEqual([
      'tool-input-start',
      'tool-input-delta',
      'tool-input-end',
      'tool-call',
    ]);
  });
});
