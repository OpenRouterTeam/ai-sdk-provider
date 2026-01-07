import { streamText } from 'ai';
import { it, vi, expect } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

/**
 * Test usage accounting via providerMetadata.
 *
 * Now uses the Responses API which provides:
 * - promptTokens, completionTokens, totalTokens
 * - cost (USD cost)
 * - promptTokensDetails (with cachedTokens) - if available
 * - completionTokensDetails (with reasoningTokens) - if reasoning model used
 *
 * Note: The `provider` field is not available in Responses API.
 */
it('receive usage accounting', async () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });
  // Use a simpler model without reasoning for basic usage test
  const model = openrouter('openai/gpt-4o-mini');
  const response = streamText({
    model,
    messages: [
      {
        role: 'user',
        content: 'What is the capital of France? Reply in one word.',
      },
    ],
    onFinish(e) {
      // Verify usage data is available in onFinish callback
      expect(e.providerMetadata?.openrouter).toMatchObject({
        usage: expect.objectContaining({
          promptTokens: expect.any(Number),
          completionTokens: expect.any(Number),
          totalTokens: expect.any(Number),
        }),
      });
    },
  });

  await response.consumeStream();
  const providerMetadata = await response.providerMetadata;

  // Verify usage data after stream consumption
  expect(providerMetadata?.openrouter).toMatchObject({
    usage: expect.objectContaining({
      promptTokens: expect.any(Number),
      completionTokens: expect.any(Number),
      totalTokens: expect.any(Number),
    }),
  });

  // Verify cost is included (Responses API feature)
  const usage = (providerMetadata?.openrouter as { usage?: { cost?: number } })
    ?.usage;
  expect(usage?.cost).toBeDefined();
  expect(typeof usage?.cost).toBe('number');
});
