import { ReasoningFormat } from '../schemas/format';
import { convertToOpenRouterChatMessages } from './convert-to-openrouter-chat-messages';

describe('user messages', () => {
  it('should convert image Uint8Array', async () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          {
            type: 'file',
            data: new Uint8Array([0, 1, 2, 3]),
            mediaType: 'image/png',
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,AAECAw==' },
          },
        ],
      },
    ]);
  });

  it('should convert image urls', async () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          {
            type: 'file',
            data: 'https://example.com/image.png',
            mediaType: 'image/png',
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          {
            type: 'image_url',
            image_url: { url: 'https://example.com/image.png' },
          },
        ],
      },
    ]);
  });

  it('should convert messages with image base64', async () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          {
            type: 'file',
            data: 'data:image/png;base64,AAECAw==',
            mediaType: 'image/png',
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,AAECAw==' },
          },
        ],
      },
    ]);
  });

  it('should convert messages with only a text part to a string content', async () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }],
      },
    ]);

    expect(result).toEqual([{ role: 'user', content: 'Hello' }]);
  });
});

describe('cache control', () => {
  it('should pass cache control from system message provider metadata', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'system',
        content: 'System prompt',
        providerOptions: {
          anthropic: {
            cacheControl: { type: 'ephemeral' },
          },
        },
      },
    ]);

    expect(result).toEqual([
      {
        role: 'system',
        content: 'System prompt',
        cache_control: { type: 'ephemeral' },
      },
    ]);
  });

  it('should pass cache control from user message provider metadata (single text part)', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }],
        providerOptions: {
          anthropic: {
            cacheControl: { type: 'ephemeral' },
          },
        },
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Hello',
            cache_control: { type: 'ephemeral' },
          },
        ],
      },
    ]);
  });

  it('should pass cache control from content part provider metadata (single text part)', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Hello',
            providerOptions: {
              anthropic: {
                cacheControl: { type: 'ephemeral' },
              },
            },
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Hello',
            cache_control: { type: 'ephemeral' },
          },
        ],
      },
    ]);
  });

  it('should pass cache control from user message provider metadata (multiple parts)', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          {
            type: 'file',
            data: new Uint8Array([0, 1, 2, 3]),
            mediaType: 'image/png',
          },
        ],
        providerOptions: {
          anthropic: {
            cacheControl: { type: 'ephemeral' },
          },
        },
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Hello',
            cache_control: { type: 'ephemeral' },
          },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,AAECAw==' },
            cache_control: { type: 'ephemeral' },
          },
        ],
      },
    ]);
  });

  it('should pass cache control from user message provider metadata without cache control (single text part)', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: 'Hello',
      },
    ]);
  });

  it('should pass cache control to multiple image parts from user message provider metadata', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          {
            type: 'file',
            data: new Uint8Array([0, 1, 2, 3]),
            mediaType: 'image/png',
          },
          {
            type: 'file',
            data: new Uint8Array([4, 5, 6, 7]),
            mediaType: 'image/jpeg',
          },
        ],
        providerOptions: {
          anthropic: {
            cacheControl: { type: 'ephemeral' },
          },
        },
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Hello',
            cache_control: { type: 'ephemeral' },
          },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,AAECAw==' },
            cache_control: { type: 'ephemeral' },
          },
          {
            type: 'image_url',
            image_url: { url: 'data:image/jpeg;base64,BAUGBw==' },
            cache_control: { type: 'ephemeral' },
          },
        ],
      },
    ]);
  });

  it('should pass cache control to file parts from user message provider metadata', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          {
            type: 'file',
            data: 'ZmlsZSBjb250ZW50',
            mediaType: 'text/plain',
            providerOptions: {
              openrouter: {
                filename: 'file.txt',
              },
            },
          },
        ],
        providerOptions: {
          anthropic: {
            cacheControl: { type: 'ephemeral' },
          },
        },
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Hello',
            cache_control: { type: 'ephemeral' },
          },
          {
            type: 'file',
            file: {
              filename: 'file.txt',
              file_data: 'data:text/plain;base64,ZmlsZSBjb250ZW50',
            },
            cache_control: { type: 'ephemeral' },
          },
        ],
      },
    ]);
  });

  it('should handle mixed part-specific and message-level cache control for multiple parts', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Hello',
            // No part-specific provider metadata
          },
          {
            type: 'file',
            data: new Uint8Array([0, 1, 2, 3]),
            mediaType: 'image/png',
            providerOptions: {
              anthropic: {
                cacheControl: { type: 'ephemeral' },
              },
            },
          },
          {
            type: 'file',
            data: 'ZmlsZSBjb250ZW50',
            mediaType: 'text/plain',
            providerOptions: {
              openrouter: {
                filename: 'file.txt',
              },
            },
            // No part-specific provider metadata
          },
        ],
        providerOptions: {
          anthropic: {
            cacheControl: { type: 'ephemeral' },
          },
        },
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Hello',
            cache_control: { type: 'ephemeral' },
          },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,AAECAw==' },
            cache_control: { type: 'ephemeral' },
          },
          {
            type: 'file',
            file: {
              filename: 'file.txt',
              file_data: 'data:text/plain;base64,ZmlsZSBjb250ZW50',
            },
            cache_control: { type: 'ephemeral' },
          },
        ],
      },
    ]);
  });

  it('should pass cache control from individual content part provider metadata', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Hello',
            providerOptions: {
              anthropic: {
                cacheControl: { type: 'ephemeral' },
              },
            },
          },
          {
            type: 'file',
            data: new Uint8Array([0, 1, 2, 3]),
            mediaType: 'image/png',
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Hello',
            cache_control: { type: 'ephemeral' },
          },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,AAECAw==' },
          },
        ],
      },
    ]);
  });

  it('should pass cache control from assistant message provider metadata', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Assistant response' }],
        providerOptions: {
          anthropic: {
            cacheControl: { type: 'ephemeral' },
          },
        },
      },
    ]);

    expect(result).toEqual([
      {
        role: 'assistant',
        content: 'Assistant response',
        cache_control: { type: 'ephemeral' },
      },
    ]);
  });

  it('should pass cache control from tool message provider metadata', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-123',
            toolName: 'calculator',
            output: {
              type: 'json',
              value: { answer: 42 },
            },
          },
        ],
        providerOptions: {
          anthropic: {
            cacheControl: { type: 'ephemeral' },
          },
        },
      },
    ]);

    expect(result).toEqual([
      {
        role: 'tool',
        tool_call_id: 'call-123',
        content: JSON.stringify({ answer: 42 }),
        cache_control: { type: 'ephemeral' },
      },
    ]);
  });

  it('should support the alias cache_control field', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'system',
        content: 'System prompt',
        providerOptions: {
          anthropic: {
            cache_control: { type: 'ephemeral' },
          },
        },
      },
    ]);

    expect(result).toEqual([
      {
        role: 'system',
        content: 'System prompt',
        cache_control: { type: 'ephemeral' },
      },
    ]);
  });

  it('should support cache control on last message in content array', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'system',
        content: 'System prompt',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'User prompt' },
          {
            type: 'text',
            text: 'User prompt 2',
            providerOptions: {
              anthropic: { cacheControl: { type: 'ephemeral' } },
            },
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'system',
        content: 'System prompt',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'User prompt' },
          {
            type: 'text',
            text: 'User prompt 2',
            cache_control: { type: 'ephemeral' },
          },
        ],
      },
    ]);
  });
});

