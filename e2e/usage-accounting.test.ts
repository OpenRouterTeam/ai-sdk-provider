import { createLLMGateway } from '@/src';
import { streamText } from 'ai';
import { it } from 'vitest';

it.skip('receive usage accounting', async () => {
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
            text: 'What is the capital of France?',
          },
        ],
      },
    ],
    onFinish(e) {
      expect(e.providerMetadata?.llmgateway).toMatchObject({
        usage: expect.objectContaining({
          inputTokens: expect.any(Number),
          outputTokens: expect.any(Number),
          promptTokensDetails: expect.any(Object),
          completionTokensDetails: expect.any(Object),
          totalTokens: expect.any(Number),
          cost: expect.any(Number),
        }),
      });
    },
  });

  await response.consumeStream();
  const providerOptions = await response.providerMetadata;
  // You can use expect.any(Type) or expect.objectContaining for schema-like matching
  expect(providerOptions?.llmgateway).toMatchObject({
    usage: expect.objectContaining({
      inputTokens: expect.any(Number),
      outputTokens: expect.any(Number),
      promptTokensDetails: expect.any(Object),
      completionTokensDetails: expect.any(Object),
      totalTokens: expect.any(Number),
      cost: expect.any(Number),
    }),
  });
});
