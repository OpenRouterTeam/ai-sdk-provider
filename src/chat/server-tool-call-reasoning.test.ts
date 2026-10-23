/**
 * Regression tests for `reasoning.server_tool_call` reasoning details.
 *
 * OpenRouter records server-tool invocations (e.g. `openrouter:fusion`,
 * `openrouter:tool_search`) as `reasoning.server_tool_call` entries in
 * reasoning_details so they can be rehydrated on a later turn. They must be
 * parsed, accumulated during streaming and replayed on the next request.
 */
import type { LanguageModelV4StreamPart } from '@ai-sdk/provider';
import type { ModelMessage } from 'ai';

import { convertReadableStreamToArray } from '@ai-sdk/provider-utils/test';
import { createTestServer } from '@ai-sdk/test-server';
import { streamText } from 'ai';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createOpenRouter } from '../provider';
import { ReasoningDetailType } from '../schemas/reasoning-details';

const SERVER_TOOL_CALL_DETAIL = {
  type: ReasoningDetailType.ServerToolCall,
  tool_name: 'openrouter:fusion',
  tool_call_id: 'call_abc123',
  arguments: '{"prompt":"Compare carbon tax proposals"}',
  result: '{"status":"ok","models":["openai/gpt-4o"]}',
};

const TEST_MESSAGES: ModelMessage[] = [
  { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
];

function chunk(delta: Record<string, unknown>, finishReason?: string) {
  return `data: ${JSON.stringify({
    id: 'chatcmpl-stc',
    object: 'chat.completion.chunk',
    created: 1711357598,
    model: 'openai/gpt-4o',
    choices: [{ index: 0, delta, finish_reason: finishReason ?? null }],
  })}\n\n`;
}

const STREAM_CHUNKS = [
  chunk({
    role: 'assistant',
    content: '',
    reasoning_details: [
      { type: ReasoningDetailType.Text, text: 'Let me ', format: 'unknown' },
    ],
  }),
  chunk({
    reasoning_details: [
      { type: ReasoningDetailType.Text, text: 'think.', format: 'unknown' },
    ],
  }),
  chunk({ reasoning_details: [SERVER_TOOL_CALL_DETAIL] }),
  chunk({ content: 'Done.' }, 'stop'),
  'data: [DONE]\n\n',
];

describe('reasoning.server_tool_call reasoning details', () => {
  const server = createTestServer({
    'https://openrouter.ai/api/v1/chat/completions': {
      response: { type: 'json-value', body: {} },
    },
  });

  beforeAll(() => server.server.start());
  afterEach(() => server.server.reset());
  afterAll(() => server.server.stop());

  const model = createOpenRouter({ apiKey: 'test-api-key' }).chat(
    'openai/gpt-4o',
  );

  it('parses server_tool_call details from non-streaming responses', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'json-value',
      body: {
        id: 'chatcmpl-stc',
        object: 'chat.completion',
        created: 1711115037,
        model: 'openai/gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Done.',
              reasoning_details: [SERVER_TOOL_CALL_DETAIL],
            },
            finish_reason: 'stop',
          },
        ],
      },
    };

    const result = await model.doGenerate({ prompt: TEST_MESSAGES as never });

    // The text is unchanged. Other parts (e.g. an empty reasoning part that
    // carries the details for replay) may be present too.
    expect(result.content).toContainEqual({ type: 'text', text: 'Done.' });
    for (const part of result.content) {
      if (part.type === 'reasoning') {
        expect(part.text).toBe('');
      }
    }

    // The details are reachable from part or response metadata.
    const reachable = [
      ...result.content.map((part) =>
        'providerMetadata' in part ? part.providerMetadata : undefined,
      ),
      result.providerMetadata,
    ].flatMap(
      (metadata) =>
        (metadata?.openrouter?.reasoning_details as unknown[] | undefined) ??
        [],
    );
    expect(reachable).toContainEqual(SERVER_TOOL_CALL_DETAIL);
  });

  it('accumulates server_tool_call details in streams without merging into text', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: STREAM_CHUNKS,
    };

    const { stream } = await model.doStream({
      prompt: TEST_MESSAGES as never,
    });
    const elements = await convertReadableStreamToArray(stream);

    const reasoningText = elements
      .filter(
        (el): el is LanguageModelV4StreamPart & { type: 'reasoning-delta' } =>
          el.type === 'reasoning-delta',
      )
      .map((el) => el.delta)
      .join('');
    expect(reasoningText).toBe('Let me think.');

    const finish = elements.find(
      (el): el is LanguageModelV4StreamPart & { type: 'finish' } =>
        el.type === 'finish',
    );
    expect(finish?.providerMetadata?.openrouter?.reasoning_details).toEqual([
      {
        type: ReasoningDetailType.Text,
        text: 'Let me think.',
        format: 'unknown',
      },
      SERVER_TOOL_CALL_DETAIL,
    ]);
  });

  it('replays server_tool_call details on the next turn', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: STREAM_CHUNKS,
    };

    const first = streamText({ model, messages: TEST_MESSAGES });
    await first.consumeStream();
    const { messages: responseMessages } = await first.response;

    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        chunk({ role: 'assistant', content: 'Ok.' }, 'stop'),
        'data: [DONE]\n\n',
      ],
    };

    const second = streamText({
      model,
      messages: [
        ...TEST_MESSAGES,
        ...responseMessages,
        { role: 'user', content: [{ type: 'text', text: 'Go on' }] },
      ],
    });
    await second.consumeStream();

    const body = (await server.calls[1]!.requestBodyJson) as {
      messages: Array<{ role: string; reasoning_details?: unknown[] }>;
    };
    const assistant = body.messages.find((m) => m.role === 'assistant');
    expect(assistant?.reasoning_details).toContainEqual(
      SERVER_TOOL_CALL_DETAIL,
    );
  });
});
