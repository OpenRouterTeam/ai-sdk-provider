/**
 * Regression test for GitHub issue #443
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/443
 *
 * Issue: Anthropic's eager_input_streaming parameter is not passed through
 * when tools are sent to the OpenRouter API. This parameter enables
 * fine-grained tool streaming, reducing latency for large tool outputs.
 *
 * Model: anthropic/claude-sonnet-4 (or any Anthropic model with tool use)
 *
 * This test verifies that eager_input_streaming from tool.providerOptions.openrouter
 * is correctly included in the request body sent to the OpenRouter API.
 */
import type { LanguageModelV3Prompt } from '@ai-sdk/provider';

import { createTestServer } from '@ai-sdk/test-server';
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

const TEST_PROMPT: LanguageModelV3Prompt = [
  {
    role: 'user',
    content: [{ type: 'text', text: 'What is the weather in Tokyo?' }],
  },
];

const provider = createOpenRouter({
  apiKey: 'test-api-key',
  compatibility: 'strict',
});

describe('Issue #443: Anthropic eager_input_streaming support', () => {
  const server = createTestServer({
    'https://openrouter.ai/api/v1/chat/completions': {
      response: {
        type: 'json-value',
        body: {
          id: 'chatcmpl-443',
          object: 'chat.completion',
          created: 1711357598,
          model: 'anthropic/claude-sonnet-4',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'The weather in Tokyo is sunny.',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 20,
            completion_tokens: 10,
            total_tokens: 30,
          },
        },
      },
    },
  });

  beforeAll(() => server.server.start());
  afterEach(() => server.server.reset());
  afterAll(() => server.server.stop());

  it('should include eager_input_streaming in request body when set via tool providerOptions', async () => {
    const model = provider.chat('anthropic/claude-sonnet-4');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      tools: [
        {
          type: 'function',
          name: 'get_weather',
          description: 'Get the current weather in a given location',
          inputSchema: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'The city name',
              },
            },
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

    const body = (await server.calls[0]!.requestBodyJson) as Record<
      string,
      unknown
    >;
    const tools = body.tools as Array<Record<string, unknown>>;

    expect(tools).toHaveLength(1);
    expect(tools[0]).toHaveProperty('eager_input_streaming', true);
    expect(tools[0]).toHaveProperty('type', 'function');
    expect(tools[0]).toHaveProperty('function');
  });

  it('should not include eager_input_streaming when not set in providerOptions', async () => {
    const model = provider.chat('anthropic/claude-sonnet-4');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      tools: [
        {
          type: 'function',
          name: 'get_weather',
          description: 'Get the current weather in a given location',
          inputSchema: {
            type: 'object',
            properties: {
              location: { type: 'string' },
            },
            required: ['location'],
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

    expect(tools).toHaveLength(1);
    expect(tools[0]).not.toHaveProperty('eager_input_streaming');
  });

  it('should support per-tool eager_input_streaming with mixed tools', async () => {
    const model = provider.chat('anthropic/claude-sonnet-4');

    await model.doGenerate({
      prompt: TEST_PROMPT,
      tools: [
        {
          type: 'function',
          name: 'get_weather',
          description:
            'Get weather (large output, benefits from eager streaming)',
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
        {
          type: 'function',
          name: 'get_time',
          description:
            'Get current time (small output, no need for eager streaming)',
          inputSchema: {
            type: 'object',
            properties: { timezone: { type: 'string' } },
            required: ['timezone'],
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
});
