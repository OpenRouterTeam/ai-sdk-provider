// Scenarios: #583 (split signed reasoning blocks), #547 (no undefined keys),
// interacting with tool calls (#575/#586) and multi-turn replay through `ai`.
import type { ModelMessage } from 'ai';

import { generateText, jsonSchema, stepCountIs, streamText, tool } from 'ai';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  chatChunk,
  chatCompletion,
  hasUndefinedProviderOptions,
  jsonResponse,
  mockProvider,
  sseResponse,
  USAGE,
} from './helpers';

const TEXT = 'reasoning.text';
const ENCRYPTED = 'reasoning.encrypted';
const SUMMARY = 'reasoning.summary';
const ANTHROPIC = 'anthropic-claude-v1';

const weatherTool = tool({
  description: 'Get the weather',
  inputSchema: jsonSchema<{ city: string }>({
    type: 'object',
    properties: { city: { type: 'string' } },
    required: ['city'],
  }),
  execute: async ({ city }) => ({ city, forecast: 'sunny' }),
});

const rd = (details: unknown[]) => ({ reasoning_details: details });

let previousLogWarnings: unknown;
beforeAll(() => {
  previousLogWarnings = (globalThis as any).AI_SDK_LOG_WARNINGS;
  (globalThis as any).AI_SDK_LOG_WARNINGS = false;
});
afterAll(() => {
  (globalThis as any).AI_SDK_LOG_WARNINGS = previousLogWarnings;
});

function finishDetails(metadata: any) {
  return metadata?.openrouter?.reasoning_details as any[] | undefined;
}

function assistantMessage(body: any) {
  return body.messages.find((m: any) => m.role === 'assistant');
}

describe('two signed reasoning blocks -> tool call -> replay (#583)', () => {
  const turn1 = [
    chatChunk({
      role: 'assistant',
      ...rd([{ type: TEXT, text: 'First ', format: ANTHROPIC, index: 0 }]),
    }),
    chatChunk(rd([{ type: TEXT, text: 'block.', index: 0 }])),
    chatChunk(rd([{ type: TEXT, text: '', signature: 'sig-1', index: 0 }])),
    chatChunk(
      rd([{ type: TEXT, text: 'Second block.', format: ANTHROPIC, index: 1 }]),
    ),
    chatChunk(rd([{ type: TEXT, signature: 'sig-2', index: 1 }])),
    chatChunk({
      tool_calls: [
        {
          index: 0,
          id: 'call_1',
          type: 'function',
          function: { name: 'weather', arguments: '' },
        },
      ],
    }),
    chatChunk({
      tool_calls: [{ index: 0, function: { arguments: '{"city":' } }],
    }),
    chatChunk({
      tool_calls: [{ index: 0, function: { arguments: '"Paris"}' } }],
    }),
    chatChunk({}, { finish_reason: 'tool_calls' }),
    chatChunk(null, { noChoices: true, usage: USAGE }),
  ];
  const turn2 = [
    chatChunk({ role: 'assistant', content: 'It is sunny.' }),
    chatChunk({}, { finish_reason: 'stop' }),
    chatChunk(null, { noChoices: true, usage: USAGE }),
  ];

  async function run() {
    const { provider, calls } = mockProvider([
      () => sseResponse(turn1),
      () => sseResponse(turn2),
    ]);
    const result = streamText({
      model: provider('anthropic/claude-sonnet-4.5'),
      prompt: 'Weather in Paris?',
      tools: { weather: weatherTool },
      stopWhen: stepCountIs(2),
    });
    const text = await result.text;
    const steps = await result.steps;
    return { calls, text, steps };
  }

  it('keeps the two signed blocks separate in the step metadata', async () => {
    const { steps } = await run();
    const details = finishDetails(steps[0]?.providerMetadata);
    expect(details).toEqual([
      {
        type: TEXT,
        text: 'First block.',
        format: ANTHROPIC,
        index: 0,
        signature: 'sig-1',
      },
      {
        type: TEXT,
        text: 'Second block.',
        format: ANTHROPIC,
        index: 1,
        signature: 'sig-2',
      },
    ]);
  });

  it('executes the tool with arguments streamed over several deltas', async () => {
    const { steps, text } = await run();
    expect(steps[0]?.toolCalls).toHaveLength(1);
    expect(steps[0]?.toolCalls[0]?.input).toEqual({ city: 'Paris' });
    expect(steps[0]?.toolResults[0]?.output).toEqual({
      city: 'Paris',
      forecast: 'sunny',
    });
    expect(steps[0]?.finishReason).toBe('tool-calls');
    expect(text).toBe('It is sunny.');
  });

  it('replays both signed blocks on the second turn', async () => {
    const { calls } = await run();
    expect(calls).toHaveLength(2);
    const assistant = assistantMessage(calls[1]?.body);
    expect(assistant.reasoning_details).toEqual([
      {
        type: TEXT,
        text: 'First block.',
        format: ANTHROPIC,
        index: 0,
        signature: 'sig-1',
      },
      {
        type: TEXT,
        text: 'Second block.',
        format: ANTHROPIC,
        index: 1,
        signature: 'sig-2',
      },
    ]);
    expect(assistant.tool_calls).toEqual([
      {
        id: 'call_1',
        type: 'function',
        function: { name: 'weather', arguments: '{"city":"Paris"}' },
      },
    ]);
    expect(assistant.reasoning).toBe('First block.Second block.');
    const toolMessage = calls[1]?.body.messages.find(
      (m: any) => m.role === 'tool',
    );
    expect(toolMessage).toMatchObject({
      tool_call_id: 'call_1',
      name: 'weather',
    });
    expect(JSON.parse(toolMessage.content)).toEqual({
      city: 'Paris',
      forecast: 'sunny',
    });
  });

  it('response.messages replay through a fresh generateText call stays valid', async () => {
    const { steps } = await run();
    const messages: ModelMessage[] = [
      { role: 'user', content: 'Weather in Paris?' },
      ...(steps[0]?.response.messages ?? []),
      { role: 'user', content: 'And tomorrow?' },
    ];
    expect(hasUndefinedProviderOptions(messages)).toBe(false);
    const { provider, calls } = mockProvider(() =>
      jsonResponse(chatCompletion({ content: 'Also sunny.' })),
    );
    const result = await generateText({
      model: provider('anthropic/claude-sonnet-4.5'),
      messages,
      tools: { weather: weatherTool },
    });
    expect(result.text).toBe('Also sunny.');
    const assistant = assistantMessage(calls[0]?.body);
    expect(assistant.reasoning_details.map((d: any) => d.signature)).toEqual([
      'sig-1',
      'sig-2',
    ]);
  });
});

