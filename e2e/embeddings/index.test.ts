import { embed, embedMany } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({ testTimeout: 60_000 });

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
});

describe('Embeddings', () => {
  it('generates a single embedding', async () => {
    const model = openrouter.textEmbeddingModel(
      'openai/text-embedding-3-small',
    );

    const { embedding } = await embed({
      model,
      value: 'sunny day at the beach',
    });

    expect(embedding).toHaveLength(1536);
    expect(typeof embedding[0]).toBe('number');
  });

  it('generates multiple embeddings', async () => {
    const model = openrouter.textEmbeddingModel(
      'openai/text-embedding-3-small',
    );

    const { embeddings } = await embedMany({
      model,
      values: [
        'sunny day at the beach',
        'rainy day in the city',
        'snowy mountain peak',
      ],
    });

    expect(embeddings).toHaveLength(3);
    for (const embedding of embeddings) {
      expect(embedding).toHaveLength(1536);
    }
  });

  it('reports usage', async () => {
    const model = openrouter.textEmbeddingModel(
      'openai/text-embedding-3-small',
    );

    const { usage } = await embed({
      model,
      value: 'test usage tracking',
    });

    expect(usage.tokens).toBeGreaterThan(0);
  });

  it('accepts provider routing options', async () => {
    const model = openrouter.textEmbeddingModel(
      'openai/text-embedding-3-small',
      {
        user: 'e2e-test-user',
        provider: { order: ['openai'] },
      },
    );

    const { embedding } = await embed({
      model,
      value: 'test with custom settings',
    });

    expect(embedding).toHaveLength(1536);
  });

  it('works with deprecated embedding() method', async () => {
    const model = openrouter.embedding('openai/text-embedding-3-small');

    const { embedding } = await embed({
      model,
      value: 'testing deprecated method',
    });

    expect(embedding).toHaveLength(1536);
  });

  it('produces similar vectors for similar texts', async () => {
    const model = openrouter.textEmbeddingModel(
      'openai/text-embedding-3-small',
    );

    const { embeddings } = await embedMany({
      model,
      values: [
        'The cat sat on the mat',
        'A feline rested on the rug',
        'The stock market crashed yesterday',
      ],
    });

    const [catMat, felineRug, stockMarket] = embeddings as [
      number[],
      number[],
      number[],
    ];

    const similar = cosineSimilarity(catMat, felineRug);
    const dissimilar = cosineSimilarity(catMat, stockMarket);

    expect(similar).toBeGreaterThan(dissimilar);
    expect(similar).toBeGreaterThan(0.5);
  });
});

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
