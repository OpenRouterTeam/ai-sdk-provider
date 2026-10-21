import { createTestServer } from '@ai-sdk/test-server';
import { createProviderRegistry, embed, generateText, streamText } from 'ai';
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
    'https://example.com/api/v1/embeddings': {
      response: {
        type: 'json-value',
        body: {
          object: 'list',
          data: [{ object: 'embedding', embedding: [0.1, 0.2], index: 0 }],
          model: 'openai/text-embedding-3-small',
          usage: { prompt_tokens: 3, total_tokens: 3 },
        },
      },
    },
  });

  beforeAll(() => server.server.start());
  afterAll(() => server.server.stop());

  it('creates the supported model factories and callable provider', () => {
    const provider = createOpenRouter({ apiKey: 'test-key' });

    expect(provider.specificationVersion).toBe('v4');
    expect(provider.chat('openai/gpt-4o')).toBeInstanceOf(
      OpenRouterChatLanguageModel,
    );
    expect(provider.completion('openai/gpt-3.5-turbo-instruct')).toBeInstanceOf(
      OpenRouterCompletionLanguageModel,
    );
    expect(
      provider.embeddingModel('openai/text-embedding-3-small'),
    ).toBeInstanceOf(OpenRouterEmbeddingModel);
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

  it('works with createProviderRegistry without corrupting usage', async () => {
    server.urls['https://example.com/api/v1/chat/completions']!.response = {
      type: 'json-value',
      body: {
        id: 'chatcmpl-1',
        object: 'chat.completion',
        created: 1,
        model: 'openai/gpt-4o',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hi' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
      },
    };
    const registry = createProviderRegistry({
      openrouter: createOpenRouter({
        apiKey: 'test-key',
        baseURL: 'https://example.com/api/v1/',
      }),
    });

    const result = await generateText({
      model: registry.languageModel('openrouter:openai/gpt-4o'),
      prompt: 'Hello',
    });
    expect(result.usage.inputTokens).toBe(5);
    expect(result.usage.outputTokens).toBe(2);

    const { embedding } = await embed({
      model: registry.embeddingModel(
        'openrouter:openai/text-embedding-3-small',
      ),
      value: 'Hello',
    });
    expect(embedding).toEqual([0.1, 0.2]);
  });
});
