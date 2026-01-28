/**
 * Regression test for GitHub issue #196
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/196
 *
 * Issue: "1 hour prompt caching problem" - User reported that when using
 * Anthropic's 1-hour prompt caching via OpenRouter with ttl: "1h", they
 * observed 1.25x cache write cost instead of 2x, suggesting the TTL
 * parameter wasn't being applied correctly.
 *
 * This test verifies that:
 * - The ttl parameter is accepted by the API without errors
 * - The exact message structure from the issue works correctly
 * - Cache is populated on first call and hit on subsequent calls
 */
import { streamText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

describe('Issue #196: Anthropic 1-hour cache TTL', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  // Use claude-3.7-sonnet which is known to support caching (same as cache-control.test.ts)
  const model = openrouter('anthropic/claude-3.7-sonnet', {
    usage: {
      include: true,
    },
  });

  // Helper function matching the EXACT structure from issue #196
  // Uses cacheControl (camelCase) as the user reported
  async function callWithIssue196Structure() {
    const response = await streamText({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a podcast summary assistant. You are detail-oriented and critical about the content.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Given the text body below:',
            },
            {
              type: 'text',
              // Large text to ensure caching threshold is met (>1024 tokens for Anthropic)
              text: 'c'.repeat(4200),
              providerOptions: {
                // Using cacheControl (camelCase) EXACTLY as in issue #196
                openrouter: {
                  cacheControl: {
                    type: 'ephemeral',
                    ttl: '1h',
                  },
                },
              },
            },
            {
              type: 'text',
              text: 'List the speakers?',
            },
          ],
        },
      ],
    });
    await response.consumeStream();
    return response;
  }

  it('should hit cache with ttl parameter using exact issue #196 structure', async () => {
    // First call to warm the cache with 1h TTL
    const response1 = await callWithIssue196Structure();
    const metadata1 = await response1.providerMetadata;

    // Verify the API accepted the request without errors
    expect(metadata1?.openrouter).toBeDefined();
    expect(metadata1?.openrouter?.usage).toBeDefined();

    // Second call should hit the cache (same exact prompt)
    const response2 = await callWithIssue196Structure();
    const metadata2 = await response2.providerMetadata;

    // Verify cache was hit (cachedTokens > 0)
    const usage = metadata2?.openrouter?.usage as
      | { promptTokensDetails?: { cachedTokens?: number } }
      | undefined;
    const cachedTokens = Number(usage?.promptTokensDetails?.cachedTokens ?? 0);

    expect(cachedTokens).toBeGreaterThan(0);
  });
});
