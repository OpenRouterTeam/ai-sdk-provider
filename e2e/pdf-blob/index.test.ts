import type { ModelMessage } from 'ai';

import { generateText } from 'ai';
import { writeFile } from 'fs/promises';
import { test, vi } from 'vitest';
import { createLLMGateway } from '@/src';

vi.setConfig({
  testTimeout: 42_000,
});

test.skip('sending pdf base64 blob', async () => {
  const llmgateway = createLLMGateway({
    apiKey: process.env.LLM_GATEWAY_API_KEY,
    baseUrl: process.env.LLM_GATEWAY_API_BASE,
  });

  const model = llmgateway('gpt-4o', {
    usage: {
      include: true,
    },
  });

  const pdfBlob = await fetch('https://bitcoin.org/bitcoin.pdf').then((res) =>
    res.arrayBuffer(),
  );

  const pdfBase64 = Buffer.from(pdfBlob).toString('base64');

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
        data: `data:application/pdf;base64,${pdfBase64}`,
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
