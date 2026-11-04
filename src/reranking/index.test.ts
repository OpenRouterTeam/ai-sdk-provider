import { rerank } from 'ai';
import { describe, expect, it } from 'vitest';
import { createOpenRouter } from '../provider';
import { OpenRouterRerankingModel } from './index';

const RERANK_RESPONSE = {
  id: 'gen-rerank-123',
  model: 'cohere/rerank-v3.5',
  provider: 'cohere',
  results: [
    {
      index: 1,
      relevance_score: 0.98,
      document: { text: 'Berlin is the capital of Germany.' },
    },
    {
      index: 0,
      relevance_score: 0.12,
      document: { text: 'Paris is the capital of France.' },
    },
  ],
  usage: {
    search_units: 1,
    total_tokens: 150,
    cost: 0.00002,
  },
};

const MINIMAL_RESPONSE = {
  model: 'cohere/rerank-v3.5',
  results: [{ index: 0, relevance_score: 0.9 }],
};

function createMockFetch(body: unknown = RERANK_RESPONSE) {
  const requestBodies: Array<Record<string, unknown>> = [];
  const mockFetch = async (
    _url: URL | RequestInfo,
    init?: RequestInit,
  ): Promise<Response> => {
    requestBodies.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { mockFetch, requestBodies };
}

describe('OpenRouterRerankingModel', () => {
  describe('provider methods', () => {
    it('should create a reranking model instance', () => {
      const provider = createOpenRouter({ apiKey: 'test-key' });
      const model = provider.rerankingModel('cohere/rerank-v3.5');
      expect(model).toBeInstanceOf(OpenRouterRerankingModel);
      expect(model.modelId).toBe('cohere/rerank-v3.5');
      expect(model.provider).toBe('openrouter');
      expect(model.specificationVersion).toBe('v4');
    });
  });

  describe('doRerank', () => {
    it('should map the rerank response to a ranking result', async () => {
      const { mockFetch } = createMockFetch();
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });
      const model = provider.rerankingModel('cohere/rerank-v3.5');

      const result = await model.doRerank({
        documents: {
          type: 'text',
          values: [
            'Paris is the capital of France.',
            'Berlin is the capital of Germany.',
          ],
        },
        query: 'What is the capital of Germany?',
      });

      expect(result.ranking).toEqual([
        { index: 1, relevanceScore: 0.98 },
        { index: 0, relevanceScore: 0.12 },
      ]);
      expect(result.providerMetadata).toEqual({
        openrouter: {
          provider: 'cohere',
          usage: { searchUnits: 1, totalTokens: 150, cost: 0.00002 },
        },
      });
      expect(result.response?.id).toBe('gen-rerank-123');
      expect(result.response?.modelId).toBe('cohere/rerank-v3.5');
      expect(result.response?.body).toEqual(RERANK_RESPONSE);
      expect(result.warnings).toEqual([]);
    });

    it('should only report metadata fields the response contains', async () => {
      const { mockFetch } = createMockFetch(MINIMAL_RESPONSE);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });

      const result = await provider
        .rerankingModel('cohere/rerank-v3.5')
        .doRerank({
          documents: { type: 'text', values: ['doc 1'] },
          query: 'test query',
        });

      expect(result.providerMetadata).toEqual({ openrouter: {} });
    });

    it('should pass query, documents, top_n, user and provider to the API', async () => {
      const { mockFetch, requestBodies } = createMockFetch(MINIMAL_RESPONSE);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });

      const model = provider.rerankingModel('cohere/rerank-v3.5', {
        user: 'user-123',
        provider: {
          order: ['cohere'],
          allow_fallbacks: false,
        },
      });

      await model.doRerank({
        documents: {
          type: 'text',
          values: ['doc 1', 'doc 2', 'doc 3'],
        },
        query: 'test query',
        topN: 2,
      });

      expect(requestBodies[0]).toEqual({
        model: 'cohere/rerank-v3.5',
        query: 'test query',
        documents: ['doc 1', 'doc 2', 'doc 3'],
        top_n: 2,
        user: 'user-123',
        provider: {
          order: ['cohere'],
          allow_fallbacks: false,
        },
      });
    });

    it('should support object documents', async () => {
      const { mockFetch, requestBodies } = createMockFetch(MINIMAL_RESPONSE);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });

      await provider.rerankingModel('cohere/rerank-v3.5').doRerank({
        documents: {
          type: 'object',
          values: [{ text: 'doc 1' }, { text: 'doc 2' }],
        },
        query: 'test query',
      });

      expect(requestBodies[0]?.documents).toEqual([
        { text: 'doc 1' },
        { text: 'doc 2' },
      ]);
    });

    it('should convert object documents that are not text/image shaped to JSON strings', async () => {
      const { mockFetch, requestBodies } = createMockFetch(MINIMAL_RESPONSE);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });

      const result = await provider
        .rerankingModel('cohere/rerank-v3.5')
        .doRerank({
          documents: {
            type: 'object',
            values: [
              { text: 'doc 1' },
              { title: 'Doc 2', body: 'content' },
              { text: 'doc 3', image: 'https://example.com/a.png' },
            ],
          },
          query: 'test query',
        });

      expect(requestBodies[0]?.documents).toEqual([
        { text: 'doc 1' },
        '{"title":"Doc 2","body":"content"}',
        { text: 'doc 3', image: 'https://example.com/a.png' },
      ]);
      expect(result.warnings).toEqual([
        expect.objectContaining({
          type: 'compatibility',
          feature: 'object documents',
        }),
      ]);
    });

    it('should forward providerOptions.openrouter into the request body', async () => {
      const { mockFetch, requestBodies } = createMockFetch(MINIMAL_RESPONSE);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });

      await provider.rerankingModel('cohere/rerank-v3.5').doRerank({
        documents: { type: 'text', values: ['doc 1'] },
        query: 'test query',
        providerOptions: {
          openrouter: {
            user: 'user-123',
            session_id: 'session-abc',
          },
        },
      });

      expect(requestBodies[0]?.user).toBe('user-123');
      expect(requestBodies[0]?.session_id).toBe('session-abc');
    });

    it('should merge runtime provider routing with configured preferences', async () => {
      const { mockFetch, requestBodies } = createMockFetch(MINIMAL_RESPONSE);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });

      await provider
        .rerankingModel('cohere/rerank-v3.5', {
          provider: { order: ['cohere'], allow_fallbacks: false },
        })
        .doRerank({
          documents: { type: 'text', values: ['doc 1'] },
          query: 'test query',
          providerOptions: {
            openrouter: { provider: { order: ['voyageai'] } },
          },
        });

      expect(requestBodies[0]?.provider).toEqual({
        order: ['voyageai'],
        allow_fallbacks: false,
      });
    });

    it('should omit top_n when not provided', async () => {
      const { mockFetch, requestBodies } = createMockFetch(MINIMAL_RESPONSE);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });

      await provider.rerankingModel('cohere/rerank-v3.5').doRerank({
        documents: { type: 'text', values: ['doc 1'] },
        query: 'test query',
      });

      expect(requestBodies[0]).not.toHaveProperty('top_n');
    });
  });

  describe('rerank() integration', () => {
    it('should return reranked documents and ranking from the AI SDK', async () => {
      const { mockFetch, requestBodies } = createMockFetch();
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });
      const documents = [
        'Paris is the capital of France.',
        'Berlin is the capital of Germany.',
      ];

      const { rerankedDocuments, ranking, providerMetadata } = await rerank({
        model: provider.rerankingModel('cohere/rerank-v3.5'),
        query: 'What is the capital of Germany?',
        documents,
      });

      expect(requestBodies[0]).toMatchObject({
        model: 'cohere/rerank-v3.5',
        query: 'What is the capital of Germany?',
        documents,
      });
      expect(rerankedDocuments).toEqual([
        'Berlin is the capital of Germany.',
        'Paris is the capital of France.',
      ]);
      expect(ranking).toEqual([
        {
          originalIndex: 1,
          score: 0.98,
          document: 'Berlin is the capital of Germany.',
        },
        {
          originalIndex: 0,
          score: 0.12,
          document: 'Paris is the capital of France.',
        },
      ]);
      expect(providerMetadata?.openrouter?.usage).toEqual({
        searchUnits: 1,
        totalTokens: 150,
        cost: 0.00002,
      });
    });
  });
});
