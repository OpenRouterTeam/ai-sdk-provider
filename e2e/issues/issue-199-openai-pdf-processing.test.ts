/**
 * Regression test for GitHub issue #199
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/199
 *
 * Issue: "PDF Processing Fails on GPT-4.1 and GPT-5 Models via OpenRouter"
 *
 * Root cause: OpenAI models don't natively support PDF file input. OpenRouter's
 * FileParserPlugin parses PDFs and sends extracted text to the model. The issue
 * was resolved by fixes to the FileParserPlugin auto-enabling behavior and
 * improved PDF handling in commits 60e3c57 and subsequent releases.
 *
 * This test verifies that:
 * - PDF processing works with OpenAI models when using FileParserPlugin
 * - PDF processing works with OpenAI models without explicit plugin config
 *   (OpenRouter auto-handles PDF parsing for models that don't support it natively)
 */
import type { ModelMessage } from 'ai';

import { generateText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 120_000,
});

describe('Issue #199: PDF Processing with OpenAI models', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  // Use gpt-4o-mini as a representative OpenAI model (cheaper than gpt-4.1/gpt-5)
  const modelWithPlugin = openrouter('openai/gpt-4o-mini', {
    plugins: [
      {
        id: 'file-parser',
        pdf: {
          engine: 'mistral-ocr',
        },
      },
    ],
  });

  const modelWithoutPlugin = openrouter('openai/gpt-4o-mini');

  // Helper to fetch and encode PDF
  async function fetchPdfAsBase64(): Promise<string> {
    const pdfBlob = await fetch('https://bitcoin.org/bitcoin.pdf').then((res) =>
      res.arrayBuffer(),
    );
    return Buffer.from(pdfBlob).toString('base64');
  }

  it('should process PDF with explicit FileParserPlugin configuration', async () => {
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
      model: modelWithPlugin,
      messages: messageHistory,
    });

    expect(response.text).toBeDefined();
    expect(response.text.length).toBeGreaterThan(0);
    // The Bitcoin whitepaper title should be mentioned
    expect(response.text.toLowerCase()).toContain('bitcoin');
  });

  it('should process PDF without explicit plugin (OpenRouter auto-handles)', async () => {
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
      model: modelWithoutPlugin,
      messages: messageHistory,
    });

    expect(response.text).toBeDefined();
    expect(response.text.length).toBeGreaterThan(0);
    // The Bitcoin whitepaper title should be mentioned
    expect(response.text.toLowerCase()).toContain('bitcoin');
  });
});