describe('single signed block with a signature-only final delta', () => {
  it('merges text and attaches the late signature (before text starts)', async () => {
    const { provider } = mockProvider(() =>
      sseResponse([
        chatChunk({
          role: 'assistant',
          ...rd([{ type: TEXT, text: 'Let me ', format: ANTHROPIC }]),
        }),
        chatChunk(rd([{ type: TEXT, text: 'think.' }])),
        chatChunk(rd([{ type: TEXT, signature: 'sig-only' }])),
        chatChunk({ content: 'Answer.' }),
        chatChunk({}, { finish_reason: 'stop' }),
        chatChunk(null, { noChoices: true, usage: USAGE }),
      ]),
    );
    const result = streamText({
      model: provider('anthropic/claude-sonnet-4.5'),
      prompt: 'q',
    });
    expect(await result.text).toBe('Answer.');
    expect(await result.reasoningText).toBe('Let me think.');
    const details = finishDetails(await result.providerMetadata);
    expect(details).toEqual([
      {
        type: TEXT,
        text: 'Let me think.',
        format: ANTHROPIC,
        signature: 'sig-only',
      },
    ]);
    const reasoning = (await result.reasoning)[0];
    expect(
      (reasoning?.providerMetadata as any)?.openrouter?.reasoning_details,
    ).toEqual(details);
  });

  it('accumulates a signature-only delta that arrives after text started', async () => {
    const { provider } = mockProvider(() =>
      sseResponse([
        chatChunk({
          role: 'assistant',
          ...rd([{ type: TEXT, text: 'Hmm.', format: ANTHROPIC }]),
        }),
        chatChunk({ content: 'Answer.' }),
        chatChunk(rd([{ type: TEXT, signature: 'late-sig' }])),
        chatChunk({}, { finish_reason: 'stop' }),
      ]),
    );
    const result = streamText({
      model: provider('anthropic/claude-sonnet-4.5'),
      prompt: 'q',
    });
    expect(await result.text).toBe('Answer.');
    // One visible reasoning block. An empty carrier part for late details is
    // allowed, so only count reasoning parts that have text.
    expect(
      (await result.reasoning).filter((part) => part.text !== ''),
    ).toHaveLength(1);
    expect(finishDetails(await result.providerMetadata)).toEqual([
      { type: TEXT, text: 'Hmm.', format: ANTHROPIC, signature: 'late-sig' },
    ]);
  });

  it('replays the single signed block on the next turn', async () => {
    const { provider } = mockProvider(() =>
      sseResponse([
        chatChunk({
          role: 'assistant',
          ...rd([{ type: TEXT, text: 'Plan.', format: ANTHROPIC }]),
        }),
        chatChunk(rd([{ type: TEXT, signature: 'sig-p' }])),
        chatChunk({ content: 'Done.' }, { finish_reason: 'stop' }),
      ]),
    );
    const first = streamText({
      model: provider('anthropic/claude-sonnet-4.5'),
      prompt: 'q',
    });
    await first.consumeStream();
    const { messages } = await first.response;
    const next = mockProvider(() =>
      jsonResponse(chatCompletion({ content: 'ok' })),
    );
    await generateText({
      model: next.provider('anthropic/claude-sonnet-4.5'),
      messages: [
        { role: 'user', content: 'q' },
        ...messages,
        { role: 'user', content: 'more' },
      ],
    });
    const assistant = assistantMessage(next.calls[0]?.body);
    expect(assistant).toMatchObject({
      content: 'Done.',
      reasoning: 'Plan.',
      reasoning_details: [
        { type: TEXT, text: 'Plan.', format: ANTHROPIC, signature: 'sig-p' },
      ],
    });
  });
});

