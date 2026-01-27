import { describe, expect, it } from 'vitest';
import { createOpenRouter } from '../provider';
import { OpenRouterEmbeddingModel } from './index';

describe('OpenRouterEmbeddingModel', () => {
  const mockFetch = async (
    _url: URL | RequestInfo,
    _init?: RequestInit,
  ): Promise<Response> => {
    return new Response(
      JSON.stringify({
        id: 'test-id',
        object: 'list',
        data: [
          {
            object: 'embedding',
            embedding: new Array(1536).fill(0.1),
            index: 0,
          },
        ],
        model: 'openai/text-embedding-3-small',
        usage: {
          prompt_tokens: 5,
          total_tokens: 5,
          cost: 0.00001,
        },
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      },
    );
  };

  describe('provider methods', () => {
    it('should expose textEmbeddingModel method', () => {
      const provider = createOpenRouter({ apiKey: 'test-key' });
      expect(provider.textEmbeddingModel).toBeDefined();
      expect(typeof provider.textEmbeddingModel).toBe('function');
    });

    it('should expose embedding method (deprecated)', () => {
      const provider = createOpenRouter({ apiKey: 'test-key' });
      expect(provider.embedding).toBeDefined();
      expect(typeof provider.embedding).toBe('function');
    });

    it('should create an embedding model instance', () => {
      const provider = createOpenRouter({ apiKey: 'test-key' });
      const model = provider.textEmbeddingModel(
        'openai/text-embedding-3-small',
      );
      expect(model).toBeInstanceOf(OpenRouterEmbeddingModel);
      expect(model.modelId).toBe('openai/text-embedding-3-small');
      expect(model.provider).toBe('openrouter');
      expect(model.specificationVersion).toBe('v3');
    });
  });

  describe('doEmbed', () => {
    it('should embed a single value', async () => {
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });
      const model = provider.textEmbeddingModel(
        'openai/text-embedding-3-small',
      );

      const result = await model.doEmbed({
        values: ['sunny day at the beach'],
      });

      expect(result.embeddings).toHaveLength(1);
      expect(result.embeddings[0]).toHaveLength(1536);
      expect(result.usage).toEqual({ tokens: 5 });
      expect(
        (result.providerMetadata?.openrouter as { usage?: { cost?: number } })
          ?.usage?.cost,
      ).toBe(0.00001);
    });

    it('should embed multiple values', async () => {
      const mockFetchMultiple = async (
        _url: URL | RequestInfo,
        _init?: RequestInit,
      ): Promise<Response> => {
        return new Response(
          JSON.stringify({
            object: 'list',
            data: [
              {
                object: 'embedding',
                embedding: new Array(1536).fill(0.1),
                index: 0,
              },
              {
                object: 'embedding',
                embedding: new Array(1536).fill(0.2),
                index: 1,
              },
              {
                object: 'embedding',
                embedding: new Array(1536).fill(0.3),
                index: 2,
              },
            ],
            model: 'openai/text-embedding-3-small',
            usage: {
              prompt_tokens: 15,
              total_tokens: 15,
            },
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        );
      };

      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetchMultiple,
      });
      const model = provider.textEmbeddingModel(
        'openai/text-embedding-3-small',
      );

      const result = await model.doEmbed({
        values: [
          'sunny day at the beach',
          'rainy day in the city',
          'snowy mountain peak',
        ],
      });

      expect(result.embeddings).toHaveLength(3);
      expect(result.embeddings[0]).toHaveLength(1536);
      expect(result.embeddings[1]).toHaveLength(1536);
      expect(result.embeddings[2]).toHaveLength(1536);
      expect(result.usage).toEqual({ tokens: 15 });
    });

    it('should pass custom settings to API', async () => {
      let capturedRequest: Record<string, unknown> | undefined;

      const mockFetchWithCapture = async (
        _url: URL | RequestInfo,
        init?: RequestInit,
      ): Promise<Response> => {
        capturedRequest = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            object: 'list',
            data: [
              {
                object: 'embedding',
                embedding: new Array(1536).fill(0.1),
                index: 0,
              },
            ],
            model: 'openai/text-embedding-3-small',
            usage: {
              prompt_tokens: 5,
              total_tokens: 5,
            },
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        );
      };

      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetchWithCapture,
      });

      const model = provider.textEmbeddingModel(
        'openai/text-embedding-3-small',
        {
          user: 'test-user-123',
          provider: {
            order: ['openai'],
            allow_fallbacks: false,
          },
        },
      );

      await model.doEmbed({
        values: ['test input'],
      });

      expect(capturedRequest?.user).toBe('test-user-123');
      expect(capturedRequest?.provider).toEqual({
        order: ['openai'],
        allow_fallbacks: false,
      });
      expect(capturedRequest?.model).toBe('openai/text-embedding-3-small');
      expect(capturedRequest?.input).toEqual(['test input']);
    });

    it('should handle response without usage information', async () => {
      const mockFetchNoUsage = async (
        _url: URL | RequestInfo,
        _init?: RequestInit,
      ): Promise<Response> => {
        return new Response(
          JSON.stringify({
            object: 'list',
            data: [
              {
                object: 'embedding',
                embedding: new Array(1536).fill(0.1),
                index: 0,
              },
            ],
            model: 'openai/text-embedding-3-small',
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        );
      };

      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetchNoUsage,
      });
      const model = provider.textEmbeddingModel(
        'openai/text-embedding-3-small',
      );

      const result = await model.doEmbed({
        values: ['test'],
      });

      expect(result.embeddings).toHaveLength(1);
      expect(result.usage).toBeUndefined();
      expect(result.providerMetadata).toStrictEqual({
        openrouter: {
          provider: '',
          usage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          },
        },
      });
    });
  });
});
