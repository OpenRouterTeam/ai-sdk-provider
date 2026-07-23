import { createTestServer } from '@ai-sdk/test-server';
import { streamText } from 'ai';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OpenRouterChatLanguageModel } from './chat';
import { OpenRouterCompletionLanguageModel } from './completion';
import { OpenRouterEmbeddingModel } from './embedding';
import { createOpenRouter } from './provider';

describe('createOpenRouter', () => {
  const server = createTestServer({
    'https://example.com/api/v1/chat/completions': {
      response: {
        type: 'stream-chunks',
        chunks: [],
      },
    },
  });

  beforeAll(() => server.server.start());
  afterAll(() => server.server.stop());

  it('creates the supported model factories and callable provider', () => {
    const provider = createOpenRouter({ apiKey: 'test-key' });

    expect(provider.chat('openai/gpt-4o')).toBeInstanceOf(
      OpenRouterChatLanguageModel,
    );
    expect(provider.completion('openai/gpt-3.5-turbo-instruct')).toBeInstanceOf(
      OpenRouterCompletionLanguageModel,
    );
    expect(
      provider.textEmbeddingModel('openai/text-embedding-3-small'),
    ).toBeInstanceOf(OpenRouterEmbeddingModel);
    expect(provider('openai/gpt-4o')).toBeInstanceOf(
      OpenRouterChatLanguageModel,
    );
    expect(provider('openai/gpt-3.5-turbo-instruct')).toBeInstanceOf(
      OpenRouterCompletionLanguageModel,
    );
  });

  it('passes API options to requests', async () => {
    const provider = createOpenRouter({
      apiKey: 'test-key',
      baseURL: 'https://example.com/api/v1/',
      headers: { 'X-Test-Header': 'test-value' },
      extraBody: { provider: { order: ['openai'] } },
    });

    await streamText({
      model: provider.chat('openai/gpt-4o'),
      messages: [{ role: 'user', content: 'Hello' }],
    }).consumeStream();

    expect(server.calls[0]!.requestUrl).toBe(
      'https://example.com/api/v1/chat/completions',
    );
    expect(server.calls[0]!.requestHeaders).toMatchObject({
      authorization: 'Bearer test-key',
      'x-test-header': 'test-value',
    });
    expect(await server.calls[0]!.requestBodyJson).toMatchObject({
      model: 'openai/gpt-4o',
      provider: { order: ['openai'] },
    });
  });

  it('rejects constructing the callable provider with new', () => {
    const provider = createOpenRouter({ apiKey: 'test-key' });

    expect(() => Reflect.construct(provider, ['openai/gpt-4o'])).toThrow(
      TypeError,
    );
  });
});
