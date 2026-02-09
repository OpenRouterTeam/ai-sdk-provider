import type {
  LanguageModelV3Prompt,
  LanguageModelV3StreamPart,
} from '@ai-sdk/provider';
import type { JSONSchema7 } from 'json-schema';
import type { ImageResponse } from '../schemas/image';
import type { ReasoningDetailUnion } from '../schemas/reasoning-details';

import { convertReadableStreamToArray } from '@ai-sdk/provider-utils/test';
import { createTestServer } from '@ai-sdk/test-server';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { createOpenRouter } from '../provider';
import { ReasoningDetailType } from '../schemas/reasoning-details';

vi.mock('@/src/version', () => ({
  VERSION: '0.0.0-test',
}));

const TEST_PROMPT: LanguageModelV3Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
];

const TEST_LOGPROBS = {
  content: [
    {
      token: 'Hello',
      logprob: -0.0009994634,
      top_logprobs: [
        {
          token: 'Hello',
          logprob: -0.0009994634,
        },
      ],
    },
    {
      token: '!',
      logprob: -0.13410144,
      top_logprobs: [
        {
          token: '!',
          logprob: -0.13410144,
        },
      ],
    },
    {
      token: ' How',
      logprob: -0.0009250381,
      top_logprobs: [
        {
          token: ' How',
          logprob: -0.0009250381,
        },
      ],
    },
    {
      token: ' can',
      logprob: -0.047709424,
      top_logprobs: [
        {
          token: ' can',
          logprob: -0.047709424,
        },
      ],
    },
    {
      token: ' I',
      logprob: -0.000009014684,
      top_logprobs: [
        {
          token: ' I',
          logprob: -0.000009014684,
        },
      ],
    },
    {
      token: ' assist',
      logprob: -0.009125131,
      top_logprobs: [
        {
          token: ' assist',
          logprob: -0.009125131,
        },
      ],
    },
    {
      token: ' you',
      logprob: -0.0000066306106,
      top_logprobs: [
        {
          token: ' you',
          logprob: -0.0000066306106,
        },
      ],
    },
    {
      token: ' today',
      logprob: -0.00011093382,
      top_logprobs: [
        {
          token: ' today',
          logprob: -0.00011093382,
        },
      ],
    },
    {
      token: '?',
      logprob: -0.00004596782,
      top_logprobs: [
        {
          token: '?',
          logprob: -0.00004596782,
        },
      ],
    },
  ],
};

