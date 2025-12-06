import { streamText } from 'ai';
import { expect, it, vi } from 'vitest';
import { createOpenRouter } from '../src';

vi.setConfig({
  testTimeout: 42_000,
});

// TODO: This test is currently failing because the OpenRouter SDK (v0.1.27)
// strips the cache_control property from content items during Zod schema validation.
// The ResponseInputText$outboundSchema only includes `type` and `text` properties,
// so cache_control is discarded when the request is parsed.
// See: node_modules/@openrouter/sdk/esm/models/responseinputtext.js
//
// The provider correctly passes cache_control to the SDK, but the SDK strips it
// before sending to the API. This needs to be fixed in the OpenRouter SDK by
// either adding cache_control to the schema or using .passthrough() on the Zod schemas.
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
    // @ts-expect-error
    providerMetadata?.openrouter?.usage?.promptTokensDetails?.cachedTokens,
  );

  expect(cachedTokens).toBeGreaterThan(0);
});

async function callLLM() {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: `${process.env.OPENROUTER_API_BASE ?? 'https://openrouter.ai'}/api/v1`,
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
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'a '.repeat(2100),
            providerOptions: {
              openrouter: {
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
