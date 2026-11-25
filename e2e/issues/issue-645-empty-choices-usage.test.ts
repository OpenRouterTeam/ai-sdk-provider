/**
 * Regression test for GitHub issue #645
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/645
 *
 * Reported error: AI_NoContentGeneratedError: No choice in response (no usage on the error)
 * Model: openai/gpt-4o-mini
 *
 * This test verifies that a non-streaming response with `choices: []` still
 * throws NoContentGeneratedError, and that the error carries the usage and
 * cost reported in the response.
 */
import { NoContentGeneratedError } from '@ai-sdk/provider';
import { generateText } from 'ai';
import { describe, expect, it } from 'vitest';
import { createOpenRouter } from '@/src';

describe('Issue #645: empty choices array keeps usage on the error', () => {
  const body = {
    choices: [],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 2,
      total_tokens: 12,
      cost: 0.0001,
    },
  };

  const openrouter = createOpenRouter({
    apiKey: 'test',
    fetch: async () =>
      new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' },
      }),
  });

  it('throws NoContentGeneratedError carrying usage and cost', async () => {
    const error = await generateText({
      model: openrouter('openai/gpt-4o-mini'),
      prompt: 'hi',
    }).catch((e: unknown) => e);

    expect(NoContentGeneratedError.isInstance(error)).toBe(true);
    expect(error).toMatchObject({
      message: 'No choice in response',
      usage: {
        inputTokens: { total: 10 },
        outputTokens: { total: 2 },
      },
      providerMetadata: {
        openrouter: {
          usage: {
            promptTokens: 10,
            completionTokens: 2,
            totalTokens: 12,
            cost: 0.0001,
          },
        },
      },
    });
  });
});
