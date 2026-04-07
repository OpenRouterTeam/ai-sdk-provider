/**
 * Regression test for GitHub issue #432
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/432
 *
 * Issue: "Can doGenerate() include the raw response body?"
 *
 * Reported behavior: doGenerate() does not include `body` in the returned
 * `response` object, so `result.response.body` is undefined when using
 * generateText(). The raw OpenRouter response includes fields that the
 * adapter doesn't map — multimodal token breakdowns, per-direction cost
 * details, is_byok, and native_finish_reason.
 *
 * Other AI SDK providers (OpenAI, Anthropic, OpenAI-compatible) all set
 * response.body from the rawValue returned by postJsonToApi().
 *
 * This test verifies that generateText() returns the raw response body
 * with OpenRouter-specific fields accessible.
 */
import { generateText } from 'ai';
import { describe, expect, it } from 'vitest';
import { createOpenRouter } from '@/src';

describe('Issue #432: raw response body in doGenerate', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  it('should include raw response body with OpenRouter-specific fields', async () => {
    const result = await generateText({
      model: openrouter('openai/gpt-4.1-nano'),
      prompt: 'Say hello in one word.',
    });

    expect(result.response.body).toBeDefined();

    const body = result.response.body as Record<string, unknown>;
    expect(body.id).toBeDefined();
    expect(typeof body.id).toBe('string');
    expect(body.model).toBeDefined();
    expect(body.choices).toBeDefined();
    expect(Array.isArray(body.choices)).toBe(true);
    expect(body.usage).toBeDefined();
  }, 30_000);

  it('should expose provider field in raw response body', async () => {
    const result = await generateText({
      model: openrouter('openai/gpt-4.1-nano'),
      prompt: 'Say hi.',
    });

    const body = result.response.body as Record<string, unknown>;
    expect(body.provider).toBeDefined();
    expect(typeof body.provider).toBe('string');
  }, 30_000);
});
