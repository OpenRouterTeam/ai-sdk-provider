import { ReasoningDetailType } from '../schemas/reasoning-details';
import { convertToOpenRouterChatMessages } from './convert-to-openrouter-chat-messages';
import { MIME_TO_FORMAT } from './file-url-utils';

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

  it.each(
    Object.entries(MIME_TO_FORMAT).map(([mimeSubtype, format]) => [
      `audio/${mimeSubtype}`,
      format,
    ]),
  )('should convert %s to input_audio with %s format', (mediaType, expectedFormat) => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: new Uint8Array([0, 1, 2, 3]),
            mediaType,
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'input_audio',
            input_audio: {
              data: 'AAECAw==',
              format: expectedFormat,
            },
          },
        ],
      },
    ]);
  });

  it('should convert audio base64 data URL to input_audio', async () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: 'data:audio/mpeg;base64,AAECAw==',
            mediaType: 'audio/mpeg',
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'input_audio',
            input_audio: {
              data: 'AAECAw==',
              format: 'mp3',
            },
          },
        ],
      },
    ]);
  });

  it('should convert raw audio base64 string to input_audio', async () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: 'AAECAw==',
            mediaType: 'audio/mpeg',
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'input_audio',
            input_audio: {
              data: 'AAECAw==',
              format: 'mp3',
            },
          },
        ],
      },
    ]);
  });

  it('should throw error for audio URLs', async () => {
    expect(() =>
      convertToOpenRouterChatMessages([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: 'https://example.com/audio.mp3',
              mediaType: 'audio/mpeg',
            },
          ],
        },
      ]),
    ).toThrow(/Audio files cannot be provided as URLs/);
  });

  it('should throw error for unsupported audio formats', async () => {
    expect(() =>
      convertToOpenRouterChatMessages([
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: new Uint8Array([0, 1, 2, 3]),
              mediaType: 'audio/webm',
            },
          ],
        },
      ]),
    ).toThrow(/Unsupported audio format: "audio\/webm"/);
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
          },
          {
            type: 'image_url',
            image_url: { url: 'data:image/jpeg;base64,BAUGBw==' },
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
          },
        ],
      },
    ]);
  });

  it('should only apply message-level cache control to last text part (multiple text parts)', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'First text part' },
          { type: 'text', text: 'Second text part' },
          { type: 'text', text: 'Third text part' },
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
            text: 'First text part',
          },
          {
            type: 'text',
            text: 'Second text part',
          },
          {
            type: 'text',
            text: 'Third text part',
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

  it('should pass cache control to audio input parts from user message provider metadata', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Listen to this' },
          {
            type: 'file',
            data: new Uint8Array([0, 1, 2, 3]),
            mediaType: 'audio/mpeg',
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
            text: 'Listen to this',
            cache_control: { type: 'ephemeral' },
          },
          {
            type: 'input_audio',
            input_audio: {
              data: 'AAECAw==',
              format: 'mp3',
            },
          },
        ],
      },
    ]);
  });
});

describe('reasoning_details accumulation', () => {
  it('should accumulate reasoning_details from reasoning part providerOptions', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'First reasoning chunk',
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Text,
                    text: 'First reasoning chunk',
                  },
                ],
              },
            },
          },
          {
            type: 'reasoning',
            text: 'Second reasoning chunk',
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Text,
                    text: 'Second reasoning chunk',
                  },
                ],
              },
            },
          },
          {
            type: 'text',
            text: 'Final response',
          },
        ],
        providerOptions: {
          openrouter: {
            reasoning_details: [
              {
                type: ReasoningDetailType.Text,
                text: 'First reasoning chunk',
              },
              {
                type: ReasoningDetailType.Text,
                text: 'Second reasoning chunk',
              },
            ],
          },
        },
      },
    ]);

    expect(result).toEqual([
      {
        role: 'assistant',
        content: 'Final response',
        reasoning: 'First reasoning chunkSecond reasoning chunk',
        reasoning_details: [
          {
            type: ReasoningDetailType.Text,
            text: 'First reasoning chunk',
          },
          {
            type: ReasoningDetailType.Text,
            text: 'Second reasoning chunk',
          },
        ],
      },
    ]);
  });

  it('should use preserved reasoning_details from message-level providerOptions when available', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Reasoning text',
            // No providerOptions on part
          },
          {
            type: 'text',
            text: 'Response',
          },
        ],
        providerOptions: {
          openrouter: {
            reasoning_details: [
              {
                type: ReasoningDetailType.Text,
                text: 'Preserved reasoning detail',
              },
              {
                type: ReasoningDetailType.Summary,
                summary: 'Preserved summary',
              },
            ],
          },
        },
      },
    ]);

    expect(result).toEqual([
      {
        role: 'assistant',
        content: 'Response',
        reasoning: 'Reasoning text',
        reasoning_details: [
          {
            type: ReasoningDetailType.Text,
            text: 'Preserved reasoning detail',
          },
          {
            type: ReasoningDetailType.Summary,
            summary: 'Preserved summary',
          },
        ],
      },
    ]);
  });

  it('should not include reasoning_details when not present in providerOptions', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Reasoning text',
            // No providerOptions
          },
          {
            type: 'text',
            text: 'Response',
          },
        ],
        // No providerOptions
      },
    ]);

    expect(result).toEqual([
      {
        role: 'assistant',
        content: 'Response',
        reasoning: 'Reasoning text',
        // reasoning_details should be undefined when not preserved
        reasoning_details: undefined,
      },
    ]);
  });

  it('should handle mixed reasoning parts with and without providerOptions', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'First chunk',
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Text,
                    text: 'First chunk',
                  },
                ],
              },
            },
          },
          {
            type: 'reasoning',
            text: 'Second chunk',
            // No providerOptions
          },
          {
            type: 'text',
            text: 'Response',
          },
        ],
        providerOptions: {
          openrouter: {
            reasoning_details: [
              {
                type: ReasoningDetailType.Text,
                text: 'First chunk',
              },
            ],
          },
        },
      },
    ]);

    expect(result).toEqual([
      {
        role: 'assistant',
        content: 'Response',
        reasoning: 'First chunkSecond chunk',
        reasoning_details: [
          {
            type: ReasoningDetailType.Text,
            text: 'First chunk',
          },
        ],
      },
    ]);
  });
});

