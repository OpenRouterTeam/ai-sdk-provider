/**
 * Regression test for GitHub issue #532
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/532
 *
 * Reported error: providerMetadata.openrouter.usage drops the API's is_byok field.
 *
 * This test verifies that the BYOK indicator is preserved in provider metadata.
 */
import { generateText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

describe('Issue #532: BYOK status should be preserved in provider metadata', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  it('includes isByok for a generation with usage accounting', async () => {
    const result = await generateText({
      model: openrouter('openai/gpt-4o-mini'),
      prompt: 'Reply with the single digit 1.',
      maxOutputTokens: 1,
    });

    const usage = (
      result.providerMetadata?.openrouter as {
        usage?: { isByok?: boolean };
      }
    )?.usage;

    expect(usage?.isByok).toEqual(expect.any(Boolean));
  });
});
