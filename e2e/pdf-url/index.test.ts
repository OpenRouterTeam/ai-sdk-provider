import type { ModelMessage } from 'ai';

import { generateText } from 'ai';
import { writeFile } from 'fs/promises';
import { test, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 42_000,
});

test('send pdf urls', async () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  const model = openrouter('anthropic/claude-sonnet-4', {
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
