import type { LanguageModelV1Prompt } from '@ai-sdk/provider';

import {
  convertReadableStreamToArray,
  JsonTestServer,
  StreamingTestServer,
} from '@ai-sdk/provider-utils/test';

import { mapOpenRouterCompletionLogProbs } from './map-openrouter-completion-logprobs';
import { createOpenRouter } from './openrouter-provider';

const TEST_PROMPT: LanguageModelV1Prompt = [
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
  const server = new JsonTestServer('https://openrouter.ai/api/v1/completions');

  server.setupTestEnvironment();

  function prepareJsonResponse({
    content = '',
    usage = {
      prompt_tokens: 4,
      total_tokens: 34,
      completion_tokens: 30,
    },
    logprobs = null,
    finish_reason = 'stop',
  }: {
    content?: string;
    usage?: {
      prompt_tokens: number;
      total_tokens: number;
      completion_tokens: number;
    };
    logprobs?: {
      tokens: string[];
      token_logprobs: number[];
      top_logprobs: Record<string, number>[];
    } | null;
    finish_reason?: string;
  }) {
    server.responseBodyJson = {
      id: 'cmpl-96cAM1v77r4jXa4qb2NSmRREV5oWB',
      object: 'text_completion',
      created: 1711363706,
      model: 'openai/gpt-3.5-turbo-instruct',
      choices: [
        {
          text: content,
          index: 0,
          logprobs,
          finish_reason,
        },
      ],
      usage,
    };
  }

  it('should extract text response', async () => {
    prepareJsonResponse({ content: 'Hello, World!' });

    const { text } = await model.doGenerate({
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: TEST_PROMPT,
    });

    expect(text).toStrictEqual('Hello, World!');
  });

  it('should extract usage', async () => {
    prepareJsonResponse({
      content: '',
      usage: { prompt_tokens: 20, total_tokens: 25, completion_tokens: 5 },
    });

    const { usage } = await model.doGenerate({
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: TEST_PROMPT,
    });

    expect(usage).toStrictEqual({
      promptTokens: 20,
      completionTokens: 5,
    });
  });

  it('should extract logprobs', async () => {
    prepareJsonResponse({ logprobs: TEST_LOGPROBS });

    const provider = createOpenRouter({ apiKey: 'test-api-key' });

    const response = await provider
      .completion('openai/gpt-3.5-turbo', { logprobs: 1 })
      .doGenerate({
        inputFormat: 'prompt',
        mode: { type: 'regular' },
        prompt: TEST_PROMPT,
      });
    expect(response.logprobs).toStrictEqual(
      mapOpenRouterCompletionLogProbs(TEST_LOGPROBS),
    );
  });

  it('should extract finish reason', async () => {
    prepareJsonResponse({
      content: '',
      finish_reason: 'stop',
    });

    const { finishReason } = await provider
      .completion('openai/gpt-3.5-turbo-instruct')
      .doGenerate({
        inputFormat: 'prompt',
        mode: { type: 'regular' },
        prompt: TEST_PROMPT,
      });

    expect(finishReason).toStrictEqual('stop');
  });

  it('should support unknown finish reason', async () => {
    prepareJsonResponse({
      content: '',
      finish_reason: 'eos',
    });

    const { finishReason } = await provider
      .completion('openai/gpt-3.5-turbo-instruct')
      .doGenerate({
        inputFormat: 'prompt',
        mode: { type: 'regular' },
        prompt: TEST_PROMPT,
      });

    expect(finishReason).toStrictEqual('unknown');
  });

  it('should expose the raw response headers', async () => {
    prepareJsonResponse({ content: '' });

    server.responseHeaders = {
      'test-header': 'test-value',
    };

    const { rawResponse } = await model.doGenerate({
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: TEST_PROMPT,
    });

    expect(rawResponse?.headers).toStrictEqual({
      // default headers:
      'content-length': '273',
      'content-type': 'application/json',

      // custom header
      'test-header': 'test-value',
    });
  });

  it('should pass the model and the prompt', async () => {
    prepareJsonResponse({ content: '' });

    await model.doGenerate({
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: TEST_PROMPT,
    });

    expect(await server.getRequestBodyJson()).toStrictEqual({
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
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: TEST_PROMPT,
    });

    expect(await server.getRequestBodyJson()).toStrictEqual({
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
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: TEST_PROMPT,
      headers: {
        'Custom-Request-Header': 'request-header-value',
      },
    });

    const requestHeaders = await server.getRequestHeaders();

    expect(requestHeaders).toStrictEqual({
      authorization: 'Bearer test-api-key',
      'content-type': 'application/json',
      'custom-provider-header': 'provider-header-value',
      'custom-request-header': 'request-header-value',
    });
  });
});

