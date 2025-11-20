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

  it('should convert audio Uint8Array to input_audio with mp3 format', async () => {
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
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Listen to this' },
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

  it('should convert audio Uint8Array to input_audio with wav format', async () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Listen to this' },
          {
            type: 'file',
            data: new Uint8Array([0, 1, 2, 3]),
            mediaType: 'audio/wav',
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Listen to this' },
          {
            type: 'input_audio',
            input_audio: {
              data: 'AAECAw==',
              format: 'wav',
            },
          },
        ],
      },
    ]);
  });

  it('should normalize audio/x-wav to wav format', async () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: new Uint8Array([0, 1, 2, 3]),
            mediaType: 'audio/x-wav',
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
              format: 'wav',
            },
          },
        ],
      },
    ]);
  });

  it('should support audio/mp3 MIME type (normalize to mp3)', async () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: new Uint8Array([0, 1, 2, 3]),
            mediaType: 'audio/mp3',
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
              mediaType: 'audio/ogg',
            },
          ],
        },
      ]),
    ).toThrow(/Unsupported audio format: "audio\/ogg"/);
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
            cache_control: { type: 'ephemeral' },
          },
        ],
      },
    ]);
  });
});
