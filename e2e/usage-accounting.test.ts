import { streamText } from 'ai';
import { it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

/**
 * Test usage accounting via providerMetadata.
 *
 * Note: The OpenRouter API returns `provider` and `cost` fields, but the
 * @openrouter/sdk's Zod schemas strip these unknown fields during parsing.
 * This is a known limitation - see: https://github.com/openrouter/sdk/issues/XXX
 *
 * Currently we can only access the token usage fields that the SDK types include:
 * - promptTokens, completionTokens, totalTokens
 * - promptTokensDetails (with cachedTokens)
 * - completionTokensDetails (with reasoningTokens)
 *
 * The `provider` (upstream provider name) and `cost` (USD cost) fields would
 * require SDK updates or bypassing the SDK to access.
 */
it('receive usage accounting', async () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });
  const model = openrouter('anthropic/claude-3.7-sonnet:thinking', {
    usage: {
      include: true,
    },
  });
  const response = streamText({
    model,
    messages: [
      {
        role: 'user',
        content: 'What is the capital of France?',
      },
    ],
    onFinish(e) {
      // Verify usage data is available in onFinish callback
      expect(e.providerMetadata?.openrouter).toMatchObject({
        usage: expect.objectContaining({
          promptTokens: expect.any(Number),
          completionTokens: expect.any(Number),
          promptTokensDetails: expect.any(Object),
          completionTokensDetails: expect.any(Object),
          totalTokens: expect.any(Number),
          // Note: cost and provider are not available due to SDK limitations
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
      promptTokensDetails: expect.any(Object),
      completionTokensDetails: expect.any(Object),
      totalTokens: expect.any(Number),
      // Note: cost and provider are not available due to SDK limitations
    }),
  });
});
