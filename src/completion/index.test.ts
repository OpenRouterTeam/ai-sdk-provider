import type {
  LanguageModelV3Prompt,
  LanguageModelV3StreamPart,
} from '@ai-sdk/provider';

import { convertReadableStreamToArray } from '@ai-sdk/provider-utils/test';
import { createTestServer } from '@ai-sdk/test-server';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { createOpenRouter } from '../provider';

vi.mock('@/src/version', () => ({
  VERSION: '0.0.0-test',
}));

const TEST_PROMPT: LanguageModelV3Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
];

const TEST_LOGPROBS = {
  tokens: [' ever', ' after', '.\n\n', 'The', ' end', '.'],
  token_logprobs: [
    -0.0664508, -0.014520033, -1.3820221, -0.7890417, -0.5323165, -0.10247037,
  ],
  top_logprobs: [
    {
      ' ever': -0.0664508,
    },
    {
      ' after': -0.014520033,
    },
    {
      '.\n\n': -1.3820221,
    },
    {
      The: -0.7890417,
    },
    {
      ' end': -0.5323165,
    },
    {
      '.': -0.10247037,
    },
  ] as Record<string, number>[],
};

const provider = createOpenRouter({
  apiKey: 'test-api-key',
  compatibility: 'strict',
});

const model = provider.completion('openai/gpt-3.5-turbo-instruct');

