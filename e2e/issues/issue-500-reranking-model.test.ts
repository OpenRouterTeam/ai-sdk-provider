/**
 * Regression test for GitHub issue #500
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/500
 *
 * Reported error: `TypeError: openrouter.rerankingModel is not a function`
 * (rerankingModel appeared in the provider typings but was undefined at runtime)
 * Model: cohere/rerank-v3.5
 *
 * This test verifies that rerankingModel is implemented at runtime and maps
 * doRerank calls to the OpenRouter /rerank endpoint.
 */
import { rerank } from 'ai';
import { describe, expect, it } from 'vitest';
import { createOpenRouter } from '@/src';

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

describe('Issue #500: rerankingModel exists in typings but is undefined at runtime', () => {
  it('should expose rerankingModel on the provider at runtime', () => {
    const openrouter = createOpenRouter({ apiKey: 'test-key' });

    expect(typeof openrouter.rerankingModel).toBe('function');
    const model = openrouter.rerankingModel('cohere/rerank-v3.5');
    expect(model.modelId).toBe('cohere/rerank-v3.5');
    expect(model.specificationVersion).toBe('v4');
  });

  it('should rerank documents through the ai rerank function', async () => {
    const openrouter = createOpenRouter({
      apiKey: 'test-key',
      fetch: mockFetch,
    });

    const result = await rerank({
      model: openrouter.rerankingModel('cohere/rerank-v3.5'),
      query: 'What is the capital of Germany?',
      documents: [
        'Paris is the capital of France.',
        'Berlin is the capital of Germany.',
      ],
    });

    expect(result.rerankedDocuments).toEqual([
      'Berlin is the capital of Germany.',
      'Paris is the capital of France.',
    ]);
    expect(result.ranking).toEqual([
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
  });
});
