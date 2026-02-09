/**
 * Regression test for GitHub issue #384
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/384
 *
 * Issue: "Support for reasoning effort minimal"
 *
 * Issue thread timeline:
 * - Jan 30, 2026: User reports that the SDK only supports reasoning effort
 *   values 'low', 'medium', 'high', but OpenRouter API also supports 'minimal'.
 *   User mentions regularly using gpt-5 with minimal effort.
 */
import { generateText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

describe('Issue #384: reasoning effort minimal with gpt-5', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  it('should accept reasoning.effort minimal with openai/gpt-5 without error', async () => {
    const model = openrouter('openai/gpt-5', {
      usage: {
        include: true,
      },
    });

    const response = await generateText({
      model,
      messages: [
        {
          role: 'user',
          content: 'What is 2+2?',
        },
      ],
      providerOptions: {
        openrouter: {
          reasoning: {
            effort: 'minimal',
          },
        },
      },
    });

    expect(response.text).toBeTruthy();
    expect(response.usage.totalTokens).toBeGreaterThan(0);
    expect(response.finishReason).toBeDefined();
  });
});
