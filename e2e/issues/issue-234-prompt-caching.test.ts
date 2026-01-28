/**
 * Regression test for GitHub issue #234
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/234
 *
 * Issue: "Delayed caching with GPT 4.1, none with Kimi K2 Thinking"
 *
 * The user reported that with GPT 4.1, native_tokens_cached was 0 for the first
 * two requests and only showed cached tokens on the third request. With Kimi K2
 * Thinking, no caching occurred at all even with 8171 native prompt tokens.
 *
 * Root cause: The "delayed caching" behavior is expected for automatic prompt
 * caching. Automatic caching (used by OpenAI, Moonshot, Groq) works by:
 * 1. First request: Cache is written (no savings visible yet)
 * 2. Subsequent requests: Cache is read (savings appear as cached_tokens)
 *
 * The ai-sdk-provider correctly handles cached_tokens when OpenRouter returns
 * them. Any issues with specific models not returning cached_tokens are
 * upstream API issues, not ai-sdk-provider bugs.
 *
 * This test verifies that:
 * - The provider correctly exposes cachedTokens in providerMetadata when present
 * - The response structure is valid regardless of whether caching occurs
 */
import { generateText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 180_000,
});

// Type for OpenRouter provider metadata usage structure
interface OpenRouterUsageMetadata {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  promptTokensDetails?: { cachedTokens?: number };
  completionTokensDetails?: { reasoningTokens?: number };
}

