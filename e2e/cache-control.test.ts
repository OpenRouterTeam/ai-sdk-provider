import { createLLMGateway } from '@/src';
import { streamText } from 'ai';
import { it, vi } from 'vitest';

vi.setConfig({
  testTimeout: 42_000,
});

it.skip('should trigger cache read', async () => {
  // First call to warm the cache
  await callLLM();
  // Second call to test cache read
  const response = await callLLM();
  const providerOptions = await response.providerMetadata;
  expect(providerOptions?.llmgateway).toMatchObject({
    usage: expect.objectContaining({
      inputTokens: expect.any(Number),
      outputTokens: expect.any(Number),
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
    providerOptions?.llmgateway?.usage?.promptTokensDetails?.cachedTokens,
  );

  expect(cachedTokens).toBeGreaterThan(0);
});

async function callLLM() {
  const llmgateway = createLLMGateway({
    apiKey: process.env.LLM_GATEWAY_API_KEY,
    baseUrl: process.env.LLM_GATEWAY_API_BASE,
  });
  const model = llmgateway('claude-3-7-sonnet', {
    usage: {
      include: true,
    },
  });
  const response = streamText({
    model,
    messages: [
      {
        role: 'user',

        content: [
          {
            type: 'text',
            text: 'a'.repeat(4200),
            providerOptions: {
              llmgateway: {
                cache_control: {
                  type: 'ephemeral',
                },
              },
            },
          },
          {
            type: 'text',
            text: 'How many "a" did I use in the previous message?',
          },
        ],
      },
    ],
  });

  await response.consumeStream();
  return response;
}
