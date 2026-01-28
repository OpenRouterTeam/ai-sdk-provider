/**
 * Regression test for GitHub issue #199
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/199
 *
 * Issue: "PDF Processing Fails on GPT-4.1 and GPT-5 Models via OpenRouter"
 *
 * Original error reported:
 *   AI_RetryError: Failed after 3 attempts. Last error: Provider returned error
 *
 * Error details from comments (502 from OpenAI):
 *   {"error":{"message":"Provider returned error","code":502,"metadata":{...}}}
 *
 * Root cause: OpenAI models don't natively support PDF file input. OpenRouter
 * automatically parses PDFs and sends extracted text to the model. The issue
 * was resolved by fixes to PDF handling and FileParserPlugin behavior.
 *
 * This test verifies that PDF processing works with the exact models mentioned
 * in the issue (gpt-4.1 and gpt-5) using base64-encoded PDFs.
 */
import type { ModelMessage } from 'ai';

import { generateText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 120_000,
});

describe('Issue #199: PDF Processing Fails on GPT-4.1 and GPT-5 Models via OpenRouter', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  // Helper to fetch and encode PDF
  async function fetchPdfAsBase64(): Promise<string> {
    const pdfBlob = await fetch('https://bitcoin.org/bitcoin.pdf').then((res) =>
      res.arrayBuffer(),
    );
    return Buffer.from(pdfBlob).toString('base64');
  }

  it('should process PDF with openai/gpt-4.1', async () => {
    const model = openrouter('openai/gpt-4.1');
    const pdfBase64 = await fetchPdfAsBase64();

    const messageHistory: ModelMessage[] = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'What is the title of this document? Reply with just the title.',
          },
          {
            type: 'file',
            data: `data:application/pdf;base64,${pdfBase64}`,
            mediaType: 'application/pdf',
          },
        ],
      },
    ];

    const response = await generateText({
      model,
      messages: messageHistory,
    });

    expect(response.text).toBeDefined();
    expect(response.text.length).toBeGreaterThan(0);
    expect(response.text.toLowerCase()).toContain('bitcoin');
  });

  it('should process PDF with openai/gpt-5', async () => {
    const model = openrouter('openai/gpt-5');
    const pdfBase64 = await fetchPdfAsBase64();

    const messageHistory: ModelMessage[] = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'What is the title of this document? Reply with just the title.',
          },
          {
            type: 'file',
            data: `data:application/pdf;base64,${pdfBase64}`,
            mediaType: 'application/pdf',
          },
        ],
      },
    ];

    const response = await generateText({
      model,
      messages: messageHistory,
    });

    expect(response.text).toBeDefined();
    expect(response.text.length).toBeGreaterThan(0);
    expect(response.text.toLowerCase()).toContain('bitcoin');
  });
});
