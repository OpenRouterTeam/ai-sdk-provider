import type { ModelMessage } from 'ai';

import { generateText } from 'ai';
import { readFile } from 'fs/promises';
import { expect, test, vi } from 'vitest';
import { createOpenRouter } from '@/src';

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

  // Minimal assertion that doesn't spam logs with full response
  expect(response.text).toBeTruthy();
  expect(response.text.length).toBeGreaterThan(0);
});

test('sending large pdf base64 blob with FileParserPlugin', async () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  const model = openrouter('anthropic/claude-3.5-sonnet', {
    usage: {
      include: true,
    },
  });

  // Load fixture metadata to get expected verification code
  const metadataPath = new URL('../fixtures/pdfs/large.json', import.meta.url);
  const metadataText = await readFile(metadataPath, 'utf-8');
  const metadata = JSON.parse(metadataText) as {
    size: string;
    verificationCode: string;
  };

  // Read large PDF fixture and convert to base64
  const pdfPath = new URL('../fixtures/pdfs/large.pdf', import.meta.url);
  const pdfBuffer = await readFile(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');

  const messageHistory: ModelMessage[] = [];
  messageHistory.push({
    role: 'user',
    content: [
      {
        type: 'text',
        text: 'Extract the verification code shown in this PDF. Reply with ONLY the code.',
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
  });

  messageHistory.push({
    role: 'assistant',
    content: response.text,
  });

  // Check verification code - use custom message to avoid dumping large objects
  expect(
    response.text,
    `Response should contain code ${metadata.verificationCode}`,
  ).toContain(metadata.verificationCode);

  // Assert FileParserPlugin was active (token count should be low, <150)
  // Without the plugin, AI SDK would send raw base64 causing much higher token usage
  expect(
    response.usage?.totalTokens || 0,
    'Token usage should be < 150 (proves FileParserPlugin is active)',
  ).toBeLessThan(150);
});
