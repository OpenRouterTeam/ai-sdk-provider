import { streamText } from 'ai';
import { it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 42_000,
});

it('should trigger cache read', async () => {
  // First call to warm the cache
  await callLLM();
  // Second call to test cache read
  const response = await callLLM();
  const providerMetadata = await response.providerMetadata;
  expect(providerMetadata?.openrouter).toMatchObject({
    usage: expect.objectContaining({
      promptTokens: expect.any(Number),
      completionTokens: expect.any(Number),
      promptTokensDetails: expect.objectContaining({
        cachedTokens: expect.any(Number),
      }),
      completionTokensDetails: expect.any(Object),
      totalTokens: expect.any(Number),
      cost: expect.any(Number),
    }),
  });

  const cachedTokens = Number(
    // @ts-ignore
    providerMetadata?.openrouter?.usage?.promptTokensDetails?.cachedTokens,
  );

  expect(cachedTokens).toBeGreaterThan(0);
});

async function callLLM() {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });
  const model = openrouter('anthropic/claude-3.7-sonnet', {
    usage: {
      include: true,
    },
  });
  const response = streamText({
    model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "a".repeat(4200),
            providerOptions: {
              openrouter: {
                cache_control: {
                  type: "ephemeral",
                },
              },
            },
          },
          {
            type: "text",
            text: 'How many "a" did I use in the previous message?',
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "hi",
          },
        ],
      },
    ],
  });

  await response.consumeStream();
  return response;
}
