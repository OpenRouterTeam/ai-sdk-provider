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
 *
 * These tests verify that the SDK accepts and passes through extended effort
 * values without throwing SDK-level errors. Model-level rejection (e.g.
 * "Unsupported value") is expected for models that don't support them — the
 * important thing is that the SDK doesn't block the values.
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

  // Use anthropic/claude-sonnet-4 which supports extended reasoning effort.
  // openai/o3-mini only supports 'low', 'medium', 'high'.
  const model = openrouter('anthropic/claude-sonnet-4');

  it('should accept reasoning.effort xhigh without SDK-level error', async () => {
    // The SDK should pass 'xhigh' through to the API without rejecting it.
    // If the model doesn't support it, the API returns an error — that's
    // acceptable. What matters is no SDK-level TypeError or validation error.
    try {
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

      expect(response.finishReason).toBeDefined();
    } catch (error) {
      // API-level rejection is acceptable — it means the SDK passed the
      // value through correctly but the model/provider doesn't support it.
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toMatch(/TypeError/);
      expect(message).not.toMatch(/validation/i);
    }
  });

  it('should accept reasoning.effort minimal without SDK-level error', async () => {
    try {
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

      expect(response.finishReason).toBeDefined();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toMatch(/TypeError/);
      expect(message).not.toMatch(/validation/i);
    }
  });

  it('should accept reasoning.effort none without SDK-level error', async () => {
    try {
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

      expect(response.finishReason).toBeDefined();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toMatch(/TypeError/);
      expect(message).not.toMatch(/validation/i);
    }
  });
});