describe('doGenerate', () => {
  const server = createTestServer({
    'https://openrouter.ai/api/v1/completions': {
      response: { type: 'json-value', body: {} },
    },
  });

  beforeAll(() => server.server.start());
  afterEach(() => server.server.reset());
  afterAll(() => server.server.stop());

  function prepareJsonResponse({
    content = '',
    usage = {
      prompt_tokens: 4,
      total_tokens: 34,
      completion_tokens: 30,
    },
    logprobs = null,
    finish_reason = 'stop',
    provider,
  }: {
    content?: string;
    usage?: {
      prompt_tokens: number;
      total_tokens: number;
      completion_tokens: number;
      cost?: number;
      prompt_tokens_details?: {
        cached_tokens: number;
      };
      completion_tokens_details?: {
        reasoning_tokens: number;
      };
      cost_details?: {
        upstream_inference_cost: number;
      };
    };
    logprobs?: {
      tokens: string[];
      token_logprobs: number[];
      top_logprobs: Record<string, number>[];
    } | null;
    finish_reason?: string;
    provider?: string;
  }) {
    server.urls['https://openrouter.ai/api/v1/completions']!.response = {
      type: 'json-value',
      body: {
        id: 'cmpl-96cAM1v77r4jXa4qb2NSmRREV5oWB',
        object: 'text_completion',
        created: 1711363706,
        model: 'openai/gpt-3.5-turbo-instruct',
        provider,
        choices: [
          {
            text: content,
            index: 0,
            logprobs,
            finish_reason,
          },
        ],
        usage,
      },
    };
  }

  it('should extract text response', async () => {
    prepareJsonResponse({ content: 'Hello, World!' });

    const { content } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    const text = content[0]?.type === 'text' ? content[0].text : '';

    expect(text).toStrictEqual('Hello, World!');
  });

  it('should extract usage', async () => {
    prepareJsonResponse({
      content: '',
      usage: { prompt_tokens: 20, total_tokens: 25, completion_tokens: 5 },
    });

    const { usage } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(usage).toStrictEqual({
      inputTokens: {
        total: 20,
        noCache: undefined,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 5,
        text: undefined,
        reasoning: undefined,
      },
      raw: {
        prompt_tokens: 20,
        total_tokens: 25,
        completion_tokens: 5,
      },
    });
  });

  it('should return providerMetadata with usage and provider', async () => {
    prepareJsonResponse({
      content: 'Hello',
      usage: {
        prompt_tokens: 10,
        total_tokens: 20,
        completion_tokens: 10,
        cost: 0.0001,
      },
      provider: 'openai',
    });

    const { providerMetadata } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(providerMetadata).toStrictEqual({
      openrouter: {
        provider: 'openai',
        usage: {
          promptTokens: 10,
          completionTokens: 10,
          totalTokens: 20,
          cost: 0.0001,
        },
      },
    });
  });

  it('should omit cost from providerMetadata when undefined', async () => {
    prepareJsonResponse({
      content: 'Hello',
      usage: {
        prompt_tokens: 10,
        total_tokens: 20,
        completion_tokens: 10,
      },
      provider: 'google',
    });

    const { providerMetadata } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    const openrouterMetadata = providerMetadata?.openrouter as {
      provider?: string;
      usage?: { cost?: number };
    };

    expect(openrouterMetadata?.provider).toBe('google');
    expect(openrouterMetadata?.usage?.cost).toBeUndefined();
    expect('cost' in (openrouterMetadata?.usage ?? {})).toBe(false);
  });

  it('should include cost: 0 in providerMetadata when cost is zero', async () => {
    prepareJsonResponse({
      content: 'Hello',
      usage: {
        prompt_tokens: 10,
        total_tokens: 20,
        completion_tokens: 10,
        cost: 0,
      },
      provider: 'openai',
    });

    const { providerMetadata } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    const openrouterMetadata = providerMetadata?.openrouter as {
      usage?: { cost?: number };
    };

    expect(openrouterMetadata?.usage?.cost).toBe(0);
  });

  it('should default provider to empty string when not returned by API', async () => {
    prepareJsonResponse({
      content: 'Hello',
      usage: {
        prompt_tokens: 10,
        total_tokens: 20,
        completion_tokens: 10,
      },
    });

    const { providerMetadata } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    const openrouterMetadata = providerMetadata?.openrouter as {
      provider?: string;
    };

    expect(openrouterMetadata?.provider).toBe('');
  });

  it('should include token details in providerMetadata when provided', async () => {
    prepareJsonResponse({
      content: 'Hello',
      usage: {
        prompt_tokens: 100,
        total_tokens: 150,
        completion_tokens: 50,
        prompt_tokens_details: {
          cached_tokens: 80,
        },
        completion_tokens_details: {
          reasoning_tokens: 20,
        },
        cost_details: {
          upstream_inference_cost: 0.005,
        },
      },
      provider: 'anthropic',
    });

    const { providerMetadata } = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(providerMetadata).toStrictEqual({
      openrouter: {
        provider: 'anthropic',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          promptTokensDetails: {
            cachedTokens: 80,
          },
          completionTokensDetails: {
            reasoningTokens: 20,
          },
          costDetails: {
            upstreamInferenceCost: 0.005,
          },
        },
      },
    });
  });

  it('should extract logprobs', async () => {
    prepareJsonResponse({ logprobs: TEST_LOGPROBS });

    const provider = createOpenRouter({ apiKey: 'test-api-key' });

    await provider
      .completion('openai/gpt-3.5-turbo', { logprobs: 1 })
      .doGenerate({
        prompt: TEST_PROMPT,
      });
  });

  it('should extract finish reason', async () => {
    prepareJsonResponse({
      content: '',
      finish_reason: 'stop',
    });

    const { finishReason } = await provider
      .completion('openai/gpt-3.5-turbo-instruct')
      .doGenerate({
        prompt: TEST_PROMPT,
      });

    expect(finishReason).toStrictEqual({ unified: 'stop', raw: 'stop' });
  });

  it('should support unknown finish reason', async () => {
    prepareJsonResponse({
      content: '',
      finish_reason: 'eos',
    });

    const { finishReason } = await provider
      .completion('openai/gpt-3.5-turbo-instruct')
      .doGenerate({
        prompt: TEST_PROMPT,
      });

    expect(finishReason).toStrictEqual({ unified: 'other', raw: 'eos' });
  });

  it('should pass the model and the prompt', async () => {
    prepareJsonResponse({ content: '' });

    await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(await server.calls[0]!.requestBodyJson).toStrictEqual({
      model: 'openai/gpt-3.5-turbo-instruct',
      prompt: 'Hello',
    });
  });

  it('should pass the models array when provided', async () => {
    prepareJsonResponse({ content: '' });

    const customModel = provider.completion('openai/gpt-3.5-turbo-instruct', {
      models: ['openai/gpt-4', 'anthropic/claude-2'],
    });

    await customModel.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(await server.calls[0]!.requestBodyJson).toStrictEqual({
      model: 'openai/gpt-3.5-turbo-instruct',
      models: ['openai/gpt-4', 'anthropic/claude-2'],
      prompt: 'Hello',
    });
  });

  it('should pass headers', async () => {
    prepareJsonResponse({ content: '' });

    const provider = createOpenRouter({
      apiKey: 'test-api-key',
      headers: {
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider.completion('openai/gpt-3.5-turbo-instruct').doGenerate({
      prompt: TEST_PROMPT,
      headers: {
        'Custom-Request-Header': 'request-header-value',
      },
    });

    const call = server.calls[0]!;

    expect(call.requestHeaders).toMatchObject({
      authorization: 'Bearer test-api-key',
      'content-type': 'application/json',
      'custom-provider-header': 'provider-header-value',
      'custom-request-header': 'request-header-value',
    });
    expect(call.requestUserAgent).toContain('ai-sdk/openrouter/0.0.0-test');
  });
});

describe('doStream', () => {
  const server = createTestServer({
    'https://openrouter.ai/api/v1/completions': {
      response: { type: 'stream-chunks', chunks: [] },
    },
  });

  beforeAll(() => server.server.start());
  afterEach(() => server.server.reset());
  afterAll(() => server.server.stop());

  function prepareStreamResponse({
    content,
    finish_reason = 'stop',
    usage = {
      prompt_tokens: 10,
      total_tokens: 372,
      completion_tokens: 362,
    },
    logprobs = null,
  }: {
    content: string[];
    usage?: {
      prompt_tokens: number;
      total_tokens: number;
      completion_tokens: number;
      prompt_tokens_details?: {
        cached_tokens: number;
      };
      completion_tokens_details?: {
        reasoning_tokens: number;
      };
      cost?: number;
      cost_details?: {
        upstream_inference_cost: number;
      };
    };
    logprobs?: {
      tokens: string[];
      token_logprobs: number[];
      top_logprobs: Record<string, number>[];
    } | null;
    finish_reason?: string;
  }) {
    server.urls['https://openrouter.ai/api/v1/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        ...content.map((text) => {
          return `data: {"id":"cmpl-96c64EdfhOw8pjFFgVpLuT8k2MtdT","object":"text_completion","created":1711363440,"choices":[{"text":"${text}","index":0,"logprobs":null,"finish_reason":null}],"model":"openai/gpt-3.5-turbo-instruct"}\n\n`;
        }),
        `data: {"id":"cmpl-96c3yLQE1TtZCd6n6OILVmzev8M8H","object":"text_completion","created":1711363310,"choices":[{"text":"","index":0,"logprobs":${JSON.stringify(
          logprobs,
        )},"finish_reason":"${finish_reason}"}],"model":"openai/gpt-3.5-turbo-instruct"}\n\n`,
        `data: {"id":"cmpl-96c3yLQE1TtZCd6n6OILVmzev8M8H","object":"text_completion","created":1711363310,"model":"openai/gpt-3.5-turbo-instruct","usage":${JSON.stringify(
          usage,
        )},"choices":[]}\n\n`,
        'data: [DONE]\n\n',
      ],
    };
  }

  it('should stream text deltas', async () => {
    prepareStreamResponse({
      content: ['Hello', ', ', 'World!'],
      finish_reason: 'stop',
      usage: {
        prompt_tokens: 10,
        total_tokens: 372,
        completion_tokens: 362,
      },
      logprobs: TEST_LOGPROBS,
    });

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    // note: space moved to last chunk bc of trimming
    const elements = await convertReadableStreamToArray(stream);
    expect(elements).toStrictEqual([
      { type: 'text-delta', delta: 'Hello', id: expect.any(String) },
      { type: 'text-delta', delta: ', ', id: expect.any(String) },
      { type: 'text-delta', delta: 'World!', id: expect.any(String) },
      { type: 'text-delta', delta: '', id: expect.any(String) },
      {
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },
        providerMetadata: {
          openrouter: {
            usage: {
              promptTokens: 10,
              completionTokens: 362,
              totalTokens: 372,
            },
          },
        },
        usage: {
          inputTokens: {
            total: 10,
            noCache: undefined,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: 362,
            text: undefined,
            reasoning: undefined,
          },
          raw: {
            prompt_tokens: 10,
            completion_tokens: 362,
            total_tokens: 372,
          },
        },
      },
    ]);
  });

  it('should include upstream inference cost when provided', async () => {
    prepareStreamResponse({
      content: ['Hello'],
      usage: {
        prompt_tokens: 5,
        total_tokens: 15,
        completion_tokens: 10,
        cost_details: {
          upstream_inference_cost: 0.0036,
        },
      },
    });

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const elements = (await convertReadableStreamToArray(
      stream,
    )) as LanguageModelV3StreamPart[];
    const finishChunk = elements.find(
      (
        element,
      ): element is Extract<LanguageModelV3StreamPart, { type: 'finish' }> =>
        element.type === 'finish',
    );
    const openrouterUsage = (
      finishChunk?.providerMetadata?.openrouter as {
        usage?: {
          cost?: number;
          costDetails?: { upstreamInferenceCost: number };
        };
      }
    )?.usage;
    expect(openrouterUsage?.costDetails).toStrictEqual({
      upstreamInferenceCost: 0.0036,
    });
  });

  it('should handle both normal cost and upstream inference cost in finish metadata when both are provided', async () => {
    prepareStreamResponse({
      content: ['Hello'],
      usage: {
        prompt_tokens: 5,
        total_tokens: 15,
        completion_tokens: 10,
        cost: 0.0025,
        cost_details: {
          upstream_inference_cost: 0.0036,
        },
      },
    });

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const elements = (await convertReadableStreamToArray(
      stream,
    )) as LanguageModelV3StreamPart[];
    const finishChunk = elements.find(
      (
        element,
      ): element is Extract<LanguageModelV3StreamPart, { type: 'finish' }> =>
        element.type === 'finish',
    );
    const openrouterUsage = (
      finishChunk?.providerMetadata?.openrouter as {
        usage?: {
          cost?: number;
          costDetails?: { upstreamInferenceCost: number };
        };
      }
    )?.usage;
    expect(openrouterUsage?.costDetails).toStrictEqual({
      upstreamInferenceCost: 0.0036,
    });
    expect(openrouterUsage?.cost).toBe(0.0025);
  });

  it('should handle error stream parts', async () => {
    server.urls['https://openrouter.ai/api/v1/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"error":{"message": "The server had an error processing your request. Sorry about that! You can retry your request, or contact us through our ` +
          `help center at help.openrouter.com if you keep seeing this error.","type":"server_error","param":null,"code":null}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    expect(await convertReadableStreamToArray(stream)).toStrictEqual([
      {
        type: 'error',
        error: {
          message:
            'The server had an error processing your request. Sorry about that! ' +
            'You can retry your request, or contact us through our help center at ' +
            'help.openrouter.com if you keep seeing this error.',
          type: 'server_error',
          code: null,
          param: null,
        },
      },
      {
        finishReason: { unified: 'error', raw: undefined },
        providerMetadata: {
          openrouter: {
            usage: {},
          },
        },
        type: 'finish',
        usage: {
          inputTokens: {
            total: undefined,
            noCache: undefined,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: undefined,
            text: undefined,
            reasoning: undefined,
          },
          raw: undefined,
        },
      },
    ]);
  });

  it('should handle unparsable stream parts', async () => {
    server.urls['https://openrouter.ai/api/v1/completions']!.response = {
      type: 'stream-chunks',
      chunks: ['data: {unparsable}\n\n', 'data: [DONE]\n\n'],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    expect(elements.length).toBe(2);
    expect(elements[0]?.type).toBe('error');
    expect(elements[1]).toStrictEqual({
      finishReason: { unified: 'error', raw: undefined },
      providerMetadata: {
        openrouter: {
          usage: {},
        },
      },
      type: 'finish',
      usage: {
        inputTokens: {
          total: undefined,
          noCache: undefined,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: {
          total: undefined,
          text: undefined,
          reasoning: undefined,
        },
        raw: undefined,
      },
    });
  });

  it('should pass the model and the prompt', async () => {
    prepareStreamResponse({ content: [] });

    await model.doStream({
      prompt: TEST_PROMPT,
    });

    expect(await server.calls[0]!.requestBodyJson).toStrictEqual({
      stream: true,
      stream_options: { include_usage: true },
      model: 'openai/gpt-3.5-turbo-instruct',
      prompt: 'Hello',
    });
  });

  it('should pass headers', async () => {
    prepareStreamResponse({ content: [] });

    const provider = createOpenRouter({
      apiKey: 'test-api-key',
      headers: {
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider.completion('openai/gpt-3.5-turbo-instruct').doStream({
      prompt: TEST_PROMPT,
      headers: {
        'Custom-Request-Header': 'request-header-value',
      },
    });

    const call = server.calls[0]!;

    expect(call.requestHeaders).toMatchObject({
      authorization: 'Bearer test-api-key',
      'content-type': 'application/json',
      'custom-provider-header': 'provider-header-value',
      'custom-request-header': 'request-header-value',
    });
    expect(call.requestUserAgent).toContain('ai-sdk/openrouter/0.0.0-test');
  });

  it('should pass extra body', async () => {
    prepareStreamResponse({ content: [] });

    const provider = createOpenRouter({
      apiKey: 'test-api-key',
      extraBody: {
        custom_field: 'custom_value',
        providers: {
          anthropic: {
            custom_field: 'custom_value',
          },
        },
      },
    });

    await provider.completion('openai/gpt-4o').doStream({
      prompt: TEST_PROMPT,
    });

    const requestBody = await server.calls[0]!.requestBodyJson;

    expect(requestBody).toHaveProperty('custom_field', 'custom_value');
    expect(requestBody).toHaveProperty(
      'providers.anthropic.custom_field',
      'custom_value',
    );
  });
});

describe('includeRawChunks', () => {
  const server = createTestServer({
    'https://openrouter.ai/api/v1/completions': {
      response: { type: 'stream-chunks', chunks: [] },
    },
  });

  beforeAll(() => server.server.start());
  afterEach(() => server.server.reset());
  afterAll(() => server.server.stop());

  function prepareStreamResponse({ content }: { content: string[] }) {
    server.urls['https://openrouter.ai/api/v1/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        ...content.map(
          (text) =>
            `data: {"id":"cmpl-test","object":"text_completion","created":1711363440,"choices":[{"text":"${text}","index":0,"logprobs":null,"finish_reason":null}],"model":"openai/gpt-3.5-turbo-instruct"}\n\n`,
        ),
        `data: {"id":"cmpl-test","object":"text_completion","created":1711363310,"choices":[{"text":"","index":0,"logprobs":null,"finish_reason":"stop"}],"model":"openai/gpt-3.5-turbo-instruct"}\n\n`,
        `data: {"id":"cmpl-test","object":"text_completion","created":1711363310,"model":"openai/gpt-3.5-turbo-instruct","usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15},"choices":[]}\n\n`,
        'data: [DONE]\n\n',
      ],
    };
  }

  it('should emit raw chunks when includeRawChunks is true', async () => {
    prepareStreamResponse({ content: ['Hello'] });

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: true,
    });

    const elements = await convertReadableStreamToArray(stream);
    const rawChunks = elements.filter(
      (chunk): chunk is Extract<LanguageModelV3StreamPart, { type: 'raw' }> =>
        chunk.type === 'raw',
    );

    expect(rawChunks.length).toBeGreaterThan(0);
    expect(rawChunks[0]).toHaveProperty('rawValue');
    expect(rawChunks[0]!.rawValue).toHaveProperty('id', 'cmpl-test');
  });

  it('should not emit raw chunks when includeRawChunks is false', async () => {
    prepareStreamResponse({ content: ['Hello'] });

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
    });

    const elements = await convertReadableStreamToArray(stream);
    const rawChunks = elements.filter(
      (chunk): chunk is Extract<LanguageModelV3StreamPart, { type: 'raw' }> =>
        chunk.type === 'raw',
    );

    expect(rawChunks.length).toBe(0);
  });

  it('should not emit raw chunks when includeRawChunks is not specified', async () => {
    prepareStreamResponse({ content: ['Hello'] });

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);
    const rawChunks = elements.filter(
      (chunk): chunk is Extract<LanguageModelV3StreamPart, { type: 'raw' }> =>
        chunk.type === 'raw',
    );

    expect(rawChunks.length).toBe(0);
  });

  it('should emit raw chunks for each SSE event including usage chunk', async () => {
    prepareStreamResponse({ content: ['Hello', ' World'] });

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: true,
    });

    const elements = await convertReadableStreamToArray(stream);
    const rawChunks = elements.filter(
      (chunk): chunk is Extract<LanguageModelV3StreamPart, { type: 'raw' }> =>
        chunk.type === 'raw',
    );

    // Should have raw chunks for: Hello, World, finish_reason, usage
    expect(rawChunks.length).toBe(4);
  });

  it('should emit raw chunk even when parsing fails (for debugging malformed responses)', async () => {
    server.urls['https://openrouter.ai/api/v1/completions']!.response = {
      type: 'stream-chunks',
      chunks: ['data: {unparsable}\n\n', 'data: [DONE]\n\n'],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: true,
    });

    const elements = await convertReadableStreamToArray(stream);
    const rawChunks = elements.filter(
      (chunk): chunk is Extract<LanguageModelV3StreamPart, { type: 'raw' }> =>
        chunk.type === 'raw',
    );
    const errorChunks = elements.filter(
      (chunk): chunk is Extract<LanguageModelV3StreamPart, { type: 'error' }> =>
        chunk.type === 'error',
    );

    // Raw chunk is emitted before error handling, useful for debugging
    expect(rawChunks.length).toBe(1);
    expect(errorChunks.length).toBe(1);
  });
});