describe('doStream', () => {
  const server = new StreamingTestServer(
    'https://openrouter.ai/api/v1/completions',
  );

  server.setupTestEnvironment();

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
    };
    logprobs?: {
      tokens: string[];
      token_logprobs: number[];
      top_logprobs: Record<string, number>[];
    } | null;
    finish_reason?: string;
  }) {
    server.responseChunks = [
      ...content.map((text) => {
        return (
          `data: {"id":"cmpl-96c64EdfhOw8pjFFgVpLuT8k2MtdT","object":"text_completion","created":1711363440,` +
          `"choices":[{"text":"${text}","index":0,"logprobs":null,"finish_reason":null}],"model":"openai/gpt-3.5-turbo-instruct"}\n\n`
        );
      }),
      `data: {"id":"cmpl-96c3yLQE1TtZCd6n6OILVmzev8M8H","object":"text_completion","created":1711363310,` +
        `"choices":[{"text":"","index":0,"logprobs":${JSON.stringify(
          logprobs,
        )},"finish_reason":"${finish_reason}"}],"model":"openai/gpt-3.5-turbo-instruct"}\n\n`,
      `data: {"id":"cmpl-96c3yLQE1TtZCd6n6OILVmzev8M8H","object":"text_completion","created":1711363310,` +
        `"model":"openai/gpt-3.5-turbo-instruct","usage":${JSON.stringify(
          usage,
        )},"choices":[]}\n\n`,
      'data: [DONE]\n\n',
    ];
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
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: TEST_PROMPT,
    });

    // note: space moved to last chunk bc of trimming
    expect(await convertReadableStreamToArray(stream)).toStrictEqual([
      { type: 'text-delta', textDelta: 'Hello' },
      { type: 'text-delta', textDelta: ', ' },
      { type: 'text-delta', textDelta: 'World!' },
      { type: 'text-delta', textDelta: '' },
      {
        type: 'finish',
        finishReason: 'stop',
        logprobs: mapOpenRouterCompletionLogProbs(TEST_LOGPROBS),
        usage: { promptTokens: 10, completionTokens: 362 },
      },
    ]);
  });

  it('should handle error stream parts', async () => {
    server.responseChunks = [
      `data: {"error":{"message": "The server had an error processing your request. Sorry about that! You can retry your request, or contact us through our ` +
        `help center at help.openrouter.com if you keep seeing this error.","type":"server_error","param":null,"code":null}}\n\n`,
      'data: [DONE]\n\n',
    ];

    const { stream } = await model.doStream({
      inputFormat: 'prompt',
      mode: { type: 'regular' },
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
        finishReason: 'error',
        logprobs: undefined,
        type: 'finish',
        usage: {
          completionTokens: NaN,
          promptTokens: NaN,
        },
      },
    ]);
  });

  it('should handle unparsable stream parts', async () => {
    server.responseChunks = [`data: {unparsable}\n\n`, 'data: [DONE]\n\n'];

    const { stream } = await model.doStream({
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    expect(elements.length).toBe(2);
    expect(elements[0]?.type).toBe('error');
    expect(elements[1]).toStrictEqual({
      finishReason: 'error',
      logprobs: undefined,
      type: 'finish',
      usage: {
        completionTokens: NaN,
        promptTokens: NaN,
      },
    });
  });

  it('should expose the raw response headers', async () => {
    prepareStreamResponse({ content: [] });

    server.responseHeaders = {
      'test-header': 'test-value',
    };

    const { rawResponse } = await model.doStream({
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: TEST_PROMPT,
    });

    expect(rawResponse?.headers).toStrictEqual({
      // default headers:
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',

      // custom header
      'test-header': 'test-value',
    });
  });

  it('should pass the model and the prompt', async () => {
    prepareStreamResponse({ content: [] });

    await model.doStream({
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: TEST_PROMPT,
    });

    expect(await server.getRequestBodyJson()).toStrictEqual({
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
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: TEST_PROMPT,
      headers: {
        'Custom-Request-Header': 'request-header-value',
      },
    });

    const requestHeaders = await server.getRequestHeaders();

    expect(requestHeaders).toStrictEqual({
      authorization: 'Bearer test-api-key',
      'content-type': 'application/json',
      'custom-provider-header': 'provider-header-value',
      'custom-request-header': 'request-header-value',
    });
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
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: TEST_PROMPT,
    });

    const requestBody = await server.getRequestBodyJson();

    expect(requestBody).toHaveProperty('custom_field', 'custom_value');
    expect(requestBody).toHaveProperty(
      'providers.anthropic.custom_field',
      'custom_value',
    );
  });
});
