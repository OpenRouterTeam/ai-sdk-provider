import { createLLMGateway } from '@/src';
import { getEnvVar } from '@/src/env-utils';
import { streamText } from 'ai';
import { it } from 'vitest';

it.skip('receive usage accounting', async () => {
  const llmgateway = createLLMGateway({
    apiKey: getEnvVar('API_KEY'),
    baseURL: `${getEnvVar('API_BASE')}/api/v1`,
  });
  const model = llmgateway('anthropic/claude-3.7-sonnet:thinking', {
    usage: {
      include: true,
    },
  });
  const response = streamText({
    model,
    messages: [
      {
        role: 'user',
        content: 'What is the capital of France?',
      },
    ],
    onFinish(e) {
      expect(e.providerMetadata?.llmgateway).toMatchObject({
        usage: expect.objectContaining({
          promptTokens: expect.any(Number),
          completionTokens: expect.any(Number),
          promptTokensDetails: expect.any(Object),
          completionTokensDetails: expect.any(Object),
          totalTokens: expect.any(Number),
          cost: expect.any(Number),
        }),
      });
    },
  });

  await response.consumeStream();
  const providerMetadata = await response.providerMetadata;
  // You can use expect.any(Type) or expect.objectContaining for schema-like matching
  expect(providerMetadata?.llmgateway).toMatchObject({
    usage: expect.objectContaining({
      promptTokens: expect.any(Number),
      completionTokens: expect.any(Number),
      promptTokensDetails: expect.any(Object),
      completionTokensDetails: expect.any(Object),
      totalTokens: expect.any(Number),
      cost: expect.any(Number),
    }),
  });
});
