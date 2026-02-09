/**
 * Regression test for GitHub issue #389
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/389
 *
 * Issue: "Anthropic prompt caching not applied when `system` is a string
 * in AI SDK (`ModelMessage[]`); only block content works"
 *
 * The user reported that prompt caching does not work when a system message
 * is provided as a plain string with cache_control at the message level via
 * providerOptions. Caching only worked when content was an array of text
 * blocks with cache_control on each block.
 *
 * The fix converts system message content to array format with block-level
 * cache_control when cache control is present, matching the existing behavior
 * for user messages.
 */
import { generateText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 120_000,
});

describe('Issue #389: System message cache control with string content', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  const model = openrouter('anthropic/claude-sonnet-4');

  const longSystemPrompt = `You are a helpful assistant. Here is some context that should be cached:

${Array(50)
  .fill(
    'This is padding text to ensure the prompt meets the minimum token threshold for Anthropic prompt caching. ' +
      'Prompt caching requires a minimum number of tokens in the prompt prefix. ' +
      'This text is repeated multiple times to reach that threshold. ',
  )
  .join('\n')}

Remember to be helpful and concise in your responses.`;

  it('should trigger cache write on first request with system message cache control', async () => {
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
          content: 'What is 2+2? Answer with just the number.',
        },
      ],
    });

    expect(response.text).toBeDefined();
    expect(response.text.length).toBeGreaterThan(0);
    expect(response.finishReason).toBeDefined();
  });

  it('should trigger cache read on second request with system message cache control', async () => {
    const makeRequest = () =>
      generateText({
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
            content: 'What is 2+2? Answer with just the number.',
          },
        ],
      });

    await makeRequest();

    const response = await makeRequest();

    const openrouterMetadata = response.providerMetadata?.openrouter as {
      usage?: {
        promptTokensDetails?: { cachedTokens?: number };
      };
    };

    const cachedTokens =
      openrouterMetadata?.usage?.promptTokensDetails?.cachedTokens;

    expect(cachedTokens).toBeDefined();
    expect(cachedTokens).toBeGreaterThan(0);
  });
});
