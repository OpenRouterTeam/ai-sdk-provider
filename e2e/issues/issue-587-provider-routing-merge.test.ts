/**
 * Regression test for GitHub issue #587
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/587
 *
 * Issue: "Chat model replaces configured provider routing instead of merging
 * (consistency with image model, #551)"
 *
 * This test verifies that a call-level `providerOptions.openrouter.provider`
 * is shallow merged into the model's configured provider routing, so keys it
 * does not set (`allow_fallbacks`, `sort`) are still sent.
 */
import { generateText } from 'ai';
import { describe, expect, it } from 'vitest';
import { createOpenRouter } from '@/src';

describe('Issue #587: chat provider routing is merged, not replaced', () => {
  it('keeps configured routing keys when the call overrides order', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const openrouter = createOpenRouter({
      apiKey: 'test-key',
      fetch: async (_input, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return new Response(
          JSON.stringify({
            id: 'chatcmpl-587',
            model: 'google/gemini-2.5-flash',
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: 'Hello' },
                finish_reason: 'stop',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    });

    await generateText({
      model: openrouter.chat('google/gemini-2.5-flash', {
        provider: { order: ['google'], allow_fallbacks: false, sort: 'price' },
      }),
      prompt: 'Hello',
      providerOptions: { openrouter: { provider: { order: ['anthropic'] } } },
    });

    expect(bodies[0]?.provider).toStrictEqual({
      order: ['anthropic'],
      allow_fallbacks: false,
      sort: 'price',
    });
  });
});
