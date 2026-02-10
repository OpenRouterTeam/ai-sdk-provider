/**
 * Regression test for GitHub issue #407
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/407
 *
 * Issue: "Doesn't provide proper token usage data leading to 'undefined' sometime"
 *
 * The user reported that the provider leaves inputTokens.noCache,
 * outputTokens.text, and inputTokens.cacheWrite as undefined even when
 * the API response contains sufficient data to compute them. This causes
 * downstream dashboards/analytics to receive misleading values.
 *
 * The fix computes these fields from available API data:
 * - noCache = total - cacheRead
 * - text = total - reasoning
 * - cacheWrite = passthrough from cache_write_tokens
 */
import { generateText, streamText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

describe('Issue #407: Token usage detail fields should not be undefined', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  describe('generateText (doGenerate)', () => {
    it('should populate inputTokens.noCache and outputTokens.text with openai/gpt-4.1-nano', async () => {
      const response = await generateText({
        model: openrouter('openai/gpt-4.1-nano'),
        messages: [
          {
            role: 'user',
            content: 'What is 2+2? Answer with just the number.',
          },
        ],
      });

      expect(response.usage.inputTokens).toEqual(expect.any(Number));
      expect(response.usage.inputTokenDetails.noCacheTokens).toEqual(
        expect.any(Number),
      );
      expect(response.usage.outputTokens).toEqual(expect.any(Number));
      expect(response.usage.outputTokenDetails.textTokens).toEqual(
        expect.any(Number),
      );

      expect(response.usage.inputTokenDetails.noCacheTokens).toBe(
        response.usage.inputTokens! -
          (response.usage.inputTokenDetails.cacheReadTokens ?? 0),
      );
      expect(response.usage.outputTokenDetails.textTokens).toBe(
        response.usage.outputTokens! -
          (response.usage.outputTokenDetails.reasoningTokens ?? 0),
      );
    });

    it('should populate reasoning tokens with anthropic/claude-3.7-sonnet:thinking', async () => {
      const response = await generateText({
        model: openrouter('anthropic/claude-3.7-sonnet:thinking'),
        messages: [
          {
            role: 'user',
            content: 'What is 2+2? Answer with just the number.',
          },
        ],
      });

      expect(response.usage.outputTokens).toEqual(expect.any(Number));
      expect(response.usage.outputTokenDetails.textTokens).toEqual(
        expect.any(Number),
      );
      expect(response.usage.outputTokenDetails.reasoningTokens).toEqual(
        expect.any(Number),
      );

      expect(response.usage.outputTokenDetails.textTokens).toBe(
        response.usage.outputTokens! -
          (response.usage.outputTokenDetails.reasoningTokens ?? 0),
      );
    });
  });

  describe('streamText (doStream)', () => {
    it('should populate inputTokens.noCache and outputTokens.text with openai/gpt-4.1-nano', async () => {
      const response = streamText({
        model: openrouter('openai/gpt-4.1-nano'),
        messages: [
          {
            role: 'user',
            content: 'What is 2+2? Answer with just the number.',
          },
        ],
      });

      await response.consumeStream();
      const usage = await response.usage;

      expect(usage.inputTokens).toEqual(expect.any(Number));
      expect(usage.inputTokenDetails.noCacheTokens).toEqual(expect.any(Number));
      expect(usage.outputTokens).toEqual(expect.any(Number));
      expect(usage.outputTokenDetails.textTokens).toEqual(expect.any(Number));

      expect(usage.inputTokenDetails.noCacheTokens).toBe(
        usage.inputTokens! - (usage.inputTokenDetails.cacheReadTokens ?? 0),
      );
      expect(usage.outputTokenDetails.textTokens).toBe(
        usage.outputTokens! - (usage.outputTokenDetails.reasoningTokens ?? 0),
      );
    });

    it('should populate reasoning tokens with anthropic/claude-3.7-sonnet:thinking', async () => {
      const response = streamText({
        model: openrouter('anthropic/claude-3.7-sonnet:thinking'),
        messages: [
          {
            role: 'user',
            content: 'What is 2+2? Answer with just the number.',
          },
        ],
      });

      await response.consumeStream();
      const usage = await response.usage;

      expect(usage.outputTokens).toEqual(expect.any(Number));
      expect(usage.outputTokenDetails.textTokens).toEqual(expect.any(Number));
      expect(usage.outputTokenDetails.reasoningTokens).toEqual(
        expect.any(Number),
      );

      expect(usage.outputTokenDetails.textTokens).toBe(
        usage.outputTokens! - (usage.outputTokenDetails.reasoningTokens ?? 0),
      );
    });
  });
});
