import type {
  LanguageModelV3Content,
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
        noCache: 20,
        cacheRead: 0,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 5,
        text: 5,
        reasoning: 0,
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

  it('should include raw response body in doGenerate result', async () => {
    prepareJsonResponse({ content: 'Hello, World!' });

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(result.response?.body).toBeDefined();
    expect(result.response?.body).toMatchObject({
      id: 'chatcmpl-95ZTZkhr0mHNKqerQfiwkuox3PHAd',
      object: 'chat.completion',
      model: 'gpt-3.5-turbo-0125',
      choices: expect.any(Array),
      usage: expect.any(Object),
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

  it('should not emit reasoning content for encrypted reasoning details', async () => {
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

    // Encrypted reasoning should not produce a reasoning content part.
    // The encrypted data is preserved in response-level providerMetadata
    // for multi-turn conversation continuity.
    expect(result.content).toStrictEqual([
      {
        type: 'text',
        text: 'Hello!',
      },
    ]);

    // Verify encrypted data is still in response-level providerMetadata
    expect(
      result.providerMetadata?.openrouter?.reasoning_details,
    ).toContainEqual({
      type: 'reasoning.encrypted',
      data: 'encrypted_reasoning_data_here',
    });
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

  it('should infer tool-calls finishReason when finish_reason is unknown but tool calls are present in doGenerate (#420)', async () => {
    // Simulate Kimi K2.5 behavior: provider returns an unrecognized finish_reason
    // with tool calls, which mapOpenRouterFinishReason maps to 'other'
    prepareJsonResponse({
      content: '',
      tool_calls: [
        {
          id: 'call_kimi_001',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"city":"Tokyo"}',
          },
        },
      ],
      finish_reason: 'some_unknown_reason',
    });

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    // Should infer 'tool-calls' when tool calls are present but finish_reason maps to 'other'
    expect(result.finishReason).toStrictEqual({
      unified: 'tool-calls',
      raw: 'some_unknown_reason',
    });

    expect(result.content).toContainEqual(
      expect.objectContaining({
        type: 'tool-call',
        toolCallId: 'call_kimi_001',
        toolName: 'get_weather',
      }),
    );
  });

  it('should infer tool-calls finishReason when finish_reason is null and tool calls are present in doGenerate (#166)', async () => {
    // Simulate the exact #166 scenario: provider returns null finish_reason
    // with tool calls. mapOpenRouterFinishReason maps null to 'other'.
    prepareJsonResponse({
      content: '',
      tool_calls: [
        {
          id: 'call_166_001',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"city":"Tokyo"}',
          },
        },
      ],
      // @ts-expect-error — testing null finish_reason from API
      finish_reason: null,
    });

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(result.finishReason).toStrictEqual({
      unified: 'tool-calls',
      raw: undefined,
    });

    expect(result.content).toContainEqual(
      expect.objectContaining({
        type: 'tool-call',
        toolCallId: 'call_166_001',
        toolName: 'get_weather',
      }),
    );
  });

  it('should keep finishReason as other when finish_reason is null and no tool calls are present (#166)', async () => {
    prepareJsonResponse({
      content: 'Hello!',
      // @ts-expect-error — testing null finish_reason from API
      finish_reason: null,
    });

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    // Without tool calls, null finish_reason should remain 'other'
    expect(result.finishReason).toStrictEqual({
      unified: 'other',
      raw: undefined,
    });
  });

  it('should not override stop finishReason to tool-calls when tool calls present but no encrypted reasoning (#166)', async () => {
    prepareJsonResponse({
      content: '',
      tool_calls: [
        {
          id: 'call_stop_001',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"city":"Berlin"}',
          },
        },
      ],
      finish_reason: 'stop',
    });

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    // 'stop' with tool calls but without encrypted reasoning should NOT be
    // overridden — only 'other' (null/unknown) triggers the fallback
    expect(result.finishReason).toStrictEqual({
      unified: 'stop',
      raw: 'stop',
    });
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

  it('should pass eager_input_streaming from tool providerOptions to request body', async () => {
    prepareJsonResponse({ content: '' });

    await model.doGenerate({
      prompt: TEST_PROMPT,
      tools: [
        {
          type: 'function',
          name: 'get-weather',
          description: 'Get the weather',
          inputSchema: {
            type: 'object',
            properties: { location: { type: 'string' } },
            required: ['location'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
          providerOptions: {
            openrouter: {
              eager_input_streaming: true,
            },
          },
        },
      ],
    });

    expect(await server.calls[0]!.requestBodyJson).toStrictEqual({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{ role: 'user', content: 'Hello' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get-weather',
            description: 'Get the weather',
            parameters: {
              type: 'object',
              properties: { location: { type: 'string' } },
              required: ['location'],
              additionalProperties: false,
              $schema: 'http://json-schema.org/draft-07/schema#',
            },
          },
          eager_input_streaming: true,
        },
      ],
    });
  });

  it('should not include eager_input_streaming when not set in tool providerOptions', async () => {
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
    });

    const body = (await server.calls[0]!.requestBodyJson) as Record<
      string,
      unknown
    >;
    const tools = body.tools as Array<Record<string, unknown>>;
    expect(tools[0]).not.toHaveProperty('eager_input_streaming');
  });

  it('should handle mixed tools with and without eager_input_streaming', async () => {
    prepareJsonResponse({ content: '' });

    await model.doGenerate({
      prompt: TEST_PROMPT,
      tools: [
        {
          type: 'function',
          name: 'eager-tool',
          description: 'Tool with eager streaming',
          inputSchema: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
          providerOptions: {
            openrouter: {
              eager_input_streaming: true,
            },
          },
        },
        {
          type: 'function',
          name: 'normal-tool',
          description: 'Tool without eager streaming',
          inputSchema: {
            type: 'object',
            properties: { id: { type: 'number' } },
            required: ['id'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
    });

    const body = (await server.calls[0]!.requestBodyJson) as Record<
      string,
      unknown
    >;
    const tools = body.tools as Array<Record<string, unknown>>;
    expect(tools).toHaveLength(2);
    expect(tools[0]).toHaveProperty('eager_input_streaming', true);
    expect(tools[1]).not.toHaveProperty('eager_input_streaming');
  });

  it('should send both response_format and tools when both are present', async () => {
    prepareJsonResponse({ content: '' });

    await model.doGenerate({
      prompt: TEST_PROMPT,
      responseFormat: {
        type: 'json',
        schema: {
          type: 'object',
          properties: { answer: { type: 'string' } },
          required: ['answer'],
          additionalProperties: false,
        },
        name: 'AnswerResponse',
      },
      tools: [
        {
          type: 'function',
          name: 'lookup-email',
          description: 'Look up information about an email address',
          inputSchema: {
            type: 'object',
            properties: { email: { type: 'string' } },
            required: ['email'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
    });

    const body = await server.calls[0]!.requestBodyJson;

    // Both response_format and tools should be present (matching @ai-sdk/openai behavior)
    expect(body).toHaveProperty('response_format');
    expect(body).toHaveProperty('tools');
    expect((body as Record<string, unknown>).response_format).toEqual({
      type: 'json_schema',
      json_schema: {
        schema: {
          type: 'object',
          properties: { answer: { type: 'string' } },
          required: ['answer'],
          additionalProperties: false,
        },
        strict: true,
        name: 'AnswerResponse',
      },
    });
    expect((body as Record<string, unknown>).tools).toEqual([
      {
        type: 'function',
        function: {
          name: 'lookup-email',
          description: 'Look up information about an email address',
          parameters: {
            type: 'object',
            properties: { email: { type: 'string' } },
            required: ['email'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      },
    ]);
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

  it('should pass auto-router plugin with allowed_models in request payload', async () => {
    prepareJsonResponse({ content: 'Hello from auto-selected model' });

    const autoModel = provider.chat('openrouter/auto', {
      plugins: [
        {
          id: 'auto-router',
          allowed_models: ['anthropic/*', 'openai/gpt-5.1'],
        },
      ],
    });

    await autoModel.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(await server.calls[0]!.requestBodyJson).toStrictEqual({
      model: 'openrouter/auto',
      messages: [{ role: 'user', content: 'Hello' }],
      plugins: [
        {
          id: 'auto-router',
          allowed_models: ['anthropic/*', 'openai/gpt-5.1'],
        },
      ],
    });
  });

  it('should pass auto-router plugin without allowed_models in request payload', async () => {
    prepareJsonResponse({ content: 'Hello from auto-selected model' });

    const autoModel = provider.chat('openrouter/auto', {
      plugins: [{ id: 'auto-router' }],
    });

    await autoModel.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(await server.calls[0]!.requestBodyJson).toStrictEqual({
      model: 'openrouter/auto',
      messages: [{ role: 'user', content: 'Hello' }],
      plugins: [{ id: 'auto-router' }],
    });
  });

  it('should pass auto-router plugin combined with other plugins', async () => {
    prepareJsonResponse({ content: 'Hello from auto-selected model' });

    const autoModel = provider.chat('openrouter/auto', {
      plugins: [
        { id: 'auto-router', allowed_models: ['anthropic/*'] },
        { id: 'web' },
      ],
    });

    await autoModel.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(await server.calls[0]!.requestBodyJson).toStrictEqual({
      model: 'openrouter/auto',
      messages: [{ role: 'user', content: 'Hello' }],
      plugins: [
        { id: 'auto-router', allowed_models: ['anthropic/*'] },
        { id: 'web' },
      ],
    });
  });

  it('should pass cache_control from model settings in request payload (#424)', async () => {
    prepareJsonResponse({ content: 'Cached response' });

    const cachedModel = provider.chat('anthropic/claude-sonnet-4', {
      cache_control: { type: 'ephemeral' },
    });

    await cachedModel.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(await server.calls[0]!.requestBodyJson).toStrictEqual({
      model: 'anthropic/claude-sonnet-4',
      messages: [{ role: 'user', content: 'Hello' }],
      cache_control: { type: 'ephemeral' },
    });
  });

  it('should pass cache_control from providerOptions.openrouter (snake_case) in request payload (#424)', async () => {
    prepareJsonResponse({ content: 'Cached response' });

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        openrouter: {
          cache_control: { type: 'ephemeral' },
        },
      },
    });

    expect(await server.calls[0]!.requestBodyJson).toStrictEqual({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{ role: 'user', content: 'Hello' }],
      cache_control: { type: 'ephemeral' },
    });
  });

  it('should normalize cacheControl (camelCase) from providerOptions to cache_control (#424)', async () => {
    prepareJsonResponse({ content: 'Cached response' });

    await model.doGenerate({
      prompt: TEST_PROMPT,
      providerOptions: {
        openrouter: {
          cacheControl: { type: 'ephemeral' },
        },
      },
    });

    expect(await server.calls[0]!.requestBodyJson).toStrictEqual({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{ role: 'user', content: 'Hello' }],
      cache_control: { type: 'ephemeral' },
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

  it('should generate unique toolCallIds when provider returns duplicate IDs', async () => {
    prepareJsonResponse({
      content: '',
      tool_calls: [
        {
          id: 'call_0',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"city":"Tokyo"}',
          },
        },
        {
          id: 'call_0',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"city":"London"}',
          },
        },
      ],
      finish_reason: 'tool_calls',
    });

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    const toolCalls = result.content.filter(
      (c): c is Extract<LanguageModelV3Content, { type: 'tool-call' }> =>
        c.type === 'tool-call',
    );

    expect(toolCalls).toHaveLength(2);
    // All toolCallIds must be unique
    const ids = toolCalls.map((tc) => tc.toolCallId);
    expect(new Set(ids).size).toBe(2);
  });

  it('should generate unique toolCallIds when provider returns empty string IDs', async () => {
    prepareJsonResponse({
      content: '',
      tool_calls: [
        {
          id: '',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"city":"Tokyo"}',
          },
        },
        {
          id: '',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"city":"London"}',
          },
        },
      ],
      finish_reason: 'tool_calls',
    });

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    const toolCalls = result.content.filter(
      (c): c is Extract<LanguageModelV3Content, { type: 'tool-call' }> =>
        c.type === 'tool-call',
    );

    expect(toolCalls).toHaveLength(2);
    // Empty string IDs should be replaced with generated unique IDs
    const ids = toolCalls.map((tc) => tc.toolCallId);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) {
      expect(id).not.toBe('');
    }
  });

  it('should preserve valid unique tool call IDs from the provider', async () => {
    prepareJsonResponse({
      content: '',
      tool_calls: [
        {
          id: 'call_abc123',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"city":"Tokyo"}',
          },
        },
      ],
      finish_reason: 'tool_calls',
    });

    const result = await model.doGenerate({
      prompt: TEST_PROMPT,
    });

    const toolCalls = result.content.filter(
      (c): c is Extract<LanguageModelV3Content, { type: 'tool-call' }> =>
        c.type === 'tool-call',
    );

    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]!.toolCallId).toBe('call_abc123');
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
            reasoning_details: [],
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
            noCache: 17,
            cacheRead: 0,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: 227,
            text: 227,
            reasoning: 0,
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
    // start + 3 deltas (text, summary, reasoning-only; encrypted is skipped) + end = 5
    expect(reasoningElements).toHaveLength(5);

    // Verify the content comes from reasoning_details, not reasoning field
    const reasoningDeltas = reasoningElements
      .filter(isReasoningDeltaPart)
      .map((el) => el.delta);

    expect(reasoningDeltas).toEqual([
      'Let me think about this...', // from reasoning_details text
      'User wants a greeting', // from reasoning_details summary
      // encrypted reasoning details are silently skipped (no [REDACTED])
      'This reasoning is used', // from reasoning field (no reasoning_details)
    ]);

    // Verify that "This should be ignored..." and "Also ignored" are NOT in the output
    expect(reasoningDeltas).not.toContain('This should be ignored...');
    expect(reasoningDeltas).not.toContain('Also ignored');

    // reasoning-delta events should NOT carry providerMetadata (fix for #413
    // payload bloat). The full accumulated reasoning_details are available on
    // reasoning-end, tool-call, and finish events instead.
    const reasoningDeltaElements = elements.filter(isReasoningDeltaPart);

    expect(reasoningDeltaElements[0]?.providerMetadata).toBeUndefined();
    expect(reasoningDeltaElements[1]?.providerMetadata).toBeUndefined();
    expect(reasoningDeltaElements[2]?.providerMetadata).toBeUndefined();
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

    // Only 2 deltas: text + summary. Encrypted details don't produce deltas.
    expect(reasoningDeltaElements).toHaveLength(2);

    // reasoning-delta events should NOT carry providerMetadata (fix for #413
    // payload bloat). The full accumulated reasoning_details are available on
    // reasoning-end and finish events instead.
    expect(reasoningDeltaElements[0]?.providerMetadata).toBeUndefined();
    expect(reasoningDeltaElements[1]?.providerMetadata).toBeUndefined();

    // Encrypted data is still accumulated and available in reasoning-end
    const reasoningEnd = elements.find((el) => el.type === 'reasoning-end');
    expect(reasoningEnd?.providerMetadata).toEqual({
      openrouter: {
        reasoning_details: [
          {
            type: ReasoningDetailType.Text,
            text: 'First reasoning chunk',
          },
          {
            type: ReasoningDetailType.Summary,
            summary: 'Summary reasoning',
          },
          {
            type: ReasoningDetailType.Encrypted,
            data: 'encrypted_data',
          },
        ],
      },
    });

    // reasoning-start should NOT carry providerMetadata (fix for #413 payload bloat)
    const reasoningStart = elements.find(isReasoningStartPart);
    expect(reasoningStart?.providerMetadata).toBeUndefined();
  });

  it('should not emit reasoning events when only encrypted details arrive in stream', async () => {
    // Edge case: stream contains ONLY encrypted reasoning details (no text/summary).
    // No reasoning-start/reasoning-delta/reasoning-end events should be emitted,
    // but the encrypted data must still be preserved in the finish event's providerMetadata.
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // First chunk: only encrypted reasoning detail
        `data: {"id":"chatcmpl-encrypted-only","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"role":"assistant","content":"",` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Encrypted}","data":"opaque_blob_1"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Second chunk: another encrypted detail
        `data: {"id":"chatcmpl-encrypted-only","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Encrypted}","data":"opaque_blob_2"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Content chunk
        `data: {"id":"chatcmpl-encrypted-only","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"content":"Hello!"},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Finish chunk
        `data: {"id":"chatcmpl-encrypted-only","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{},` +
          `"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"chatcmpl-encrypted-only","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    // No reasoning events should be emitted
    const reasoningDeltaElements = elements.filter(isReasoningDeltaPart);
    expect(reasoningDeltaElements).toHaveLength(0);

    const reasoningStart = elements.find(isReasoningStartPart);
    expect(reasoningStart).toBeUndefined();

    const reasoningEnd = elements.find((el) => el.type === 'reasoning-end');
    expect(reasoningEnd).toBeUndefined();

    // Text content should still work
    const textDeltas = elements.filter(isTextDeltaPart);
    expect(textDeltas).toHaveLength(1);

    // Encrypted data must still be preserved in finish event's providerMetadata
    const finishEvent = elements.find((el) => el.type === 'finish');
    expect(finishEvent?.providerMetadata).toEqual(
      expect.objectContaining({
        openrouter: expect.objectContaining({
          reasoning_details: [
            {
              type: ReasoningDetailType.Encrypted,
              data: 'opaque_blob_1',
            },
            {
              type: ReasoningDetailType.Encrypted,
              data: 'opaque_blob_2',
            },
          ],
        }),
      }),
    );
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

  it('should use different IDs for reasoning and text streams', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // First chunk: reasoning
        `data: {"id":"chatcmpl-id-test","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{` +
          `"reasoning":"Let me think..."},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Second chunk: content starts
        `data: {"id":"chatcmpl-id-test","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"content":"Hello!"},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Finish chunk
        `data: {"id":"chatcmpl-id-test","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{},` +
          `"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"chatcmpl-id-test","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":20,"total_tokens":30}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    const reasoningStart = elements.find((el) => el.type === 'reasoning-start');
    const textStart = elements.find((el) => el.type === 'text-start');

    // Both events should exist
    expect(reasoningStart).toBeDefined();
    expect(textStart).toBeDefined();

    // IDs must be different to avoid confusing downstream consumers
    // that correlate events by ID
    expect((reasoningStart as { id: string }).id).not.toBe(
      (textStart as { id: string }).id,
    );
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
            reasoning_details: [],
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
            noCache: 53,
            cacheRead: 0,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: 17,
            text: 17,
            reasoning: 0,
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
            reasoning_details: [],
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
            noCache: 53,
            cacheRead: 0,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: 17,
            text: 17,
            reasoning: 0,
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

  it('should infer tool-calls finishReason when finish_reason is missing but tool calls are present (#420)', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // Tool call chunk with no finish_reason set (simulates Kimi K2.5 behavior)
        `data: {"id":"chatcmpl-kimi","object":"chat.completion.chunk","created":1711357598,"model":"moonshotai/kimi-k2.5",` +
          `"system_fingerprint":"fp_kimi","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_kimi_001","type":"function","function":{"name":"get_weather","arguments":"{\\"city\\":\\"Tokyo\\"}"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Final chunk with no finish_reason (provider returns null)
        `data: {"id":"chatcmpl-kimi","object":"chat.completion.chunk","created":1711357598,"model":"moonshotai/kimi-k2.5",` +
          `"system_fingerprint":"fp_kimi","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-kimi","object":"chat.completion.chunk","created":1711357598,"model":"moonshotai/kimi-k2.5",` +
          `"system_fingerprint":"fp_kimi","choices":[],"usage":{"prompt_tokens":100,"completion_tokens":25,"total_tokens":125}}\n\n`,
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
            properties: { city: { type: 'string' } },
            required: ['city'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    const finishEvent = elements.find(
      (el): el is LanguageModelV3StreamPart & { type: 'finish' } =>
        el.type === 'finish',
    );

    // finishReason should be inferred as 'tool-calls' even though provider returned null
    expect(finishEvent?.finishReason).toStrictEqual({
      unified: 'tool-calls',
      raw: undefined,
    });

    const toolCallEvent = elements.find(
      (el): el is LanguageModelV3StreamPart & { type: 'tool-call' } =>
        el.type === 'tool-call',
    );
    expect(toolCallEvent?.toolName).toBe('get_weather');
  });

  it('should keep finishReason as other when finish_reason is null and no tool calls are present in streaming (#166)', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-166-notools","object":"chat.completion.chunk","created":1711357598,"model":"some-model",` +
          `"system_fingerprint":"fp_166","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-166-notools","object":"chat.completion.chunk","created":1711357598,"model":"some-model",` +
          `"system_fingerprint":"fp_166","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-166-notools","object":"chat.completion.chunk","created":1711357598,"model":"some-model",` +
          `"system_fingerprint":"fp_166","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    const finishEvent = elements.find(
      (el): el is LanguageModelV3StreamPart & { type: 'finish' } =>
        el.type === 'finish',
    );

    // Without tool calls, null finish_reason should remain 'other'
    expect(finishEvent?.finishReason).toStrictEqual({
      unified: 'other',
      raw: undefined,
    });
  });

  it('should not override stop finishReason to tool-calls in streaming when tool calls present but no encrypted reasoning (#166)', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // Tool call chunk
        `data: {"id":"chatcmpl-166-stop","object":"chat.completion.chunk","created":1711357598,"model":"some-model",` +
          `"system_fingerprint":"fp_166","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_166_stop","type":"function","function":{"name":"get_weather","arguments":"{\\"city\\":\\"Paris\\"}"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Final chunk: finish_reason is "stop" with NO encrypted reasoning
        `data: {"id":"chatcmpl-166-stop","object":"chat.completion.chunk","created":1711357598,"model":"some-model",` +
          `"system_fingerprint":"fp_166","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"chatcmpl-166-stop","object":"chat.completion.chunk","created":1711357598,"model":"some-model",` +
          `"system_fingerprint":"fp_166","choices":[],"usage":{"prompt_tokens":50,"completion_tokens":15,"total_tokens":65}}\n\n`,
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
            properties: { city: { type: 'string' } },
            required: ['city'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    const finishEvent = elements.find(
      (el): el is LanguageModelV3StreamPart & { type: 'finish' } =>
        el.type === 'finish',
    );

    // 'stop' with tool calls but without encrypted reasoning should NOT be
    // overridden — only 'other' (null/unknown) triggers the fallback
    expect(finishEvent?.finishReason).toStrictEqual({
      unified: 'stop',
      raw: 'stop',
    });
  });

  it('should populate usage from openrouterUsage when standard usage is empty (#419)', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // Text content chunk
        `data: {"id":"chatcmpl-kilo","object":"chat.completion.chunk","created":1711357598,"model":"z-ai/glm-5",` +
          `"system_fingerprint":"fp_kilo","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Final chunk with finish_reason but NO usage chunk
        `data: {"id":"chatcmpl-kilo","object":"chat.completion.chunk","created":1711357598,"model":"z-ai/glm-5",` +
          `"system_fingerprint":"fp_kilo","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    const finishEvent = elements.find(
      (el): el is LanguageModelV3StreamPart & { type: 'finish' } =>
        el.type === 'finish',
    );

    // When no usage chunk is sent, standard usage should have undefined totals
    expect(finishEvent?.usage.inputTokens.total).toBeUndefined();
    expect(finishEvent?.usage.outputTokens.total).toBeUndefined();
  });

  it('should fallback usage from openrouterUsage when usage chunk has data but standard usage totals are undefined (#419)', async () => {
    // Simulate a provider that sends usage data in the chunk but where the
    // standard usage object ends up with undefined totals (e.g., due to
    // non-standard chunk structure). The openrouterUsage should be used
    // as a fallback to populate the standard usage fields.
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // Text content chunk
        `data: {"id":"chatcmpl-419","object":"chat.completion.chunk","created":1711357598,"model":"z-ai/glm-5",` +
          `"system_fingerprint":"fp_419","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Finish reason chunk
        `data: {"id":"chatcmpl-419","object":"chat.completion.chunk","created":1711357598,"model":"z-ai/glm-5",` +
          `"system_fingerprint":"fp_419","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        // Usage chunk with valid data
        `data: {"id":"chatcmpl-419","object":"chat.completion.chunk","created":1711357598,"model":"z-ai/glm-5",` +
          `"system_fingerprint":"fp_419","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":20,"total_tokens":30}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    const finishEvent = elements.find(
      (el): el is LanguageModelV3StreamPart & { type: 'finish' } =>
        el.type === 'finish',
    );

    // Standard usage should be populated
    expect(finishEvent?.usage.inputTokens.total).toBe(10);
    expect(finishEvent?.usage.outputTokens.total).toBe(20);

    // openrouterUsage should also be populated
    const openrouterMeta = finishEvent?.providerMetadata?.openrouter as {
      usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
    };
    expect(openrouterMeta.usage.promptTokens).toBe(10);
    expect(openrouterMeta.usage.completionTokens).toBe(20);
    expect(openrouterMeta.usage.totalTokens).toBe(30);
  });

  it('should fallback usage.inputTokens.total from openrouterUsage.promptTokens when only standard total is undefined (#419)', async () => {
    // This tests the defensive fallback: if for any reason the standard usage
    // total fields end up undefined but openrouterUsage has valid data,
    // the flush handler should copy values from openrouterUsage.
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-419b","object":"chat.completion.chunk","created":1711357598,"model":"z-ai/glm-5",` +
          `"system_fingerprint":"fp_419b","choices":[{"index":0,"delta":{"role":"assistant","content":"Hi"},` +
          `"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        // Usage chunk with zero tokens (valid edge case)
        `data: {"id":"chatcmpl-419b","object":"chat.completion.chunk","created":1711357598,"model":"z-ai/glm-5",` +
          `"system_fingerprint":"fp_419b","choices":[],"usage":{"prompt_tokens":0,"completion_tokens":0,"total_tokens":0}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    const finishEvent = elements.find(
      (el): el is LanguageModelV3StreamPart & { type: 'finish' } =>
        el.type === 'finish',
    );

    // Even with zero tokens, usage totals should be numbers (not undefined)
    expect(finishEvent?.usage.inputTokens.total).toBe(0);
    expect(finishEvent?.usage.outputTokens.total).toBe(0);
  });

  it('should handle usage with detailed token breakdown in streaming (#419)', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-419c","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-3.5-sonnet",` +
          `"system_fingerprint":"fp_419c","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},` +
          `"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"chatcmpl-419c","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-3.5-sonnet",` +
          `"system_fingerprint":"fp_419c","choices":[],"usage":{"prompt_tokens":50,"completion_tokens":30,"total_tokens":80,` +
          `"prompt_tokens_details":{"cached_tokens":10},"completion_tokens_details":{"reasoning_tokens":5}}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    const finishEvent = elements.find(
      (el): el is LanguageModelV3StreamPart & { type: 'finish' } =>
        el.type === 'finish',
    );

    // Verify detailed token breakdown is preserved
    expect(finishEvent?.usage.inputTokens).toStrictEqual({
      total: 50,
      noCache: 40, // 50 - 10 cached
      cacheRead: 10,
      cacheWrite: undefined,
    });
    expect(finishEvent?.usage.outputTokens).toStrictEqual({
      total: 30,
      text: 25, // 30 - 5 reasoning
      reasoning: 5,
    });
  });

  it('should handle usage arriving in multiple chunks by using last values (#419)', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-419d","object":"chat.completion.chunk","created":1711357598,"model":"z-ai/glm-5",` +
          `"system_fingerprint":"fp_419d","choices":[{"index":0,"delta":{"role":"assistant","content":"Hi"},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // First usage chunk with partial data
        `data: {"id":"chatcmpl-419d","object":"chat.completion.chunk","created":1711357598,"model":"z-ai/glm-5",` +
          `"system_fingerprint":"fp_419d","choices":[],"usage":{"prompt_tokens":5,"completion_tokens":3,"total_tokens":8}}\n\n`,
        // Second usage chunk with updated data (should overwrite)
        `data: {"id":"chatcmpl-419d","object":"chat.completion.chunk","created":1711357598,"model":"z-ai/glm-5",` +
          `"system_fingerprint":"fp_419d","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":15,"completion_tokens":10,"total_tokens":25}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    const finishEvent = elements.find(
      (el): el is LanguageModelV3StreamPart & { type: 'finish' } =>
        el.type === 'finish',
    );

    // Should use the last usage values
    expect(finishEvent?.usage.inputTokens.total).toBe(15);
    expect(finishEvent?.usage.outputTokens.total).toBe(10);
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
            reasoning_details: [],
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
            noCache: 53,
            cacheRead: 0,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: 17,
            text: 17,
            reasoning: 0,
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
            reasoning_details: [],
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
          reasoning_details: [],
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

  it('should send both response_format and tools when both are present in streaming', async () => {
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

    const body = await server.calls[0]!.requestBodyJson;

    // Both response_format and tools should be present (matching @ai-sdk/openai behavior)
    expect(body).toHaveProperty('response_format');
    expect(body).toHaveProperty('tools');

    expect(body).toStrictEqual({
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

  it('should emit exactly one reasoning-start and one reasoning-end when API sends both reasoning and reasoning_details across multiple chunks', async () => {
    // Verification test: proves that our if/else if guard (line 752/818) prevents
    // duplicate reasoning emission even when every chunk has both fields.
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // Chunk 1: both reasoning_details AND reasoning
        `data: {"id":"chatcmpl-dedup","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"role":"assistant","content":"",` +
          `"reasoning":"IGNORED-1",` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":"Used-1"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Chunk 2: both reasoning_details AND reasoning again
        `data: {"id":"chatcmpl-dedup","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{` +
          `"reasoning":"IGNORED-2",` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":"Used-2"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Chunk 3: both reasoning_details AND reasoning yet again
        `data: {"id":"chatcmpl-dedup","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{` +
          `"reasoning":"IGNORED-3",` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":"Used-3"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Content starts
        `data: {"id":"chatcmpl-dedup","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"content":"Hello!"},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Finish
        `data: {"id":"chatcmpl-dedup","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{},` +
          `"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"chatcmpl-dedup","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":20,"total_tokens":30}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    // Count reasoning lifecycle events
    const reasoningStarts = elements.filter(
      (el) => el.type === 'reasoning-start',
    );
    const reasoningEnds = elements.filter((el) => el.type === 'reasoning-end');
    const reasoningDeltas = elements.filter(isReasoningDeltaPart);

    // EXACTLY one reasoning-start and one reasoning-end
    expect(reasoningStarts).toHaveLength(1);
    expect(reasoningEnds).toHaveLength(1);

    // 3 deltas — one per chunk, from reasoning_details only
    expect(reasoningDeltas).toHaveLength(3);

    // All delta content comes from reasoning_details, NOT reasoning field
    const deltaTexts = reasoningDeltas.map((el) => el.delta);
    expect(deltaTexts).toEqual(['Used-1', 'Used-2', 'Used-3']);

    // None of the ignored reasoning field content appears
    expect(deltaTexts).not.toContain('IGNORED-1');
    expect(deltaTexts).not.toContain('IGNORED-2');
    expect(deltaTexts).not.toContain('IGNORED-3');

    // Also verify text events — exactly one text block
    const textStarts = elements.filter((el) => el.type === 'text-start');
    const textEnds = elements.filter((el) => el.type === 'text-end');
    expect(textStarts).toHaveLength(1);
    expect(textEnds).toHaveLength(1);
  });

  it('should emit no duplicate reasoning when reasoning_details switches to reasoning-only mid-stream', async () => {
    // Simulates a stream where early chunks have reasoning_details (prioritized)
    // and later chunks only have reasoning (fallback). Verifies the single
    // reasoning block spans both without creating a second start/end pair.
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // Chunk 1: reasoning_details (prioritized)
        `data: {"id":"chatcmpl-mixed","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"role":"assistant","content":"",` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":"Detailed thought"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Chunk 2: only reasoning field (fallback path)
        `data: {"id":"chatcmpl-mixed","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{` +
          `"reasoning":" continued thought"},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Chunk 3: content
        `data: {"id":"chatcmpl-mixed","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"content":"Result"},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Finish
        `data: {"id":"chatcmpl-mixed","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{},` +
          `"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"chatcmpl-mixed","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":20,"total_tokens":30}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    // Still exactly one reasoning block
    const reasoningStarts = elements.filter(
      (el) => el.type === 'reasoning-start',
    );
    const reasoningEnds = elements.filter((el) => el.type === 'reasoning-end');
    expect(reasoningStarts).toHaveLength(1);
    expect(reasoningEnds).toHaveLength(1);

    // Two deltas: one from reasoning_details, one from reasoning fallback
    const reasoningDeltas = elements.filter(isReasoningDeltaPart);
    expect(reasoningDeltas).toHaveLength(2);
    expect(reasoningDeltas.map((el) => el.delta)).toEqual([
      'Detailed thought',
      ' continued thought',
    ]);

    // Reasoning block ordering: start < all deltas < end < text-start
    const types = elements.map((el) => el.type);
    const startIdx = types.indexOf('reasoning-start');
    const endIdx = types.indexOf('reasoning-end');
    const textStartIdx = types.indexOf('text-start');
    expect(startIdx).toBeLessThan(endIdx);
    expect(endIdx).toBeLessThan(textStartIdx);
  });

  it('should not emit reasoning events from the reasoning field when reasoning_details is an empty array', async () => {
    // Edge case: reasoning_details is present but empty. The if branch
    // checks length > 0, so the else-if reasoning path should activate.
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // Chunk with empty reasoning_details AND reasoning field
        `data: {"id":"chatcmpl-empty","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"role":"assistant",` +
          `"reasoning":"Fallback text",` +
          `"reasoning_details":[]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Content
        `data: {"id":"chatcmpl-empty","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{"content":"Done"},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Finish
        `data: {"id":"chatcmpl-empty","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[{"index":0,"delta":{},` +
          `"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"chatcmpl-empty","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_3bc1b5746c","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    // Empty reasoning_details falls through to else-if, so reasoning field is used
    const reasoningDeltas = elements.filter(isReasoningDeltaPart);
    expect(reasoningDeltas).toHaveLength(1);
    expect(reasoningDeltas[0]?.delta).toBe('Fallback text');

    // Still exactly one reasoning block
    expect(elements.filter((el) => el.type === 'reasoning-start')).toHaveLength(
      1,
    );
    expect(elements.filter((el) => el.type === 'reasoning-end')).toHaveLength(
      1,
    );
  });

  it('should not emit a second reasoning block when signature-only reasoning_details arrive after text has started', async () => {
    // Reproduces the exact scenario reported by vacavaca in issue #423:
    // 1. Reasoning deltas arrive (no signature)
    // 2. Text content starts (reasoning-end emitted, reasoningStarted reset)
    // 3. A late signature-only reasoning_details delta arrives
    // Without the fix, step 3 starts a NEW reasoning block because
    // reasoningStarted was reset to false. This creates duplicate
    // reasoning parts in the UIMessage.
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // Chunk 1: reasoning text, no signature
        `data: {"id":"chatcmpl-sig-late","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"role":"assistant","content":"",` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":"Let me think","index":0,"format":"anthropic-claude-v1"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Chunk 2: more reasoning text, still no signature
        `data: {"id":"chatcmpl-sig-late","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":" about this.","index":0,"format":"anthropic-claude-v1"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Chunk 3: text content starts (triggers reasoning-end)
        `data: {"id":"chatcmpl-sig-late","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"content":"Hello!"},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Chunk 4: more text
        `data: {"id":"chatcmpl-sig-late","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"content":" How can I help?"},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Chunk 5: LATE signature-only reasoning_details (arrives after text started)
        `data: {"id":"chatcmpl-sig-late","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":"","index":0,"format":"anthropic-claude-v1","signature":"erX9OCAqSEO90HsfvNlBn5J3BQ9cEI/Hg2wHFo5iA8w3L+a"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Finish
        `data: {"id":"chatcmpl-sig-late","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{},` +
          `"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"chatcmpl-sig-late","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[],"usage":{"prompt_tokens":100,"completion_tokens":50,"total_tokens":150}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    // EXACTLY one reasoning block — the late signature must NOT create a second
    const reasoningStarts = elements.filter(
      (el) => el.type === 'reasoning-start',
    );
    const reasoningEnds = elements.filter((el) => el.type === 'reasoning-end');
    expect(reasoningStarts).toHaveLength(1);
    expect(reasoningEnds).toHaveLength(1);

    // Only 2 reasoning deltas (from the text chunks), NOT 3
    const reasoningDeltas = elements.filter(isReasoningDeltaPart);
    expect(reasoningDeltas).toHaveLength(2);
    expect(reasoningDeltas.map((el) => el.delta)).toEqual([
      'Let me think',
      ' about this.',
    ]);

    // Text block is also exactly one
    const textStarts = elements.filter((el) => el.type === 'text-start');
    const textEnds = elements.filter((el) => el.type === 'text-end');
    expect(textStarts).toHaveLength(1);
    expect(textEnds).toHaveLength(1);

    // Verify event ordering: reasoning before text, no interleaving
    const types = elements.map((el) => el.type);
    const reasoningEndIdx = types.indexOf('reasoning-end');
    const textStartIdx = types.indexOf('text-start');
    expect(reasoningEndIdx).toBeLessThan(textStartIdx);

    // The late signature MUST still be accumulated in accumulatedReasoningDetails
    // and appear in the finish event's providerMetadata for multi-turn roundtrip
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
      text: 'Let me think about this.',
      signature: 'erX9OCAqSEO90HsfvNlBn5J3BQ9cEI/Hg2wHFo5iA8w3L+a',
      format: 'anthropic-claude-v1',
    });

    // The reasoning-end providerMetadata should have the details as they
    // were when reasoning ended (before the late signature arrived)
    const reasoningEnd = elements.find(
      (
        el,
      ): el is Extract<LanguageModelV3StreamPart, { type: 'reasoning-end' }> =>
        el.type === 'reasoning-end',
    );

    expect(reasoningEnd?.providerMetadata).toBeDefined();
  });

  it('should accumulate multiple late reasoning_details after text without creating duplicate blocks', async () => {
    // Edge case: API sends MULTIPLE reasoning_details chunks after text
    // (e.g. encrypted blob + signature-only + another text fragment).
    // All must be accumulated for multi-turn but none should create reasoning events.
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // Reasoning text
        `data: {"id":"chatcmpl-multi-late","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"role":"assistant","content":"",` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":"Thinking...","index":0,"format":"anthropic-claude-v1"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Text content starts
        `data: {"id":"chatcmpl-multi-late","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"content":"Result"},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Late: encrypted reasoning blob
        `data: {"id":"chatcmpl-multi-late","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Encrypted}","data":"encrypted-blob-data"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Late: signature-only
        `data: {"id":"chatcmpl-multi-late","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":"","index":0,"format":"anthropic-claude-v1","signature":"sig123"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Late: another text fragment
        `data: {"id":"chatcmpl-multi-late","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Summary}","summary":"Late summary"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Finish
        `data: {"id":"chatcmpl-multi-late","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{},` +
          `"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"chatcmpl-multi-late","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":20,"total_tokens":30}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({ prompt: TEST_PROMPT });
    const elements = await convertReadableStreamToArray(stream);

    // Still exactly one reasoning block
    expect(elements.filter((el) => el.type === 'reasoning-start')).toHaveLength(
      1,
    );
    expect(elements.filter((el) => el.type === 'reasoning-end')).toHaveLength(
      1,
    );

    // Only 1 reasoning delta (from before text started)
    const reasoningDeltas = elements.filter(isReasoningDeltaPart);
    expect(reasoningDeltas).toHaveLength(1);
    expect(reasoningDeltas[0]?.delta).toBe('Thinking...');

    // ALL late details must be accumulated in finish metadata
    const finishEvent = elements.find(
      (el): el is Extract<LanguageModelV3StreamPart, { type: 'finish' }> =>
        el.type === 'finish',
    );
    const finishDetails = (
      finishEvent?.providerMetadata?.openrouter as {
        reasoning_details: ReasoningDetailUnion[];
      }
    )?.reasoning_details;

    // Text detail, encrypted, signature-only text (can't merge — encrypted is between),
    // summary
    expect(finishDetails).toHaveLength(4);
    expect(finishDetails[0]).toMatchObject({
      type: ReasoningDetailType.Text,
      text: 'Thinking...',
    });
    expect(finishDetails[1]).toMatchObject({
      type: ReasoningDetailType.Encrypted,
      data: 'encrypted-blob-data',
    });
    // Signature-only delta creates a separate Text entry since the previous
    // detail is Encrypted — consecutive merging only works for adjacent Text entries
    expect(finishDetails[2]).toMatchObject({
      type: ReasoningDetailType.Text,
      text: '',
      signature: 'sig123',
    });
    expect(finishDetails[3]).toMatchObject({
      type: ReasoningDetailType.Summary,
      summary: 'Late summary',
    });
  });

  it('should handle reasoning_details and content arriving in the same delta chunk', async () => {
    // Edge case: a single SSE chunk contains BOTH reasoning_details AND content.
    // The reasoning_details processing runs before content processing in the
    // transform function, so textStarted is still false during reasoning emission.
    // This should produce exactly one reasoning block followed by text.
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // Single chunk with both reasoning_details AND content
        `data: {"id":"chatcmpl-same-chunk","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"role":"assistant",` +
          `"content":"Hello!",` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":"Quick thought","index":0,"format":"anthropic-claude-v1","signature":"sig-same"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Finish
        `data: {"id":"chatcmpl-same-chunk","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{},` +
          `"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"chatcmpl-same-chunk","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({ prompt: TEST_PROMPT });
    const elements = await convertReadableStreamToArray(stream);

    // Exactly one reasoning block and one text block
    expect(elements.filter((el) => el.type === 'reasoning-start')).toHaveLength(
      1,
    );
    expect(elements.filter((el) => el.type === 'reasoning-end')).toHaveLength(
      1,
    );
    expect(elements.filter((el) => el.type === 'text-start')).toHaveLength(1);
    expect(elements.filter((el) => el.type === 'text-end')).toHaveLength(1);

    // Reasoning has correct content
    const reasoningDeltas = elements.filter(isReasoningDeltaPart);
    expect(reasoningDeltas).toHaveLength(1);
    expect(reasoningDeltas[0]?.delta).toBe('Quick thought');

    // Text has correct content
    const textDeltas = elements.filter(isTextDeltaPart);
    expect(textDeltas).toHaveLength(1);
    expect(textDeltas[0]?.delta).toBe('Hello!');

    // Ordering: reasoning-start < reasoning-end < text-start
    const types = elements.map((el) => el.type);
    expect(types.indexOf('reasoning-start')).toBeLessThan(
      types.indexOf('reasoning-end'),
    );
    expect(types.indexOf('reasoning-end')).toBeLessThan(
      types.indexOf('text-start'),
    );

    // Signature should be in finish metadata
    const finishEvent = elements.find(
      (el): el is Extract<LanguageModelV3StreamPart, { type: 'finish' }> =>
        el.type === 'finish',
    );
    const finishDetails = (
      finishEvent?.providerMetadata?.openrouter as {
        reasoning_details: ReasoningDetailUnion[];
      }
    )?.reasoning_details;
    expect(finishDetails?.[0]).toMatchObject({
      type: ReasoningDetailType.Text,
      signature: 'sig-same',
    });
  });

  it('should not emit reasoning events when reasoning_details arrive only after text has started', async () => {
    // Edge case: model sends text FIRST, then reasoning_details later.
    // No reasoning block should be created — data is only in finish metadata.
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // Text first
        `data: {"id":"chatcmpl-text-first","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"role":"assistant","content":"Answer first."},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Reasoning_details arrives after text
        `data: {"id":"chatcmpl-text-first","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":"Late reasoning","index":0,"format":"anthropic-claude-v1","signature":"sig-late"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Finish
        `data: {"id":"chatcmpl-text-first","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{},` +
          `"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"chatcmpl-text-first","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_test","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({ prompt: TEST_PROMPT });
    const elements = await convertReadableStreamToArray(stream);

    // NO reasoning events at all
    expect(elements.filter((el) => el.type === 'reasoning-start')).toHaveLength(
      0,
    );
    expect(elements.filter((el) => el.type === 'reasoning-end')).toHaveLength(
      0,
    );
    expect(elements.filter(isReasoningDeltaPart)).toHaveLength(0);

    // Text block exists
    expect(elements.filter((el) => el.type === 'text-start')).toHaveLength(1);

    // But reasoning data IS in finish metadata for multi-turn
    const finishEvent = elements.find(
      (el): el is Extract<LanguageModelV3StreamPart, { type: 'finish' }> =>
        el.type === 'finish',
    );
    const finishDetails = (
      finishEvent?.providerMetadata?.openrouter as {
        reasoning_details: ReasoningDetailUnion[];
      }
    )?.reasoning_details;
    expect(finishDetails).toHaveLength(1);
    expect(finishDetails[0]).toMatchObject({
      type: ReasoningDetailType.Text,
      text: 'Late reasoning',
      signature: 'sig-late',
    });
  });

  it('should not emit reasoning from legacy reasoning field after text has started', async () => {
    // Edge case: the legacy `reasoning` field (not reasoning_details) arrives
    // after text. The else-if guard should prevent emission.
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // Text first
        `data: {"id":"chatcmpl-legacy-late","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Legacy reasoning field arrives after text
        `data: {"id":"chatcmpl-legacy-late","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{` +
          `"reasoning":"Late legacy reasoning"},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Finish
        `data: {"id":"chatcmpl-legacy-late","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{},` +
          `"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"chatcmpl-legacy-late","object":"chat.completion.chunk","created":1711357598,"model":"gpt-3.5-turbo-0125",` +
          `"system_fingerprint":"fp_test","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({ prompt: TEST_PROMPT });
    const elements = await convertReadableStreamToArray(stream);

    // NO reasoning events
    expect(elements.filter((el) => el.type === 'reasoning-start')).toHaveLength(
      0,
    );
    expect(elements.filter((el) => el.type === 'reasoning-end')).toHaveLength(
      0,
    );
    expect(elements.filter(isReasoningDeltaPart)).toHaveLength(0);

    // Text block exists with correct content
    const textDeltas = elements.filter(isTextDeltaPart);
    expect(textDeltas).toHaveLength(1);
    expect(textDeltas[0]?.delta).toBe('Hello');
  });

  it('should preserve late signature in tool call providerMetadata', async () => {
    // Edge case: reasoning → late signature → tool call (no text content).
    // The tool call's providerMetadata should include the late signature
    // from accumulatedReasoningDetails.
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // Reasoning
        `data: {"id":"chatcmpl-tool-sig","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"role":"assistant","content":"",` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":"Need a tool","index":0,"format":"anthropic-claude-v1"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Signature arrives with reasoning text
        `data: {"id":"chatcmpl-tool-sig","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":"","index":0,"format":"anthropic-claude-v1","signature":"tool-sig-123"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Tool call start (name + id)
        `data: {"id":"chatcmpl-tool-sig","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{` +
          `"tool_calls":[{"index":0,"id":"call_123","type":"function","function":{"name":"get_weather","arguments":""}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Tool call arguments
        `data: {"id":"chatcmpl-tool-sig","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{` +
          `"tool_calls":[{"index":0,"function":{"arguments":"{\\"city\\":\\"SF\\"}"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Finish with tool_calls reason
        `data: {"id":"chatcmpl-tool-sig","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{},` +
          `"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        // Usage
        `data: {"id":"chatcmpl-tool-sig","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":20,"total_tokens":30}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({ prompt: TEST_PROMPT });
    const elements = await convertReadableStreamToArray(stream);

    // Reasoning block has 2 deltas (text + signature-only, both before text started)
    const reasoningDeltas = elements.filter(isReasoningDeltaPart);
    expect(reasoningDeltas).toHaveLength(2);

    // Tool call should have reasoning_details with signature
    const toolCallEvent = elements.find(
      (el): el is Extract<LanguageModelV3StreamPart, { type: 'tool-call' }> =>
        el.type === 'tool-call',
    );
    expect(toolCallEvent).toBeDefined();

    const toolReasoningDetails = (
      toolCallEvent?.providerMetadata?.openrouter as {
        reasoning_details: ReasoningDetailUnion[];
      }
    )?.reasoning_details;

    expect(toolReasoningDetails).toHaveLength(1);
    expect(toolReasoningDetails[0]).toMatchObject({
      type: ReasoningDetailType.Text,
      text: 'Need a tool',
      signature: 'tool-sig-123',
    });
  });

  it('should handle reasoning → text → late signature → more text without duplicate reasoning', async () => {
    // Edge case: text content continues AFTER the late signature delta.
    // The late signature is sandwiched between text deltas.
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // Reasoning
        `data: {"id":"chatcmpl-sandwich","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"role":"assistant","content":"",` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":"Reasoning here","index":0,"format":"anthropic-claude-v1"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Text starts
        `data: {"id":"chatcmpl-sandwich","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"content":"First "},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Late signature (sandwiched between text)
        `data: {"id":"chatcmpl-sandwich","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":"","index":0,"format":"anthropic-claude-v1","signature":"sandwich-sig"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // More text after signature
        `data: {"id":"chatcmpl-sandwich","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"content":"second part"},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Finish
        `data: {"id":"chatcmpl-sandwich","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{},` +
          `"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"chatcmpl-sandwich","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":10,"total_tokens":20}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({ prompt: TEST_PROMPT });
    const elements = await convertReadableStreamToArray(stream);

    // Exactly one reasoning block
    expect(elements.filter((el) => el.type === 'reasoning-start')).toHaveLength(
      1,
    );
    expect(elements.filter((el) => el.type === 'reasoning-end')).toHaveLength(
      1,
    );

    // Text content is continuous — both deltas present
    const textDeltas = elements.filter(isTextDeltaPart);
    expect(textDeltas).toHaveLength(2);
    expect(textDeltas.map((el) => el.delta)).toEqual(['First ', 'second part']);

    // Signature in finish metadata
    const finishEvent = elements.find(
      (el): el is Extract<LanguageModelV3StreamPart, { type: 'finish' }> =>
        el.type === 'finish',
    );
    const finishDetails = (
      finishEvent?.providerMetadata?.openrouter as {
        reasoning_details: ReasoningDetailUnion[];
      }
    )?.reasoning_details;
    expect(finishDetails?.[0]).toMatchObject({
      type: ReasoningDetailType.Text,
      text: 'Reasoning here',
      signature: 'sandwich-sig',
    });
  });

  it('should have correct reasoning-end metadata (pre-signature) and finish metadata (with signature)', async () => {
    // Verifies the split: reasoning-end carries accumulated details as they
    // were WHEN reasoning ended (before late signature). The finish event
    // carries the FULL accumulated details including the late signature.
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // Reasoning text
        `data: {"id":"chatcmpl-split-meta","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"role":"assistant","content":"",` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":"My reasoning","index":0,"format":"anthropic-claude-v1"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Text starts (triggers reasoning-end)
        `data: {"id":"chatcmpl-split-meta","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"content":"Answer"},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Late signature
        `data: {"id":"chatcmpl-split-meta","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":"","index":0,"format":"anthropic-claude-v1","signature":"split-sig"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Finish
        `data: {"id":"chatcmpl-split-meta","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{},` +
          `"logprobs":null,"finish_reason":"stop"}]}\n\n`,
        `data: {"id":"chatcmpl-split-meta","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.6",` +
          `"system_fingerprint":"fp_test","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({ prompt: TEST_PROMPT });
    const elements = await convertReadableStreamToArray(stream);

    // reasoning-end metadata: has the text but NO signature (it arrived later)
    const reasoningEnd = elements.find(
      (
        el,
      ): el is Extract<LanguageModelV3StreamPart, { type: 'reasoning-end' }> =>
        el.type === 'reasoning-end',
    );
    const reasoningEndDetails = (
      reasoningEnd?.providerMetadata?.openrouter as {
        reasoning_details: ReasoningDetailUnion[];
      }
    )?.reasoning_details;

    expect(reasoningEndDetails).toHaveLength(1);
    expect(reasoningEndDetails[0]).toMatchObject({
      type: ReasoningDetailType.Text,
      text: 'My reasoning',
    });
    // Note: accumulatedReasoningDetails is passed by reference to reasoning-end,
    // so the late signature mutation IS visible here. This is correct behavior —
    // the AI SDK can use the signature from reasoning-end's providerMetadata
    // to update the reasoning part even before the finish event.
    const endDetail = reasoningEndDetails[0];
    if (endDetail?.type === ReasoningDetailType.Text) {
      expect(endDetail.signature).toBe('split-sig');
    }

    // finish event metadata: has BOTH text AND signature (accumulated after text)
    const finishEvent = elements.find(
      (el): el is Extract<LanguageModelV3StreamPart, { type: 'finish' }> =>
        el.type === 'finish',
    );
    const finishDetails = (
      finishEvent?.providerMetadata?.openrouter as {
        reasoning_details: ReasoningDetailUnion[];
      }
    )?.reasoning_details;

    expect(finishDetails).toHaveLength(1);
    expect(finishDetails[0]).toMatchObject({
      type: ReasoningDetailType.Text,
      text: 'My reasoning',
      signature: 'split-sig',
      format: 'anthropic-claude-v1',
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

  it('should emit tool-input-end before tool-call in multi-chunk streaming path', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // First chunk: tool call start with empty arguments
        `data: {"id":"chatcmpl-multi","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_multi","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_multi_001","type":"function","function":{"name":"get_weather","arguments":""}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Second chunk: partial arguments
        `data: {"id":"chatcmpl-multi","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_multi","choices":[{"index":0,"delta":{` +
          `"tool_calls":[{"index":0,"function":{"arguments":"{\\"city"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Third chunk: completes the JSON
        `data: {"id":"chatcmpl-multi","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_multi","choices":[{"index":0,"delta":{` +
          `"tool_calls":[{"index":0,"function":{"arguments":"\\":\\"Tokyo\\"}"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Finish
        `data: {"id":"chatcmpl-multi","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_multi","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-multi","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_multi","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":20,"total_tokens":30}}\n\n`,
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
            properties: { city: { type: 'string' } },
            required: ['city'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    // Extract just tool-related events in order
    const toolEvents = elements.filter((el) =>
      [
        'tool-input-start',
        'tool-input-delta',
        'tool-input-end',
        'tool-call',
      ].includes(el.type),
    );

    // tool-input-end MUST appear before tool-call
    expect(toolEvents.map((e) => e.type)).toStrictEqual([
      'tool-input-start',
      'tool-input-delta',
      'tool-input-delta',
      'tool-input-end',
      'tool-call',
    ]);
  });

  it('should emit tool-input-start, tool-input-delta, and tool-input-end in flush path for unsent tool calls', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // Tool call arrives but arguments are not valid JSON (incomplete)
        `data: {"id":"chatcmpl-flush","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_flush","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_flush_001","type":"function","function":{"name":"search","arguments":"{\\"q\\""}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Stream ends with tool_calls finish_reason but JSON never completed during streaming
        `data: {"id":"chatcmpl-flush","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_flush","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-flush","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_flush","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      tools: [
        {
          type: 'function',
          name: 'search',
          inputSchema: {
            type: 'object',
            properties: { q: { type: 'string' } },
            required: ['q'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    const toolEvents = elements.filter((el) =>
      [
        'tool-input-start',
        'tool-input-delta',
        'tool-input-end',
        'tool-call',
      ].includes(el.type),
    );

    // Flush path should emit the full tool-input lifecycle before tool-call
    // The tool call had incomplete JSON so it was never sent during streaming,
    // so flush should emit: tool-input-start → tool-input-delta → tool-input-end → tool-call
    expect(toolEvents.map((e) => e.type)).toStrictEqual([
      'tool-input-start',
      'tool-input-delta',
      'tool-input-end',
      'tool-call',
    ]);

    // The tool-call should have coerced the invalid JSON to '{}'
    const toolCall = toolEvents.find((e) => e.type === 'tool-call');
    expect(toolCall).toMatchObject({
      type: 'tool-call',
      toolCallId: 'call_flush_001',
      toolName: 'search',
      input: '{}',
    });
  });

  it('should emit only tool-input-end in flush path when tool call was partially streamed', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // First chunk: tool call start with empty arguments
        `data: {"id":"chatcmpl-partial","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_partial","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_partial_001","type":"function","function":{"name":"search","arguments":""}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Second chunk: partial arguments (triggers inputStarted via merge path)
        `data: {"id":"chatcmpl-partial","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_partial","choices":[{"index":0,"delta":{` +
          `"tool_calls":[{"index":0,"function":{"arguments":"{\\"q\\""}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Stream ends with tool_calls but JSON never completed
        `data: {"id":"chatcmpl-partial","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_partial","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-partial","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_partial","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      tools: [
        {
          type: 'function',
          name: 'search',
          inputSchema: {
            type: 'object',
            properties: { q: { type: 'string' } },
            required: ['q'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    const toolEvents = elements.filter((el) =>
      [
        'tool-input-start',
        'tool-input-delta',
        'tool-input-end',
        'tool-call',
      ].includes(el.type),
    );

    // Since merge path already emitted tool-input-start + tool-input-delta,
    // flush should only add tool-input-end (no duplicate delta) + tool-call
    expect(toolEvents.map((e) => e.type)).toStrictEqual([
      'tool-input-start',
      'tool-input-delta',
      'tool-input-end',
      'tool-call',
    ]);
  });

  it('should emit initial chunk arguments as tool-input-delta in multi-chunk merge path', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // First chunk: tool call start with partial (non-empty, non-parsable) arguments
        `data: {"id":"chatcmpl-initargs","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_initargs","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_initargs_001","type":"function","function":{"name":"search","arguments":"{\\"q"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Second chunk: completes the JSON
        `data: {"id":"chatcmpl-initargs","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_initargs","choices":[{"index":0,"delta":{` +
          `"tool_calls":[{"index":0,"function":{"arguments":"\\":\\"hello\\"}"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Finish
        `data: {"id":"chatcmpl-initargs","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_initargs","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-initargs","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_initargs","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":10,"total_tokens":20}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      tools: [
        {
          type: 'function',
          name: 'search',
          inputSchema: {
            type: 'object',
            properties: { q: { type: 'string' } },
            required: ['q'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    const toolInputDeltas = elements.filter(
      (el): el is LanguageModelV3StreamPart & { type: 'tool-input-delta' } =>
        el.type === 'tool-input-delta',
    );

    // Both the initial chunk's arguments AND the merge chunk's arguments
    // should appear as separate deltas
    expect(toolInputDeltas).toHaveLength(2);
    expect(toolInputDeltas.at(0)?.delta).toBe('{"q');
    expect(toolInputDeltas.at(1)?.delta).toBe('":"hello"}');
  });

  it('should emit complete tool-input lifecycle for parallel tool calls in multi-chunk streaming', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // First chunk: two tool calls start simultaneously with empty arguments
        `data: {"id":"chatcmpl-parallel","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_par","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[` +
          `{"index":0,"id":"call_par_001","type":"function","function":{"name":"get_weather","arguments":""}},` +
          `{"index":1,"id":"call_par_002","type":"function","function":{"name":"get_time","arguments":""}}` +
          `]},"logprobs":null,"finish_reason":null}]}\n\n`,
        // Second chunk: partial arguments for tool 0 — sends {"city
        `data: {"id":"chatcmpl-parallel","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_par","choices":[{"index":0,"delta":{` +
          `"tool_calls":[{"index":0,"function":{"arguments":"{\\"city"}}]},"logprobs":null,"finish_reason":null}]}\n\n`,
        // Third chunk: partial arguments for tool 1 — sends {"zone
        `data: {"id":"chatcmpl-parallel","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_par","choices":[{"index":0,"delta":{` +
          `"tool_calls":[{"index":1,"function":{"arguments":"{\\"zone"}}]},"logprobs":null,"finish_reason":null}]}\n\n`,
        // Fourth chunk: complete tool 0 — sends ":"Tokyo"}
        `data: {"id":"chatcmpl-parallel","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_par","choices":[{"index":0,"delta":{` +
          `"tool_calls":[{"index":0,"function":{"arguments":"\\":\\"Tokyo\\"}"}}]},"logprobs":null,"finish_reason":null}]}\n\n`,
        // Fifth chunk: complete tool 1 — sends ":"UTC"}
        `data: {"id":"chatcmpl-parallel","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_par","choices":[{"index":0,"delta":{` +
          `"tool_calls":[{"index":1,"function":{"arguments":"\\":\\"UTC\\"}"}}]},"logprobs":null,"finish_reason":null}]}\n\n`,
        // Finish
        `data: {"id":"chatcmpl-parallel","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_par","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-parallel","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_par","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":20,"total_tokens":30}}\n\n`,
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
            properties: { city: { type: 'string' } },
            required: ['city'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
        {
          type: 'function',
          name: 'get_time',
          inputSchema: {
            type: 'object',
            properties: { zone: { type: 'string' } },
            required: ['zone'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    // Extract tool events grouped by tool call ID (tool-call uses toolCallId, others use id)
    const tool0Events = elements.filter(
      (el) =>
        (('id' in el && el.id === 'call_par_001') ||
          ('toolCallId' in el && el.toolCallId === 'call_par_001')) &&
        el.type !== 'response-metadata',
    );
    const tool1Events = elements.filter(
      (el) =>
        (('id' in el && el.id === 'call_par_002') ||
          ('toolCallId' in el && el.toolCallId === 'call_par_002')) &&
        el.type !== 'response-metadata',
    );

    // Tool 0 lifecycle: start → delta(s) → end → call
    expect(tool0Events.map((e) => e.type)).toStrictEqual([
      'tool-input-start',
      'tool-input-delta',
      'tool-input-delta',
      'tool-input-end',
      'tool-call',
    ]);

    // Tool 1 lifecycle: start → delta(s) → end → call
    expect(tool1Events.map((e) => e.type)).toStrictEqual([
      'tool-input-start',
      'tool-input-delta',
      'tool-input-delta',
      'tool-input-end',
      'tool-call',
    ]);

    // Verify tool-call inputs are correct (accumulated correctly)
    const tool0Call = tool0Events.find((e) => e.type === 'tool-call');
    const tool1Call = tool1Events.find((e) => e.type === 'tool-call');
    expect(tool0Call).toMatchObject({ input: '{"city":"Tokyo"}' });
    expect(tool1Call).toMatchObject({ input: '{"zone":"UTC"}' });
  });

  it('should not emit extra events in single-chunk complete path (regression guard)', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-single","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_single","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_single_001","type":"function","function":{"name":"get_weather","arguments":"{\\"city\\":\\"Paris\\"}"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-single","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_single","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-single","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_single","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n`,
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
            properties: { city: { type: 'string' } },
            required: ['city'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);
    const toolEvents = elements.filter((el) =>
      [
        'tool-input-start',
        'tool-input-delta',
        'tool-input-end',
        'tool-call',
      ].includes(el.type),
    );

    // Single-chunk path: exactly start → delta → end → call (no extra deltas or events)
    expect(toolEvents.map((e) => e.type)).toStrictEqual([
      'tool-input-start',
      'tool-input-delta',
      'tool-input-end',
      'tool-call',
    ]);

    // Only 1 delta with the full arguments
    const deltas = toolEvents.filter((e) => e.type === 'tool-input-delta');
    expect(deltas).toHaveLength(1);
    expect(deltas.at(0)).toMatchObject({ delta: '{"city":"Paris"}' });

    // tool-call input matches
    expect(toolEvents.find((e) => e.type === 'tool-call')).toMatchObject({
      input: '{"city":"Paris"}',
    });
  });

  it('should not emit initial-chunk delta when first chunk has empty arguments', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // First chunk: tool call start with empty arguments
        `data: {"id":"chatcmpl-empty","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_empty","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_empty_001","type":"function","function":{"name":"get_weather","arguments":""}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Second chunk: all arguments arrive at once as complete JSON
        `data: {"id":"chatcmpl-empty","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_empty","choices":[{"index":0,"delta":{` +
          `"tool_calls":[{"index":0,"function":{"arguments":"{\\"city\\":\\"Berlin\\"}"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-empty","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_empty","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-empty","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_empty","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n`,
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
            properties: { city: { type: 'string' } },
            required: ['city'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);
    const toolInputDeltas = elements.filter(
      (el) => el.type === 'tool-input-delta',
    );

    // Empty initial args should NOT produce an initial-chunk delta.
    // The second chunk sends complete JSON via merge path, which completes
    // the tool call during streaming. Only 1 delta is emitted (the complete args).
    expect(toolInputDeltas).toHaveLength(1);
    expect(toolInputDeltas.at(0)).toMatchObject({ delta: '{"city":"Berlin"}' });
  });

  it('should accumulate correct tool-call input across many chunks (5+ deltas)', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-many","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_many","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_many_001","type":"function","function":{"name":"search","arguments":""}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-many","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_many","choices":[{"index":0,"delta":{` +
          `"tool_calls":[{"index":0,"function":{"arguments":"{"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-many","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_many","choices":[{"index":0,"delta":{` +
          `"tool_calls":[{"index":0,"function":{"arguments":"\\"q"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-many","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_many","choices":[{"index":0,"delta":{` +
          `"tool_calls":[{"index":0,"function":{"arguments":"\\":"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-many","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_many","choices":[{"index":0,"delta":{` +
          `"tool_calls":[{"index":0,"function":{"arguments":"\\"hi"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-many","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_many","choices":[{"index":0,"delta":{` +
          `"tool_calls":[{"index":0,"function":{"arguments":"\\"}"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-many","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_many","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-many","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_many","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":10,"total_tokens":20}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      tools: [
        {
          type: 'function',
          name: 'search',
          inputSchema: {
            type: 'object',
            properties: { q: { type: 'string' } },
            required: ['q'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);
    const toolEvents = elements.filter((el) =>
      [
        'tool-input-start',
        'tool-input-delta',
        'tool-input-end',
        'tool-call',
      ].includes(el.type),
    );

    // Verify lifecycle ordering
    const types = toolEvents.map((e) => e.type);
    expect(types.at(0)).toBe('tool-input-start');
    expect(types.at(-2)).toBe('tool-input-end');
    expect(types.at(-1)).toBe('tool-call');

    // All middle events should be deltas
    const middleTypes = types.slice(1, -2);
    expect(middleTypes.every((t) => t === 'tool-input-delta')).toBe(true);

    // Concatenated deltas should equal the tool-call input
    const deltas = toolEvents
      .filter(
        (e): e is LanguageModelV3StreamPart & { type: 'tool-input-delta' } =>
          e.type === 'tool-input-delta',
      )
      .map((e) => e.delta)
      .join('');
    const toolCall = toolEvents.find((e) => e.type === 'tool-call');
    expect(toolCall).toMatchObject({ input: '{"q":"hi"}' });
    expect(deltas).toBe('{"q":"hi"}');
  });

  it('should emit full lifecycle for multiple unsent tool calls in flush path', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // Two tool calls arrive in one chunk, neither has valid JSON
        `data: {"id":"chatcmpl-multiflush","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_mf","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[` +
          `{"index":0,"id":"call_mf_001","type":"function","function":{"name":"tool_a","arguments":"{\\"x"}},` +
          `{"index":1,"id":"call_mf_002","type":"function","function":{"name":"tool_b","arguments":"{\\"y"}}` +
          `]},"logprobs":null,"finish_reason":null}]}\n\n`,
        // Stream ends — both tool calls have incomplete JSON
        `data: {"id":"chatcmpl-multiflush","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_mf","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-multiflush","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_mf","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":10,"total_tokens":20}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      tools: [
        {
          type: 'function',
          name: 'tool_a',
          inputSchema: {
            type: 'object',
            properties: { x: { type: 'string' } },
            required: ['x'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
        {
          type: 'function',
          name: 'tool_b',
          inputSchema: {
            type: 'object',
            properties: { y: { type: 'string' } },
            required: ['y'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    const tool0Events = elements.filter(
      (el) =>
        ('id' in el && el.id === 'call_mf_001') ||
        ('toolCallId' in el && el.toolCallId === 'call_mf_001'),
    );
    const tool1Events = elements.filter(
      (el) =>
        ('id' in el && el.id === 'call_mf_002') ||
        ('toolCallId' in el && el.toolCallId === 'call_mf_002'),
    );

    // Both tool calls should get full lifecycle from flush path
    expect(tool0Events.map((e) => e.type)).toStrictEqual([
      'tool-input-start',
      'tool-input-delta',
      'tool-input-end',
      'tool-call',
    ]);
    expect(tool1Events.map((e) => e.type)).toStrictEqual([
      'tool-input-start',
      'tool-input-delta',
      'tool-input-end',
      'tool-call',
    ]);

    // Both should have coerced input to '{}'
    expect(tool0Events.find((e) => e.type === 'tool-call')).toMatchObject({
      input: '{}',
    });
    expect(tool1Events.find((e) => e.type === 'tool-call')).toMatchObject({
      input: '{}',
    });
  });

  it('should handle mixed paths: one tool completes during stream, another goes to flush', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // Two tool calls start
        `data: {"id":"chatcmpl-mixed","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_mix","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[` +
          `{"index":0,"id":"call_mix_001","type":"function","function":{"name":"fast_tool","arguments":"{\\"a\\":\\"1\\"}"}},` +
          `{"index":1,"id":"call_mix_002","type":"function","function":{"name":"slow_tool","arguments":""}}` +
          `]},"logprobs":null,"finish_reason":null}]}\n\n`,
        // Tool 1 gets partial args but never completes
        `data: {"id":"chatcmpl-mixed","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_mix","choices":[{"index":0,"delta":{` +
          `"tool_calls":[{"index":1,"function":{"arguments":"{\\"b\\""}}]},"logprobs":null,"finish_reason":null}]}\n\n`,
        // Stream ends
        `data: {"id":"chatcmpl-mixed","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_mix","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-mixed","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_mix","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":10,"total_tokens":20}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      tools: [
        {
          type: 'function',
          name: 'fast_tool',
          inputSchema: {
            type: 'object',
            properties: { a: { type: 'string' } },
            required: ['a'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
        {
          type: 'function',
          name: 'slow_tool',
          inputSchema: {
            type: 'object',
            properties: { b: { type: 'string' } },
            required: ['b'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    // Tool 0 (fast_tool): completed in single-chunk path → start → delta → end → call
    const tool0Events = elements.filter(
      (el) =>
        ('id' in el && el.id === 'call_mix_001') ||
        ('toolCallId' in el && el.toolCallId === 'call_mix_001'),
    );
    expect(tool0Events.map((e) => e.type)).toStrictEqual([
      'tool-input-start',
      'tool-input-delta',
      'tool-input-end',
      'tool-call',
    ]);
    expect(tool0Events.find((e) => e.type === 'tool-call')).toMatchObject({
      input: '{"a":"1"}',
    });

    // Tool 1 (slow_tool): partially streamed → flush path adds end + call
    const tool1Events = elements.filter(
      (el) =>
        ('id' in el && el.id === 'call_mix_002') ||
        ('toolCallId' in el && el.toolCallId === 'call_mix_002'),
    );
    expect(tool1Events.map((e) => e.type)).toStrictEqual([
      'tool-input-start',
      'tool-input-delta',
      'tool-input-end',
      'tool-call',
    ]);
    // Slow tool had invalid JSON → coerced to '{}'
    expect(tool1Events.find((e) => e.type === 'tool-call')).toMatchObject({
      input: '{}',
    });
  });

  it('should use consistent IDs across tool-input-start, all deltas, tool-input-end, and tool-call', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-idcheck","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_id","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_id_001","type":"function","function":{"name":"lookup","arguments":""}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-idcheck","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_id","choices":[{"index":0,"delta":{` +
          `"tool_calls":[{"index":0,"function":{"arguments":"{\\"k"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-idcheck","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_id","choices":[{"index":0,"delta":{` +
          `"tool_calls":[{"index":0,"function":{"arguments":"\\":\\"v\\"}"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-idcheck","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_id","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-idcheck","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_id","choices":[],"usage":{"prompt_tokens":5,"completion_tokens":5,"total_tokens":10}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      tools: [
        {
          type: 'function',
          name: 'lookup',
          inputSchema: {
            type: 'object',
            properties: { k: { type: 'string' } },
            required: ['k'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);
    const toolEvents = elements.filter((el) =>
      [
        'tool-input-start',
        'tool-input-delta',
        'tool-input-end',
        'tool-call',
      ].includes(el.type),
    );

    // Every tool-input-* event should use the same id
    const expectedId = 'call_id_001';
    for (const event of toolEvents) {
      if (event.type === 'tool-call') {
        expect(event.toolCallId).toBe(expectedId);
      } else if (
        event.type === 'tool-input-start' ||
        event.type === 'tool-input-delta' ||
        event.type === 'tool-input-end'
      ) {
        expect(event.id).toBe(expectedId);
      }
    }
  });

  it('should emit all tool lifecycle events before the finish event', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-order","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_ord","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_ord_001","type":"function","function":{"name":"ping","arguments":""}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-order","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_ord","choices":[{"index":0,"delta":{` +
          `"tool_calls":[{"index":0,"function":{"arguments":"{\\"x\\":\\"1\\"}"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-order","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_ord","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-order","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_ord","choices":[],"usage":{"prompt_tokens":5,"completion_tokens":5,"total_tokens":10}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      tools: [
        {
          type: 'function',
          name: 'ping',
          inputSchema: {
            type: 'object',
            properties: { x: { type: 'string' } },
            required: ['x'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    const finishIndex = elements.findIndex((el) => el.type === 'finish');
    const lastToolCallIndex = elements.findIndex(
      (el) => el.type === 'tool-call',
    );
    const lastToolInputEndIndex = elements.findIndex(
      (el) => el.type === 'tool-input-end',
    );

    // All tool events must precede the finish event
    expect(finishIndex).toBeGreaterThan(-1);
    expect(lastToolCallIndex).toBeGreaterThan(-1);
    expect(lastToolInputEndIndex).toBeGreaterThan(-1);
    expect(lastToolCallIndex).toBeLessThan(finishIndex);
    expect(lastToolInputEndIndex).toBeLessThan(finishIndex);
  });

  it('should not emit tool-input-end without a preceding tool-input-start', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-orphan","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_orph","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_orph_001","type":"function","function":{"name":"noop","arguments":"{\\"a\\":\\"b\\"}"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-orphan","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_orph","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-orphan","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_orph","choices":[],"usage":{"prompt_tokens":5,"completion_tokens":5,"total_tokens":10}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      tools: [
        {
          type: 'function',
          name: 'noop',
          inputSchema: {
            type: 'object',
            properties: { a: { type: 'string' } },
            required: ['a'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    // For every tool-input-end, there must be a preceding tool-input-start with the same id
    const ends = elements.filter(
      (el): el is LanguageModelV3StreamPart & { type: 'tool-input-end' } =>
        el.type === 'tool-input-end',
    );
    const starts = elements.filter(
      (el): el is LanguageModelV3StreamPart & { type: 'tool-input-start' } =>
        el.type === 'tool-input-start',
    );

    for (const end of ends) {
      const matchingStart = starts.find((s) => s.id === end.id);
      expect(matchingStart).toBeDefined();

      // start must come before end
      const startIdx = elements.indexOf(matchingStart!);
      const endIdx = elements.indexOf(end);
      expect(startIdx).toBeLessThan(endIdx);
    }
  });

  it('should handle tool call with minimal empty-object arguments {}', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-minimal","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_min","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_min_001","type":"function","function":{"name":"no_args","arguments":"{}"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-minimal","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_min","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-minimal","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_min","choices":[],"usage":{"prompt_tokens":5,"completion_tokens":5,"total_tokens":10}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      tools: [
        {
          type: 'function',
          name: 'no_args',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);
    const toolEvents = elements.filter((el) =>
      [
        'tool-input-start',
        'tool-input-delta',
        'tool-input-end',
        'tool-call',
      ].includes(el.type),
    );

    // Single-chunk path with minimal args should still get full lifecycle
    expect(toolEvents.map((e) => e.type)).toStrictEqual([
      'tool-input-start',
      'tool-input-delta',
      'tool-input-end',
      'tool-call',
    ]);

    const delta = toolEvents.find((e) => e.type === 'tool-input-delta');
    expect(delta).toMatchObject({ delta: '{}' });

    const call = toolEvents.find((e) => e.type === 'tool-call');
    expect(call).toMatchObject({ input: '{}' });
  });

  it('should handle three parallel tool calls with correct independent lifecycles', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // Three tool calls start simultaneously
        `data: {"id":"chatcmpl-tri","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_tri","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[` +
          `{"index":0,"id":"call_tri_001","type":"function","function":{"name":"alpha","arguments":""}},` +
          `{"index":1,"id":"call_tri_002","type":"function","function":{"name":"beta","arguments":""}},` +
          `{"index":2,"id":"call_tri_003","type":"function","function":{"name":"gamma","arguments":""}}` +
          `]},"logprobs":null,"finish_reason":null}]}\n\n`,
        // Args for tool 0
        `data: {"id":"chatcmpl-tri","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_tri","choices":[{"index":0,"delta":{` +
          `"tool_calls":[{"index":0,"function":{"arguments":"{\\"a\\":\\"1\\"}"}}]},"logprobs":null,"finish_reason":null}]}\n\n`,
        // Args for tool 1
        `data: {"id":"chatcmpl-tri","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_tri","choices":[{"index":0,"delta":{` +
          `"tool_calls":[{"index":1,"function":{"arguments":"{\\"b\\":\\"2\\"}"}}]},"logprobs":null,"finish_reason":null}]}\n\n`,
        // Args for tool 2
        `data: {"id":"chatcmpl-tri","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_tri","choices":[{"index":0,"delta":{` +
          `"tool_calls":[{"index":2,"function":{"arguments":"{\\"c\\":\\"3\\"}"}}]},"logprobs":null,"finish_reason":null}]}\n\n`,
        // Finish
        `data: {"id":"chatcmpl-tri","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_tri","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-tri","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_tri","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":15,"total_tokens":25}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      tools: [
        {
          type: 'function',
          name: 'alpha',
          inputSchema: {
            type: 'object',
            properties: { a: { type: 'string' } },
            required: ['a'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
        {
          type: 'function',
          name: 'beta',
          inputSchema: {
            type: 'object',
            properties: { b: { type: 'string' } },
            required: ['b'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
        {
          type: 'function',
          name: 'gamma',
          inputSchema: {
            type: 'object',
            properties: { c: { type: 'string' } },
            required: ['c'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    const filterById = (id: string) =>
      elements.filter(
        (el) =>
          (('id' in el && el.id === id) ||
            ('toolCallId' in el && el.toolCallId === id)) &&
          el.type !== 'response-metadata',
      );

    for (const [id, expectedInput] of [
      ['call_tri_001', '{"a":"1"}'],
      ['call_tri_002', '{"b":"2"}'],
      ['call_tri_003', '{"c":"3"}'],
    ] as const) {
      const events = filterById(id);
      expect(events.map((e) => e.type)).toStrictEqual([
        'tool-input-start',
        'tool-input-delta',
        'tool-input-end',
        'tool-call',
      ]);
      expect(events.find((e) => e.type === 'tool-call')).toMatchObject({
        input: expectedInput,
      });
    }
  });

  it('should not double-emit tool-call in flush when tool was already sent during streaming', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // Tool call arrives with complete JSON in one chunk — sent during streaming
        `data: {"id":"chatcmpl-nosend","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_ns","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_ns_001","type":"function","function":{"name":"done","arguments":"{\\"ok\\":true}"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-nosend","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_ns","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-nosend","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_ns","choices":[],"usage":{"prompt_tokens":5,"completion_tokens":5,"total_tokens":10}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      tools: [
        {
          type: 'function',
          name: 'done',
          inputSchema: {
            type: 'object',
            properties: { ok: { type: 'boolean' } },
            required: ['ok'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    // There should be exactly ONE tool-call and ONE tool-input-end
    const toolCalls = elements.filter((el) => el.type === 'tool-call');
    const toolEnds = elements.filter((el) => el.type === 'tool-input-end');
    expect(toolCalls).toHaveLength(1);
    expect(toolEnds).toHaveLength(1);
  });

  it('should not interfere tool lifecycle when text content precedes tool calls', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // First: text content
        `data: {"id":"chatcmpl-textool","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_tt","choices":[{"index":0,"delta":{"role":"assistant","content":"Let me check"},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Then: tool call
        `data: {"id":"chatcmpl-textool","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_tt","choices":[{"index":0,"delta":{` +
          `"tool_calls":[{"index":0,"id":"call_tt_001","type":"function","function":{"name":"fetch","arguments":""}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-textool","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_tt","choices":[{"index":0,"delta":{` +
          `"tool_calls":[{"index":0,"function":{"arguments":"{\\"url\\":\\"https://example.com\\"}"}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-textool","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_tt","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-textool","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_tt","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":10,"total_tokens":20}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      tools: [
        {
          type: 'function',
          name: 'fetch',
          inputSchema: {
            type: 'object',
            properties: { url: { type: 'string' } },
            required: ['url'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);

    // Text events should be present
    const textDeltas = elements.filter((el) => el.type === 'text-delta');
    expect(textDeltas.length).toBeGreaterThan(0);

    // Tool lifecycle should still be complete
    const toolEvents = elements.filter(
      (el) =>
        ('id' in el && el.id === 'call_tt_001') ||
        ('toolCallId' in el && el.toolCallId === 'call_tt_001'),
    );
    expect(toolEvents.map((e) => e.type)).toStrictEqual([
      'tool-input-start',
      'tool-input-delta',
      'tool-input-end',
      'tool-call',
    ]);

    expect(toolEvents.find((e) => e.type === 'tool-call')).toMatchObject({
      input: '{"url":"https://example.com"}',
    });

    // Text events should come before tool events
    const firstTextIdx = elements.findIndex((el) => el.type === 'text-delta');
    const firstToolIdx = elements.findIndex(
      (el) => el.type === 'tool-input-start',
    );
    expect(firstTextIdx).toBeLessThan(firstToolIdx);
  });

  it('should attach reasoning_details providerMetadata only to the first tool-call in parallel calls', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // Reasoning chunk first
        `data: {"id":"chatcmpl-reason","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_rsn","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"reasoning_details":[{"type":"reasoning.text","text":"Let me think..."}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // Two tool calls
        `data: {"id":"chatcmpl-reason","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_rsn","choices":[{"index":0,"delta":{` +
          `"tool_calls":[` +
          `{"index":0,"id":"call_rsn_001","type":"function","function":{"name":"tool_x","arguments":"{\\"x\\":1}"}},` +
          `{"index":1,"id":"call_rsn_002","type":"function","function":{"name":"tool_y","arguments":"{\\"y\\":2}"}}` +
          `]},"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-reason","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_rsn","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-reason","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_rsn","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":10,"total_tokens":20}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      tools: [
        {
          type: 'function',
          name: 'tool_x',
          inputSchema: {
            type: 'object',
            properties: { x: { type: 'number' } },
            required: ['x'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
        {
          type: 'function',
          name: 'tool_y',
          inputSchema: {
            type: 'object',
            properties: { y: { type: 'number' } },
            required: ['y'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);
    const toolCallEvents = elements.filter((el) => el.type === 'tool-call');
    expect(toolCallEvents).toHaveLength(2);

    // First tool-call should have reasoning_details in providerMetadata
    expect(
      toolCallEvents[0]?.providerMetadata?.openrouter?.reasoning_details,
    ).toBeDefined();
    expect(
      toolCallEvents[0]?.providerMetadata?.openrouter?.reasoning_details,
    ).toHaveLength(1);

    // Second tool-call should NOT have providerMetadata (avoids duplication)
    expect(toolCallEvents[1]?.providerMetadata).toBeUndefined();
  });

  it('should trigger flush path when finish_reason is "other" with unsent tool calls', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // Tool call with incomplete JSON
        `data: {"id":"chatcmpl-other","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_oth","choices":[{"index":0,"delta":{"role":"assistant","content":null,` +
          `"tool_calls":[{"index":0,"id":"call_oth_001","type":"function","function":{"name":"action","arguments":"{\\"z\\""}}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
        // finish_reason is "other" (unknown) — the #420 fix overrides to "tool-calls"
        `data: {"id":"chatcmpl-other","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_oth","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"other"}]}\n\n`,
        `data: {"id":"chatcmpl-other","object":"chat.completion.chunk","created":1711357598,"model":"gpt-4.1",` +
          `"system_fingerprint":"fp_oth","choices":[],"usage":{"prompt_tokens":5,"completion_tokens":5,"total_tokens":10}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({
      tools: [
        {
          type: 'function',
          name: 'action',
          inputSchema: {
            type: 'object',
            properties: { z: { type: 'string' } },
            required: ['z'],
            additionalProperties: false,
            $schema: 'http://json-schema.org/draft-07/schema#',
          },
        },
      ],
      prompt: TEST_PROMPT,
    });

    const elements = await convertReadableStreamToArray(stream);
    const toolEvents = elements.filter((el) =>
      [
        'tool-input-start',
        'tool-input-delta',
        'tool-input-end',
        'tool-call',
      ].includes(el.type),
    );

    // Should get full lifecycle even though finish_reason was "other"
    expect(toolEvents.map((e) => e.type)).toStrictEqual([
      'tool-input-start',
      'tool-input-delta',
      'tool-input-end',
      'tool-call',
    ]);

    // Invalid JSON coerced to '{}'
    expect(toolEvents.find((e) => e.type === 'tool-call')).toMatchObject({
      input: '{}',
    });

    // Finish reason should be overridden to tool-calls
    const finishEvent = elements.find((el) => el.type === 'finish');
    expect(finishEvent).toMatchObject({
      finishReason: { unified: 'tool-calls' },
    });
  });

  it('should generate unique toolCallIds when streaming provider returns duplicate IDs for parallel tool calls', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // Two tool calls with the same id "call_0"
        `data: {"id":"chatcmpl-160a","object":"chat.completion.chunk","created":1711357598,"model":"gemini-2.0","system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"role":"assistant","content":null,"tool_calls":[{"index":0,"id":"call_0","type":"function","function":{"name":"get_weather","arguments":"{\\"city\\":\\"Tokyo\\"}"}}]},"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-160a","object":"chat.completion.chunk","created":1711357598,"model":"gemini-2.0","system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"tool_calls":[{"index":1,"id":"call_0","type":"function","function":{"name":"get_weather","arguments":"{\\"city\\":\\"London\\"}"}}]},"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-160a","object":"chat.completion.chunk","created":1711357598,"model":"gemini-2.0","system_fingerprint":"fp_test","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-160a","object":"chat.completion.chunk","created":1711357598,"model":"gemini-2.0","system_fingerprint":"fp_test","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":15,"total_tokens":25}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({ prompt: TEST_PROMPT });
    const elements = await convertReadableStreamToArray(stream);

    const toolCallEvents = elements.filter(
      (el: LanguageModelV3StreamPart) => el.type === 'tool-call',
    );

    expect(toolCallEvents).toHaveLength(2);
    // All toolCallIds must be unique even though the provider returned duplicates
    const ids = toolCallEvents.map((e) => {
      if (e.type === 'tool-call') {
        return e.toolCallId;
      }
      return undefined;
    });
    expect(new Set(ids).size).toBe(2);
  });

  it('should generate unique toolCallIds when streaming provider returns empty string IDs', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        // Two tool calls with empty string ids
        `data: {"id":"chatcmpl-160b","object":"chat.completion.chunk","created":1711357598,"model":"gemini-2.0","system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"role":"assistant","content":null,"tool_calls":[{"index":0,"id":"","type":"function","function":{"name":"get_weather","arguments":"{\\"city\\":\\"Tokyo\\"}"}}]},"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-160b","object":"chat.completion.chunk","created":1711357598,"model":"gemini-2.0","system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"tool_calls":[{"index":1,"id":"","type":"function","function":{"name":"get_weather","arguments":"{\\"city\\":\\"London\\"}"}}]},"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-160b","object":"chat.completion.chunk","created":1711357598,"model":"gemini-2.0","system_fingerprint":"fp_test","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-160b","object":"chat.completion.chunk","created":1711357598,"model":"gemini-2.0","system_fingerprint":"fp_test","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":15,"total_tokens":25}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({ prompt: TEST_PROMPT });
    const elements = await convertReadableStreamToArray(stream);

    const toolCallEvents = elements.filter(
      (el: LanguageModelV3StreamPart) => el.type === 'tool-call',
    );

    expect(toolCallEvents).toHaveLength(2);
    const ids = toolCallEvents.map((e) => {
      if (e.type === 'tool-call') {
        return e.toolCallId;
      }
      return undefined;
    });
    // Empty string IDs should be replaced with generated unique IDs
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) {
      expect(id).not.toBe('');
    }
  });

  it('should preserve valid unique tool call IDs in streaming responses', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: [
        `data: {"id":"chatcmpl-160c","object":"chat.completion.chunk","created":1711357598,"model":"gemini-2.0","system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"role":"assistant","content":null,"tool_calls":[{"index":0,"id":"call_unique_abc","type":"function","function":{"name":"get_weather","arguments":"{\\"city\\":\\"Tokyo\\"}"}}]},"logprobs":null,"finish_reason":null}]}\n\n`,
        `data: {"id":"chatcmpl-160c","object":"chat.completion.chunk","created":1711357598,"model":"gemini-2.0","system_fingerprint":"fp_test","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}]}\n\n`,
        `data: {"id":"chatcmpl-160c","object":"chat.completion.chunk","created":1711357598,"model":"gemini-2.0","system_fingerprint":"fp_test","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":15,"total_tokens":25}}\n\n`,
        'data: [DONE]\n\n',
      ],
    };

    const { stream } = await model.doStream({ prompt: TEST_PROMPT });
    const elements = await convertReadableStreamToArray(stream);

    const toolCallEvents = elements.filter(
      (el: LanguageModelV3StreamPart) => el.type === 'tool-call',
    );

    expect(toolCallEvents).toHaveLength(1);
    const toolCallEvent = toolCallEvents.find(
      (el): el is LanguageModelV3StreamPart & { type: 'tool-call' } =>
        el.type === 'tool-call',
    );
    expect(toolCallEvent?.toolCallId).toBe('call_unique_abc');
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
