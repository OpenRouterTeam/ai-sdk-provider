import type { CoreMessage } from 'ai';

import { writeFile } from 'fs/promises';
import { createOpenRouter } from '@/src';
import { generateText } from 'ai';
import { test, vi } from 'vitest';

vi.setConfig({
  testTimeout: 42_000,
});

test('sending pdf base64 blob', async () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  const model = openrouter('anthropic/claude-sonnet-4', {
    usage: {
      include: true,
    },
  });

  const pdfBlob = await fetch('https://bitcoin.org/bitcoin.pdf').then((res) =>
    res.arrayBuffer(),
  );

  const pdfBase64 = Buffer.from(pdfBlob).toString('base64');

  const messageHistory: CoreMessage[] = [];
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
        mimeType: 'application/pdf',
      },
    ],
  });

  const response = await generateText({
    model,
    messages: messageHistory,
    maxSteps: 10,
    providerOptions: {
      openrouter: {
        reasoning: {
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
