import { rerank } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '../../src/index';

vi.setConfig({ testTimeout: 30_000 });

describe('OpenRouter Reranking E2E', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  it('reranks documents and returns the most relevant first', async () => {
    const documents = [
      'Berlin is the capital of Germany.',
      'Paris is the capital of France.',
      'Madrid is the capital of Spain.',
      'Rome is the capital of Italy.',
    ];
    const query = 'What is the capital of France?';

    const result = await rerank({
      model: openrouter.rerankingModel('cohere/rerank-v3.5'),
      documents,
      query,
    });

    expect(result.rerankedDocuments).toHaveLength(documents.length);
    expect(result.rerankedDocuments[0]).toBe('Paris is the capital of France.');

    expect(result.ranking).toHaveLength(documents.length);
    expect(result.ranking![0]!.score).toBeGreaterThan(0.5);
  });

  it('respects topN and returns only the top N results', async () => {
    const documents = [
      'The Eiffel Tower is in Paris.',
      'The Colosseum is in Rome.',
      'The Sagrada Familia is in Barcelona.',
      'Big Ben is in London.',
      'The Acropolis is in Athens.',
    ];

    const result = await rerank({
      model: openrouter.rerankingModel('cohere/rerank-v3.5'),
      documents,
      query: 'Famous landmark in Paris',
      topN: 2,
    });

    expect(result.rerankedDocuments).toHaveLength(2);
    expect(result.rerankedDocuments[0]).toBe('The Eiffel Tower is in Paris.');
  });

  it('reranking() alias works identically to rerankingModel()', async () => {
    const result = await rerank({
      model: openrouter.reranking('cohere/rerank-v3.5'),
      documents: ['cat', 'dog', 'fish'],
      query: 'aquatic animal',
      topN: 1,
    });

    expect(result.rerankedDocuments).toHaveLength(1);
    expect(result.rerankedDocuments[0]).toBe('fish');
  });
});