describe('unsigned reasoning blocks (GLM-like, #547)', () => {
  const glmStream = () =>
    sseResponse([
      chatChunk({
        role: 'assistant',
        content: '',
        ...rd([{ type: TEXT, text: 'think', format: 'unknown' }]),
      }),
      chatChunk(rd([{ type: TEXT, text: ' more' }])),
      chatChunk(rd([{ type: TEXT, text: ' and more' }])),
      chatChunk({ content: 'done' }),
      chatChunk({}, { finish_reason: 'stop' }),
      chatChunk(null, { noChoices: true, usage: USAGE }),
    ]);

  it('merges unsigned deltas into one detail without undefined keys', async () => {
    const { provider } = mockProvider(glmStream);
    const result = streamText({ model: provider('z-ai/glm-5.3'), prompt: 'q' });
    await result.consumeStream();
    const details = finishDetails(await result.providerMetadata);
    expect(details).toHaveLength(1);
    expect(details?.[0]).toEqual({
      type: TEXT,
      text: 'think more and more',
      format: 'unknown',
    });
    expect(Object.keys(details?.[0] ?? {})).not.toContain('signature');
    const { messages } = await result.response;
    expect(hasUndefinedProviderOptions(messages)).toBe(false);
  });

  it('response.messages from the GLM stream can be replayed into generateText', async () => {
    const { provider } = mockProvider(glmStream);
    const first = streamText({ model: provider('z-ai/glm-5.3'), prompt: 'q' });
    await first.consumeStream();
    const { messages } = await first.response;
    const next = mockProvider(() =>
      jsonResponse(chatCompletion({ content: 'ok' })),
    );
    const result = await generateText({
      model: next.provider('z-ai/glm-5.3'),
      messages: [
        { role: 'user', content: 'q' },
        ...messages,
        { role: 'user', content: 'again' },
      ],
    });
    expect(result.text).toBe('ok');
    const assistant = assistantMessage(next.calls[0]?.body);
    expect(assistant.reasoning_details).toEqual([
      { type: TEXT, text: 'think more and more', format: 'unknown' },
    ]);
  });

  it('unsigned multi-turn tool loop keeps one merged block (no undefined keys)', async () => {
    const { provider, calls } = mockProvider([
      () =>
        sseResponse([
          chatChunk({
            role: 'assistant',
            ...rd([{ type: TEXT, text: 'a', format: 'unknown' }]),
          }),
          chatChunk(rd([{ type: TEXT, text: 'b' }])),
          chatChunk({
            tool_calls: [
              {
                index: 0,
                id: 'c1',
                type: 'function',
                function: { name: 'weather', arguments: '{"city":"Oslo"}' },
              },
            ],
          }),
          chatChunk({}, { finish_reason: 'tool_calls' }),
        ]),
      () =>
        sseResponse([
          chatChunk({ content: 'Cold.' }, { finish_reason: 'stop' }),
        ]),
    ]);
    const result = streamText({
      model: provider('z-ai/glm-5.3'),
      prompt: 'q',
      tools: { weather: weatherTool },
      stopWhen: stepCountIs(2),
    });
    expect(await result.text).toBe('Cold.');
    const assistant = assistantMessage(calls[1]?.body);
    expect(assistant.reasoning_details).toEqual([
      { type: TEXT, text: 'ab', format: 'unknown' },
    ]);
  });
});

