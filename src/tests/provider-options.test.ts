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

  it('should set X-Title header when appName is provided', async () => {
    const openrouter = createOpenRouter({
      apiKey: 'test',
      appName: 'My Test App',
    });
    const model = openrouter('openai/gpt-4o');
    await streamText({ model, messages: TEST_MESSAGES }).consumeStream();
    const headers = server.calls[0]?.requestHeaders;
    expect(headers?.['x-title']).toBe('My Test App');
  });

  it('should set HTTP-Referer header when appUrl is provided', async () => {
    const openrouter = createOpenRouter({
      apiKey: 'test',
      appUrl: 'https://myapp.example.com',
    });
    const model = openrouter('openai/gpt-4o');
    await streamText({ model, messages: TEST_MESSAGES }).consumeStream();
    const headers = server.calls[0]?.requestHeaders;
    expect(headers?.['http-referer']).toBe('https://myapp.example.com');
  });

  it('should set both X-Title and HTTP-Referer headers when appName and appUrl are provided', async () => {
    const openrouter = createOpenRouter({
      apiKey: 'test',
      appName: 'My Test App',
      appUrl: 'https://myapp.example.com',
    });
    const model = openrouter('openai/gpt-4o');
    await streamText({ model, messages: TEST_MESSAGES }).consumeStream();
    const headers = server.calls[0]?.requestHeaders;
    expect(headers?.['x-title']).toBe('My Test App');
    expect(headers?.['http-referer']).toBe('https://myapp.example.com');
  });

  it('should allow custom headers to override appName and appUrl', async () => {
    const openrouter = createOpenRouter({
      apiKey: 'test',
      appName: 'Original App',
      appUrl: 'https://original.example.com',
      headers: {
        'X-Title': 'Override App',
        'HTTP-Referer': 'https://override.example.com',
      },
    });
    const model = openrouter('openai/gpt-4o');
    await streamText({ model, messages: TEST_MESSAGES }).consumeStream();
    const headers = server.calls[0]?.requestHeaders;
    expect(headers?.['x-title']).toBe('Override App');
    expect(headers?.['http-referer']).toBe('https://override.example.com');
  });

  it('should not set X-Title or HTTP-Referer headers when appName and appUrl are not provided', async () => {
    const openrouter = createOpenRouter({
      apiKey: 'test',
    });
    const model = openrouter('openai/gpt-4o');
    await streamText({ model, messages: TEST_MESSAGES }).consumeStream();
    const headers = server.calls[0]?.requestHeaders;
    expect(headers?.['x-title']).toBeUndefined();
    expect(headers?.['http-referer']).toBeUndefined();
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
