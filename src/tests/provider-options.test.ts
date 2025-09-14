import type { ModelMessage } from 'ai';

import { createTestServer } from '@ai-sdk/provider-utils/test';
import { streamText } from 'ai';
import { describe, expect, it, vi } from 'vitest';

import { createLLMGateway } from '../provider';

// Add type assertions for the mocked classes
const TEST_MESSAGES: ModelMessage[] = [
  { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
];

describe('providerOptions', () => {
  const server = createTestServer({
    'https://api.llmgateway.io/v1/chat/completions': {
      response: {
        type: 'stream-chunks',
        chunks: [],
      },
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set providerOptions llmgateway to extra body', async () => {
    const llmgateway = createLLMGateway({
      apiKey: 'test',
    });
    const model = llmgateway('gpt-4o');

    await streamText({
      model: model,
      messages: TEST_MESSAGES,
      providerOptions: {
        llmgateway: {
          reasoning: {
            max_tokens: 1000,
          },
        },
      },
    }).consumeStream();

    expect(await server.calls[0]?.requestBodyJson).toStrictEqual({
      messages: [
        {
          content: 'Hello',
          role: 'user',
        },
      ],
      reasoning: {
        max_tokens: 1000,
      },
      model: 'gpt-4o',
      stream: true,
    });
  });
});
