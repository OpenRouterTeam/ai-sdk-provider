/**
 * Regression test for GitHub issue #391
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/391
 *
 * Issue: "Add support for effort: none | minimal | xhigh"
 *
 * Issue thread timeline:
 * - Feb 2, 2026: User reports that the SDK only supports effort values
 *   'high', 'medium', 'low' but the OpenRouter API docs show additional
 *   values: 'xhigh', 'minimal', 'none'.
 * - Links to https://openrouter.ai/docs/guides/best-practices/reasoning-tokens
 */
import { generateText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

describe('Issue #391: reasoning effort xhigh, minimal, none values', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  it('should accept reasoning.effort xhigh without error', async () => {
    const model = openrouter('openai/o3-mini', {
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
            effort: 'xhigh',
          },
        },
      },
    });

    expect(response.usage.totalTokens).toBeGreaterThan(0);
    expect(response.finishReason).toBeDefined();
  });

  it('should accept reasoning.effort minimal without error', async () => {
    const model = openrouter('openai/o3-mini', {
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

    expect(response.usage.totalTokens).toBeGreaterThan(0);
    expect(response.finishReason).toBeDefined();
  });

  it('should accept reasoning.effort none without error', async () => {
    const model = openrouter('openai/o3-mini', {
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
            effort: 'none',
          },
        },
      },
    });

    expect(response.usage.totalTokens).toBeGreaterThan(0);
    expect(response.finishReason).toBeDefined();
  });
});
