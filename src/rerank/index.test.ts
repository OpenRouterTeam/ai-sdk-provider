import { describe, expect, it } from 'vitest';
import { createOpenRouter } from '../provider';
import { OpenRouterRerankingModel } from './index';

const MOCK_RERANK_RESPONSE = {
  id: 'rerank-abc123',
  model: 'cohere/rerank-v3.5',
  provider: 'Cohere',
  results: [
    {
      document: { text: 'Paris is the capital of France.' },
      index: 1,
      relevance_score: 0.98,
    },
    {
      document: { text: 'Berlin is the capital of Germany.' },
      index: 0,
      relevance_score: 0.12,
    },
  ],
  usage: {
    total_tokens: 42,
    search_units: 1,
    cost: 0.0001,
  },
};

function mockFetch(response: unknown, status = 200) {
  return async () =>
    new Response(JSON.stringify(response), {
      status,
      headers: { 'content-type': 'application/json' },
    });
}

type RequestCapture = { url: string; body: Record<string, unknown> };

function mockFetchWithCapture(response: unknown): {
  fetch: typeof fetch;
  captured: () => RequestCapture;
} {
  let capture: RequestCapture;
  const fetchFn = async (url: string | URL | Request, init?: RequestInit) => {
    capture = {
      url: url.toString(),
      body: JSON.parse(init?.body as string),
    };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return {
    fetch: fetchFn as typeof fetch,
    captured: () => capture,
  };
}

describe('OpenRouterRerankingModel', () => {
  describe('provider methods', () => {
    it('rerankingModel() returns an OpenRouterRerankingModel', () => {
      const openrouter = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch(MOCK_RERANK_RESPONSE),
      });
      const model = openrouter.rerankingModel('cohere/rerank-v3.5');
      expect(model).toBeInstanceOf(OpenRouterRerankingModel);
      expect(model.modelId).toBe('cohere/rerank-v3.5');
      expect(model.provider).toBe('openrouter.reranking');
    });

    it('reranking() alias also returns an OpenRouterRerankingModel', () => {
      const openrouter = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch(MOCK_RERANK_RESPONSE),
      });
      const model = openrouter.reranking('cohere/rerank-v3.5');
      expect(model).toBeInstanceOf(OpenRouterRerankingModel);
    });
  });

  describe('doRerank', () => {
    it('sends correct request with text documents', async () => {
      const { fetch, captured } = mockFetchWithCapture(MOCK_RERANK_RESPONSE);
      const openrouter = createOpenRouter({ apiKey: 'test-key', fetch });
      const model = openrouter.rerankingModel('cohere/rerank-v3.5');

      await model.doRerank({
        documents: {
          type: 'text',
          values: [
            'Berlin is the capital of Germany.',
            'Paris is the capital of France.',
          ],
        },
        query: 'What is the capital of France?',
        topN: 2,
      });

      expect(captured().url).toContain('/rerank');
      expect(captured().body).toMatchObject({
        model: 'cohere/rerank-v3.5',
        query: 'What is the capital of France?',
        documents: [
          'Berlin is the capital of Germany.',
          'Paris is the capital of France.',
        ],
        top_n: 2,
      });
    });

    it('maps results to ranking with relevanceScore', async () => {
      const openrouter = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch(MOCK_RERANK_RESPONSE),
      });
      const model = openrouter.rerankingModel('cohere/rerank-v3.5');

      const result = await model.doRerank({
        documents: {
          type: 'text',
          values: [
            'Berlin is the capital of Germany.',
            'Paris is the capital of France.',
          ],
        },
        query: 'What is the capital of France?',
      });

      expect(result.ranking).toHaveLength(2);
      expect(result.ranking[0]).toEqual({ index: 1, relevanceScore: 0.98 });
      expect(result.ranking[1]).toEqual({ index: 0, relevanceScore: 0.12 });
    });

    it('omits top_n when topN is not provided', async () => {
      const { fetch, captured } = mockFetchWithCapture(MOCK_RERANK_RESPONSE);
      const openrouter = createOpenRouter({ apiKey: 'test-key', fetch });
      const model = openrouter.rerankingModel('cohere/rerank-v3.5');

      await model.doRerank({
        documents: { type: 'text', values: ['doc1', 'doc2'] },
        query: 'test query',
      });

      expect(captured().body).not.toHaveProperty('top_n');
    });

    it('converts object documents to JSON strings and emits a warning', async () => {
      const { fetch, captured } = mockFetchWithCapture({
        ...MOCK_RERANK_RESPONSE,
        results: [
          {
            document: { text: '{"title":"France"}' },
            index: 0,
            relevance_score: 0.9,
          },
        ],
      });
      const openrouter = createOpenRouter({ apiKey: 'test-key', fetch });
      const model = openrouter.rerankingModel('cohere/rerank-v3.5');

      const result = await model.doRerank({
        documents: {
          type: 'object',
          values: [{ title: 'France' }, { title: 'Germany' }],
        },
        query: 'France',
      });

      expect(captured().body.documents).toEqual([
        '{"title":"France"}',
        '{"title":"Germany"}',
      ]);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings![0]!.type).toBe('compatibility');
    });

    it('surfaces provider metadata with usage and provider name', async () => {
      const openrouter = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch(MOCK_RERANK_RESPONSE),
      });
      const model = openrouter.rerankingModel('cohere/rerank-v3.5');

      const result = await model.doRerank({
        documents: { type: 'text', values: ['doc1'] },
        query: 'test',
      });

      expect(result.providerMetadata?.openrouter).toMatchObject({
        provider: 'Cohere',
        usage: { total_tokens: 42, search_units: 1, cost: 0.0001 },
      });
    });

    it('surfaces response id and modelId', async () => {
      const openrouter = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch(MOCK_RERANK_RESPONSE),
      });
      const model = openrouter.rerankingModel('cohere/rerank-v3.5');

      const result = await model.doRerank({
        documents: { type: 'text', values: ['doc1'] },
        query: 'test',
      });

      expect(result.response?.id).toBe('rerank-abc123');
      expect(result.response?.modelId).toBe('cohere/rerank-v3.5');
    });

    it('passes extraBody through to the request', async () => {
      const { fetch, captured } = mockFetchWithCapture(MOCK_RERANK_RESPONSE);
      const openrouter = createOpenRouter({
        apiKey: 'test-key',
        fetch,
        extraBody: { custom_field: 'custom_value' },
      });
      const model = openrouter.rerankingModel('cohere/rerank-v3.5');

      await model.doRerank({
        documents: { type: 'text', values: ['doc1'] },
        query: 'test',
      });

      expect(captured().body).toHaveProperty('custom_field', 'custom_value');
    });

    it('includes Authorization header with API key', async () => {
      let capturedHeaders: Record<string, string> = {};
      const fetchFn = async (
        _url: string | URL | Request,
        init?: RequestInit,
      ) => {
        capturedHeaders = Object.fromEntries(
          new Headers(init?.headers).entries(),
        );
        return new Response(JSON.stringify(MOCK_RERANK_RESPONSE), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      };

      const openrouter = createOpenRouter({
        apiKey: 'test-api-key-123',
        fetch: fetchFn as typeof fetch,
      });
      const model = openrouter.rerankingModel('cohere/rerank-v3.5');

      await model.doRerank({
        documents: { type: 'text', values: ['doc1'] },
        query: 'test',
      });

      expect(capturedHeaders['authorization']).toBe('Bearer test-api-key-123');
    });

    it('merges providerOptions.openrouter into the request body', async () => {
      const { fetch, captured } = mockFetchWithCapture(MOCK_RERANK_RESPONSE);
      const openrouter = createOpenRouter({ apiKey: 'test-key', fetch });
      const model = openrouter.rerankingModel('cohere/rerank-v3.5');

      await model.doRerank({
        documents: { type: 'text', values: ['doc1'] },
        query: 'test',
        providerOptions: {
          openrouter: { provider: { order: ['Cohere'] } },
        },
      });

      expect(captured().body).toHaveProperty('provider');
      expect(captured().body['provider']).toMatchObject({ order: ['Cohere'] });
    });

    it('merges settings.extraBody into the request body', async () => {
      const { fetch, captured } = mockFetchWithCapture(MOCK_RERANK_RESPONSE);
      const openrouter = createOpenRouter({ apiKey: 'test-key', fetch });
      const model = openrouter.rerankingModel('cohere/rerank-v3.5', {
        extraBody: { settings_field: 'settings_value' },
      });

      await model.doRerank({
        documents: { type: 'text', values: ['doc1'] },
        query: 'test',
      });

      expect(captured().body).toHaveProperty(
        'settings_field',
        'settings_value',
      );
    });

    it('emits no warnings for text documents', async () => {
      const openrouter = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch(MOCK_RERANK_RESPONSE),
      });
      const model = openrouter.rerankingModel('cohere/rerank-v3.5');

      const result = await model.doRerank({
        documents: { type: 'text', values: ['doc1', 'doc2'] },
        query: 'test',
      });

      expect(result.warnings).toHaveLength(0);
    });
  });
});
