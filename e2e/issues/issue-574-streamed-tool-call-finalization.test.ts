/**
 * Regression test for GitHub issue #574
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/574
 *
 * Reported error: streamed Claude tool arguments come back as invalid JSON
 * Model: anthropic/claude-haiku-5.5
 *
 * One reported corruption shape is an "early root close": an extra `}`
 * closes the root object and the remaining properties follow. Arguments
 * arrive in many small deltas and the finish reason is `stop` or
 * `tool_calls`.
 *
 * This test verifies that streamed tool calls are finalized with the full
 * accumulated arguments rather than a truncated JSON prefix, so the invalid
 * input reaches the AI SDK's tool-call repair instead of being hidden.
 */
import type {
  LanguageModelV4Prompt,
  LanguageModelV4StreamPart,
} from '@ai-sdk/provider';

import { convertReadableStreamToArray } from '@ai-sdk/provider-utils/test';
import { createTestServer } from '@ai-sdk/test-server';
import { jsonSchema, streamText, tool } from 'ai';
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

const TEST_PROMPT: LanguageModelV4Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'Write the report.' }] },
];

const provider = createOpenRouter({
  apiKey: 'test-api-key',
  compatibility: 'strict',
});

const chunk = (delta: string, finishReason: string | null = null) =>
  `data: {"id":"chatcmpl-574","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-haiku-5.5",` +
  `"choices":[{"index":0,"delta":${delta},"finish_reason":${JSON.stringify(finishReason)}}]}\n\n`;

// Valid JSON prefix (root closed early) followed by more fragments.
const fragments = ['{"a":[1]}', '}, "b":', '[2]}'];

const earlyRootCloseChunks = (finishReason: string) => [
  chunk(
    '{"role":"assistant","content":null,"tool_calls":[{"index":0,"id":"call_574","type":"function","function":{"name":"report","arguments":""}}]}',
  ),
  ...fragments.map((args) =>
    chunk(
      `{"tool_calls":[{"index":0,"function":{"arguments":${JSON.stringify(args)}}}]}`,
    ),
  ),
  chunk('{}', finishReason),
  'data: [DONE]\n\n',
];

describe('Issue #574: streamed tool arguments with an early root close', () => {
  const server = createTestServer({
    'https://openrouter.ai/api/v1/chat/completions': {
      response: { type: 'json-value', body: {} },
    },
  });

  beforeAll(() => server.server.start());
  afterEach(() => server.server.reset());
  afterAll(() => server.server.stop());

  it.each([
    'tool_calls',
    'stop',
  ])('should emit one tool call with the full arguments (finish_reason %s)', async (finishReason) => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: earlyRootCloseChunks(finishReason),
    };

    const model = provider.chat('anthropic/claude-haiku-5.5');
    const { stream } = await model.doStream({ prompt: TEST_PROMPT });
    const elements: LanguageModelV4StreamPart[] =
      await convertReadableStreamToArray(stream);
    const toolEvents = elements.filter((el) => el.type.startsWith('tool-'));

    // No tool-input-delta may follow the tool-call.
    expect(toolEvents.map((el) => el.type)).toEqual([
      'tool-input-start',
      'tool-input-delta',
      'tool-input-delta',
      'tool-input-delta',
      'tool-input-end',
      'tool-call',
    ]);
    expect(toolEvents.at(-1)).toMatchObject({
      type: 'tool-call',
      toolCallId: 'call_574',
      input: fragments.join(''),
    });
  });

  it('should pass the full invalid arguments to experimental_repairToolCall', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: earlyRootCloseChunks('tool_calls'),
    };

    const repairInputs: string[] = [];
    const result = streamText({
      model: provider.chat('anthropic/claude-haiku-5.5'),
      prompt: 'Write the report.',
      tools: {
        report: tool({
          inputSchema: jsonSchema<{ a: number[]; b: number[] }>({
            type: 'object',
            properties: {
              a: { type: 'array', items: { type: 'number' } },
              b: { type: 'array', items: { type: 'number' } },
            },
            required: ['a', 'b'],
          }),
        }),
      },
      experimental_repairToolCall: async ({ toolCall }) => {
        repairInputs.push(toolCall.input);
        return { ...toolCall, input: '{"a":[1],"b":[2]}' };
      },
    });

    const toolCalls = await result.toolCalls;

    expect(repairInputs).toEqual([fragments.join('')]);
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]).toMatchObject({
      toolCallId: 'call_574',
      toolName: 'report',
      input: { a: [1], b: [2] },
    });
  });
});
