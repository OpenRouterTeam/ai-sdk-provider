import type { LanguageModelV3Prompt } from '@ai-sdk/provider';

import { describe, expect, it } from 'vitest';
import { convertToOpenRouterMessages } from '../../chat/convert-to-openrouter-messages.js';

describe('convertToOpenRouterMessages', () => {
  describe('system messages', () => {
    it('converts system message to system role with string content', () => {
      const prompt: LanguageModelV3Prompt = [
        { role: 'system', content: 'You are a helpful assistant.' },
      ];

      const result = convertToOpenRouterMessages(prompt);

      expect(result).toEqual([
        {
          role: 'system',
          content: 'You are a helpful assistant.',
        },
      ]);
    });
  });

  describe('user messages', () => {
    it('converts user text message', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Hello, world!' }],
        },
      ];

      const result = convertToOpenRouterMessages(prompt);

      expect(result).toEqual([
        {
          role: 'user',
          content: [{ type: 'input_text', text: 'Hello, world!' }],
        },
      ]);
    });

    it('converts user image URL message', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              mediaType: 'image/png',
              data: new URL('https://example.com/image.png'),
            },
          ],
        },
      ];

      const result = convertToOpenRouterMessages(prompt);

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'input_image',
              imageUrl: 'https://example.com/image.png',
              detail: 'auto',
            },
          ],
        },
      ]);
    });

    it('converts user image base64 message', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              mediaType: 'image/jpeg',
              data: 'base64encodeddata',
            },
          ],
        },
      ];

      const result = convertToOpenRouterMessages(prompt);

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'input_image',
              imageUrl: 'data:image/jpeg;base64,base64encodeddata',
              detail: 'auto',
            },
          ],
        },
      ]);
    });

    it('converts user file message (non-image)', () => {
      // Non-image files (PDFs, etc.) are sent as input_file type
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              mediaType: 'application/pdf',
              data: new URL('https://example.com/doc.pdf'),
            },
          ],
        },
      ];

      const result = convertToOpenRouterMessages(prompt);

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            {
              type: 'input_file',
              fileUrl: 'https://example.com/doc.pdf',
            },
          ],
        },
      ]);
    });

    it('converts mixed user content', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is in this image?' },
            {
              type: 'file',
              mediaType: 'image/png',
              data: new URL('https://example.com/image.png'),
            },
          ],
        },
      ];

      const result = convertToOpenRouterMessages(prompt);

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'What is in this image?' },
            {
              type: 'input_image',
              imageUrl: 'https://example.com/image.png',
              detail: 'auto',
            },
          ],
        },
      ]);
    });
  });

  describe('assistant messages', () => {
    it('converts assistant text message', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'I can help you with that.' }],
        },
      ];

      const result = convertToOpenRouterMessages(prompt);

      // Responses API uses simple string content for assistant messages
      expect(result).toEqual([
        {
          role: 'assistant',
          content: 'I can help you with that.',
        },
      ]);
    });

    it('converts assistant tool-call message', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call_123',
              toolName: 'get_weather',
              input: { location: 'San Francisco' },
            },
          ],
        },
      ];

      const result = convertToOpenRouterMessages(prompt);

      expect(result).toEqual([
        {
          type: 'function_call',
          callId: 'call_123',
          name: 'get_weather',
          arguments: JSON.stringify({ location: 'San Francisco' }),
        },
      ]);
    });

    it('converts assistant with mixed text and tool-calls', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me check the weather.' },
            {
              type: 'tool-call',
              toolCallId: 'call_123',
              toolName: 'get_weather',
              input: { location: 'NYC' },
            },
          ],
        },
      ];

      const result = convertToOpenRouterMessages(prompt);

      // Tool calls are separate items in the output array
      expect(result).toEqual([
        {
          role: 'assistant',
          content: 'Let me check the weather.',
        },
        {
          type: 'function_call',
          callId: 'call_123',
          name: 'get_weather',
          arguments: JSON.stringify({ location: 'NYC' }),
        },
      ]);
    });

    it('converts assistant reasoning message', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'assistant',
          content: [
            { type: 'reasoning', text: 'Let me think about this...' },
            { type: 'text', text: 'The answer is 42.' },
          ],
        },
      ];

      const result = convertToOpenRouterMessages(prompt);

      // Reasoning and text are concatenated in Responses API format
      expect(result).toEqual([
        {
          role: 'assistant',
          content: 'Let me think about this...The answer is 42.',
        },
      ]);
    });

    it('extracts reasoning_details from providerOptions and includes reasoning', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'assistant',
          content: [
            { type: 'reasoning', text: 'Let me think...' },
            { type: 'text', text: 'The answer is 42.' },
          ],
          providerOptions: {
            openrouter: {
              reasoning_details: [
                {
                  type: 'reasoning.text',
                  text: 'Let me think...',
                  signature: 'abc123',
                  format: 'anthropic-claude-v1',
                  index: 0,
                },
              ],
            },
          },
        } as LanguageModelV3Prompt[0],
      ];

      const result = convertToOpenRouterMessages(prompt);

      expect(result).toEqual([
        {
          role: 'assistant',
          content: 'Let me think...The answer is 42.',
          reasoning: {
            text: 'Let me think...',
          },
        },
      ]);
    });

    it('extracts reasoning_details from providerMetadata', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Response' }],
          providerMetadata: {
            openrouter: {
              reasoning_details: [
                {
                  type: 'reasoning.encrypted',
                  data: 'encrypted-blob',
                  format: 'gemini-v1',
                  index: 0,
                },
              ],
            },
          },
        } as LanguageModelV3Prompt[0],
      ];

      const result = convertToOpenRouterMessages(prompt);

      expect(result).toEqual([
        {
          role: 'assistant',
          content: 'Response',
          reasoning: {
            encrypted: 'encrypted-blob',
          },
        },
      ]);
    });

    it('handles reasoning_details with summary items', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Response' }],
          providerOptions: {
            openrouter: {
              reasoning_details: [
                {
                  type: 'reasoning.summary',
                  summary: 'Summary of thinking',
                  index: 0,
                },
              ],
            },
          },
        } as LanguageModelV3Prompt[0],
      ];

      const result = convertToOpenRouterMessages(prompt);

      expect(result).toEqual([
        {
          role: 'assistant',
          content: 'Response',
          reasoning: {
            summary: 'Summary of thinking',
          },
        },
      ]);
    });

    it('handles SDK format reasoning_details with content array', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Response' }],
          providerOptions: {
            openrouter: {
              reasoning_details: [
                {
                  type: 'reasoning',
                  id: 'reasoning_123',
                  format: 'anthropic-claude-v1',
                  signature: 'sig123',
                  content: [
                    { type: 'reasoning_text', text: 'First thought. ' },
                    { type: 'reasoning_text', text: 'Second thought.' },
                  ],
                },
              ],
            },
          },
        } as LanguageModelV3Prompt[0],
      ];

      const result = convertToOpenRouterMessages(prompt);

      expect(result).toEqual([
        {
          role: 'assistant',
          content: 'Response',
          reasoning: {
            text: 'First thought. Second thought.',
          },
        },
      ]);
    });

    it('includes reasoning for tool-call only messages', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call_123',
              toolName: 'get_weather',
              input: { location: 'NYC' },
            },
          ],
          providerOptions: {
            openrouter: {
              reasoning_details: [
                {
                  type: 'reasoning.encrypted',
                  data: 'encrypted-data',
                  index: 0,
                },
              ],
            },
          },
        } as LanguageModelV3Prompt[0],
      ];

      const result = convertToOpenRouterMessages(prompt);

      expect(result).toEqual([
        {
          role: 'assistant',
          content: '',
          reasoning: {
            encrypted: 'encrypted-data',
          },
        },
        {
          type: 'function_call',
          callId: 'call_123',
          name: 'get_weather',
          arguments: JSON.stringify({ location: 'NYC' }),
        },
      ]);
    });
  });

  describe('tool messages', () => {
    it('converts tool result message', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call_123',
              toolName: 'get_weather',
              output: { type: 'json', value: { temperature: 72, unit: 'F' } },
            },
          ],
        },
      ];

      const result = convertToOpenRouterMessages(prompt);

      expect(result).toEqual([
        {
          type: 'function_call_output',
          callId: 'call_123',
          output: JSON.stringify({ temperature: 72, unit: 'F' }),
          status: 'completed',
        },
      ]);
    });

    it('converts tool result with text output', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call_456',
              toolName: 'search',
              output: { type: 'text', value: 'Search results: ...' },
            },
          ],
        },
      ];

      const result = convertToOpenRouterMessages(prompt);

      expect(result).toEqual([
        {
          type: 'function_call_output',
          callId: 'call_456',
          output: 'Search results: ...',
          status: 'completed',
        },
      ]);
    });

    it('converts tool result with error', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call_789',
              toolName: 'api_call',
              output: { type: 'error-text', value: 'Connection timeout' },
            },
          ],
        },
      ];

      const result = convertToOpenRouterMessages(prompt);

      expect(result).toEqual([
        {
          type: 'function_call_output',
          callId: 'call_789',
          output: 'Connection timeout',
          status: 'incomplete',
        },
      ]);
    });

    it('converts multiple tool results', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call_1',
              toolName: 'func1',
              output: { type: 'text', value: 'result1' },
            },
            {
              type: 'tool-result',
              toolCallId: 'call_2',
              toolName: 'func2',
              output: { type: 'text', value: 'result2' },
            },
          ],
        },
      ];

      const result = convertToOpenRouterMessages(prompt);

      expect(result).toEqual([
        {
          type: 'function_call_output',
          callId: 'call_1',
          output: 'result1',
          status: 'completed',
        },
        {
          type: 'function_call_output',
          callId: 'call_2',
          output: 'result2',
          status: 'completed',
        },
      ]);
    });
  });

  describe('complex conversations', () => {
    it('converts a multi-turn conversation', () => {
      const prompt: LanguageModelV3Prompt = [
        { role: 'system', content: 'You are a helpful assistant.' },
        {
          role: 'user',
          content: [{ type: 'text', text: 'What is the weather in NYC?' }],
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call_123',
              toolName: 'get_weather',
              input: { location: 'NYC' },
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call_123',
              toolName: 'get_weather',
              output: { type: 'json', value: { temperature: 72 } },
            },
          ],
        },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'The temperature in NYC is 72 degrees.' },
          ],
        },
      ];

      const result = convertToOpenRouterMessages(prompt);

      expect(result).toEqual([
        { role: 'system', content: 'You are a helpful assistant.' },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'What is the weather in NYC?' },
          ],
        },
        {
          type: 'function_call',
          callId: 'call_123',
          name: 'get_weather',
          arguments: JSON.stringify({ location: 'NYC' }),
        },
        {
          type: 'function_call_output',
          callId: 'call_123',
          output: JSON.stringify({ temperature: 72 }),
          status: 'completed',
        },
        {
          role: 'assistant',
          content: 'The temperature in NYC is 72 degrees.',
        },
      ]);
    });
  });

  describe('assistant prefill', () => {
    it('allows messages array ending with assistant message for prefill', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Hello' }],
        },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'I think' }], // prefill
        },
      ];

      const result = convertToOpenRouterMessages(prompt);

      expect(result).toEqual([
        {
          role: 'user',
          content: [{ type: 'input_text', text: 'Hello' }],
        },
        {
          role: 'assistant',
          content: 'I think', // preserved as trailing assistant message
        },
      ]);
    });

    it('preserves partial assistant content for prefill', () => {
      const prompt: LanguageModelV3Prompt = [
        { role: 'system', content: 'You are a helpful assistant.' },
        {
          role: 'user',
          content: [{ type: 'text', text: 'Write a poem about cats.' }],
        },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Here is a poem:\n\n' }], // partial prefill
        },
      ];

      const result = convertToOpenRouterMessages(prompt);

      expect(result).toEqual([
        { role: 'system', content: 'You are a helpful assistant.' },
        {
          role: 'user',
          content: [{ type: 'input_text', text: 'Write a poem about cats.' }],
        },
        {
          role: 'assistant',
          content: 'Here is a poem:\n\n', // partial content preserved
        },
      ]);
    });
  });

  describe('edge cases', () => {
    it('handles empty prompt', () => {
      const result = convertToOpenRouterMessages([]);
      expect(result).toEqual([]);
    });

    it('handles Uint8Array image data', () => {
      const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              mediaType: 'image/png',
              data: imageData,
            },
          ],
        },
      ];

      const result = convertToOpenRouterMessages(prompt);

      // Uint8Array should be converted to base64
      expect(result).toHaveLength(1);
      const userMessage = result[0] as {
        content: { type: string; imageUrl: string }[];
      };
      expect(userMessage.content[0]!.type).toBe('input_image');
      expect(userMessage.content[0]!.imageUrl).toMatch(
        /^data:image\/png;base64,/,
      );
    });

    it('handles tool-result with execution-denied output', () => {
      const prompt: LanguageModelV3Prompt = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call_denied',
              toolName: 'dangerous_action',
              output: {
                type: 'execution-denied',
                reason: 'User denied execution',
              },
            },
          ],
        },
      ];

      const result = convertToOpenRouterMessages(prompt);

      expect(result).toEqual([
        {
          type: 'function_call_output',
          callId: 'call_denied',
          output: 'Execution denied: User denied execution',
          status: 'incomplete',
        },
      ]);
    });
  });
});
