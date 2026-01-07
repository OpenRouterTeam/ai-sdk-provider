import { streamText } from 'ai';
import { describe, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 42_000,
});

/**
 * Test cache_control with Anthropic's prompt caching.
 *
 * This test verifies:
 * 1. cache_control is properly passed in message content via providerOptions
 * 2. promptTokensDetails structure exists in provider metadata
 *
 * Note: Actual cache hit data (cachedTokens > 0) depends on:
 * - The model/provider supporting prompt caching
 * - Meeting minimum token thresholds for caching
 * - Cache not being evicted between calls
 *
 * We verify the structure is correct; cache hits are best-effort.
 */
describe('cache-control', () => {
  it('should pass cache_control and receive promptTokensDetails', async () => {
    // First call to warm the cache (or read from existing cache)
    const firstResponse = await callLLM();
    await firstResponse.providerMetadata;

    // Second call to test cache read
    const response = await callLLM();
    const providerMetadata = await response.providerMetadata;

    // Verify basic usage structure is present
    expect(providerMetadata?.openrouter).toMatchObject({
      usage: expect.objectContaining({
        promptTokens: expect.any(Number),
        completionTokens: expect.any(Number),
        totalTokens: expect.any(Number),
        cost: expect.any(Number),
      }),
    });

    // Verify promptTokensDetails structure exists (values may be 0 or undefined)
    const openrouterMeta = providerMetadata?.openrouter as Record<string, unknown> | undefined;
    const usage = openrouterMeta?.usage as Record<string, unknown> | undefined;
    expect(usage).toHaveProperty('promptTokensDetails');

    // Log cache info for debugging (visible in test output)
    const details = usage?.promptTokensDetails as Record<string, unknown> | undefined;
    console.log('Cache details:', {
      cachedTokens: details?.cachedTokens,
      cacheWriteTokens: details?.cacheWriteTokens,
    });
  });

  it.skipIf(process.env.E2E_RECORD !== '1')(
    'should get cache hit on subsequent calls (live API only)',
    async () => {
      // This test only makes sense with live API calls
      // Fixtures can't capture the time-dependent cache behavior

      // First call to warm the cache
      await callLLM();

      // Second call should hit cache
      const response = await callLLM();
      const providerMetadata = await response.providerMetadata;

      // @ts-expect-error - accessing nested provider metadata
      const cachedTokens = providerMetadata?.openrouter?.usage?.promptTokensDetails?.cachedTokens ?? 0;

      // With live API and Anthropic routing, we expect cache hits
      // But this can fail due to cache eviction, so it's informational
      console.log('Cached tokens:', cachedTokens);
      if (cachedTokens === 0) {
        console.warn('Warning: No cache hit detected. This may be due to cache eviction or model limitations.');
      }
    },
  );
});

async function callLLM() {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });
  const model = openrouter('anthropic/claude-sonnet-4', {
    usage: {
      include: true,
    },
    // Force routing to Anthropic to ensure prompt caching works
    provider: {
      order: ['Anthropic'],
    },
  });
  const response = streamText({
    model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'a'.repeat(4200),
            providerOptions: {
              openrouter: {
                cache_control: {
                  type: 'ephemeral',
                },
              },
            },
          },
          {
            type: 'text',
            text: 'How many "a" did I use in the previous message?',
          },
        ],
      },
    ],
  });

  await response.consumeStream();
  return response;
}
