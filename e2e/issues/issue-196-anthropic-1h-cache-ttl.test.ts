/**
 * Regression test for GitHub issue #196
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/196
 *
 * Issue: "1 hour prompt caching problem" - User reported that when using
 * Anthropic's 1-hour prompt caching via OpenRouter with ttl: "1h", they
 * observed 1.25x cache write cost instead of 2x.
 *
 * This test verifies that the ttl parameter is accepted and cache is hit.
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

  const model = openrouter('anthropic/claude-3.7-sonnet', {
    usage: { include: true },
  });

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
            { type: 'text', text: 'Given the text body below:' },
            {
              type: 'text',
              text: 'c'.repeat(4200),
              providerOptions: {
                openrouter: {
                  cacheControl: { type: 'ephemeral', ttl: '1h' },
                },
              },
            },
            { type: 'text', text: 'List the speakers?' },
          ],
        },
      ],
    });
    await response.consumeStream();
    return response;
  }

  it('should hit cache with ttl parameter', async () => {
    const response1 = await callWithIssue196Structure();
    const metadata1 = await response1.providerMetadata;
    expect(metadata1?.openrouter).toBeDefined();
    expect(metadata1?.openrouter?.usage).toBeDefined();

    const response2 = await callWithIssue196Structure();
    const metadata2 = await response2.providerMetadata;

    const usage = metadata2?.openrouter?.usage as
      | { promptTokensDetails?: { cachedTokens?: number } }
      | undefined;
    const cachedTokens = Number(usage?.promptTokensDetails?.cachedTokens ?? 0);
    expect(cachedTokens).toBeGreaterThan(0);
  });
});
