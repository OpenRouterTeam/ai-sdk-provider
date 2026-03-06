/**
 * Regression test for GitHub Issue #422
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/422
 *
 * Reported error: "Provider returned error" - generic message without upstream details
 * Model: any (error handling is model-agnostic)
 *
 * This test verifies that API errors surface detailed error information
 * from metadata.raw instead of generic messages.
 */
import { generateText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 30_000,
});

describe('Issue #422: API errors should surface detailed error information', () => {
  it('should include provider error details in the error message when using an invalid API key', async () => {
    const provider = createOpenRouter({
      apiKey: 'sk-or-v1-invalid-key-for-testing',
      baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
    });

    const model = provider('openai/gpt-4.1-nano');

    try {
      await generateText({
        model,
        prompt: 'Hello',
      });
      // Should not reach here
      expect.unreachable('Expected an error to be thrown');
    } catch (error: unknown) {
      const err = error as Error;
      // The error message should contain more detail than just "Provider returned error"
      // With the fix, invalid API key errors should mention the key issue
      expect(err.message).toBeDefined();
      expect(err.message.length).toBeGreaterThan(0);
      // The message should NOT be just the generic "Provider returned error"
      // It should contain actual details from the API response
      expect(err.message).not.toBe('Provider returned error');
    }
  });
});
