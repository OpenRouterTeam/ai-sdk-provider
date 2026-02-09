import type { ModelMessage } from 'ai';

import { createTestServer } from '@ai-sdk/test-server';
import { streamText } from 'ai';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createOpenRouter } from '../provider';

// Add type assertions for the mocked classes
const TEST_MESSAGES: ModelMessage[] = [
  { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
];

describe('providerOptions', () => {
  const server = createTestServer({
    'https://openrouter.ai/api/v1/chat/completions': {
      response: {
        type: 'stream-chunks',
        chunks: [],
      },
    },
  });

  beforeAll(() => server.server.start());
  afterEach(() => server.server.reset());
  afterAll(() => server.server.stop());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set providerOptions openrouter to extra body', async () => {
    const openrouter = createOpenRouter({
      apiKey: 'test',
    });
    const model = openrouter('anthropic/claude-3.7-sonnet');

    await streamText({
      model: model,
      messages: TEST_MESSAGES,
      providerOptions: {
        openrouter: {
          reasoning: {
            max_tokens: 1000,
          },
        },
      },
    }).consumeStream();

    expect(await server.calls[0]?.requestBodyJson).toStrictEqual({
      messages: [
        {
          content: 'Hello',
          role: 'user',
        },
      ],
      reasoning: {
        max_tokens: 1000,
      },
      model: 'anthropic/claude-3.7-sonnet',
      stream: true,
    });
  });

  it('should pass effort xhigh to API body', async () => {
    const openrouter = createOpenRouter({
      apiKey: 'test',
    });
    const model = openrouter('openai/o3');

    await streamText({
      model: model,
      messages: TEST_MESSAGES,
      providerOptions: {
        openrouter: {
          reasoning: {
            effort: 'xhigh',
          },
        },
      },
    }).consumeStream();

    expect(await server.calls[0]?.requestBodyJson).toStrictEqual({
      messages: [
        {
          content: 'Hello',
          role: 'user',
        },
      ],
      reasoning: {
        effort: 'xhigh',
      },
      model: 'openai/o3',
      stream: true,
    });
  });

  it('should pass effort minimal to API body', async () => {
    const openrouter = createOpenRouter({
      apiKey: 'test',
    });
    const model = openrouter('openai/o3');

    await streamText({
      model: model,
      messages: TEST_MESSAGES,
      providerOptions: {
        openrouter: {
          reasoning: {
            effort: 'minimal',
          },
        },
      },
    }).consumeStream();

    expect(await server.calls[0]?.requestBodyJson).toStrictEqual({
      messages: [
        {
          content: 'Hello',
          role: 'user',
        },
      ],
      reasoning: {
        effort: 'minimal',
      },
      model: 'openai/o3',
      stream: true,
    });
  });

  it('should pass effort none to API body', async () => {
    const openrouter = createOpenRouter({
      apiKey: 'test',
    });
    const model = openrouter('openai/o3');

    await streamText({
      model: model,
      messages: TEST_MESSAGES,
      providerOptions: {
        openrouter: {
          reasoning: {
            effort: 'none',
          },
        },
      },
    }).consumeStream();

    expect(await server.calls[0]?.requestBodyJson).toStrictEqual({
      messages: [
        {
          content: 'Hello',
          role: 'user',
        },
      ],
      reasoning: {
        effort: 'none',
      },
      model: 'openai/o3',
      stream: true,
    });
  });
});
