/**
 * Regression test for GitHub issue #587
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/587
 *
 * Issue: in the chat model, `providerOptions.openrouter.provider` replaced the
 * configured provider routing instead of merging with it. A model configured
 * with `{ order: ['google'], allow_fallbacks: false, sort: 'price' }` called
 * with `providerOptions.openrouter.provider = { order: ['anthropic'] }` lost
 * `allow_fallbacks` and `sort`.
 *
 * This test verifies that configured routing keys survive a call-time
 * `provider` override in chat (generate + stream) and completion, and that a
 * call-time `provider: null` still clears configured routing.
 */
import { generateText, streamText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

function createCapturingOpenRouter() {
  const bodies: Array<Record<string, unknown>> = [];
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE ?? 'https://openrouter.ai'}/api/v1`,
    fetch: async (input, init) => {
      if (typeof init?.body === 'string') {
        bodies.push(JSON.parse(init.body));
      }
      return fetch(input, init);
    },
  });
  return { openrouter, bodies };
}

// A configured `only` that matches no real provider makes the request fail,
// so a successful call proves the configured routing was dropped.
const unroutable = {
  only: ['nonexistent-provider'],
  allow_fallbacks: false,
};

describe('Issue #587: call-time provider routing merges with configured routing', () => {
  it('chat generateText: keeps configured keys when runtime sets provider', async () => {
    const { openrouter, bodies } = createCapturingOpenRouter();
    const model = openrouter('openai/gpt-4o-mini', { provider: unroutable });

    await expect(
      generateText({
        model,
        prompt: 'Say hi',
        maxRetries: 0,
        providerOptions: { openrouter: { provider: { sort: 'price' } } },
      }),
    ).rejects.toThrow();

    expect(bodies[0]?.provider).toStrictEqual({ ...unroutable, sort: 'price' });
  });

  it('chat streamText: keeps configured keys when runtime sets provider', async () => {
    const { openrouter, bodies } = createCapturingOpenRouter();
    const model = openrouter('openai/gpt-4o-mini', { provider: unroutable });
    let streamError: unknown;

    const result = streamText({
      model,
      prompt: 'Say hi',
      maxRetries: 0,
      providerOptions: { openrouter: { provider: { sort: 'price' } } },
      onError: ({ error }) => {
        streamError = error;
      },
    });
    await result.consumeStream();

    expect(streamError).toBeDefined();
    expect(bodies[0]?.provider).toStrictEqual({ ...unroutable, sort: 'price' });
  });

  it('chat: a runtime provider of null clears configured routing', async () => {
    const { openrouter, bodies } = createCapturingOpenRouter();
    const model = openrouter('openai/gpt-4o-mini', { provider: unroutable });

    const { text } = await generateText({
      model,
      prompt: 'Say hi',
      maxRetries: 0,
      providerOptions: { openrouter: { provider: null } },
    });

    expect(text.length).toBeGreaterThan(0);
    expect(bodies[0]).not.toHaveProperty('provider');
  });

  it('completion: keeps configured extraBody keys when runtime sets provider', async () => {
    const { openrouter, bodies } = createCapturingOpenRouter();
    const model = openrouter.completion('openai/gpt-3.5-turbo-instruct', {
      extraBody: { provider: unroutable },
    });

    await expect(
      generateText({
        model,
        prompt: 'Say hi',
        maxRetries: 0,
        providerOptions: { openrouter: { provider: { sort: 'price' } } },
      }),
    ).rejects.toThrow();

    expect(bodies[0]?.provider).toStrictEqual({ ...unroutable, sort: 'price' });
  });
});
