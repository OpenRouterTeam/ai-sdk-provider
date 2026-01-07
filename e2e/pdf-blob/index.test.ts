import type { ModelMessage } from 'ai';

import { generateText } from 'ai';
import { readFile } from 'fs/promises';
import { expect, test, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

// Note: PDF data URIs only work with certain models through the Chat API.
// Google Gemini models support PDF data URIs, while Anthropic models do not.
// For Claude PDF support, use the OpenRouter Responses API instead.

test('sending pdf base64 blob', async () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  // Use Gemini which supports PDF data URIs through the Chat API
  const model = openrouter('google/gemini-2.0-flash-001', {
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
        text: "What's the title of this document? Reply with just the title.",
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

  // Verify we got a response about Bitcoin
  expect(response.text).toBeTruthy();
  expect(response.text.toLowerCase()).toContain('bitcoin');
});

test('sending large pdf base64 blob with FileParserPlugin', async () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  // Use Gemini with FileParserPlugin for large PDFs
  const model = openrouter('google/gemini-2.0-flash-001', {
    plugins: [
      {
        id: 'file-parser',
        pdf: {
          engine: 'mistral-ocr',
        },
      },
    ],
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

  // Assert FileParserPlugin was active (token count should be reasonable)
  // Without the plugin, AI SDK would send raw base64 causing much higher token usage
  // With a 3.4MB PDF, we expect ~1000-2000 tokens with OCR, not millions from raw base64
  expect(
    response.usage?.totalTokens || 0,
    'Token usage should be < 5000 (proves FileParserPlugin is active)',
  ).toBeLessThan(5000);
});