describe('parallel tool calls reasoning_details deduplication', () => {
  it('should only use reasoning_details from first tool call (parallel tool calls)', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'get_weather',
            input: { location: 'San Francisco' },
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Text,
                    text: 'Full reasoning text',
                  },
                  {
                    type: ReasoningDetailType.Encrypted,
                    data: 'encrypted-signature',
                  },
                ],
              },
            },
          },
          {
            type: 'tool-call',
            toolCallId: 'call-2',
            toolName: 'get_time',
            input: {},
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Text,
                    text: 'Full reasoning text',
                  },
                  {
                    type: ReasoningDetailType.Encrypted,
                    data: 'encrypted-signature',
                  },
                ],
              },
            },
          },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.role).toBe('assistant');
    expect(result[0]).toMatchObject({
      tool_calls: expect.arrayContaining([
        expect.objectContaining({ id: 'call-1' }),
        expect.objectContaining({ id: 'call-2' }),
      ]),
      reasoning_details: [
        {
          type: ReasoningDetailType.Text,
          text: 'Full reasoning text',
        },
        {
          type: ReasoningDetailType.Encrypted,
          data: 'encrypted-signature',
        },
      ],
    });
  });

  it('should collect reasoning_details from single tool call', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'get_weather',
            input: { location: 'San Francisco' },
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Text,
                    text: 'Reasoning for weather call',
                  },
                ],
              },
            },
          },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      reasoning_details: [
        {
          type: ReasoningDetailType.Text,
          text: 'Reasoning for weather call',
        },
      ],
    });
  });

  it('should prefer message-level reasoning_details over tool call reasoning_details', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'get_weather',
            input: { location: 'San Francisco' },
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Text,
                    text: 'Tool call reasoning',
                  },
                ],
              },
            },
          },
        ],
        providerOptions: {
          openrouter: {
            reasoning_details: [
              {
                type: ReasoningDetailType.Text,
                text: 'Message-level reasoning',
              },
              {
                type: ReasoningDetailType.Encrypted,
                data: 'message-level-signature',
              },
            ],
          },
        },
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      reasoning_details: [
        {
          type: ReasoningDetailType.Text,
          text: 'Message-level reasoning',
        },
        {
          type: ReasoningDetailType.Encrypted,
          data: 'message-level-signature',
        },
      ],
    });
  });

  it('should prefer tool call reasoning_details over reasoning part (tool calls have complete data)', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Thinking about the request',
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Text,
                    text: 'Delta reasoning only',
                  },
                ],
              },
            },
          },
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'get_weather',
            input: { location: 'San Francisco' },
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Text,
                    text: 'Full accumulated reasoning',
                  },
                  {
                    type: ReasoningDetailType.Encrypted,
                    data: 'encrypted-signature',
                  },
                ],
              },
            },
          },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      reasoning: 'Thinking about the request',
      reasoning_details: [
        {
          type: ReasoningDetailType.Text,
          text: 'Full accumulated reasoning',
        },
        {
          type: ReasoningDetailType.Encrypted,
          data: 'encrypted-signature',
        },
      ],
    });
  });

  it('should handle tool calls without reasoning_details', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'get_weather',
            input: { location: 'San Francisco' },
          },
          {
            type: 'tool-call',
            toolCallId: 'call-2',
            toolName: 'get_time',
            input: {},
          },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      tool_calls: expect.arrayContaining([
        expect.objectContaining({ id: 'call-1' }),
        expect.objectContaining({ id: 'call-2' }),
      ]),
      reasoning_details: undefined,
    });
  });

  it('should fall back to reasoning part if no tool calls have reasoning_details', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Thinking process',
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Text,
                    text: 'Reasoning from part',
                  },
                ],
              },
            },
          },
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'get_weather',
            input: { location: 'San Francisco' },
          },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      reasoning: 'Thinking process',
      reasoning_details: [
        {
          type: ReasoningDetailType.Text,
          text: 'Reasoning from part',
        },
      ],
    });
  });
});
