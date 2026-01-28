/**
 * Regression test for GitHub issue #341
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/341
 *
 * Reported error: Cache control bug exceeding Anthropic's 4-segment limit
 *
 * When message-level cache_control was set, it was being applied to ALL parts
 * in a multi-part message, which could exceed provider cache segment limits.
 *
 * The fix ensures message-level cache_control only applies to the last text part,
 * while part-specific cache_control still takes precedence for all part types.
 *
 * This test verifies that cache control works correctly with multi-part messages
 * on Anthropic models.
 */
import { generateText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 120_000,
});

describe('Issue #341: Cache control only applies to last text part', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  // Use Anthropic model which supports cache control
  const model = openrouter('anthropic/claude-3.5-haiku');

  // Long system prompt to meet caching threshold
  const longSystemPrompt = `You are a helpful assistant. Here is some context that should be cached:

${Array(50)
  .fill(
    'This is padding text to ensure the prompt meets the minimum token threshold for automatic caching. ' +
      'Automatic prompt caching requires a minimum number of tokens in the prompt prefix. ' +
      'This text is repeated multiple times to reach that threshold. ',
  )
  .join('\n')}

Remember to be helpful and concise in your responses.`;

  it('should work with message-level cache control on multi-part user message', async () => {
    // Multi-part message with message-level cache control
    // The fix ensures only the last text part gets cache_control
    const response = await generateText({
      model,
      messages: [
        {
          role: 'system',
          content: longSystemPrompt,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'First part of my question.' },
            { type: 'text', text: 'Second part: What is 2+2?' },
          ],
          providerOptions: {
            anthropic: {
              cacheControl: { type: 'ephemeral' },
            },
          },
        },
      ],
    });

    // Should complete without errors about exceeding cache segment limits
    expect(response.text).toBeDefined();
    expect(response.text.length).toBeGreaterThan(0);
    expect(response.finishReason).toBeDefined();
  });

  it('should work with explicit cache control on system message', async () => {
    // Test cache control on system message
    const response = await generateText({
      model,
      messages: [
        {
          role: 'system',
          content: longSystemPrompt,
          providerOptions: {
            anthropic: {
              cacheControl: { type: 'ephemeral' },
            },
          },
        },
        {
          role: 'user',
          content: 'What is the capital of France? Answer briefly.',
        },
      ],
    });

    expect(response.text).toBeDefined();
    expect(response.text.length).toBeGreaterThan(0);
    expect(response.finishReason).toBeDefined();
  });

  it('should handle multiple requests with caching enabled', async () => {
    // Make multiple requests to verify caching works across requests
    const responses = [];

    for (let i = 0; i < 2; i++) {
      const response = await generateText({
        model,
        messages: [
          {
            role: 'system',
            content: longSystemPrompt,
            providerOptions: {
              anthropic: {
                cacheControl: { type: 'ephemeral' },
              },
            },
          },
          {
            role: 'user',
            content: `Request ${i + 1}: What is ${i + 1} + ${i + 1}? Answer with just the number.`,
          },
        ],
      });

      expect(response.text).toBeDefined();
      expect(response.finishReason).toBeDefined();
      responses.push(response);
    }

    // Both requests should complete successfully
    expect(responses.length).toBe(2);
    responses.forEach((r) => {
      expect(r.text.length).toBeGreaterThan(0);
    });
  });
});