describe('reasoning_details handling', () => {
  it('should use message-level reasoning_details from providerOptions when present', () => {
    const messageReasoningDetails = [
      {
        type: 'reasoning.text',
        text: 'message level reasoning',
        format: ReasoningFormat.AnthropicClaudeV1,
      },
    ];

    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Response' },
          {
            type: 'tool-call',
            toolCallId: 'call-123',
            toolName: 'test',
            input: {},
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: 'reasoning.text',
                    text: 'tool call reasoning',
                    format: ReasoningFormat.GoogleGeminiV1,
                  },
                ],
              },
            },
          },
        ],
        providerOptions: {
          openrouter: {
            reasoning_details: messageReasoningDetails,
          },
        },
      },
    ]);

    expect(result[0]?.reasoning_details).toEqual(messageReasoningDetails);
  });

  it('should include accumulated reasoning_details for Gemini format when no message-level details', () => {
    const geminiReasoningDetails = [
      {
        type: 'reasoning.text',
        text: 'gemini reasoning',
        format: ReasoningFormat.GoogleGeminiV1,
      },
    ];

    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Response' },
          {
            type: 'tool-call',
            toolCallId: 'call-123',
            toolName: 'test',
            input: {},
            providerOptions: {
              openrouter: {
                reasoning_details: geminiReasoningDetails,
              },
            },
          },
        ],
      },
    ]);

    expect(result[0]?.reasoning_details).toEqual(geminiReasoningDetails);
  });

  it('should NOT include accumulated reasoning_details for Anthropic format when no message-level details', () => {
    const anthropicReasoningDetails = [
      {
        type: 'reasoning.text',
        text: 'anthropic reasoning',
        format: ReasoningFormat.AnthropicClaudeV1,
      },
    ];

    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Response' },
          {
            type: 'tool-call',
            toolCallId: 'call-123',
            toolName: 'test',
            input: {},
            providerOptions: {
              openrouter: {
                reasoning_details: anthropicReasoningDetails,
              },
            },
          },
        ],
      },
    ]);

    expect(result[0]?.reasoning_details).toBeUndefined();
  });

  it('should NOT include accumulated reasoning_details when format is unknown', () => {
    const unknownFormatDetails = [
      {
        type: 'reasoning.text',
        text: 'unknown format reasoning',
        format: ReasoningFormat.Unknown,
      },
    ];

    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Response' },
          {
            type: 'tool-call',
            toolCallId: 'call-123',
            toolName: 'test',
            input: {},
            providerOptions: {
              openrouter: {
                reasoning_details: unknownFormatDetails,
              },
            },
          },
        ],
      },
    ]);

    expect(result[0]?.reasoning_details).toBeUndefined();
  });

  it('should NOT include accumulated reasoning_details when format is missing', () => {
    const noFormatDetails = [
      {
        type: 'reasoning.text',
        text: 'no format reasoning',
      },
    ];

    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Response' },
          {
            type: 'tool-call',
            toolCallId: 'call-123',
            toolName: 'test',
            input: {},
            providerOptions: {
              openrouter: {
                reasoning_details: noFormatDetails,
              },
            },
          },
        ],
      },
    ]);

    expect(result[0]?.reasoning_details).toBeUndefined();
  });

  it('should scope accumulated reasoning_details to each assistant message independently', () => {
    const geminiDetails1 = [
      {
        type: 'reasoning.text',
        text: 'first message reasoning',
        format: ReasoningFormat.GoogleGeminiV1,
      },
    ];
    const geminiDetails2 = [
      {
        type: 'reasoning.text',
        text: 'second message reasoning',
        format: ReasoningFormat.GoogleGeminiV1,
      },
    ];

    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'First response' },
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'test',
            input: {},
            providerOptions: {
              openrouter: {
                reasoning_details: geminiDetails1,
              },
            },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'test',
            output: { type: 'text', value: 'result' },
          },
        ],
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Second response' },
          {
            type: 'tool-call',
            toolCallId: 'call-2',
            toolName: 'test',
            input: {},
            providerOptions: {
              openrouter: {
                reasoning_details: geminiDetails2,
              },
            },
          },
        ],
      },
    ]);

    expect(result[0]?.reasoning_details).toEqual(geminiDetails1);
    expect(result[2]?.reasoning_details).toEqual(geminiDetails2);
  });
});
