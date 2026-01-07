import type { ModelMessage } from 'ai';

import { generateText } from 'ai';
import { writeFile } from 'fs/promises';
import { expect, test, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 42_000,
});

test('send image urls', async () => {
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
        text: "What's in this image? Reply with just a few words.",
      },
      {
        type: 'file',
        // Use a reliable test image URL (httpbin.org echo service with a simple base64-encoded 1x1 red pixel)
        data: new URL('https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png'),
        mediaType: 'image/png',
      },
    ],
  });

  const response = await generateText({
    model,
    messages: messageHistory,
  });

  messageHistory.push({
    role: 'assistant',
    content: response.text,
  });

  // Verify we got a response about the image
  expect(response.text).toBeTruthy();
  expect(response.text.length).toBeGreaterThan(0);

  await writeFile(
    new URL('./output.ignore.json', import.meta.url),
    JSON.stringify(messageHistory, null, 2),
  );
});