describe('encrypted + text reasoning mixes', () => {
  it('keeps signed text, encrypted blob and a later text block as three entries', async () => {
    const { provider } = mockProvider(() =>
      sseResponse([
        chatChunk({
          role: 'assistant',
          ...rd([{ type: TEXT, text: 'one', format: ANTHROPIC }]),
        }),
        chatChunk(rd([{ type: TEXT, signature: 's1' }])),
        chatChunk(
          rd([{ type: ENCRYPTED, data: 'REDACTED_BLOB', format: ANTHROPIC }]),
        ),
        chatChunk(rd([{ type: TEXT, text: 'two', format: ANTHROPIC }])),
        chatChunk(rd([{ type: TEXT, signature: 's2' }])),
        chatChunk({ content: 'final' }, { finish_reason: 'stop' }),
      ]),
    );
    const result = streamText({
      model: provider('anthropic/claude-opus-4.1'),
      prompt: 'q',
    });
    expect(await result.text).toBe('final');
    expect(await result.reasoningText).toBe('onetwo');
    expect(finishDetails(await result.providerMetadata)).toEqual([
      { type: TEXT, text: 'one', format: ANTHROPIC, signature: 's1' },
      { type: ENCRYPTED, data: 'REDACTED_BLOB', format: ANTHROPIC },
      { type: TEXT, text: 'two', format: ANTHROPIC, signature: 's2' },
    ]);
  });

  it('summary deltas merge and encrypted blobs stay separate (OpenAI-like)', async () => {
    const { provider } = mockProvider(() =>
      sseResponse([
        chatChunk({
          role: 'assistant',
          ...rd([
            {
              type: SUMMARY,
              summary: 'Sum',
              format: 'openai-responses-v1',
              index: 0,
            },
          ]),
        }),
        chatChunk(rd([{ type: SUMMARY, summary: 'mary', index: 0 }])),
        chatChunk(
          rd([
            {
              type: ENCRYPTED,
              data: 'enc-1',
              id: 'rs_1',
              format: 'openai-responses-v1',
              index: 0,
            },
          ]),
        ),
        chatChunk({ content: 'answer' }, { finish_reason: 'stop' }),
      ]),
    );
    const result = streamText({ model: provider('openai/gpt-5'), prompt: 'q' });
    expect(await result.reasoningText).toBe('Summary');
    expect(finishDetails(await result.providerMetadata)).toEqual([
      {
        type: SUMMARY,
        summary: 'Summary',
        format: 'openai-responses-v1',
        index: 0,
      },
      {
        type: ENCRYPTED,
        data: 'enc-1',
        id: 'rs_1',
        format: 'openai-responses-v1',
        index: 0,
      },
    ]);
  });

  it('Gemini-like text + encrypted + tool call with finish "stop" continues the loop', async () => {
    const { provider, calls } = mockProvider([
      () =>
        sseResponse([
          chatChunk({
            role: 'assistant',
            ...rd([
              { type: TEXT, text: 'thinking', format: 'google-gemini-v1' },
            ]),
          }),
          chatChunk(
            rd([
              {
                type: ENCRYPTED,
                data: 'thought-sig',
                format: 'google-gemini-v1',
              },
            ]),
          ),
          chatChunk({
            tool_calls: [
              {
                index: 0,
                id: 'g1',
                type: 'function',
                function: { name: 'weather', arguments: '{"city":"Rome"}' },
              },
            ],
          }),
          chatChunk({}, { finish_reason: 'stop' }),
        ]),
      () =>
        sseResponse([
          chatChunk({ content: 'Warm.' }, { finish_reason: 'stop' }),
        ]),
    ]);
    const result = streamText({
      model: provider('google/gemini-3-pro'),
      prompt: 'q',
      tools: { weather: weatherTool },
      stopWhen: stepCountIs(2),
    });
    expect(await result.text).toBe('Warm.');
    const steps = await result.steps;
    expect(steps[0]?.finishReason).toBe('tool-calls');
    const assistant = assistantMessage(calls[1]?.body);
    // Unsigned Gemini text is stripped on replay; the encrypted blob survives.
    expect(assistant.reasoning_details).toEqual([
      { type: ENCRYPTED, data: 'thought-sig', format: 'google-gemini-v1' },
    ]);
  });

  it('generateText exposes separately signed blocks as separate reasoning parts', async () => {
    const { provider } = mockProvider(() =>
      jsonResponse(
        chatCompletion({
          content: 'ok',
          reasoning_details: [
            { type: TEXT, text: 'A', signature: 'sa', format: ANTHROPIC },
            { type: ENCRYPTED, data: 'blob', format: ANTHROPIC },
            { type: TEXT, text: 'B', signature: 'sb', format: ANTHROPIC },
          ],
        }),
      ),
    );
    const result = await generateText({
      model: provider('anthropic/claude-opus-4.1'),
      prompt: 'q',
    });
    expect(result.reasoning.map((r) => ('text' in r ? r.text : null))).toEqual([
      'A',
      'B',
    ]);
    expect(finishDetails(result.providerMetadata)).toHaveLength(3);
  });
});
