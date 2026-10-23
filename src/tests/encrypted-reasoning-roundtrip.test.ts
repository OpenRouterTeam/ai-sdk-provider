import type { ModelMessage } from 'ai';
import type { ReasoningDetailUnion } from '../schemas/reasoning-details';

import { createTestServer } from '@ai-sdk/test-server';
import { generateText, streamText } from 'ai';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createOpenRouter } from '../provider';
import { ReasoningFormat } from '../schemas/format';
import { ReasoningDetailType } from '../schemas/reasoning-details';

const CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

const ENCRYPTED_DETAIL: ReasoningDetailUnion = {
  type: ReasoningDetailType.Encrypted,
  id: 'rs_turn1',
  data: 'encrypted_turn1_blob',
  format: ReasoningFormat.OpenAIResponsesV1,
  index: 0,
};

const EMPTY_SUMMARY_DETAIL: ReasoningDetailUnion = {
  type: ReasoningDetailType.Summary,
  summary: '',
  format: ReasoningFormat.OpenAIResponsesV1,
  index: 0,
};

const SUMMARY_DETAIL: ReasoningDetailUnion = {
  type: ReasoningDetailType.Summary,
  summary: 'Thinking about a greeting.',
  format: ReasoningFormat.OpenAIResponsesV1,
  index: 0,
};

const TURN_1_MESSAGES: ModelMessage[] = [{ role: 'user', content: 'Hello' }];

const TURN_2_RESPONSE = {
  type: 'json-value' as const,
  body: {
    id: 'gen-turn2',
    object: 'chat.completion',
    created: 1711357598,
    model: 'openai/gpt-5',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'Fine.' },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  },
};

function streamChunks(reasoningDetails: ReasoningDetailUnion[]): string[] {
  const chunk = (delta: unknown, finishReason: string | null = null) =>
    `data: ${JSON.stringify({
      id: 'gen-turn1',
      object: 'chat.completion.chunk',
      created: 1711357598,
      model: 'openai/gpt-5',
      choices: [{ index: 0, delta, finish_reason: finishReason }],
    })}\n\n`;

  return [
    chunk({ role: 'assistant', content: '', reasoning_details: [] }),
    ...reasoningDetails.map((detail) => chunk({ reasoning_details: [detail] })),
    chunk({ content: 'Hi there!' }),
    chunk({}, 'stop'),
    'data: [DONE]\n\n',
  ];
}

function generateResponse(reasoningDetails: ReasoningDetailUnion[]) {
  return {
    type: 'json-value' as const,
    body: {
      id: 'gen-turn1',
      object: 'chat.completion',
      created: 1711357598,
      model: 'openai/gpt-5',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hi there!',
            reasoning_details: reasoningDetails,
          },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    },
  };
}

describe('encrypted reasoning round trip across turns', () => {
  const server = createTestServer({
    [CHAT_URL]: { response: { type: 'stream-chunks', chunks: [] } },
  });

  beforeAll(() => server.server.start());
  afterEach(() => server.server.reset());
  afterAll(() => server.server.stop());

  const model = createOpenRouter({ apiKey: 'test-api-key' }).chat(
    'openai/gpt-5',
  );

  async function turn2AssistantMessage(turn1Messages: ModelMessage[]) {
    server.urls[CHAT_URL]!.response = TURN_2_RESPONSE;
    await generateText({
      model,
      messages: [
        ...TURN_1_MESSAGES,
        ...turn1Messages,
        { role: 'user', content: 'How are you?' },
      ],
    });

    const body = await server.calls[1]!.requestBodyJson;
    return body.messages.find(
      (message: { role: string }) => message.role === 'assistant',
    );
  }

  describe('streamText', () => {
    it.each([
      ['encrypted only', [ENCRYPTED_DETAIL]],
      ['empty summary + encrypted', [EMPTY_SUMMARY_DETAIL, ENCRYPTED_DETAIL]],
    ])('replays %s reasoning_details on the next turn', async (_label, reasoningDetails) => {
      server.urls[CHAT_URL]!.response = {
        type: 'stream-chunks',
        chunks: streamChunks(reasoningDetails),
      };

      const result = streamText({ model, messages: TURN_1_MESSAGES });
      const { messages } = await result.response;

      const assistant = await turn2AssistantMessage(messages);
      expect(assistant.content).toBe('Hi there!');
      expect(assistant.reasoning_details).toStrictEqual(reasoningDetails);
    });
  });

  describe('generateText', () => {
    it.each([
      ['encrypted only', [ENCRYPTED_DETAIL]],
      ['summary + encrypted', [SUMMARY_DETAIL, ENCRYPTED_DETAIL]],
    ])('replays %s reasoning_details on the next turn', async (_label, reasoningDetails) => {
      server.urls[CHAT_URL]!.response = generateResponse(reasoningDetails);

      const result = await generateText({ model, messages: TURN_1_MESSAGES });

      const assistant = await turn2AssistantMessage(result.response.messages);
      expect(assistant.content).toBe('Hi there!');
      expect(assistant.reasoning_details).toStrictEqual(reasoningDetails);
    });
  });
});
