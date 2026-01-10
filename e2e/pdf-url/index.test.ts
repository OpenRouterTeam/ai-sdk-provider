import type { ModelMessage } from 'ai';

import { generateText } from 'ai';
import { writeFile } from 'fs/promises';
import { test, vi } from 'vitest';
import { createLLMGateway } from '@/src';

vi.setConfig({
  testTimeout: 42_000,
});

test.skip('send pdf urls', async () => {
  const llmgateway = createLLMGateway({
    apiKey: process.env.LLM_GATEWAY_API_KEY,
    baseUrl: process.env.LLM_GATEWAY_API_BASE,
  });

  const model = llmgateway('gpt-4o', {
    usage: {
      include: true,
    },
  });
  const messageHistory: ModelMessage[] = [];
  messageHistory.push({
    role: 'user',
    content: [
      {
        type: 'text',
        text: "What's in this file?",
      },
      {
        type: 'file',
        data: new URL('https://bitcoin.org/bitcoin.pdf'),
        mediaType: 'application/pdf',
      },
    ],
  });

  const response = await generateText({
    model,
    messages: messageHistory,
    providerOptions: {
      llmgateway: {
        reasoningText: {
          max_tokens: 2048,
        },
      },
    },
  });

  messageHistory.push({
    role: 'assistant',
    content: response.text,
  });

  await writeFile(
    new URL('./output.ignore.json', import.meta.url),
    JSON.stringify(messageHistory, null, 2),
  );
});
