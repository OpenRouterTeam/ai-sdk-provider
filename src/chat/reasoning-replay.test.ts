import type { LanguageModelV4Prompt } from '@ai-sdk/provider';

import { generateText, streamText } from 'ai';
import { describe, expect, it } from 'vitest';
import { createOpenRouter } from '../provider';
import { convertToOpenRouterChatMessages } from './convert-to-openrouter-chat-messages';
import { createReasoningReplayFilter } from './reasoning-replay';

const OPENAI_DETAILS = [
  {
    type: 'reasoning.summary',
    summary: 'Checking weather.',
    format: 'openai-responses-v1',
    index: 0,
  },
  {
    type: 'reasoning.encrypted',
    data: 'gAAAA-openai-blob',
    id: 'rs_123',
    format: 'openai-responses-v1',
    index: 1,
  },
];

const PROMPT: LanguageModelV4Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'Weather?' }] },
  {
    role: 'assistant',
    content: [
      { type: 'reasoning', text: 'Checking weather.' },
      { type: 'text', text: 'Sunny.' },
    ],
    providerOptions: {
      openrouter: { reasoning_details: OPENAI_DETAILS as never },
    },
  },
  { role: 'user', content: [{ type: 'text', text: 'Thanks' }] },
];

const assistantOf = (
  modelIds: string[],
  mode?: 'all' | 'same-family' | 'none',
) =>
  convertToOpenRouterChatMessages(PROMPT, {
    modelIds,
    reasoningReplay: mode,
  })[1] as unknown as Record<string, unknown>;

describe('reasoningReplay', () => {
  it('defaults to replaying everything (current behaviour)', () => {
    const msg = assistantOf(['deepseek/deepseek-v4-pro']);
    expect(msg.reasoning_details).toEqual(OPENAI_DETAILS);
    expect(msg.reasoning).toBe('Checking weather.');
  });

  it('same-family drops OpenAI details when targeting DeepSeek', () => {
    const msg = assistantOf(['deepseek/deepseek-v4-pro'], 'same-family');
    expect(msg.reasoning_details).toEqual([]);
    expect(msg.reasoning).toBeUndefined();
  });

  it('same-family keeps OpenAI details when targeting another OpenAI model', () => {
    const msg = assistantOf(['openai/gpt-5.5-mini'], 'same-family');
    expect(msg.reasoning_details).toEqual(OPENAI_DETAILS);
  });

  it('same-family keeps details if any fallback model shares the family', () => {
    const msg = assistantOf(
      ['deepseek/deepseek-v4-pro', 'openai/gpt-5.5'],
      'same-family',
    );
    expect(msg.reasoning_details).toEqual(OPENAI_DETAILS);
  });

  it('same-family does not filter for router slugs', () => {
    const msg = assistantOf(['openrouter/auto'], 'same-family');
    expect(msg.reasoning_details).toEqual(OPENAI_DETAILS);
  });

  it('same-family keeps provider-agnostic (unknown format) details', () => {
    const result = convertToOpenRouterChatMessages(
      [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'x' }],
          providerOptions: {
            openrouter: {
              reasoning_details: [
                { type: 'reasoning.text', text: 'plain', format: 'unknown' },
              ] as never,
            },
          },
        },
      ],
      { modelIds: ['openai/gpt-5.5'], reasoningReplay: 'same-family' },
    );
    expect(
      (result[0] as unknown as Record<string, unknown>).reasoning_details,
    ).toEqual([{ type: 'reasoning.text', text: 'plain', format: 'unknown' }]);
  });

  it('none strips reasoning and reasoning_details entirely', () => {
    const msg = assistantOf(['openai/gpt-5.5'], 'none');
    expect(msg.reasoning_details).toBeUndefined();
    expect(msg.reasoning).toBeUndefined();
  });

  it('same-family resolves ~author/model-latest aliases', () => {
    const msg = assistantOf(['~openai/gpt-latest'], 'same-family');
    expect(msg.reasoning_details).toEqual(OPENAI_DETAILS);
  });

  it('none ignores the target model entirely', () => {
    const msg = assistantOf(['openrouter/auto'], 'none');
    expect(msg.reasoning_details).toBeUndefined();
  });
});

