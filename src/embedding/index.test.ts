import { embed, embedMany } from 'ai';
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
      expect(model.specificationVersion).toBe('v4');
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

  describe('providerOptions.openrouter', () => {
    const createCapturingProvider = (
      options: { extraBody?: Record<string, unknown> } = {},
    ) => {
      const bodies: Array<Record<string, unknown>> = [];
      const provider = createOpenRouter({
        apiKey: 'test-key',
        ...options,
        fetch: async (_url, init) => {
          const body = JSON.parse(String(init?.body));
          bodies.push(body);
          const inputs: unknown[] = Array.isArray(body.input) ? body.input : [];
          return new Response(
            JSON.stringify({
              object: 'list',
              data: inputs.map((_, index) => ({
                object: 'embedding',
                embedding: [0.1, 0.2],
                index,
              })),
              model: 'openai/text-embedding-3-small',
              usage: { prompt_tokens: 5, total_tokens: 5 },
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          );
        },
      });
      return { provider, bodies };
    };

    it('embed: forwards runtime-only provider routing', async () => {
      const { provider, bodies } = createCapturingProvider();

      await embed({
        model: provider.textEmbeddingModel('openai/text-embedding-3-small'),
        value: 'hello',
        providerOptions: { openrouter: { provider: { only: ['openai'] } } },
      });

      expect(bodies).toHaveLength(1);
      expect(bodies[0]?.provider).toEqual({ only: ['openai'] });
    });

    it('embedMany: forwards runtime-only provider routing', async () => {
      const { provider, bodies } = createCapturingProvider();

      await embedMany({
        model: provider.textEmbeddingModel('openai/text-embedding-3-small'),
        values: ['a', 'b'],
        providerOptions: { openrouter: { provider: { only: ['openai'] } } },
      });

      expect(bodies).toHaveLength(1);
      expect(bodies[0]?.input).toEqual(['a', 'b']);
      expect(bodies[0]?.provider).toEqual({ only: ['openai'] });
    });

    it('shallow merges runtime provider with settings.provider', async () => {
      const { provider, bodies } = createCapturingProvider();

      await embed({
        model: provider.textEmbeddingModel('openai/text-embedding-3-small', {
          provider: { order: ['openai'], allow_fallbacks: false },
        }),
        value: 'hello',
        providerOptions: {
          openrouter: { provider: { allow_fallbacks: true, sort: 'price' } },
        },
      });

      expect(bodies[0]?.provider).toEqual({
        order: ['openai'],
        allow_fallbacks: true,
        sort: 'price',
      });
    });

    it('applies precedence settings < config.extraBody < settings.extraBody < runtime', async () => {
      const { provider, bodies } = createCapturingProvider({
        extraBody: {
          provider: { order: ['config'], sort: 'latency', ignore: ['x'] },
        },
      });

      await embedMany({
        model: provider.textEmbeddingModel('openai/text-embedding-3-small', {
          provider: { order: ['settings'], data_collection: 'deny' },
          extraBody: { provider: { sort: 'throughput', only: ['extra'] } },
        }),
        values: ['a'],
        providerOptions: { openrouter: { provider: { only: ['runtime'] } } },
      });

      expect(bodies[0]?.provider).toEqual({
        order: ['config'],
        data_collection: 'deny',
        sort: 'throughput',
        ignore: ['x'],
        only: ['runtime'],
      });
    });

    it('ignores non-object runtime provider values', async () => {
      const { provider, bodies } = createCapturingProvider();

      await embed({
        model: provider.textEmbeddingModel('openai/text-embedding-3-small', {
          provider: { order: ['openai'] },
        }),
        value: 'hello',
        providerOptions: { openrouter: { provider: null } },
      });

      expect(bodies[0]?.provider).toEqual({ order: ['openai'] });
    });

    it('passes through other runtime options, overriding settings and extraBody', async () => {
      const { provider, bodies } = createCapturingProvider({
        extraBody: { dimensions: 128 },
      });

      await embed({
        model: provider.textEmbeddingModel('openai/text-embedding-3-small', {
          user: 'settings-user',
          extraBody: { input_type: 'search_document' },
        }),
        value: 'hello',
        providerOptions: {
          openrouter: {
            user: 'runtime-user',
            dimensions: 256,
            input_type: 'search_query',
            session_id: 'session-1',
          },
        },
      });

      expect(bodies[0]).toMatchObject({
        user: 'runtime-user',
        dimensions: 256,
        input_type: 'search_query',
        session_id: 'session-1',
      });
    });

    it('does not let runtime options override model or input', async () => {
      const { provider, bodies } = createCapturingProvider();
      const model = provider.textEmbeddingModel(
        'openai/text-embedding-3-small',
      );
      const providerOptions = {
        openrouter: { model: 'other/model', input: ['different text'] },
      };

      await embed({ model, value: 'invoice', providerOptions });
      await embedMany({ model, values: ['a', 'b'], providerOptions });

      expect(bodies[0]).toMatchObject({
        model: 'openai/text-embedding-3-small',
        input: ['invoice'],
      });
      expect(bodies[1]).toMatchObject({
        model: 'openai/text-embedding-3-small',
        input: ['a', 'b'],
      });
    });

    it('leaves the request body unchanged without providerOptions', async () => {
      const { provider, bodies } = createCapturingProvider();

      await embedMany({
        model: provider.textEmbeddingModel('openai/text-embedding-3-small', {
          user: 'test-user',
          provider: { order: ['openai'] },
        }),
        values: ['a', 'b'],
      });

      expect(bodies[0]).toEqual({
        model: 'openai/text-embedding-3-small',
        input: ['a', 'b'],
        user: 'test-user',
        provider: { order: ['openai'] },
      });
    });

    it('omits provider when no source sets it', async () => {
      const { provider, bodies } = createCapturingProvider();

      await embed({
        model: provider.textEmbeddingModel('openai/text-embedding-3-small'),
        value: 'hello',
        providerOptions: { openrouter: { user: 'u' } },
      });

      expect(bodies[0]).not.toHaveProperty('provider');
      expect(bodies[0]?.user).toBe('u');
    });
  });
});
