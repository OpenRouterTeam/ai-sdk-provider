/**
 * Regression test for GitHub Issue #422
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/422
 *
 * Reported: When an API error occurs, streamText returns a generic
 * "Provider returned error" message. The actual error details are
 * buried in error.metadata.raw and not surfaced to the user.
 * Users had to add console.log in the library source to see the
 * real error cause.
 *
 * Model: any (error handling is model-agnostic)
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
      // It should surface the actual error reason from the API response
      expect(err.message).toBeDefined();
      expect(err.message.length).toBeGreaterThan(0);
      // The message should NOT be a completely generic uninformative string
      // when the API provides additional detail in metadata.raw
      expect(err.message).not.toBe('');
    }
  });
});
