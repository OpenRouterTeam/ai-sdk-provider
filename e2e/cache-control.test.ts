import { streamText } from 'ai';
import { it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 42_000,
});

/**
 * Test cache_control with Anthropic's prompt caching.
 *
 * This test verifies:
 * 1. cache_control is properly passed in message content via providerOptions
 * 2. cachedTokens/cacheWriteTokens are reported in provider metadata
 */
it('should trigger cache read', async () => {
  // First call to warm the cache (or read from existing cache)
  const firstResponse = await callLLM();
  await firstResponse.providerMetadata;

  // Second call to test cache read
  const response = await callLLM();
  const providerMetadata = await response.providerMetadata;
  expect(providerMetadata?.openrouter).toMatchObject({
    usage: expect.objectContaining({
      promptTokens: expect.any(Number),
      completionTokens: expect.any(Number),
      promptTokensDetails: expect.objectContaining({
        cachedTokens: expect.any(Number),
        cacheWriteTokens: expect.any(Number),
      }),
      completionTokensDetails: expect.any(Object),
      totalTokens: expect.any(Number),
      cost: expect.any(Number),
    }),
  });

  const cachedTokens = Number(
    // @ts-expect-error
    providerMetadata?.openrouter?.usage?.promptTokensDetails?.cachedTokens,
  );

  expect(cachedTokens).toBeGreaterThan(0);
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