const TEST_IMAGE_URL = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAIAAADwf7zUAAAAiXpUWHRSYXcgcHJvZmlsZSB0eXBlIGlwdGMAAAiZTYwxDgIxDAT7vOKekDjrtV1T0VHwgbtcIiEhgfh/QaDgmGlWW0w6X66n5fl6jNu9p+ULkapDENgzpj+Kl5aFfa6KnYWgSjZjGOiSYRxTY/v8KIijI==`;

const TEST_IMAGE_BASE64 = TEST_IMAGE_URL.split(',')[1]!;

const provider = createOpenRouter({
  apiKey: 'test-api-key',
  compatibility: 'strict',
});

const model = provider.chat('anthropic/claude-3.5-sonnet');

function isReasoningDeltaPart(part: LanguageModelV3StreamPart): part is Extract<
  LanguageModelV3StreamPart,
  {
    type: 'reasoning-delta';
  }
> {
  return part.type === 'reasoning-delta';
}

function isReasoningStartPart(part: LanguageModelV3StreamPart): part is Extract<
  LanguageModelV3StreamPart,
  {
    type: 'reasoning-start';
  }
> {
  return part.type === 'reasoning-start';
}

function isTextDeltaPart(part: LanguageModelV3StreamPart): part is Extract<
  LanguageModelV3StreamPart,
  {
    type: 'text-delta';
  }
> {
  return part.type === 'text-delta';
}

describe('doGenerate', () => {
  const server = createTestServer({
    'https://openrouter.ai/api/v1/chat/completions': {
      response: { type: 'json-value', body: {} },
    },
  });

  beforeAll(() => server.server.start());
  afterEach(() => server.server.reset());
  afterAll(() => server.server.stop());

  function prepareJsonResponse({
    content = '',
    reasoning,
    reasoning_details,
    images,
    tool_calls,
    usage = {
      prompt_tokens: 4,
      total_tokens: 34,
      completion_tokens: 30,
    },
    logprobs = null,
    finish_reason = 'stop',
  }: {
    content?: string;
    reasoning?: string;
    reasoning_details?: Array<ReasoningDetailUnion>;
    images?: Array<ImageResponse>;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments?: string };
    }>;
    usage?: {
      prompt_tokens: number;
      total_tokens: number;
      completion_tokens: number;
    };
    logprobs?: {
      content:
        | {
            token: string;
            logprob: number;
            top_logprobs: { token: string; logprob: number }[];
          }[]
        | null;
    } | null;
    finish_reason?: string;
  } = {}) {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'json-value',
      body: {
        id: 'chatcmpl-95ZTZkhr0mHNKqerQfiwkuox3PHAd',
        object: 'chat.completion',
        created: 1711115037,
        model: 'gpt-3.5-turbo-0125',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content,
              reasoning,
              reasoning_details,
              images,
              tool_calls,
            },
            logprobs,
            finish_reason,
          },
        ],
        usage,
        system_fingerprint: 'fp_3bc1b5746c',
      },
    };
  }

  it('should extract text response', async () => {
    prepareJsonResponse({ content: 'Hello, World!' });

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(result.content[0]).toStrictEqual({
      type: 'text',
      text: 'Hello, World!',
    });
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

  it('should extract logprobs', async () => {
    prepareJsonResponse({
      logprobs: TEST_LOGPROBS,
    });

    await provider.chat('openai/gpt-3.5-turbo', { logprobs: 1 }).doGenerate({
      prompt: TEST_PROMPT,
    });
  });

  it('should extract finish reason', async () => {
    prepareJsonResponse({
      content: '',
      finish_reason: 'stop',
    });

    const response = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(response.finishReason).toStrictEqual({
      unified: 'stop',
      raw: 'stop',
    });
  });

  it('should support unknown finish reason', async () => {
    prepareJsonResponse({
      content: '',
      finish_reason: 'eos',
    });

    const response = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(response.finishReason).toStrictEqual({
      unified: 'other',
      raw: 'eos',
    });
  });

  it('should extract reasoning content from reasoning field', async () => {
    prepareJsonResponse({
      content: 'Hello!',
      reasoning:
        'I need to think about this... The user said hello, so I should respond with a greeting.',
    });

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(result.content).toStrictEqual([
      {
        type: 'reasoning',
        text: 'I need to think about this... The user said hello, so I should respond with a greeting.',
      },
      {
        type: 'text',
        text: 'Hello!',
      },
    ]);
  });

  it('should extract reasoning content from reasoning_details', async () => {
    prepareJsonResponse({
      content: 'Hello!',
      reasoning_details: [
        {
          type: ReasoningDetailType.Text,
          text: 'Let me analyze this request...',
        },
        {
          type: ReasoningDetailType.Summary,
          summary: 'The user wants a greeting response.',
        },
      ],
    });

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(result.content).toStrictEqual([
      {
        type: 'reasoning',
        text: 'Let me analyze this request...',
        providerMetadata: {
          openrouter: {
            reasoning_details: [
              {
                type: 'reasoning.text',
                text: 'Let me analyze this request...',
              },
            ],
          },
        },
      },
      {
        type: 'reasoning',
        text: 'The user wants a greeting response.',
        providerMetadata: {
          openrouter: {
            reasoning_details: [
              {
                type: 'reasoning.summary',
                summary: 'The user wants a greeting response.',
              },
            ],
          },
        },
      },
      {
        type: 'text',
        text: 'Hello!',
      },
    ]);
  });

  it('should handle encrypted reasoning details', async () => {
    prepareJsonResponse({
      content: 'Hello!',
      reasoning_details: [
        {
          type: ReasoningDetailType.Encrypted,
          data: 'encrypted_reasoning_data_here',
        },
      ],
    });

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(result.content).toStrictEqual([
      {
        type: 'reasoning',
        text: '[REDACTED]',
        providerMetadata: {
          openrouter: {
            reasoning_details: [
              {
                type: 'reasoning.encrypted',
                data: 'encrypted_reasoning_data_here',
              },
            ],
          },
        },
      },
      {
        type: 'text',
        text: 'Hello!',
      },
    ]);
  });

  it('should prioritize reasoning_details over reasoning when both are present', async () => {
    prepareJsonResponse({
      content: 'Hello!',
      reasoning: 'This should be ignored when reasoning_details is present',
      reasoning_details: [
        {
          type: ReasoningDetailType.Text,
          text: 'Processing from reasoning_details...',
        },
        {
          type: ReasoningDetailType.Summary,
          summary: 'Summary from reasoning_details',
        },
      ],
    });

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(result.content).toStrictEqual([
      {
        type: 'reasoning',
        text: 'Processing from reasoning_details...',
        providerMetadata: {
          openrouter: {
            reasoning_details: [
              {
                type: 'reasoning.text',
                text: 'Processing from reasoning_details...',
              },
            ],
          },
        },
      },
      {
        type: 'reasoning',
        text: 'Summary from reasoning_details',
        providerMetadata: {
          openrouter: {
            reasoning_details: [
              {
                type: 'reasoning.summary',
                summary: 'Summary from reasoning_details',
              },
            ],
          },
        },
      },
      {
        type: 'text',
        text: 'Hello!',
      },
    ]);

    // Verify that the reasoning field content is not included
    expect(result.content).not.toContainEqual({
      type: 'reasoning',
      text: 'This should be ignored when reasoning_details is present',
    });
  });

  it('should override finishReason to tool-calls when tool calls and encrypted reasoning are present', async () => {
    prepareJsonResponse({
      content: '',
      tool_calls: [
        {
          id: 'call_123',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"location":"San Francisco"}',
          },
        },
      ],
      reasoning_details: [
        {
          type: ReasoningDetailType.Encrypted,
          data: 'encrypted_reasoning_data_here',
        },
      ],
      // Gemini 3 returns 'stop' instead of 'tool_calls' when using thoughtSignature
      finish_reason: 'stop',
    });

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    // Should override to 'tool-calls' when encrypted reasoning + tool calls + stop
    expect(result.finishReason).toStrictEqual({
      unified: 'tool-calls',
      raw: 'stop',
    });

    // Should still have the tool call in content
    expect(result.content).toContainEqual(
      expect.objectContaining({
        type: 'tool-call',
        toolCallId: 'call_123',
        toolName: 'get_weather',
      }),
    );
  });

  it('should default to empty JSON object when tool call arguments field is missing', async () => {
    prepareJsonResponse({
      content: '',
      tool_calls: [
        {
          id: 'call_no_args',
          type: 'function',
          function: {
            name: 'get_current_time',
          },
        },
      ],
      finish_reason: 'tool_calls',
    });

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(result.content).toContainEqual(
      expect.objectContaining({
        type: 'tool-call',
        toolCallId: 'call_no_args',
        toolName: 'get_current_time',
        input: '{}',
      }),
    );
  });

  it('should pass the model and the messages', async () => {
    prepareJsonResponse({ content: '' });

    await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(await server.calls[0]!.requestBodyJson).toStrictEqual({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{ role: 'user', content: 'Hello' }],
    });
  });

  it('should pass the models array when provided', async () => {
    prepareJsonResponse({ content: '' });

    const customModel = provider.chat('anthropic/claude-3.5-sonnet', {
      models: ['anthropic/claude-2', 'gryphe/mythomax-l2-13b'],
    });

    await customModel.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(await server.calls[0]!.requestBodyJson).toStrictEqual({
      model: 'anthropic/claude-3.5-sonnet',
      models: ['anthropic/claude-2', 'gryphe/mythomax-l2-13b'],
      messages: [{ role: 'user', content: 'Hello' }],
    });
  });

  it('should pass settings', async () => {
    prepareJsonResponse();

    await provider
      .chat('openai/gpt-3.5-turbo', {
        logitBias: { 50256: -100 },
        logprobs: 2,
        parallelToolCalls: false,
        user: 'test-user-id',
      })
      .doGenerate({
        prompt: TEST_PROMPT,
      });

    expect(await server.calls[0]!.requestBodyJson).toStrictEqual({
      model: 'openai/gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello' }],
      logprobs: true,
      top_logprobs: 2,
      logit_bias: { 50256: -100 },
      parallel_tool_calls: false,
      user: 'test-user-id',
    });
  });

  it('should pass tools and toolChoice', async () => {
    prepareJsonResponse({ content: '' });

    await model.doGenerate({
      prompt: TEST_PROMPT,
      tools: [
        {
          type: 'function',
          name: 'test-tool',
          description: 'Test tool',
          inputSchema: {
            type: 'object',
            properties: { value: { type: 'string' } },
            required: ['value'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      toolChoice: {
        type: 'tool',
        toolName: 'test-tool',
      },
    });

    expect(await server.calls[0]!.requestBodyJson).toStrictEqual({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{ role: 'user', content: 'Hello' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'test-tool',
            description: 'Test tool',
            parameters: {
              type: 'object',
              properties: { value: { type: 'string' } },
              required: ['value'],
              additionalProperties: false,
              $schema: 'http://json-schema.org/draft-07/schema#',
            },
          },
        },
      ],
      tool_choice: {
        type: 'function',
        function: { name: 'test-tool' },
      },
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

    await provider.chat('openai/gpt-3.5-turbo').doGenerate({
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

  it('should pass responseFormat for JSON schema structured outputs', async () => {
    prepareJsonResponse({ content: '{"name": "John", "age": 30}' });

    const testSchema: JSONSchema7 = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name', 'age'],
      additionalProperties: false,
    };

    await model.doGenerate({
      prompt: TEST_PROMPT,
      responseFormat: {
        type: 'json',
        schema: testSchema,
        name: 'PersonResponse',
        description: 'A person object',
      },
    });

    expect(await server.calls[0]!.requestBodyJson).toStrictEqual({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{ role: 'user', content: 'Hello' }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          schema: testSchema,
          strict: true,
          name: 'PersonResponse',
          description: 'A person object',
        },
      },
    });
  });

  it('should use default name when name is not provided in responseFormat', async () => {
    prepareJsonResponse({ content: '{"name": "John", "age": 30}' });

    const testSchema: JSONSchema7 = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name', 'age'],
      additionalProperties: false,
    };

    await model.doGenerate({
      prompt: TEST_PROMPT,
      responseFormat: {
        type: 'json',
        schema: testSchema,
      },
    });

    expect(await server.calls[0]!.requestBodyJson).toStrictEqual({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{ role: 'user', content: 'Hello' }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          schema: testSchema,
          strict: true,
          name: 'response',
        },
      },
    });
  });

  it('should pass response-healing plugin in request payload', async () => {
    prepareJsonResponse({ content: '{"name": "John", "age": 30}' });

    const modelWithPlugin = provider.chat('anthropic/claude-3.5-sonnet', {
      plugins: [{ id: 'response-healing' }],
    });

    await modelWithPlugin.doGenerate({
      prompt: TEST_PROMPT,
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
          required: ['name', 'age'],
        },
        name: 'PersonResponse',
      },
    });

    expect(await server.calls[0]!.requestBodyJson).toStrictEqual({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{ role: 'user', content: 'Hello' }],
      plugins: [{ id: 'response-healing' }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'number' },
            },
            required: ['name', 'age'],
          },
          strict: true,
          name: 'PersonResponse',
        },
      },
    });
  });

  it('should pass images', async () => {
    prepareJsonResponse({
      content: '',
      images: [
        {
          type: 'image_url',
          image_url: { url: TEST_IMAGE_URL },
        },
      ],
      usage: { prompt_tokens: 53, total_tokens: 70, completion_tokens: 17 },
    });

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(result.content).toStrictEqual([
      {
        type: 'file',
        mediaType: 'image/png',
        data: TEST_IMAGE_BASE64,
      },
    ]);
  });
});

describe('doStream', () => {
  const server = createTestServer({
    'https://openrouter.ai/api/v1/chat/completions': {
      response: { type: 'json-value', body: {} },
    },
  });

  beforeAll(() => server.server.start());
  afterEach(() => server.server.reset());
  afterAll(() => server.server.stop());

  function prepareStreamResponse({
    content,
    usage = {
      prompt_tokens: 17,
      total_tokens: 244,
      completion_tokens: 227,
    },
    logprobs = null,
    finish_reason = 'stop',
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
      content:
        | {
            token: string;
            logprob: number;
            top_logprobs: { token: string; logprob: number }[];
          }[]
        | null;
    } | null;
    finish_reason?: string;
  }) {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613",` +
          `"system_fingerprint":null,"choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n`,
        ...content.flatMap((text) => {
          return `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":null,"choices":[{"index":1,"delta":{"content":"${text}"},"finish_reason":null}]}\n\n`;
        }),
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":null,"choices":[{"index":0,"delta":{},"finish_reason":"${finish_reason}","logprobs":${JSON.stringify(
          logprobs,
        )}}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":${JSON.stringify(
          usage,
        )}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };
  }

  it('should stream text deltas', async () => {
    prepareStreamResponse({
      content: ['Hello', ', ', 'World!'],
      finish_reason: 'stop',
      usage: {
        prompt_tokens: 17,
        total_tokens: 244,
        completion_tokens: 227,
      },
      logprobs: TEST_LOGPROBS,
    });

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    // note: space moved to last chunk bc of trimming
    const elements = await convertReadableStreamToArray(stream);
    expect(elements).toStrictEqual([
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0613',
      },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0613',
      },
      { type: 'text-start', id: expect.any(String) },
      { type: 'text-delta', delta: 'Hello', id: expect.any(String) },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0613',
      },
      { type: 'text-delta', delta: ', ', id: expect.any(String) },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0613',
      },
      { type: 'text-delta', delta: 'World!', id: expect.any(String) },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0613',
      },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0613',
      },
      {
        type: 'text-end',
        id: expect.any(String),
      },
      {
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },

        providerMetadata: {
          openrouter: {
            usage: {
              completionTokens: 227,
              promptTokens: 17,
              totalTokens: 244,
            },
          },
        },
        usage: {
          inputTokens: {
            total: 17,
            noCache: undefined,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: 227,
            text: undefined,
            reasoning: undefined,
          },
          raw: {
            prompt_tokens: 17,
            total_tokens: 244,
            completion_tokens: 227,
          },
        },
      },
    ]);
  });

  it('should include upstream inference cost in finish metadata when provided', async () => {
    prepareStreamResponse({
      content: ['Hello'],
      usage: {
        prompt_tokens: 17,
        total_tokens: 244,
        completion_tokens: 227,
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
        chunk,
      ): chunk is Extract<LanguageModelV3StreamPart, { type: 'finish' }> =>
        chunk.type === 'finish',
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
        prompt_tokens: 17,
        total_tokens: 244,
        completion_tokens: 227,
        cost: 0.0042,
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
        chunk,
      ): chunk is Extract<LanguageModelV3StreamPart, { type: 'finish' }> =>
        chunk.type === 'finish',
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
    expect(openrouterUsage?.cost).toBe(0.0042);
  });

  it('should prioritize reasoning_details over reasoning when both are present in streaming', async () => {
    // This test verifies that when the API returns both 'reasoning' and 'reasoning_details' fields,
    // we prioritize reasoning_details and ignore the reasoning field to avoid duplicates.
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // First chunk: both reasoning and reasoning_details with different content
        `data: {"id":"chatcmpl-reasoning","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"role":"assistant","content":"",` +
          `"reasoning":"This should be ignored...",` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":"Let me think about this..."}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Second chunk: reasoning_details with multiple types
        `data: {"id":"chatcmpl-reasoning","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{` +
          `"reasoning":"Also ignored",` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Summary}","summary":"User wants a greeting"},{"type":"${ReasoningDetailType.Encrypted}","data":"secret"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Third chunk: only reasoning field (should be processed)
        `data: {"id":"chatcmpl-reasoning","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{` +
          `"reasoning":"This reasoning is used"},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Content chunk
        `data: {"id":"chatcmpl-reasoning","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"content":"Hello!"},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Finish chunk
        `data: {"id":"chatcmpl-reasoning","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{},` +
          `"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"chatcmpl-reasoning","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":{"prompt_tokens":17,"completion_tokens":30,"total_tokens":47}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    // Filter for reasoning-related elements
    const reasoningElements = elements.filter(
      (el) =>
        el.type === 'reasoning-start' ||
        el.type === 'reasoning-delta' ||
        el.type === 'reasoning-end',
    );

    // Debug output to see what we're getting
    // console.log('Reasoning elements count:', reasoningElements.length);
    // console.log('Reasoning element types:', reasoningElements.map(el => el.type));

    // We should get reasoning content from reasoning_details when present, not reasoning field
    // start + 4 deltas (text, summary, encrypted, reasoning-only) + end = 6
    expect(reasoningElements).toHaveLength(6);

    // Verify the content comes from reasoning_details, not reasoning field
    const reasoningDeltas = reasoningElements
      .filter(isReasoningDeltaPart)
      .map((el) => el.delta);

    expect(reasoningDeltas).toEqual([
      'Let me think about this...', // from reasoning_details text
      'User wants a greeting', // from reasoning_details summary
      '[REDACTED]', // from reasoning_details encrypted
      'This reasoning is used', // from reasoning field (no reasoning_details)
    ]);

    // Verify that "This should be ignored..." and "Also ignored" are NOT in the output
    expect(reasoningDeltas).not.toContain('This should be ignored...');
    expect(reasoningDeltas).not.toContain('Also ignored');

    // Verify that reasoning-delta chunks include providerMetadata with reasoning_details
    const reasoningDeltaElements = elements.filter(isReasoningDeltaPart);

    // First delta should have reasoning_details from first chunk
    expect(reasoningDeltaElements[0]?.providerMetadata).toEqual({
      openrouter: {
        reasoning_details: [
          {
            type: ReasoningDetailType.Text,
            text: 'Let me think about this...',
          },
        ],
      },
    });

    // Second and third deltas should have reasoning_details from second chunk
    expect(reasoningDeltaElements[1]?.providerMetadata).toEqual({
      openrouter: {
        reasoning_details: [
          {
            type: ReasoningDetailType.Summary,
            summary: 'User wants a greeting',
          },
          {
            type: ReasoningDetailType.Encrypted,
            data: 'secret',
          },
        ],
      },
    });

    expect(reasoningDeltaElements[2]?.providerMetadata).toEqual({
      openrouter: {
        reasoning_details: [
          {
            type: ReasoningDetailType.Summary,
            summary: 'User wants a greeting',
          },
          {
            type: ReasoningDetailType.Encrypted,
            data: 'secret',
          },
        ],
      },
    });

    // Fourth delta (from reasoning field only) should not have providerMetadata
    expect(reasoningDeltaElements[3]?.providerMetadata).toBeUndefined();
  });

  it('should emit reasoning_details in providerMetadata for all reasoning delta chunks', async () => {
    // This test verifies that reasoning_details are included in providerMetadata
    // for all reasoning-delta chunks, enabling users to accumulate them for multi-turn conversations
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // First chunk: reasoning_details with Text type
        `data: {"id":"chatcmpl-metadata-test","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"role":"assistant","content":"",` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":"First reasoning chunk"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Second chunk: reasoning_details with Summary type
        `data: {"id":"chatcmpl-metadata-test","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Summary}","summary":"Summary reasoning"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Third chunk: reasoning_details with Encrypted type
        `data: {"id":"chatcmpl-metadata-test","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Encrypted}","data":"encrypted_data"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Finish chunk
        `data: {"id":"chatcmpl-metadata-test","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{},` +
          `"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"chatcmpl-metadata-test","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":{"prompt_tokens":17,"completion_tokens":30,"total_tokens":47}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    const reasoningDeltaElements = elements.filter(isReasoningDeltaPart);

    expect(reasoningDeltaElements).toHaveLength(3);

    // Verify each delta has the correct reasoning_details in providerMetadata
    expect(reasoningDeltaElements[0]?.providerMetadata).toEqual({
      openrouter: {
        reasoning_details: [
          {
            type: ReasoningDetailType.Text,
            text: 'First reasoning chunk',
          },
        ],
      },
    });

    expect(reasoningDeltaElements[1]?.providerMetadata).toEqual({
      openrouter: {
        reasoning_details: [
          {
            type: ReasoningDetailType.Summary,
            summary: 'Summary reasoning',
          },
        ],
      },
    });

    expect(reasoningDeltaElements[2]?.providerMetadata).toEqual({
      openrouter: {
        reasoning_details: [
          {
            type: ReasoningDetailType.Encrypted,
            data: 'encrypted_data',
          },
        ],
      },
    });

    // Verify reasoning-start also has providerMetadata when first delta includes it
    const reasoningStart = elements.find(isReasoningStartPart);

    expect(reasoningStart?.providerMetadata).toEqual({
      openrouter: {
        reasoning_details: [
          {
            type: ReasoningDetailType.Text,
            text: 'First reasoning chunk',
          },
        ],
      },
    });
  });

  it('should maintain correct reasoning order when content comes after reasoning (issue #7824)', async () => {
    // This test reproduces the issue where reasoning appears first but then gets "pushed down"
    // by content that comes later in the stream
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // First chunk: Start with reasoning
        `data: {"id":"chatcmpl-order-test","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"role":"assistant",` +
          `"reasoning":"I need to think about this step by step..."},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Second chunk: More reasoning
        `data: {"id":"chatcmpl-order-test","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{` +
          `"reasoning":" First, I should analyze the request."},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Third chunk: Even more reasoning
        `data: {"id":"chatcmpl-order-test","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{` +
          `"reasoning":" Then I should provide a helpful response."},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Fourth chunk: Content starts
        `data: {"id":"chatcmpl-order-test","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"content":"Hello! "},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Fifth chunk: More content
        `data: {"id":"chatcmpl-order-test","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"content":"How can I help you today?"},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Finish chunk
        `data: {"id":"chatcmpl-order-test","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{},` +
          `"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"chatcmpl-order-test","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":{"prompt_tokens":17,"completion_tokens":30,"total_tokens":47}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    // The expected order should be:
    // 1. reasoning-start
    // 2. reasoning-delta (3 times)
    // 3. reasoning-end (when text starts)
    // 4. text-start
    // 5. text-delta (2 times)
    // 6. text-end (when stream finishes)

    const streamOrder = elements.map((el) => el.type);

    // Find the positions of key events
    const reasoningStartIndex = streamOrder.indexOf('reasoning-start');
    const reasoningEndIndex = streamOrder.indexOf('reasoning-end');
    const textStartIndex = streamOrder.indexOf('text-start');

    // Reasoning should come before text and end before text starts
    expect(reasoningStartIndex).toBeLessThan(textStartIndex);
    expect(reasoningEndIndex).toBeLessThan(textStartIndex);

    // Verify reasoning content
    const reasoningDeltas = elements
      .filter(isReasoningDeltaPart)
      .map((el) => el.delta);

    expect(reasoningDeltas).toEqual([
      'I need to think about this step by step...',
      ' First, I should analyze the request.',
      ' Then I should provide a helpful response.',
    ]);

    // Verify text content
    const textDeltas = elements.filter(isTextDeltaPart).map((el) => el.delta);

    expect(textDeltas).toEqual(['Hello! ', 'How can I help you today?']);
  });

  it('should stream tool deltas', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_O17Uplv4lJvD6DVdIvFFeRMw","type":"function","function":{"name":"test-tool","arguments":""}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\""}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"value"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\":\\""}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"Spark"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"le"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":" Day"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"}"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":{"prompt_tokens":53,"completion_tokens":17,"total_tokens":70}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      tools: [
        {
          type: 'function',
          name: 'test-tool',
          inputSchema: {
            type: 'object',
            properties: { value: { type: 'string' } },
            required: ['value'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    expect(await convertReadableStreamToArray(stream)).toStrictEqual([
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
        toolName: 'test-tool',
        type: 'tool-input-start',
      },
      {
        type: 'tool-input-delta',
        id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
        delta: '{"',
      },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        type: 'tool-input-delta',
        id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
        delta: 'value',
      },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        type: 'tool-input-delta',
        id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
        delta: '":"',
      },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        type: 'tool-input-delta',
        id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
        delta: 'Spark',
      },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        type: 'tool-input-delta',
        id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
        delta: 'le',
      },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        type: 'tool-input-delta',
        id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
        delta: ' Day',
      },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        type: 'tool-input-delta',
        id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
        delta: '"}',
      },
      {
        type: 'tool-call',
        toolCallId: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
        toolName: 'test-tool',
        input: '{"value":"Sparkle Day"}',
        providerMetadata: {
          openrouter: {
            reasoning_details: [],
          },
        },
      },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        type: 'finish',
        finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
        providerMetadata: {
          openrouter: {
            usage: {
              completionTokens: 17,
              promptTokens: 53,
              totalTokens: 70,
            },
          },
        },
        usage: {
          inputTokens: {
            total: 53,
            noCache: undefined,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: 17,
            text: undefined,
            reasoning: undefined,
          },
          raw: {
            prompt_tokens: 53,
            completion_tokens: 17,
            total_tokens: 70,
          },
        },
      },
    ]);
  });

  it('should stream tool call that is sent in one chunk', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_O17Uplv4lJvD6DVdIvFFeRMw","type":"function","function":{"name":"test-tool","arguments":"{\\"value\\":\\"Sparkle Day\\"}"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":{"prompt_tokens":53,"completion_tokens":17,"total_tokens":70}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      tools: [
        {
          type: 'function',
          name: 'test-tool',
          inputSchema: {
            type: 'object',
            properties: { value: { type: 'string' } },
            required: ['value'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);
    expect(elements).toStrictEqual([
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        type: 'tool-input-start',
        id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
        toolName: 'test-tool',
      },
      {
        type: 'tool-input-delta',
        id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
        delta: '{"value":"Sparkle Day"}',
      },
      {
        type: 'tool-input-end',
        id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
      },
      {
        type: 'tool-call',
        toolCallId: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
        toolName: 'test-tool',
        input: '{"value":"Sparkle Day"}',
        providerMetadata: {
          openrouter: {
            reasoning_details: [],
          },
        },
      },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        type: 'finish',
        finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
        providerMetadata: {
          openrouter: {
            usage: {
              completionTokens: 17,
              promptTokens: 53,
              totalTokens: 70,
            },
          },
        },
        usage: {
          inputTokens: {
            total: 53,
            noCache: undefined,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: 17,
            text: undefined,
            reasoning: undefined,
          },
          raw: {
            prompt_tokens: 53,
            completion_tokens: 17,
            total_tokens: 70,
          },
        },
      },
    ]);
  });

  it('should override finishReason to tool-calls in streaming when tool calls and encrypted reasoning are present', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // First chunk: reasoning_details with encrypted data
        `data: {"id":"chatcmpl-gemini3","object":"chat.completion.chunk","created":1711357598,"model":"google/gemini-3-pro",` +
          `"system_fingerprint":"fp_gemini3","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"reasoning_details":[{"type":"reasoning.encrypted","data":"encrypted_thoughtsig_data"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Second chunk: tool call
        `data: {"id":"chatcmpl-gemini3","object":"chat.completion.chunk","created":1711357598,"model":"google/gemini-3-pro",` +
          `"system_fingerprint":"fp_gemini3","choices":[{"index":0,"delta":{` +
          `"tool_calls":[{"index":0,"id":"call_gemini3_123","type":"function","function":{"name":"get_weather","arguments":"{\\"location\\":\\"SF\\"}"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Final chunk: finish_reason is "stop" (Gemini 3 bug) - should be overridden to "tool-calls"
        `data: {"id":"chatcmpl-gemini3","object":"chat.completion.chunk","created":1711357598,"model":"google/gemini-3-pro",` +
          `"system_fingerprint":"fp_gemini3","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"chatcmpl-gemini3","object":"chat.completion.chunk","created":1711357598,"model":"google/gemini-3-pro",` +
          `"system_fingerprint":"fp_gemini3","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":20,"total_tokens":30}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      tools: [
        {
          type: 'function',
          name: 'get_weather',
          inputSchema: {
            type: 'object',
            properties: { location: { type: 'string' } },
            required: ['location'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    // Find the finish event
    const finishEvent = elements.find(
      (el): el is LanguageModelV3StreamPart & { type: 'finish' } =>
        el.type === 'finish',
    );

    // Should override to 'tool-calls' when encrypted reasoning + tool calls + stop
    expect(finishEvent?.finishReason).toStrictEqual({
      unified: 'tool-calls',
      raw: 'stop',
    });

    // Should have the tool call
    const toolCallEvent = elements.find(
      (el): el is LanguageModelV3StreamPart & { type: 'tool-call' } =>
        el.type === 'tool-call',
    );
    expect(toolCallEvent?.toolName).toBe('get_weather');
    expect(toolCallEvent?.toolCallId).toBe('call_gemini3_123');
  });

  it('should stream images', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"role":"assistant","content":"",` +
          `"images":[{"type":"image_url","image_url":{"url":"${TEST_IMAGE_URL}"},"index":0}]},` +
          `"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":{"prompt_tokens":53,"completion_tokens":17,"total_tokens":70}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    expect(await convertReadableStreamToArray(stream)).toStrictEqual([
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        type: 'file',
        mediaType: 'image/png',
        data: TEST_IMAGE_BASE64,
      },
      {
        type: 'response-metadata',
        id: 'chatcmpl-96aZqmeDpA9IPD6tACY8djkMsJCMP',
      },
      {
        type: 'response-metadata',
        modelId: 'gpt-3.5-turbo-0125',
      },
      {
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },
        providerMetadata: {
          openrouter: {
            usage: {
              completionTokens: 17,
              promptTokens: 53,
              totalTokens: 70,
            },
          },
        },
        usage: {
          inputTokens: {
            total: 53,
            noCache: undefined,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: 17,
            text: undefined,
            reasoning: undefined,
          },
          raw: {
            prompt_tokens: 53,
            completion_tokens: 17,
            total_tokens: 70,
          },
        },
      },
    ]);
  });

  it('should handle error stream parts', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
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
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
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

      type: 'finish',
      providerMetadata: {
        openrouter: {
          usage: {},
        },
      },
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

  it('should pass the messages and the model', async () => {
    prepareStreamResponse({ content: [] });

    await model.doStream({
      prompt: TEST_PROMPT,
    });

    expect(await server.calls[0]!.requestBodyJson).toStrictEqual({
      stream: true,
      stream_options: { include_usage: true },
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{ role: 'user', content: 'Hello' }],
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

    await provider.chat('openai/gpt-3.5-turbo').doStream({
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

    await provider.chat('anthropic/claude-3.5-sonnet').doStream({
      prompt: TEST_PROMPT,
    });

    const requestBody = await server.calls[0]!.requestBodyJson;

    expect(requestBody).toHaveProperty('custom_field', 'custom_value');
    expect(requestBody).toHaveProperty(
      'providers.anthropic.custom_field',
      'custom_value',
    );
  });

  it('should pass responseFormat for JSON schema structured outputs', async () => {
    prepareStreamResponse({ content: ['{"name": "John", "age": 30}'] });

    const testSchema: JSONSchema7 = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name', 'age'],
      additionalProperties: false,
    };

    await model.doStream({
      prompt: TEST_PROMPT,
      responseFormat: {
        type: 'json',
        schema: testSchema,
        name: 'PersonResponse',
        description: 'A person object',
      },
    });

    expect(await server.calls[0]!.requestBodyJson).toStrictEqual({
      stream: true,
      stream_options: { include_usage: true },
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{ role: 'user', content: 'Hello' }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          schema: testSchema,
          strict: true,
          name: 'PersonResponse',
          description: 'A person object',
        },
      },
    });
  });

  it('should pass responseFormat AND tools together', async () => {
    prepareStreamResponse({ content: ['{"name": "John", "age": 30}'] });

    const testSchema: JSONSchema7 = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name', 'age'],
      additionalProperties: false,
    };

    await model.doStream({
      prompt: TEST_PROMPT,
      responseFormat: {
        type: 'json',
        schema: testSchema,
        name: 'PersonResponse',
        description: 'A person object',
      },
      tools: [
        {
          type: 'function',
          name: 'test-tool',
          description: 'Test tool',
          inputSchema: {
            type: 'object',
            properties: { value: { type: 'string' } },
            required: ['value'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      toolChoice: {
        type: 'tool',
        toolName: 'test-tool',
      },
    });

    expect(await server.calls[0]!.requestBodyJson).toStrictEqual({
      stream: true,
      stream_options: { include_usage: true },
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{ role: 'user', content: 'Hello' }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          schema: testSchema,
          strict: true,
          name: 'PersonResponse',
          description: 'A person object',
        },
      },
      tools: [
        {
          type: 'function',
          function: {
            name: 'test-tool',
            description: 'Test tool',
            parameters: {
              type: 'object',
              properties: { value: { type: 'string' } },
              required: ['value'],
              additionalProperties: false,
              $schema: 'http://json-schema.org/draft-07/schema#',
            },
          },
        },
      ],
      tool_choice: {
        type: 'function',
        function: { name: 'test-tool' },
      },
    });
  });

  it('should pass debug settings', async () => {
    prepareStreamResponse({ content: ['Hello'] });

    const debugModel = provider.chat('anthropic/claude-3.5-sonnet', {
      debug: {
        echo_upstream_body: true,
      },
    });

    await debugModel.doStream({
      prompt: TEST_PROMPT,
    });

    expect(await server.calls[0]!.requestBodyJson).toStrictEqual({
      stream: true,
      stream_options: { include_usage: true },
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{ role: 'user', content: 'Hello' }],
      debug: {
        echo_upstream_body: true,
      },
    });
  });

  it('should include file annotations in finish metadata when streamed', async () => {
    // This test verifies that file annotations from FileParserPlugin are accumulated
    // during streaming and included in the finish event's providerMetadata
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // First chunk with role and content
        `data: {"id":"chatcmpl-file-annotations","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4o-mini",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"role":"assistant","content":"The title is Bitcoin."},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Chunk with file annotation
        `data: {"id":"chatcmpl-file-annotations","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4o-mini",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{` +
          `"annotations":[{"type":"file","file":{"hash":"abc123def456","name":"bitcoin.pdf","content":[{"type":"text","text":"Page 1 content"},{"type":"text","text":"Page 2 content"}]}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Finish chunk
        `data: {"id":"chatcmpl-file-annotations","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4o-mini",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{},` +
          `"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"chatcmpl-file-annotations","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4o-mini",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":{"prompt_tokens":100,"completion_tokens":20,"total_tokens":120}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const elements = (await convertReadableStreamToArray(
      stream,
    )) as LanguageModelV3StreamPart[];

    // Find the finish chunk
    const finishChunk = elements.find(
      (
        chunk,
      ): chunk is Extract<LanguageModelV3StreamPart, { type: 'finish' }> =>
        chunk.type === 'finish',
    );

    expect(finishChunk).toBeDefined();

    // Verify file annotations are included in providerMetadata
    const openrouterMetadata = finishChunk?.providerMetadata?.openrouter as {
      annotations?: Array<{
        type: 'file';
        file: {
          hash: string;
          name: string;
          content?: Array<{ type: string; text?: string }>;
        };
      }>;
    };

    expect(openrouterMetadata?.annotations).toStrictEqual([
      {
        type: 'file',
        file: {
          hash: 'abc123def456',
          name: 'bitcoin.pdf',
          content: [
            { type: 'text', text: 'Page 1 content' },
            { type: 'text', text: 'Page 2 content' },
          ],
        },
      },
    ]);
  });

  it('should accumulate multiple file annotations from stream', async () => {
    // This test verifies that multiple file annotations are accumulated correctly
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // First chunk with content
        `data: {"id":"chatcmpl-multi-files","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4o-mini",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"role":"assistant","content":"Comparing two documents."},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // First file annotation
        `data: {"id":"chatcmpl-multi-files","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4o-mini",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{` +
          `"annotations":[{"type":"file","file":{"hash":"hash1","name":"doc1.pdf","content":[{"type":"text","text":"Doc 1"}]}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Second file annotation
        `data: {"id":"chatcmpl-multi-files","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4o-mini",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{` +
          `"annotations":[{"type":"file","file":{"hash":"hash2","name":"doc2.pdf","content":[{"type":"text","text":"Doc 2"}]}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Finish chunk
        `data: {"id":"chatcmpl-multi-files","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4o-mini",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{},` +
          `"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"chatcmpl-multi-files","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4o-mini",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":{"prompt_tokens":100,"completion_tokens":20,"total_tokens":120}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const elements = (await convertReadableStreamToArray(
      stream,
    )) as LanguageModelV3StreamPart[];

    const finishChunk = elements.find(
      (
        chunk,
      ): chunk is Extract<LanguageModelV3StreamPart, { type: 'finish' }> =>
        chunk.type === 'finish',
    );

    const openrouterMetadata = finishChunk?.providerMetadata?.openrouter as {
      annotations?: Array<{
        type: 'file';
        file: {
          hash: string;
          name: string;
          content?: Array<{ type: string; text?: string }>;
        };
      }>;
    };

    // Both file annotations should be accumulated
    expect(openrouterMetadata?.annotations).toHaveLength(2);
    expect(openrouterMetadata?.annotations?.[0]?.file.hash).toBe('hash1');
    expect(openrouterMetadata?.annotations?.[1]?.file.hash).toBe('hash2');
  });

  it('should include accumulated reasoning_details with signature in reasoning-end providerMetadata for text-only responses', async () => {
    // This test reproduces the Anthropic multi-turn signature bug:
    // When streaming a text-only response (no tool calls), the signature arrives
    // in the LAST reasoning delta. The reasoning-start event gets the FIRST delta's
    // metadata (no signature). The AI SDK uses reasoning-end's providerMetadata to
    // update the reasoning part's providerMetadata. So the provider MUST include
    // the accumulated reasoning_details (with signature) in the reasoning-end event.
    // Without this fix, the saved reasoning part has no signature, and the next turn
    // fails with "Invalid signature in thinking block".
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // First chunk: reasoning starts, NO signature yet
        `data: {"id":"chatcmpl-sig-test","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-opus-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"role":"assistant","content":"",` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":"Let me think about this","index":0,"format":"anthropic-claude-v1"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Second chunk: more reasoning text, still no signature
        `data: {"id":"chatcmpl-sig-test","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-opus-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":" step by step.","index":0,"format":"anthropic-claude-v1"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Third chunk: last reasoning delta WITH signature
        `data: {"id":"chatcmpl-sig-test","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-opus-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":" Done.","index":0,"format":"anthropic-claude-v1","signature":"erX9OCAqSEO90HsfvNlBn5J3BQ9cEI/Hg2wHFo5iA8w3L+a"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Fourth chunk: text content starts (reasoning ends)
        `data: {"id":"chatcmpl-sig-test","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-opus-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"content":"Hello! How can I help?"},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Finish chunk
        `data: {"id":"chatcmpl-sig-test","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-opus-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{},` +
          `"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"chatcmpl-sig-test","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-opus-4.6",` +
          `"system_fingerprint":"fp_test","choices":[],"usage":{"prompt_tokens":100,"completion_tokens":50,"total_tokens":150}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    // Find reasoning-end event
    const reasoningEnd = elements.find(
      (
        el,
      ): el is Extract<LanguageModelV3StreamPart, { type: 'reasoning-end' }> =>
        el.type === 'reasoning-end',
    );

    expect(reasoningEnd).toBeDefined();

    // The reasoning-end event MUST have providerMetadata with the full accumulated
    // reasoning_details including the signature from the last delta.
    // This is critical because the AI SDK updates the reasoning part's providerMetadata
    // from reasoning-end, and the signature is needed for multi-turn conversations.
    expect(reasoningEnd?.providerMetadata).toBeDefined();

    const reasoningDetails = (
      reasoningEnd?.providerMetadata?.openrouter as {
        reasoning_details: ReasoningDetailUnion[];
      }
    )?.reasoning_details;

    expect(reasoningDetails).toBeDefined();
    expect(reasoningDetails).toHaveLength(1);
    expect(reasoningDetails[0]).toMatchObject({
      type: ReasoningDetailType.Text,
      text: 'Let me think about this step by step. Done.',
      signature: 'erX9OCAqSEO90HsfvNlBn5J3BQ9cEI/Hg2wHFo5iA8w3L+a',
      format: 'anthropic-claude-v1',
    });

    // Also verify that the finish event has the same accumulated data
    const finishEvent = elements.find(
      (el): el is Extract<LanguageModelV3StreamPart, { type: 'finish' }> =>
        el.type === 'finish',
    );

    const finishReasoningDetails = (
      finishEvent?.providerMetadata?.openrouter as {
        reasoning_details: ReasoningDetailUnion[];
      }
    )?.reasoning_details;

    expect(finishReasoningDetails).toHaveLength(1);
    expect(finishReasoningDetails[0]).toMatchObject({
      type: ReasoningDetailType.Text,
      text: 'Let me think about this step by step. Done.',
      signature: 'erX9OCAqSEO90HsfvNlBn5J3BQ9cEI/Hg2wHFo5iA8w3L+a',
    });
  });
});

describe('debug settings', () => {
  const server = createTestServer({
    'https://openrouter.ai/api/v1/chat/completions': {
      response: { type: 'json-value', body: {} },
    },
  });

  beforeAll(() => server.server.start());
  afterEach(() => server.server.reset());
  afterAll(() => server.server.stop());

  function prepareJsonResponse({ content = '' }: { content?: string } = {}) {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'json-value',
      body: {
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: 1711115037,
        model: 'anthropic/claude-3.5-sonnet',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 4,
          total_tokens: 34,
          completion_tokens: 30,
        },
      },
    };
  }

  it('should pass debug settings in doGenerate', async () => {
    prepareJsonResponse({ content: 'Hello!' });

    const debugModel = provider.chat('anthropic/claude-3.5-sonnet', {
      debug: {
        echo_upstream_body: true,
      },
    });

    await debugModel.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(await server.calls[0]!.requestBodyJson).toStrictEqual({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{ role: 'user', content: 'Hello' }],
      debug: {
        echo_upstream_body: true,
      },
    });
  });

  it('should not include debug when not set', async () => {
    prepareJsonResponse({ content: 'Hello!' });

    await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    const requestBody = await server.calls[0]!.requestBodyJson;
    expect(requestBody).not.toHaveProperty('debug');
  });
});

describe('web search citations', () => {
  const server = createTestServer({
    'https://openrouter.ai/api/v1/chat/completions': {
      response: { type: 'json-value', body: {} },
    },
  });

  beforeAll(() => server.server.start());
  afterEach(() => server.server.reset());
  afterAll(() => server.server.stop());

  it('should handle url_citation with missing title field in non-streaming response', async () => {
    // Some upstream providers return url_citation without title field
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'json-value',
      body: {
        id: 'chatcmpl-web-search',
        object: 'chat.completion',
        created: 1711115037,
        model: 'anthropic/claude-3.5-sonnet:online',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Here is information from the web.',
              annotations: [
                {
                  type: 'url_citation',
                  url_citation: {
                    url: 'https://example.com/article',
                    // title is missing
                    start_index: 0,
                    end_index: 30,
                  },
                },
              ],
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      },
    };

    const result = await provider
      .chat('anthropic/claude-3.5-sonnet:online')
      .doGenerate({
        prompt: TEST_PROMPT,
      });

    // Should have a source content part with empty title fallback
    const sourceContent = result.content.find((c) => c.type === 'source');
    expect(sourceContent).toBeDefined();
    expect(sourceContent).toMatchObject({
      type: 'source',
      sourceType: 'url',
      url: 'https://example.com/article',
      title: '', // Should default to empty string
    });
  });

  it('should handle url_citation with missing start_index and end_index in non-streaming response', async () => {
    // Some providers may omit index fields
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'json-value',
      body: {
        id: 'chatcmpl-web-search',
        object: 'chat.completion',
        created: 1711115037,
        model: 'anthropic/claude-3.5-sonnet:online',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Here is information from the web.',
              annotations: [
                {
                  type: 'url_citation',
                  url_citation: {
                    url: 'https://example.com/article',
                    title: 'Example Article',
                    // start_index and end_index are missing
                  },
                },
              ],
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      },
    };

    const result = await provider
      .chat('anthropic/claude-3.5-sonnet:online')
      .doGenerate({
        prompt: TEST_PROMPT,
      });

    // Should have a source content part
    const sourceContent = result.content.find((c) => c.type === 'source');
    expect(sourceContent).toBeDefined();
    expect(sourceContent).toMatchObject({
      type: 'source',
      sourceType: 'url',
      url: 'https://example.com/article',
      title: 'Example Article',
    });
  });

  it('should handle url_citation with all optional fields missing in streaming response', async () => {
    // Test streaming with minimal url_citation (only url present)
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-web-search","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-3.5-sonnet:online",` +
          `"choices":[{"index":0,"delta":{"role":"assistant","content":"Web search result."},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-web-search","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-3.5-sonnet:online",` +
          `"choices":[{"index":0,"delta":{"annotations":[{"type":"url_citation","url_citation":{"url":"https://example.com/page"}}]},"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-web-search","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-3.5-sonnet:online",` +
          `"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"chatcmpl-web-search","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-3.5-sonnet:online",` +
          `"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":20,"total_tokens":30}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await provider
      .chat('anthropic/claude-3.5-sonnet:online')
      .doStream({
        prompt: TEST_PROMPT,
      });

    const elements = await convertReadableStreamToArray(stream);

    // Find the source event
    const sourceEvent = elements.find(
      (e): e is Extract<LanguageModelV3StreamPart, { type: 'source' }> =>
        e.type === 'source',
    );

    expect(sourceEvent).toBeDefined();
    expect(sourceEvent).toMatchObject({
      type: 'source',
      sourceType: 'url',
      url: 'https://example.com/page',
      title: '', // Should default to empty string
      providerMetadata: {
        openrouter: {
          content: '',
          startIndex: 0,
          endIndex: 0,
        },
      },
    });
  });

  it('should handle complete url_citation with all fields present', async () => {
    // Verify normal case still works
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'json-value',
      body: {
        id: 'chatcmpl-web-search',
        object: 'chat.completion',
        created: 1711115037,
        model: 'anthropic/claude-3.5-sonnet:online',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Here is information from the web.',
              annotations: [
                {
                  type: 'url_citation',
                  url_citation: {
                    url: 'https://example.com/article',
                    title: 'Complete Article',
                    start_index: 5,
                    end_index: 25,
                    content: 'Article content here',
                  },
                },
              ],
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      },
    };

    const result = await provider
      .chat('anthropic/claude-3.5-sonnet:online')
      .doGenerate({
        prompt: TEST_PROMPT,
      });

    const sourceContent = result.content.find((c) => c.type === 'source');
    expect(sourceContent).toBeDefined();
    expect(sourceContent).toMatchObject({
      type: 'source',
      sourceType: 'url',
      url: 'https://example.com/article',
      title: 'Complete Article',
      providerMetadata: {
        openrouter: {
          content: 'Article content here',
          startIndex: 5,
          endIndex: 25,
        },
      },
    });
  });

  it('should default startIndex and endIndex to 0 when missing', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'json-value',
      body: {
        id: 'chatcmpl-web-search',
        object: 'chat.completion',
        created: 1711115037,
        model: 'anthropic/claude-3.5-sonnet:online',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Here is information from the web.',
              annotations: [
                {
                  type: 'url_citation',
                  url_citation: {
                    url: 'https://example.com/article',
                    title: 'Article Without Indices',
                    // start_index and end_index are missing
                  },
                },
              ],
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      },
    };

    const result = await provider
      .chat('anthropic/claude-3.5-sonnet:online')
      .doGenerate({
        prompt: TEST_PROMPT,
      });

    const sourceContent = result.content.find((c) => c.type === 'source');
    expect(sourceContent).toBeDefined();
    expect(sourceContent).toMatchObject({
      type: 'source',
      sourceType: 'url',
      url: 'https://example.com/article',
      title: 'Article Without Indices',
      providerMetadata: {
        openrouter: {
          content: '',
          startIndex: 0,
          endIndex: 0,
        },
      },
    });
  });
});

describe('includeRawChunks', () => {
  const server = createTestServer({
    'https://openrouter.ai/api/v1/chat/completions': {
      response: { type: 'json-value', body: {} },
    },
  });

  beforeAll(() => server.server.start());
  afterEach(() => server.server.reset());
  afterAll(() => server.server.stop());

  function prepareStreamResponse({ content }: { content: string[] }) {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n`,
        ...content.map(
          (text) =>
            `data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","choices":[{"index":0,"delta":{"content":"${text}"},"finish_reason":null}]}\n\n`,
        ),
        `data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1702657020,"model":"gpt-3.5-turbo-0613","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n`,
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
    expect(rawChunks[0]!.rawValue).toHaveProperty('id', 'chatcmpl-test');
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

    // Should have raw chunks for: initial, Hello, World, finish_reason, usage
    expect(rawChunks.length).toBe(5);
  });

  it('should emit raw chunk even when parsing fails (for debugging malformed responses)', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
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