describe('createReasoningReplayFilter', () => {
  const detail = (format: string) =>
    ({ type: 'reasoning.encrypted', data: 'x', format }) as never;

  it.each([
    ['openai/gpt-5.5', 'bedrock-openai-responses-v1', true],
    ['x-ai/grok-4.6', 'bedrock-xai-responses-v1', true],
    ['meta/muse-spark', 'meta-responses-v1', true],
    ['meta-llama/llama-4-maverick', 'meta-responses-v1', false],
    ['anthropic/claude-sonnet-4.6', 'bedrock-openai-responses-v1', false],
    ['deepseek/deepseek-v4-pro', 'anthropic-claude-v1', false],
    ['deepseek/deepseek-v4-pro', 'google-gemini-v1', false],
    ['deepseek/deepseek-v4-pro', 'some-future-provider-v1', true],
  ])('%s with %s -> keep=%s', (modelId, format, keep) => {
    const filter = createReasoningReplayFilter({
      mode: 'same-family',
      modelIds: [modelId],
    });
    expect(filter?.(detail(format))).toBe(keep);
  });

  it.each([
    'all',
    'none',
    undefined,
  ] as const)('returns no filter for mode %s', (mode) => {
    expect(
      createReasoningReplayFilter({ mode, modelIds: ['openai/gpt-5.5'] }),
    ).toBeUndefined();
  });
});

describe('reasoningReplay request plumbing', () => {
  const MESSAGES = [
    { role: 'user' as const, content: 'Weather?' },
    {
      role: 'assistant' as const,
      content: [{ type: 'text' as const, text: 'Sunny.' }],
      providerOptions: {
        openrouter: { reasoning_details: OPENAI_DETAILS },
      },
    },
    { role: 'user' as const, content: 'Thanks' },
  ];

  const createCapturingProvider = (stream = false) => {
    const bodies: Array<Record<string, unknown>> = [];
    const provider = createOpenRouter({
      apiKey: 'test',
      fetch: (async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)));
        if (stream) {
          return new Response(
            [
              `data: ${JSON.stringify({
                id: 'gen-1',
                model: 'deepseek/deepseek-v4-pro',
                choices: [
                  {
                    index: 0,
                    delta: { role: 'assistant', content: 'ok' },
                    finish_reason: 'stop',
                  },
                ],
              })}\n\n`,
              'data: [DONE]\n\n',
            ].join(''),
            { headers: { 'content-type': 'text/event-stream' } },
          );
        }
        return new Response(
          JSON.stringify({
            id: 'gen-1',
            model: 'deepseek/deepseek-v4-pro',
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: 'ok' },
                finish_reason: 'stop',
              },
            ],
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      }) as unknown as typeof fetch,
    });
    return { provider, bodies };
  };

  it('is read from call-level providerOptions and not leaked into the body (generate)', async () => {
    const { provider, bodies } = createCapturingProvider();
    await generateText({
      model: provider('deepseek/deepseek-v4-pro'),
      messages: MESSAGES,
      providerOptions: { openrouter: { reasoningReplay: 'same-family' } },
    });

    expect(bodies[0]).not.toHaveProperty('reasoningReplay');
    const messages = bodies[0]!.messages as Array<Record<string, unknown>>;
    expect(messages[1]?.reasoning_details).toEqual([]);
  });

  it('is read from call-level providerOptions and not leaked into the body (stream)', async () => {
    const { provider, bodies } = createCapturingProvider(true);
    const result = streamText({
      model: provider('deepseek/deepseek-v4-pro'),
      messages: MESSAGES,
      providerOptions: { openrouter: { reasoningReplay: 'same-family' } },
    });
    await result.consumeStream();

    expect(bodies[0]).not.toHaveProperty('reasoningReplay');
    const messages = bodies[0]!.messages as Array<Record<string, unknown>>;
    expect(messages[1]?.reasoning_details).toEqual([]);
  });

  it('is read from model settings and not leaked into the body', async () => {
    const { provider, bodies } = createCapturingProvider();
    await generateText({
      model: provider.chat('deepseek/deepseek-v4-pro', {
        reasoningReplay: 'none',
      }),
      messages: MESSAGES,
    });

    expect(bodies[0]).not.toHaveProperty('reasoningReplay');
    const messages = bodies[0]!.messages as Array<Record<string, unknown>>;
    expect(messages[1]).not.toHaveProperty('reasoning_details');
  });

  it('call-level models fallbacks are taken into account', async () => {
    const { provider, bodies } = createCapturingProvider();
    await generateText({
      model: provider('deepseek/deepseek-v4-pro'),
      messages: MESSAGES,
      providerOptions: {
        openrouter: {
          reasoningReplay: 'same-family',
          models: ['openai/gpt-5.5'],
        },
      },
    });

    const messages = bodies[0]!.messages as Array<Record<string, unknown>>;
    expect(messages[1]?.reasoning_details).toEqual(OPENAI_DETAILS);
  });

  it('is not leaked into completion model request bodies', async () => {
    const { provider, bodies } = createCapturingProvider();
    await generateText({
      model: provider.completion('deepseek/deepseek-v4-pro'),
      prompt: 'Hello',
      providerOptions: { openrouter: { reasoningReplay: 'same-family' } },
    }).catch(() => undefined);

    expect(bodies[0]).toBeDefined();
    expect(bodies[0]).not.toHaveProperty('reasoningReplay');
  });
});
