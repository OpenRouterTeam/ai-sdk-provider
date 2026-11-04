/**
 * Regression test for GitHub issue #616
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/616
 *
 * Issue: `providerOptions.openrouter.provider` routing preferences were
 * reported as not applied. Chat and completion were verified to forward them;
 * the embedding model (`embed` / `embedMany`) ignored `providerOptions`
 * entirely.
 */
import { embed, embedMany } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

describe('Issue #616: embedding models honor providerOptions.openrouter', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE ?? 'https://openrouter.ai'}/api/v1`,
  });
  const model = openrouter.textEmbeddingModel('openai/text-embedding-3-small');

  it('embed: applies runtime provider.only (unknown provider is rejected)', async () => {
    await expect(
      embed({
        model,
        value: 'sunny day at the beach',
        providerOptions: {
          openrouter: {
            provider: {
              only: ['nonexistent-provider'],
              allow_fallbacks: false,
            },
          },
        },
      }),
    ).rejects.toThrow();
  });

  it('embedMany: applies runtime provider.only (unknown provider is rejected)', async () => {
    await expect(
      embedMany({
        model,
        values: ['sunny day at the beach', 'rainy afternoon'],
        providerOptions: {
          openrouter: {
            provider: {
              only: ['nonexistent-provider'],
              allow_fallbacks: false,
            },
          },
        },
      }),
    ).rejects.toThrow();
  });

  it('embed: succeeds with a valid runtime provider routing preference', async () => {
    const { embedding } = await embed({
      model,
      value: 'sunny day at the beach',
      providerOptions: {
        openrouter: { provider: { only: ['openai'] } },
      },
    });

    expect(embedding.length).toBeGreaterThan(0);
  });

  it('embed: forwards dimensions from providerOptions', async () => {
    const { embedding } = await embed({
      model,
      value: 'sunny day at the beach',
      providerOptions: {
        openrouter: { dimensions: 256 },
      },
    });

    expect(embedding).toHaveLength(256);
  });
});
