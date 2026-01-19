import type { LanguageModelV3Prompt } from '@ai-sdk/provider';
import type { OpenRouterChatCompletionsInput } from '../types/openrouter-chat-completions-input';
import type { OpenRouterChatSettings } from '../types/openrouter-chat-settings';

import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '../provider';

describe('Payload Comparison - Large PDF', () => {
  it('should send payload matching fetch baseline for large PDFs', async () => {
    interface CapturedRequestBody {
      model: string;
      messages: OpenRouterChatCompletionsInput;
      plugins?: OpenRouterChatSettings['plugins'];
      usage?: { include: boolean };
    }

    // Capture what the provider actually sends
    let capturedRequestBody: CapturedRequestBody | null = null;

    const mockFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      // Capture the request body
      if (init?.body) {
        capturedRequestBody = JSON.parse(
          init.body as string,
        ) as CapturedRequestBody;
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
        },
      );
    }) as typeof fetch;

    const provider = createOpenRouter({
      apiKey: 'test-key',
      fetch: mockFetch,
    });

    // Simulate a large PDF (use a small base64 for testing, but structure matters)
    const smallPdfBase64 = 'JVBERi0xLjQKJeLjz9MKM...(truncated)';
    const dataUrl = `data:application/pdf;base64,${smallPdfBase64}`;

    const prompt: LanguageModelV3Prompt = [
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
      plugins: [{ id: 'file-parser', pdf: { engine: 'mistral-ocr' } }],
      usage: { include: true },
    });

    await model.doGenerate({ prompt });

    // Now assert the payload structure matches fetch baseline
    expect(capturedRequestBody).toBeDefined();
    expect(capturedRequestBody).not.toBeNull();

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

    const messages = capturedRequestBody!.messages;
    expect(messages).toHaveLength(1);
    expect(messages[0]?.role).toBe('user');
    expect(messages[0]?.content).toBeInstanceOf(Array);

    const content = messages[0]?.content;
    if (!Array.isArray(content)) {
      throw new Error('Content should be an array');
    }

    // Find the file part
    const filePart = content.find((part) => part.type === 'file');
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
    const textPart = content.find((part) => part.type === 'text');
    expect(textPart).toMatchObject({
      type: 'text',
      text: 'Extract the verification code. Reply with ONLY the code.',
    });

    // Check for plugins array
    expect(capturedRequestBody!.plugins).toBeDefined();
    expect(capturedRequestBody!.plugins).toBeInstanceOf(Array);

    const { plugins } = capturedRequestBody!;
    if (!plugins) {
      throw new Error('Plugins should be defined');
    }

    const fileParserPlugin = plugins.find((p) => p.id === 'file-parser');
    expect(fileParserPlugin).toBeDefined();
    expect(fileParserPlugin).toMatchObject({
      id: 'file-parser',
      pdf: {
        engine: expect.stringMatching(/^(mistral-ocr|pdf-text|native)$/),
      },
    });
  });
});
