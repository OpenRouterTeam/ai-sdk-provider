import type { LanguageModelV2Prompt } from '@ai-sdk/provider';
import { createOpenRouter } from '../provider';
import { describe, it, expect, vi } from 'vitest';

describe('Payload Comparison - Large PDF', () => {
  it('should send payload matching fetch baseline for large PDFs', async () => {
    // Capture what the provider actually sends
    let capturedRequestBody: any = null;

    const mockFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      // Capture the request body
      if (init?.body) {
        capturedRequestBody = JSON.parse(init.body as string);
      }

      // Return a minimal success response
      return new Response(
        JSON.stringify({
          id: 'test-123',
          model: 'anthropic/claude-3.5-sonnet',
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Test response',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });

    const provider = createOpenRouter({
      apiKey: 'test-key',
      fetch: mockFetch as any,
    });

    // Simulate a large PDF (use a small base64 for testing, but structure matters)
    const smallPdfBase64 = 'JVBERi0xLjQKJeLjz9MKM...(truncated)';
    const dataUrl = `data:application/pdf;base64,${smallPdfBase64}`;

    const prompt: LanguageModelV2Prompt = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract the verification code. Reply with ONLY the code.',
          },
          {
            type: 'file',
            data: dataUrl,
            mediaType: 'application/pdf',
          },
        ],
      },
    ];

    const model = provider('anthropic/claude-3.5-sonnet', {
      usage: { include: true },
    });

    await model.doGenerate({ prompt });

    // Now assert the payload structure matches fetch baseline
    expect(capturedRequestBody).toBeDefined();

    // Expected structure based on fetch example:
    // {
    //   model: 'anthropic/claude-3.5-sonnet',
    //   messages: [{
    //     role: 'user',
    //     content: [
    //       { type: 'file', file: { filename: '...', file_data: 'data:...' } },
    //       { type: 'text', text: '...' }
    //     ]
    //   }],
    //   plugins: [{ id: 'file-parser', pdf: { engine: 'mistral-ocr' } }],
    //   usage: { include: true }
    // }

    const messages = capturedRequestBody.messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBeInstanceOf(Array);

    const content = messages[0].content;
    
    // Find the file part
    const filePart = content.find((part: any) => part.type === 'file');
    expect(filePart).toBeDefined();

    // CRITICAL ASSERTION: The file part should have a nested 'file' object with 'file_data'
    // This is what the fetch example sends and what OpenRouter expects
    expect(filePart).toMatchObject({
      type: 'file',
      file: {
        file_data: expect.stringContaining('data:application/pdf;base64,'),
      },
    });

    // Find the text part
    const textPart = content.find((part: any) => part.type === 'text');
    expect(textPart).toMatchObject({
      type: 'text',
      text: 'Extract the verification code. Reply with ONLY the code.',
    });

    // CRITICAL: Check for plugins array (FileParserPlugin should be auto-enabled for files)
    expect(capturedRequestBody.plugins).toBeDefined();
    expect(capturedRequestBody.plugins).toBeInstanceOf(Array);
    
    const fileParserPlugin = capturedRequestBody.plugins.find(
      (p: any) => p.id === 'file-parser'
    );
    expect(fileParserPlugin).toBeDefined();
    expect(fileParserPlugin).toMatchObject({
      id: 'file-parser',
      pdf: {
        engine: expect.stringMatching(/^(mistral-ocr|pdf-text|native)$/),
      },
    });

    // Log the actual payload for inspection
    console.log('Captured payload:', JSON.stringify(capturedRequestBody, null, 2));
  });
});
