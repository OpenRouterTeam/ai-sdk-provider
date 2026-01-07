import { streamText } from 'ai';
import { it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 42_000,
});

/**
 * Test cache_control with Anthropic's prompt caching.
 *
 * Note: The `cost` field is not available due to @openrouter/sdk limitations
 * (Zod schema strips unknown fields).
 */
it('should trigger cache read', async () => {
  // First call to warm the cache
  await callLLM();
  // Second call to test cache read
  const response = await callLLM();
  const providerMetadata = await response.providerMetadata;
  expect(providerMetadata?.openrouter).toMatchObject({
    usage: expect.objectContaining({
      promptTokens: expect.any(Number),
      completionTokens: expect.any(Number),
      promptTokensDetails: expect.objectContaining({
        cachedTokens: expect.any(Number),
      }),
      completionTokensDetails: expect.any(Object),
      totalTokens: expect.any(Number),
      // Note: cost is not available due to SDK limitations
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
  const model = openrouter('anthropic/claude-3.7-sonnet', {
    usage: {
      include: true,
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
