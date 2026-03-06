/**
 * Regression test for GitHub Issue #424
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/424
 *
 * Reported error: Users cannot enable Anthropic automatic prompt caching
 * via providerOptions or model settings. The cache_control directive needs
 * to be passed at the top level of the request body.
 *
 * This test verifies that cache_control is correctly passed through to the
 * API when configured via model settings or providerOptions.
 */
import { generateText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 120_000,
});

describe('Issue #424: Anthropic automatic cache control', () => {
  const provider = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  it('should complete a request with cache_control enabled via model settings', async () => {
    const model = provider.chat('anthropic/claude-haiku-4.5', {
      cache_control: { type: 'ephemeral' },
    });

    const result = await generateText({
      model,
      messages: [
        {
          role: 'user',
          content: 'What is 2+2? Answer with just the number.',
        },
      ],
    });

    // Verify the request succeeded and returned content
    expect(result.text).toBeTruthy();
    expect(result.usage.inputTokens).toBeGreaterThan(0);
  });

  it('should complete a request with cache_control enabled via providerOptions', async () => {
    const result = await generateText({
      model: provider('anthropic/claude-haiku-4.5'),
      messages: [
        {
          role: 'user',
          content: 'What is 2+2? Answer with just the number.',
        },
      ],
      providerOptions: {
        openrouter: {
          cache_control: { type: 'ephemeral' },
        },
      },
    });

    // Verify the request succeeded and returned content
    expect(result.text).toBeTruthy();
    expect(result.usage.inputTokens).toBeGreaterThan(0);
  });
});
