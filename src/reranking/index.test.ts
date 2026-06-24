import { describe, expect, it } from 'vitest';
import { createOpenRouter } from '../provider';
import { OpenRouterRerankingModel } from './index';

describe('OpenRouterRerankingModel', () => {
  describe('provider methods', () => {
    it('should expose rerankingModel method', () => {
      const provider = createOpenRouter({ apiKey: 'test-api-key' });
      expect(provider.rerankingModel).toBeDefined();
      expect(typeof provider.rerankingModel).toBe('function');
    });

    it('should create a reranking model instance', () => {
      const provider = createOpenRouter({ apiKey: 'test-api-key' });
      const model = provider.rerankingModel('cohere/rerank-v3.5');
      expect(model).toBeInstanceOf(OpenRouterRerankingModel);
      expect(model.modelId).toBe('cohere/rerank-v3.5');
      expect(model.provider).toBe('openrouter');
      expect(model.specificationVersion).toBe('v3');
    });
  });

  describe('doRerank', () => {
    it('should rerank text documents', async () => {
      let capturedUrl: string | undefined;
      let capturedRequest: Record<string, unknown> | undefined;

      const mockFetch = async (
        url: URL | RequestInfo,
        init?: RequestInit,
      ): Promise<Response> => {
        capturedUrl = url.toString();
        capturedRequest = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            id: 'rerank-test-id',
            model: 'cohere/rerank-v3.5',
            provider: 'cohere',
            results: [
              { index: 1, relevance_score: 0.98 },
              { index: 0, relevance_score: 0.12 },
            ],
            usage: {
              prompt_tokens: 12,
              total_tokens: 12,
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

      const provider = createOpenRouter({
        apiKey: 'test-api-key',
        fetch: mockFetch,
      });
      const model = provider.rerankingModel('cohere/rerank-v3.5');

      const result = await model.doRerank({
        query: 'capital of France',
        documents: {
          type: 'text',
          values: ['Berlin is in Germany', 'Paris is in France'],
        },
        topN: 2,
      });

      expect(capturedUrl).toBe('https://openrouter.ai/api/v1/rerank');
      expect(capturedRequest).toMatchObject({
        model: 'cohere/rerank-v3.5',
        query: 'capital of France',
        documents: ['Berlin is in Germany', 'Paris is in France'],
        top_n: 2,
      });
      expect(result.ranking).toEqual([
        { index: 1, relevanceScore: 0.98 },
        { index: 0, relevanceScore: 0.12 },
      ]);
      expect(result.response?.id).toBe('rerank-test-id');
      expect(result.response?.modelId).toBe('cohere/rerank-v3.5');
      expect(
        (result.providerMetadata?.openrouter as { usage?: { cost?: number } })
          ?.usage?.cost,
      ).toBe(0.00002);
      expect(
        (result.providerMetadata?.openrouter as { provider?: string }).provider,
      ).toBe('cohere');
    });
  });
});