describe('Issue #234: Prompt caching behavior', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  // Generate a long system prompt to meet minimum token requirements for caching
  // OpenAI requires minimum 1024 tokens for automatic caching
  const longSystemPrompt = `You are a helpful assistant. Here is some context that should be cached:

${Array(50)
  .fill(
    'This is padding text to ensure the prompt meets the minimum token threshold for automatic caching. ' +
      'Automatic prompt caching requires a minimum number of tokens in the prompt prefix. ' +
      'This text is repeated multiple times to reach that threshold. ',
  )
  .join('\n')}

Remember to be helpful and concise in your responses.`;

  describe('GPT 4.1 automatic caching', () => {
    const model = openrouter('openai/gpt-4.1');

    it('should correctly expose cachedTokens in providerMetadata structure', async () => {
      // Make 3 consecutive requests with identical prompts (matching the issue scenario)
      // The user reported: request 1 & 2 had 0 cached tokens, request 3 had 1536
      const responses: Array<{
        text: string;
        promptTokens: number;
        cachedTokens: number | undefined;
      }> = [];

      for (let i = 0; i < 3; i++) {
        const response = await generateText({
          model,
          messages: [
            { role: 'system', content: longSystemPrompt },
            {
              role: 'user',
              content: 'What is 2+2? Answer with just the number.',
            },
          ],
        });

        // Verify basic response validity
        expect(response.text).toBeDefined();
        expect(response.text.length).toBeGreaterThan(0);
        expect(response.finishReason).toBeDefined();

        // Verify usage structure
        expect(response.usage).toBeDefined();
        expect(response.usage.totalTokens).toBeGreaterThan(0);

        // Verify providerMetadata structure exists
        expect(response.providerMetadata).toBeDefined();
        expect(response.providerMetadata?.openrouter).toBeDefined();

        const openrouterMetadata = response.providerMetadata?.openrouter as {
          usage?: OpenRouterUsageMetadata;
        };

        // Verify usage is available in provider metadata
        expect(openrouterMetadata?.usage).toBeDefined();
        expect(openrouterMetadata?.usage?.promptTokens).toBeGreaterThan(0);
        expect(openrouterMetadata?.usage?.completionTokens).toBeGreaterThan(0);

        // Extract cached tokens from providerMetadata (maps to native_tokens_cached)
        const cachedTokens =
          openrouterMetadata?.usage?.promptTokensDetails?.cachedTokens;

        responses.push({
          text: response.text,
          promptTokens: openrouterMetadata?.usage?.promptTokens ?? 0,
          cachedTokens,
        });

        // If cachedTokens is present, verify it's correctly typed
        if (cachedTokens !== undefined) {
          expect(typeof cachedTokens).toBe('number');
          expect(cachedTokens).toBeGreaterThanOrEqual(0);
        }
      }

      // Log all responses for debugging (matches the issue's format)
      console.log('GPT 4.1 caching test results:');
      responses.forEach((r, i) => {
        console.log(
          `  Request ${i + 1}: promptTokens=${r.promptTokens}, cachedTokens=${r.cachedTokens ?? 'undefined'}`,
        );
      });

      // Verify the provider correctly structures all responses
      // The key assertion: all responses have valid structure
      responses.forEach((r) => {
        expect(r.promptTokens).toBeGreaterThan(0);
        // cachedTokens may be undefined or a number - both are valid
        if (r.cachedTokens !== undefined) {
          expect(r.cachedTokens).toBeGreaterThanOrEqual(0);
        }
      });

      // If caching worked (any request has cachedTokens > 0), verify it's on a later request
      const cachedRequest = responses.findIndex(
        (r) => r.cachedTokens !== undefined && r.cachedTokens > 0,
      );
      if (cachedRequest > 0) {
        console.log(`  Cache hit detected on request ${cachedRequest + 1}`);
        // Verify earlier requests had 0 or undefined cached tokens
        for (let i = 0; i < cachedRequest; i++) {
          const earlier = responses[i]?.cachedTokens;
          expect(earlier === undefined || earlier === 0).toBe(true);
        }
      } else if (cachedRequest === -1) {
        console.log(
          '  No cache hit detected (expected - caching depends on server routing)',
        );
      }
    });
  });

  describe('Kimi K2 automatic caching', () => {
    const model = openrouter('moonshotai/kimi-k2-thinking');

    it('should correctly expose usage structure for Kimi K2 responses', async () => {
      // The user reported no caching with Kimi K2 even with 8171 native prompt tokens
      // This test verifies the provider correctly handles the response structure
      const response = await generateText({
        model,
        messages: [
          { role: 'system', content: longSystemPrompt },
          {
            role: 'user',
            content: 'What is 2+2? Answer with just the number.',
          },
        ],
      });

      // Verify basic response validity
      expect(response.text).toBeDefined();
      expect(response.text.length).toBeGreaterThan(0);
      expect(response.finishReason).toBeDefined();

      // Verify usage structure
      expect(response.usage).toBeDefined();
      expect(response.usage.totalTokens).toBeGreaterThan(0);

      // Verify providerMetadata structure exists
      expect(response.providerMetadata).toBeDefined();
      expect(response.providerMetadata?.openrouter).toBeDefined();

      const openrouterMetadata = response.providerMetadata?.openrouter as {
        usage?: OpenRouterUsageMetadata;
      };

      // Verify usage is available in provider metadata
      expect(openrouterMetadata?.usage).toBeDefined();
      expect(openrouterMetadata?.usage?.promptTokens).toBeGreaterThan(0);

      // Log the response for debugging
      console.log('Kimi K2 test results:');
      console.log(
        `  promptTokens=${openrouterMetadata?.usage?.promptTokens}, cachedTokens=${openrouterMetadata?.usage?.promptTokensDetails?.cachedTokens ?? 'undefined'}`,
      );

      // If cachedTokens is present, verify it's correctly typed
      const cachedTokens =
        openrouterMetadata?.usage?.promptTokensDetails?.cachedTokens;
      if (cachedTokens !== undefined) {
        expect(typeof cachedTokens).toBe('number');
        expect(cachedTokens).toBeGreaterThanOrEqual(0);
      }

      // If reasoningTokens is present (Kimi K2 is a thinking model), verify it
      const reasoningTokens =
        openrouterMetadata?.usage?.completionTokensDetails?.reasoningTokens;
      if (reasoningTokens !== undefined) {
        expect(typeof reasoningTokens).toBe('number');
        expect(reasoningTokens).toBeGreaterThanOrEqual(0);
        console.log(`  reasoningTokens=${reasoningTokens}`);
      }
    });
  });
});
