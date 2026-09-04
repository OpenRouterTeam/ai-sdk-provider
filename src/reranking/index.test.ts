import { describe, expect, it } from 'vitest';
import { createOpenRouter } from '../provider';
import { OpenRouterRerankingModel } from './index';

describe('OpenRouterRerankingModel', () => {
  const mockFetch = async (
    _url: URL | RequestInfo,
    _init?: RequestInit,
  ): Promise<Response> => {
    return new Response(
      JSON.stringify({
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
    it('should expose rerankingModel method', () => {
      const provider = createOpenRouter({ apiKey: 'test-key' });
      expect(provider.rerankingModel).toBeDefined();
      expect(typeof provider.rerankingModel).toBe('function');
    });

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
      expect(
        (result.providerMetadata?.openrouter as { usage?: { cost?: number } })
          ?.usage?.cost,
      ).toBe(0.00002);
      expect(result.response?.id).toBe('gen-rerank-123');
      expect(result.response?.modelId).toBe('cohere/rerank-v3.5');
      expect(result.warnings).toEqual([]);
    });

    it('should pass query, documents, and top_n to the API', async () => {
      let capturedRequest: Record<string, unknown> | undefined;

      const mockFetchWithCapture = async (
        _url: URL | RequestInfo,
        init?: RequestInit,
      ): Promise<Response> => {
        capturedRequest = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            model: 'cohere/rerank-v3.5',
            results: [{ index: 0, relevance_score: 0.9 }],
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

      const model = provider.rerankingModel('cohere/rerank-v3.5', {
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

      expect(capturedRequest?.model).toBe('cohere/rerank-v3.5');
      expect(capturedRequest?.query).toBe('test query');
      expect(capturedRequest?.documents).toEqual(['doc 1', 'doc 2', 'doc 3']);
      expect(capturedRequest?.top_n).toBe(2);
      expect(capturedRequest?.provider).toEqual({
        order: ['cohere'],
        allow_fallbacks: false,
      });
    });

    it('should support object documents', async () => {
      let capturedRequest: Record<string, unknown> | undefined;

      const mockFetchWithCapture = async (
        _url: URL | RequestInfo,
        init?: RequestInit,
      ): Promise<Response> => {
        capturedRequest = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            model: 'cohere/rerank-v3.5',
            results: [{ index: 0, relevance_score: 0.9 }],
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

      const model = provider.rerankingModel('cohere/rerank-v3.5');

      await model.doRerank({
        documents: {
          type: 'object',
          values: [{ text: 'doc 1' }, { text: 'doc 2' }],
        },
        query: 'test query',
      });

      expect(capturedRequest?.documents).toEqual([
        { text: 'doc 1' },
        { text: 'doc 2' },
      ]);
    });

    it('should omit top_n when not provided', async () => {
      let capturedRequest: Record<string, unknown> | undefined;

      const mockFetchWithCapture = async (
        _url: URL | RequestInfo,
        init?: RequestInit,
      ): Promise<Response> => {
        capturedRequest = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            model: 'cohere/rerank-v3.5',
            results: [{ index: 0, relevance_score: 0.9 }],
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

      const model = provider.rerankingModel('cohere/rerank-v3.5');

      await model.doRerank({
        documents: { type: 'text', values: ['doc 1'] },
        query: 'test query',
      });

      expect('top_n' in (capturedRequest ?? {})).toBe(false);
    });
  });
});
