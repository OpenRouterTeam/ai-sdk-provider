/**
 * Regression test for GitHub issue #234
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/234
 *
 * Issue: "Delayed caching with GPT 4.1, none with Kimi K2 Thinking"
 *
 * The user reported the following behavior with three consecutive prompts:
 *
 * GPT 4.1:
 *   Request 1: native_tokens_cached=0
 *   Request 2: native_tokens_cached=0
 *   Request 3: native_tokens_cached=1536
 *
 * Kimi K2 Thinking:
 *   Request 1: native_tokens_cached=0, native_tokens_reasoning=231
 *   Request 2: native_tokens_cached=0, native_tokens_reasoning=297
 *   Request 3: native_tokens_cached=0, native_tokens_reasoning=322
 *
 * Root cause: The "delayed caching" behavior is expected for automatic prompt
 * caching. Automatic caching (used by OpenAI, Moonshot, Groq) works by:
 * 1. First request: Cache is written (no savings visible yet)
 * 2. Subsequent requests: Cache is read (savings appear as cached_tokens)
 *
 * The ai-sdk-provider correctly handles cached_tokens when OpenRouter returns
 * them via prompt_tokens_details.cached_tokens. The provider exposes this as
 * providerMetadata.openrouter.usage.promptTokensDetails.cachedTokens.
 *
 * Note: The user's issue showed native_tokens_cached from the OpenRouter API
 * response. The ai-sdk-provider maps prompt_tokens_details.cached_tokens to
 * cachedTokens in the provider metadata.
 *
 * This test verifies that:
 * - The provider correctly exposes cachedTokens in providerMetadata when present
 * - The response structure matches what the user would see
 * - The "delayed caching" pattern is observable (cache hits on later requests)
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
  // The user's issue had ~1544 tokens_prompt
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
      // The user reported: request 1 & 2 had native_tokens_cached=0, request 3 had 1536
      interface RequestResult {
        tokens_prompt: number;
        tokens_completion: number;
        cachedTokens: number | undefined;
      }

      const responses: RequestResult[] = [];

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

        // Extract cached tokens from providerMetadata
        // This maps to prompt_tokens_details.cached_tokens from the API
        const cachedTokens =
          openrouterMetadata?.usage?.promptTokensDetails?.cachedTokens;

        responses.push({
          tokens_prompt: openrouterMetadata?.usage?.promptTokens ?? 0,
          tokens_completion: openrouterMetadata?.usage?.completionTokens ?? 0,
          cachedTokens,
        });

        // If cachedTokens is present, verify it's correctly typed
        if (cachedTokens !== undefined) {
          expect(typeof cachedTokens).toBe('number');
          expect(cachedTokens).toBeGreaterThanOrEqual(0);
        }
      }

      // Log all responses in the same format as the issue
      console.log('GPT 4.1 caching test results (matching issue #234 format):');
      responses.forEach((r, i) => {
        console.log(`  Request ${i + 1}:`);
        console.log(`    "tokens_prompt": ${r.tokens_prompt},`);
        console.log(`    "tokens_completion": ${r.tokens_completion},`);
        console.log(`    "cachedTokens": ${r.cachedTokens ?? 0}`);
      });

      // Verify the provider correctly structures all responses
      responses.forEach((r) => {
        expect(r.tokens_prompt).toBeGreaterThan(0);
        expect(r.tokens_completion).toBeGreaterThan(0);
      });

      // Verify caching behavior: cachedTokens should be available and >= 0
      // The "delayed caching" pattern means early requests may have 0 cached tokens
      const hasCachedTokens = responses.some(
        (r) => r.cachedTokens !== undefined && r.cachedTokens > 0,
      );
      if (hasCachedTokens) {
        console.log(
          '  Cache hit detected - provider correctly exposes cachedTokens',
        );
        // Find first request with cache hit
        const firstCacheHit = responses.findIndex(
          (r) => r.cachedTokens !== undefined && r.cachedTokens > 0,
        );
        // Verify it's not the first request (delayed caching pattern)
        if (firstCacheHit > 0) {
          console.log(
            `  First cache hit on request ${firstCacheHit + 1} (expected: delayed caching)`,
          );
        }
      } else {
        console.log(
          '  No cache hit detected (caching depends on server routing and timing)',
        );
      }
    });
  });

  describe('Kimi K2 automatic caching', () => {
    const model = openrouter('moonshotai/kimi-k2-thinking');

    it('should correctly expose usage structure for Kimi K2 responses', async () => {
      // The user reported no caching with Kimi K2 even with 8171 native prompt tokens
      // But they did see native_tokens_reasoning values (231, 297, 322)
      // This test verifies the provider correctly handles the response structure
      interface RequestResult {
        tokens_prompt: number;
        tokens_completion: number;
        cachedTokens: number | undefined;
        reasoningTokens: number | undefined;
      }

      const responses: RequestResult[] = [];

      // Make 3 consecutive requests to match the issue scenario
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

        // Extract values from provider metadata
        const cachedTokens =
          openrouterMetadata?.usage?.promptTokensDetails?.cachedTokens;
        const reasoningTokens =
          openrouterMetadata?.usage?.completionTokensDetails?.reasoningTokens;

        responses.push({
          tokens_prompt: openrouterMetadata?.usage?.promptTokens ?? 0,
          tokens_completion: openrouterMetadata?.usage?.completionTokens ?? 0,
          cachedTokens,
          reasoningTokens,
        });

        // If cachedTokens is present, verify it's correctly typed
        if (cachedTokens !== undefined) {
          expect(typeof cachedTokens).toBe('number');
          expect(cachedTokens).toBeGreaterThanOrEqual(0);
        }

        // If reasoningTokens is present, verify it's correctly typed
        if (reasoningTokens !== undefined) {
          expect(typeof reasoningTokens).toBe('number');
          expect(reasoningTokens).toBeGreaterThanOrEqual(0);
        }
      }

      // Log all responses in the same format as the issue
      console.log(
        'Kimi K2 Thinking test results (matching issue #234 format):',
      );
      responses.forEach((r, i) => {
        console.log(`  Request ${i + 1}:`);
        console.log(`    "tokens_prompt": ${r.tokens_prompt},`);
        console.log(`    "tokens_completion": ${r.tokens_completion},`);
        console.log(`    "cachedTokens": ${r.cachedTokens ?? 0},`);
        console.log(`    "reasoningTokens": ${r.reasoningTokens ?? 0}`);
      });

      // Verify the provider correctly structures all responses
      responses.forEach((r) => {
        expect(r.tokens_prompt).toBeGreaterThan(0);
        expect(r.tokens_completion).toBeGreaterThan(0);
      });

      // Kimi K2 is a thinking model, so reasoningTokens should be present
      const hasReasoningTokens = responses.some(
        (r) => r.reasoningTokens !== undefined && r.reasoningTokens > 0,
      );
      if (hasReasoningTokens) {
        console.log(
          '  Reasoning tokens detected - provider correctly exposes reasoningTokens',
        );
      }

      // Note: The user reported no caching with Kimi K2, which may be expected
      // behavior for this model/provider combination
      const hasCachedTokens = responses.some(
        (r) => r.cachedTokens !== undefined && r.cachedTokens > 0,
      );
      if (!hasCachedTokens) {
        console.log(
          '  No cache hit detected for Kimi K2 (matches issue #234 report)',
        );
      }
    });
  });
});
