/**
 * Reasoning details that arrive after the visible reasoning block has closed
 * (e.g. a late `reasoning.encrypted` blob from OpenAI or a signature-only
 * delta from Anthropic) must still be replayed on the next turn, exactly once,
 * when the stream is consumed over a real wire (chunks serialized as they
 * arrive) rather than in-process.
 */
import type { ModelMessage, UIMessage, UIMessageChunk } from 'ai';
import type { ReasoningDetailUnion } from '../schemas/reasoning-details';

import { createTestServer, TestResponseController } from '@ai-sdk/test-server';
import {
  convertToModelMessages,
  generateText,
  readUIMessageStream,
  streamText,
  tool,
} from 'ai';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createOpenRouter } from '../provider';
import { ReasoningFormat } from '../schemas/format';
import { ReasoningDetailType } from '../schemas/reasoning-details';
import { deterministicStringify } from '../utils/deterministic-stringify';

const CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const CHUNK_DELAY_MS = 20;

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

const SUMMARY: ReasoningDetailUnion = {
  type: ReasoningDetailType.Summary,
  summary: 'Thinking about a greeting.',
  format: ReasoningFormat.OpenAIResponsesV1,
  index: 0,
};

const ENCRYPTED: ReasoningDetailUnion = {
  type: ReasoningDetailType.Encrypted,
  id: 'rs_late',
  data: 'encrypted_late_blob',
  format: ReasoningFormat.OpenAIResponsesV1,
  index: 0,
};

const ANTHROPIC_TEXT: ReasoningDetailUnion = {
  type: ReasoningDetailType.Text,
  text: 'Let me think.',
  format: ReasoningFormat.AnthropicClaudeV1,
  index: 0,
};

const ANTHROPIC_SIGNATURE: ReasoningDetailUnion = {
  type: ReasoningDetailType.Text,
  signature: 'sig-late',
  format: ReasoningFormat.AnthropicClaudeV1,
  index: 0,
};

const chunk = (delta: unknown, finishReason: string | null = null) =>
  `data: ${JSON.stringify({
    id: 'gen-turn1',
    object: 'chat.completion.chunk',
    created: 1711357598,
    model: 'openai/gpt-5',
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  })}\n\n`;

const TOOL_CALL_DELTA = {
  tool_calls: [
    {
      index: 0,
      id: 'call_1',
      type: 'function',
      function: { name: 'lookup', arguments: '{"q":"x"}' },
    },
  ],
};

const SCENARIOS = [
  {
    label: 'late reasoning.encrypted after text',
    deltas: [
      { reasoning_details: [SUMMARY] },
      { content: 'Hi there!' },
      { reasoning_details: [ENCRYPTED] },
    ],
    finishReason: 'stop',
    expected: [SUMMARY, ENCRYPTED],
  },
  {
    label: 'late signature-only delta after text',
    deltas: [
      { reasoning_details: [ANTHROPIC_TEXT] },
      { content: 'Hi there!' },
      { reasoning_details: [ANTHROPIC_SIGNATURE] },
    ],
    finishReason: 'stop',
    expected: [{ ...ANTHROPIC_TEXT, signature: 'sig-late' }],
  },
  {
    label: 'late reasoning.encrypted after a tool call',
    deltas: [
      { reasoning_details: [SUMMARY] },
      TOOL_CALL_DELTA,
      { reasoning_details: [ENCRYPTED] },
    ],
    finishReason: 'tool_calls',
    expected: [SUMMARY, ENCRYPTED],
  },
  {
    label: 'late reasoning.encrypted after text and a tool call',
    deltas: [
      { reasoning_details: [SUMMARY] },
      { content: 'Let me look that up.' },
      TOOL_CALL_DELTA,
      { reasoning_details: [ENCRYPTED] },
    ],
    finishReason: 'tool_calls',
    expected: [SUMMARY, ENCRYPTED],
  },
];

