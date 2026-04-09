/**
 * Regression test for GitHub issue #419
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/419
 *
 * Issue: Standard usage object contains undefined values while
 * providerMetadata.openrouter.usage has correct data.
 * Model: z-ai/glm-5:free
 *
 * This test verifies that the standard usage object (inputTokens, outputTokens)
 * is populated with valid numbers in both streaming and non-streaming modes,
 * and that the values are consistent with providerMetadata.openrouter.usage.
 */
import { generateText, streamText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 120_000,
});

describe('Issue #419: Standard usage should not contain undefined values', () => {
  const provider = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  describe('streamText (doStream)', () => {
    it('should populate standard usage with openai/gpt-4o-mini', async () => {
      const response = streamText({
        model: provider('openai/gpt-4o-mini'),
        prompt: 'What is 2+2? Answer with just the number.',
      });

      await response.consumeStream();
      const usage = await response.usage;

      // Standard usage fields must be numbers, not undefined
      expect(usage.inputTokens).toEqual(expect.any(Number));
      expect(usage.inputTokens).toBeGreaterThan(0);
      expect(usage.outputTokens).toEqual(expect.any(Number));
      expect(usage.outputTokens).toBeGreaterThanOrEqual(0);
    });

    it('should populate standard usage with google/gemini-2.0-flash-001', async () => {
      const response = streamText({
        model: provider('google/gemini-2.0-flash-001'),
        prompt: 'What is 2+2? Answer with just the number.',
      });

      await response.consumeStream();
      const usage = await response.usage;

      expect(usage.inputTokens).toEqual(expect.any(Number));
      expect(usage.inputTokens).toBeGreaterThan(0);
      expect(usage.outputTokens).toEqual(expect.any(Number));
      expect(usage.outputTokens).toBeGreaterThanOrEqual(0);
    });

    it('should have consistent usage between standard and providerMetadata with anthropic/claude-3.5-haiku', async () => {
      const response = streamText({
        model: provider('anthropic/claude-3.5-haiku'),
        prompt: 'What is 2+2? Answer with just the number.',
      });

      await response.consumeStream();
      const usage = await response.usage;
      const metadata = await response.providerMetadata;
      const openrouterUsage = (
        metadata?.openrouter as {
          usage?: {
            promptTokens?: number;
            completionTokens?: number;
            totalTokens?: number;
          };
        }
      )?.usage;

      // Standard usage must be populated
      expect(usage.inputTokens).toEqual(expect.any(Number));
      expect(usage.inputTokens).toBeGreaterThan(0);
      expect(usage.outputTokens).toEqual(expect.any(Number));

      // Provider metadata usage should also be populated
      expect(openrouterUsage?.promptTokens).toEqual(expect.any(Number));
      expect(openrouterUsage?.completionTokens).toEqual(expect.any(Number));

      // Standard and provider metadata should be consistent
      expect(usage.inputTokens).toBe(openrouterUsage?.promptTokens);
      expect(usage.outputTokens).toBe(openrouterUsage?.completionTokens);
    });
  });

  describe('generateText (doGenerate)', () => {
    it('should populate standard usage with openai/gpt-4o-mini', async () => {
      const result = await generateText({
        model: provider('openai/gpt-4o-mini'),
        prompt: 'What is 2+2? Answer with just the number.',
      });

      expect(result.usage.inputTokens).toEqual(expect.any(Number));
      expect(result.usage.inputTokens).toBeGreaterThan(0);
      expect(result.usage.outputTokens).toEqual(expect.any(Number));
      expect(result.usage.outputTokens).toBeGreaterThanOrEqual(0);
    });
  });
});
