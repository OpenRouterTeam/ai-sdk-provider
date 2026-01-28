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
 * This test verifies that the provider correctly exposes cachedTokens and
 * reasoningTokens in providerMetadata when present in the API response.
 */
import { generateText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 180_000,
});

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

        expect(response.text).toBeDefined();
        expect(response.text.length).toBeGreaterThan(0);
        expect(response.finishReason).toBeDefined();
        expect(response.usage).toBeDefined();
        expect(response.usage.totalTokens).toBeGreaterThan(0);
        expect(response.providerMetadata).toBeDefined();
        expect(response.providerMetadata?.openrouter).toBeDefined();

        const openrouterMetadata = response.providerMetadata?.openrouter as {
          usage?: OpenRouterUsageMetadata;
        };

        expect(openrouterMetadata?.usage).toBeDefined();
        expect(openrouterMetadata?.usage?.promptTokens).toBeGreaterThan(0);
        expect(openrouterMetadata?.usage?.completionTokens).toBeGreaterThan(0);

        const cachedTokens =
          openrouterMetadata?.usage?.promptTokensDetails?.cachedTokens;

        responses.push({
          tokens_prompt: openrouterMetadata?.usage?.promptTokens ?? 0,
          tokens_completion: openrouterMetadata?.usage?.completionTokens ?? 0,
          cachedTokens,
        });

        if (cachedTokens !== undefined) {
          expect(typeof cachedTokens).toBe('number');
          expect(cachedTokens).toBeGreaterThanOrEqual(0);
        }
      }

      console.log('GPT 4.1 caching test results:');
      responses.forEach((r, i) => {
        console.log(
          `  Request ${i + 1}: tokens_prompt=${r.tokens_prompt}, tokens_completion=${r.tokens_completion}, cachedTokens=${r.cachedTokens ?? 0}`,
        );
      });

      responses.forEach((r) => {
        expect(r.tokens_prompt).toBeGreaterThan(0);
        expect(r.tokens_completion).toBeGreaterThan(0);
      });
    });
  });

  describe('Kimi K2 automatic caching', () => {
    const model = openrouter('moonshotai/kimi-k2-thinking');

    it('should correctly expose usage structure for Kimi K2 responses', async () => {
      interface RequestResult {
        tokens_prompt: number;
        tokens_completion: number;
        cachedTokens: number | undefined;
        reasoningTokens: number | undefined;
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

        expect(response.text).toBeDefined();
        expect(response.text.length).toBeGreaterThan(0);
        expect(response.finishReason).toBeDefined();
        expect(response.usage).toBeDefined();
        expect(response.usage.totalTokens).toBeGreaterThan(0);
        expect(response.providerMetadata).toBeDefined();
        expect(response.providerMetadata?.openrouter).toBeDefined();

        const openrouterMetadata = response.providerMetadata?.openrouter as {
          usage?: OpenRouterUsageMetadata;
        };

        expect(openrouterMetadata?.usage).toBeDefined();
        expect(openrouterMetadata?.usage?.promptTokens).toBeGreaterThan(0);

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

        if (cachedTokens !== undefined) {
          expect(typeof cachedTokens).toBe('number');
          expect(cachedTokens).toBeGreaterThanOrEqual(0);
        }

        if (reasoningTokens !== undefined) {
          expect(typeof reasoningTokens).toBe('number');
          expect(reasoningTokens).toBeGreaterThanOrEqual(0);
        }
      }

      console.log('Kimi K2 Thinking test results:');
      responses.forEach((r, i) => {
        console.log(
          `  Request ${i + 1}: tokens_prompt=${r.tokens_prompt}, tokens_completion=${r.tokens_completion}, cachedTokens=${r.cachedTokens ?? 0}, reasoningTokens=${r.reasoningTokens ?? 0}`,
        );
      });

      responses.forEach((r) => {
        expect(r.tokens_prompt).toBeGreaterThan(0);
        expect(r.tokens_completion).toBeGreaterThan(0);
      });
    });
  });
});