const tools = {
  lookup: tool({
    inputSchema: z.object({ q: z.string() }),
    execute: async () => 'result',
  }),
};

describe('late reasoning_details round trip across turns', () => {
  const server = createTestServer({
    [CHAT_URL]: { response: { type: 'stream-chunks', chunks: [] } },
  });

  beforeAll(() => server.server.start());
  afterEach(() => server.server.reset());
  afterAll(() => server.server.stop());

  const model = createOpenRouter({ apiKey: 'test-api-key' }).chat(
    'openai/gpt-5',
  );

  // Serve turn 1 with a delay between SSE chunks so downstream consumers
  // serialize each part (e.g. reasoning-end) before later chunks arrive.
  function serveTurn1(deltas: unknown[], finishReason: string) {
    const controller = new TestResponseController();
    server.urls[CHAT_URL]!.response = [
      { type: 'controlled-stream', controller },
      TURN_2_RESPONSE,
    ];
    void (async () => {
      const chunks = [
        chunk({ role: 'assistant', content: '' }),
        ...deltas.map((delta) => chunk(delta)),
        chunk({}, finishReason),
        'data: [DONE]\n\n',
      ];
      for (const sse of chunks) {
        await controller.write(sse);
        await new Promise((resolve) => setTimeout(resolve, CHUNK_DELAY_MS));
      }
      await controller.close();
    })();
  }

  async function turn2ReasoningDetails(turn1Messages: ModelMessage[]) {
    await generateText({
      model,
      messages: [
        ...TURN_1_MESSAGES,
        ...turn1Messages,
        { role: 'user', content: 'How are you?' },
      ],
    });

    const body = await server.calls[1]!.requestBodyJson;
    const assistants = body.messages.filter(
      (message: { role: string }) => message.role === 'assistant',
    );
    expect(assistants).toHaveLength(1);
    return assistants[0].reasoning_details as ReasoningDetailUnion[];
  }

  function expectExactlyOnce(
    actual: ReasoningDetailUnion[],
    expected: ReasoningDetailUnion[],
  ) {
    expect(actual).toStrictEqual(expected);
    for (const detail of expected) {
      expect(
        actual.filter(
          (d) => deterministicStringify(d) === deterministicStringify(detail),
        ),
      ).toHaveLength(1);
    }
  }

  it.each(SCENARIOS)('UI message stream: replays $label exactly once', async ({
    deltas,
    finishReason,
    expected,
  }) => {
    serveTurn1(deltas, finishReason);

    const result = streamText({ model, messages: TURN_1_MESSAGES, tools });

    // Serialize each UI chunk as it arrives, as a real wire would.
    const wireStream = result.toUIMessageStream().pipeThrough(
      new TransformStream<UIMessageChunk, UIMessageChunk>({
        transform(uiChunk, controller) {
          controller.enqueue(JSON.parse(JSON.stringify(uiChunk)));
        },
      }),
    );

    let uiMessage: UIMessage | undefined;
    for await (const message of readUIMessageStream({
      stream: wireStream,
    })) {
      uiMessage = JSON.parse(JSON.stringify(message));
    }

    const turn1Messages = await convertToModelMessages([uiMessage!]);
    const assistantMessages = turn1Messages.filter(
      (m) => m.role === 'assistant',
    );
    expect(assistantMessages).toHaveLength(1);

    expectExactlyOnce(await turn2ReasoningDetails(turn1Messages), expected);
  });

  it.each(SCENARIOS)('response.messages: replays $label exactly once', async ({
    deltas,
    finishReason,
    expected,
  }) => {
    serveTurn1(deltas, finishReason);

    const result = streamText({ model, messages: TURN_1_MESSAGES, tools });
    const { messages } = await result.response;

    // Persist the messages (e.g. to a database) before the next turn.
    const persisted: ModelMessage[] = JSON.parse(JSON.stringify(messages));

    expectExactlyOnce(await turn2ReasoningDetails(persisted), expected);
  });
});
