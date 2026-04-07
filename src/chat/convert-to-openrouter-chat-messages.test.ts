import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('should convert video URL to video_url content part', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this video' },
          {
            type: 'file',
            data: 'https://example.com/video.mp4',
            mediaType: 'video/mp4',
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this video' },
          {
            type: 'video_url',
            video_url: { url: 'https://example.com/video.mp4' },
          },
        ],
      },
    ]);
  });

  it('should convert base64 video to video_url content part', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is in this video?' },
          {
            type: 'file',
            data: 'data:video/mp4;base64,AAECAw==',
            mediaType: 'video/mp4',
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is in this video?' },
          {
            type: 'video_url',
            video_url: { url: 'data:video/mp4;base64,AAECAw==' },
          },
        ],
      },
    ]);
  });

  it('should convert video Uint8Array to video_url with data URL', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: new Uint8Array([0, 1, 2, 3]),
            mediaType: 'video/webm',
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'video_url',
            video_url: { url: 'data:video/webm;base64,AAECAw==' },
          },
        ],
      },
    ]);
  });

  it.each([
    'video/mp4',
    'video/mpeg',
    'video/mov',
    'video/webm',
  ])('should handle %s media type as video_url', (mediaType) => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: 'https://example.com/sample',
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
            type: 'video_url',
            video_url: { url: 'https://example.com/sample' },
          },
        ],
      },
    ]);
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
  it('should convert system message to array content with block-level cache control', () => {
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
        content: [
          {
            type: 'text',
            text: 'System prompt',
            cache_control: { type: 'ephemeral' },
          },
        ],
      },
    ]);
  });

  it('should convert system message to array content even without cache control', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'system',
        content: 'System prompt',
      },
    ]);

    expect(result).toEqual([
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: 'System prompt',
          },
        ],
      },
    ]);
  });

  it('should convert system message to array content with openrouter namespace cache control', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'system',
        content: 'System prompt',
        providerOptions: {
          openrouter: {
            cacheControl: { type: 'ephemeral' },
          },
        },
      },
    ]);

    expect(result).toEqual([
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: 'System prompt',
            cache_control: { type: 'ephemeral' },
          },
        ],
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
        name: 'calculator',
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
        content: [
          {
            type: 'text',
            text: 'System prompt',
            cache_control: { type: 'ephemeral' },
          },
        ],
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
        content: [
          {
            type: 'text',
            text: 'System prompt',
          },
        ],
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
                    signature: 'sig-chunk-1',
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
                    signature: 'sig-chunk-2',
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
                signature: 'sig-chunk-1',
              },
              {
                type: ReasoningDetailType.Text,
                text: 'Second reasoning chunk',
                signature: 'sig-chunk-2',
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
            signature: 'sig-chunk-1',
          },
          {
            type: ReasoningDetailType.Text,
            text: 'Second reasoning chunk',
            signature: 'sig-chunk-2',
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
                signature: 'valid-sig-1',
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
            signature: 'valid-sig-1',
          },
          {
            type: ReasoningDetailType.Summary,
            summary: 'Preserved summary',
          },
        ],
      },
    ]);
  });

  it('should not include reasoning or reasoning_details when not present in providerOptions', () => {
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
        // Both reasoning and reasoning_details should be undefined when
        // providerMetadata is not preserved. Sending reasoning without
        // reasoning_details causes "Invalid signature in thinking block"
        // errors on Anthropic models (issue #423).
        reasoning: undefined,
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
                    signature: 'valid-sig-chunk',
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
                signature: 'valid-sig-chunk',
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
            signature: 'valid-sig-chunk',
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
                    signature: 'valid-sig-tool',
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
                    signature: 'valid-sig-tool',
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
          signature: 'valid-sig-tool',
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
                    signature: 'valid-sig-single',
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
          signature: 'valid-sig-single',
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
                    signature: 'tool-sig',
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
                signature: 'msg-sig',
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
          signature: 'msg-sig',
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
                    signature: 'delta-sig',
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
                    signature: 'full-sig',
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
          signature: 'full-sig',
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
                    signature: 'valid-sig-fallback',
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
          signature: 'valid-sig-fallback',
        },
      ],
    });
  });
});

describe('multi-turn reasoning_details deduplication (issue #254)', () => {
  it('should deduplicate reasoning_details with same ID across multiple assistant messages', () => {
    // This test reproduces the exact scenario from issue #254 where
    // gpt-5-codex generates the same reasoning ID across multiple turns
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
                    type: ReasoningDetailType.Encrypted,
                    data: 'encrypted-data-1',
                    id: 'rs_0ad20f1f8629dc53016924443203408193abb5b3d0b4301e26',
                  },
                ],
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
            toolName: 'get_weather',
            output: { type: 'text', value: 'Sunny, 72F' },
          },
        ],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-2',
            toolName: 'get_time',
            input: {},
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Encrypted,
                    data: 'encrypted-data-2',
                    id: 'rs_0ad20f1f8629dc53016924443203408193abb5b3d0b4301e26', // Same ID!
                  },
                ],
              },
            },
          },
        ],
      },
    ]);

    // First assistant message should have reasoning_details
    expect(result[0]).toMatchObject({
      role: 'assistant',
      reasoning_details: [
        {
          type: ReasoningDetailType.Encrypted,
          data: 'encrypted-data-1',
          id: 'rs_0ad20f1f8629dc53016924443203408193abb5b3d0b4301e26',
        },
      ],
    });

    // Second assistant message should NOT have reasoning_details (duplicate ID)
    expect(result[2]).toMatchObject({
      role: 'assistant',
      reasoning_details: undefined,
    });
  });

  it('should preserve unique reasoning_details across multiple assistant messages', () => {
    // Gemini uses different IDs/data for each turn's thoughtSignature
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
                    type: ReasoningDetailType.Encrypted,
                    data: 'gemini-thought-signature-1',
                    format: 'google-gemini-v1',
                  },
                ],
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
            toolName: 'get_weather',
            output: { type: 'text', value: 'Sunny, 72F' },
          },
        ],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-2',
            toolName: 'get_time',
            input: {},
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Encrypted,
                    data: 'gemini-thought-signature-2', // Different data = unique
                    format: 'google-gemini-v1',
                  },
                ],
              },
            },
          },
        ],
      },
    ]);

    // First assistant message should have its reasoning_details
    expect(result[0]).toMatchObject({
      role: 'assistant',
      reasoning_details: [
        {
          type: ReasoningDetailType.Encrypted,
          data: 'gemini-thought-signature-1',
          format: 'google-gemini-v1',
        },
      ],
    });

    // Second assistant message should also have its reasoning_details (unique)
    expect(result[2]).toMatchObject({
      role: 'assistant',
      reasoning_details: [
        {
          type: ReasoningDetailType.Encrypted,
          data: 'gemini-thought-signature-2',
          format: 'google-gemini-v1',
        },
      ],
    });
  });

  it('should deduplicate reasoning_details from message-level providerOptions', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'First response' }],
        providerOptions: {
          openrouter: {
            reasoning_details: [
              {
                type: ReasoningDetailType.Summary,
                summary: 'This is the reasoning summary',
              },
            ],
          },
        },
      },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Follow up question' }],
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Second response' }],
        providerOptions: {
          openrouter: {
            reasoning_details: [
              {
                type: ReasoningDetailType.Summary,
                summary: 'This is the reasoning summary', // Same summary = duplicate
              },
            ],
          },
        },
      },
    ]);

    // First assistant message should have reasoning_details
    expect(result[0]).toMatchObject({
      role: 'assistant',
      content: 'First response',
      reasoning_details: [
        {
          type: ReasoningDetailType.Summary,
          summary: 'This is the reasoning summary',
        },
      ],
    });

    // Second assistant message should NOT have reasoning_details (duplicate)
    expect(result[2]).toMatchObject({
      role: 'assistant',
      content: 'Second response',
      reasoning_details: undefined,
    });
  });

  it('should handle mixed reasoning_details types with some duplicates', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'First response' }],
        providerOptions: {
          openrouter: {
            reasoning_details: [
              {
                type: ReasoningDetailType.Text,
                text: 'Thinking step 1',
                signature: 'sig-1',
              },
              {
                type: ReasoningDetailType.Summary,
                summary: 'Summary of thinking',
              },
            ],
          },
        },
      },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Follow up' }],
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Second response' }],
        providerOptions: {
          openrouter: {
            reasoning_details: [
              {
                type: ReasoningDetailType.Text,
                text: 'Thinking step 1', // Duplicate
                signature: 'sig-1',
              },
              {
                type: ReasoningDetailType.Text,
                text: 'Thinking step 2', // New
                signature: 'sig-2',
              },
            ],
          },
        },
      },
    ]);

    // First assistant message should have both reasoning_details
    expect(result[0]).toMatchObject({
      role: 'assistant',
      reasoning_details: expect.arrayContaining([
        expect.objectContaining({ text: 'Thinking step 1' }),
        expect.objectContaining({ summary: 'Summary of thinking' }),
      ]),
    });

    // Second assistant message should only have the new reasoning_detail
    expect(result[2]).toMatchObject({
      role: 'assistant',
      reasoning_details: [
        {
          type: ReasoningDetailType.Text,
          text: 'Thinking step 2',
          signature: 'sig-2',
        },
      ],
    });
  });
});

describe('issue #423: strip reasoning without valid signatures', () => {
  it('should strip reasoning text when providerOptions exist but reasoning_details are empty', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Let me think about this...',
            providerOptions: {
              openrouter: {
                // reasoning_details is empty — data was lost
                reasoning_details: [],
              },
            },
          },
          { type: 'text', text: 'The answer is 4.' },
        ],
      },
    ]);

    // reasoning text should be stripped because no reasoning_details exist
    expect(result[0]).toMatchObject({
      role: 'assistant',
      content: 'The answer is 4.',
      reasoning: undefined,
      reasoning_details: undefined,
    });
  });

  it('should preserve reasoning_details text entries that have valid signatures', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Let me think about this...',
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Text,
                    text: 'Let me think about this...',
                    signature: 'eyJhbGciOiJSUzI1NiJ9...',
                  },
                ],
              },
            },
          },
          { type: 'text', text: 'The answer is 4.' },
        ],
      },
    ]);

    expect(result[0]).toMatchObject({
      role: 'assistant',
      content: 'The answer is 4.',
      reasoning: 'Let me think about this...',
      reasoning_details: [
        {
          type: ReasoningDetailType.Text,
          text: 'Let me think about this...',
          signature: 'eyJhbGciOiJSUzI1NiJ9...',
        },
      ],
    });
  });

  it('should strip reasoning text when providerOptions are completely absent', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Some thinking...',
            // No providerOptions at all — providerMetadata was lost
          },
          { type: 'text', text: 'Result.' },
        ],
      },
    ]);

    // reasoning text should be stripped because no reasoning_details exist
    expect(result[0]).toMatchObject({
      role: 'assistant',
      content: 'Result.',
      reasoning: undefined,
      reasoning_details: undefined,
    });
  });

  it('should strip reasoning.text entries that have no signature (issue #439)', () => {
    // This reproduces the exact bug from #439: reasoning_details exist but
    // reasoning.text entries lost their signature during custom pruning or
    // DB serialization. Sending these causes Anthropic to reject with
    // "Invalid signature in thinking block".
    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Let me think about this...',
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Text,
                    text: 'Let me think about this...',
                    // signature is missing — lost during pruning/serialization
                  },
                ],
              },
            },
          },
          { type: 'text', text: 'The answer is 4.' },
        ],
      },
    ]);

    // reasoning.text without signature should be stripped, and since no
    // valid reasoning_details remain, reasoning text should also be stripped
    expect(result[0]).toMatchObject({
      role: 'assistant',
      content: 'The answer is 4.',
      reasoning: undefined,
      reasoning_details: undefined,
    });
  });

  it('should strip reasoning.text with null signature (issue #439)', () => {
    // signature explicitly set to null — can happen after JSON round-trip
    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Thinking...',
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Text,
                    text: 'Thinking...',
                    signature: null,
                  },
                ],
              },
            },
          },
          { type: 'text', text: 'Done.' },
        ],
      },
    ]);

    expect(result[0]).toMatchObject({
      role: 'assistant',
      content: 'Done.',
      reasoning: undefined,
      reasoning_details: undefined,
    });
  });

  it('should keep valid entries and strip signatureless ones in mixed reasoning_details (issue #439)', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Some thinking...',
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Text,
                    text: 'No signature here',
                    // missing signature
                  },
                  {
                    type: ReasoningDetailType.Encrypted,
                    data: 'encrypted-data',
                  },
                  {
                    type: ReasoningDetailType.Text,
                    text: 'Has valid signature',
                    signature: 'valid-sig',
                  },
                ],
              },
            },
          },
          { type: 'text', text: 'Result.' },
        ],
      },
    ]);

    // Only the signatureless reasoning.text should be stripped;
    // encrypted and signed text entries are preserved
    expect(result[0]).toMatchObject({
      role: 'assistant',
      content: 'Result.',
      reasoning: 'Some thinking...',
      reasoning_details: [
        {
          type: ReasoningDetailType.Encrypted,
          data: 'encrypted-data',
        },
        {
          type: ReasoningDetailType.Text,
          text: 'Has valid signature',
          signature: 'valid-sig',
        },
      ],
    });
  });

  it('should preserve non-text reasoning_details even without signatures', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: '[REDACTED]',
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Encrypted,
                    data: 'encrypted-data-here',
                  },
                ],
              },
            },
          },
          { type: 'text', text: 'Result.' },
        ],
      },
    ]);

    // Encrypted entries don't need signatures — should be preserved
    expect(result[0]).toMatchObject({
      role: 'assistant',
      reasoning: '[REDACTED]',
      reasoning_details: [
        {
          type: ReasoningDetailType.Encrypted,
          data: 'encrypted-data-here',
        },
      ],
    });
  });
});

describe('signature stripping warning respects AI_SDK_LOG_WARNINGS', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    delete (globalThis as Record<string, unknown>).AI_SDK_LOG_WARNINGS;
  });

  it('should suppress console.warn when AI_SDK_LOG_WARNINGS is false', () => {
    (globalThis as Record<string, unknown>).AI_SDK_LOG_WARNINGS = false;

    convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Some thinking...',
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Text,
                    text: 'Some thinking...',
                    // missing signature — triggers warning
                  },
                ],
              },
            },
          },
          { type: 'text', text: 'Result.' },
        ],
      },
    ]);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('should emit console.warn when AI_SDK_LOG_WARNINGS is not set', () => {
    convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Some thinking...',
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Text,
                    text: 'Some thinking...',
                    // missing signature — triggers warning
                  },
                ],
              },
            },
          },
          { type: 'text', text: 'Result.' },
        ],
      },
    ]);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('reasoning_details entries were removed'),
    );
  });

  it('should suppress console.warn when AI_SDK_LOG_WARNINGS is a function', () => {
    const customLogger = vi.fn();
    (globalThis as Record<string, unknown>).AI_SDK_LOG_WARNINGS = customLogger;

    convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Some thinking...',
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Text,
                    text: 'Some thinking...',
                    // missing signature — triggers warning
                  },
                ],
              },
            },
          },
          { type: 'text', text: 'Result.' },
        ],
      },
    ]);

    // When a custom function logger is set, console.warn is suppressed.
    // We don't call the function because it expects the AI SDK's
    // structured { warnings, provider, model } format, not a string.
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('should emit console.warn when AI_SDK_LOG_WARNINGS is true', () => {
    (globalThis as Record<string, unknown>).AI_SDK_LOG_WARNINGS = true;

    convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Some thinking...',
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Text,
                    text: 'Some thinking...',
                  },
                ],
              },
            },
          },
          { type: 'text', text: 'Result.' },
        ],
      },
    ]);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('reasoning_details entries were removed'),
    );
  });
});

describe('multimodal tool result content (issue #181)', () => {
  it('should convert tool result with text + image-data to structured content array', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-123',
            toolName: 'screenshot_tool',
            output: {
              type: 'content',
              value: [
                {
                  type: 'text',
                  text: 'Here is the screenshot:',
                },
                {
                  type: 'image-data',
                  data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                  mediaType: 'image/png',
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      role: 'tool',
      tool_call_id: 'call-123',
    });

    expect(Array.isArray(result[0]?.content)).toBe(true);

    expect(result[0]?.content).toEqual([
      { type: 'text', text: 'Here is the screenshot:' },
      {
        type: 'image_url',
        image_url: {
          url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        },
      },
    ]);
  });

  it('should convert tool result with text + image-url to structured content array', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-456',
            toolName: 'image_generator',
            output: {
              type: 'content',
              value: [
                {
                  type: 'text',
                  text: 'Generated image:',
                },
                {
                  type: 'image-url',
                  url: 'https://example.com/generated-image.png',
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(Array.isArray(result[0]?.content)).toBe(true);

    expect(result[0]?.content).toEqual([
      { type: 'text', text: 'Generated image:' },
      {
        type: 'image_url',
        image_url: { url: 'https://example.com/generated-image.png' },
      },
    ]);
  });

  it('should convert tool result with file-data (image mediaType) to image_url', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-789',
            toolName: 'screenshot_tool',
            output: {
              type: 'content',
              value: [
                {
                  type: 'file-data',
                  data: 'AAECAw==',
                  mediaType: 'image/jpeg',
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(Array.isArray(result[0]?.content)).toBe(true);

    expect(result[0]?.content).toEqual([
      {
        type: 'image_url',
        image_url: { url: 'data:image/jpeg;base64,AAECAw==' },
      },
    ]);
  });

  it('should convert tool result with file-data (non-image mediaType) to file part', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-abc',
            toolName: 'pdf_reader',
            output: {
              type: 'content',
              value: [
                {
                  type: 'text',
                  text: 'Document contents:',
                },
                {
                  type: 'file-data',
                  data: 'ZmlsZSBjb250ZW50',
                  mediaType: 'application/pdf',
                  filename: 'report.pdf',
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(Array.isArray(result[0]?.content)).toBe(true);

    expect(result[0]?.content).toEqual([
      { type: 'text', text: 'Document contents:' },
      {
        type: 'file',
        file: {
          filename: 'report.pdf',
          file_data: 'data:application/pdf;base64,ZmlsZSBjb250ZW50',
        },
      },
    ]);
  });

  it('should convert tool result with file-url (image extension) to image_url part', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-def',
            toolName: 'web_fetch',
            output: {
              type: 'content',
              value: [
                {
                  type: 'file-url',
                  url: 'https://example.com/photo.jpg',
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(Array.isArray(result[0]?.content)).toBe(true);

    expect(result[0]?.content).toEqual([
      {
        type: 'image_url',
        image_url: { url: 'https://example.com/photo.jpg' },
      },
    ]);
  });

  it('should convert tool result with file-url (non-image extension) to file part', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-def2',
            toolName: 'web_fetch',
            output: {
              type: 'content',
              value: [
                {
                  type: 'file-url',
                  url: 'https://example.com/report.pdf',
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(Array.isArray(result[0]?.content)).toBe(true);

    expect(result[0]?.content).toEqual([
      {
        type: 'file',
        file: {
          filename: 'report.pdf',
          file_data: 'https://example.com/report.pdf',
        },
      },
    ]);
  });

  it('should convert tool result with file-url (no extension) to file part', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-def3',
            toolName: 'web_fetch',
            output: {
              type: 'content',
              value: [
                {
                  type: 'file-url',
                  url: 'https://api.example.com/files/123',
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(Array.isArray(result[0]?.content)).toBe(true);

    expect(result[0]?.content).toEqual([
      {
        type: 'file',
        file: {
          filename: '',
          file_data: 'https://api.example.com/files/123',
        },
      },
    ]);
  });

  it('should fallback to stringified text part for unknown content part types', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-ghi',
            toolName: 'file_tool',
            output: {
              type: 'content',
              value: [
                {
                  type: 'text',
                  text: 'Here is the file:',
                },
                {
                  type: 'file-id',
                  fileId: 'file-abc-123',
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(Array.isArray(result[0]?.content)).toBe(true);

    expect(result[0]?.content).toEqual([
      { type: 'text', text: 'Here is the file:' },
      // Unknown type falls back to stringified text
      {
        type: 'text',
        text: JSON.stringify({ type: 'file-id', fileId: 'file-abc-123' }),
      },
    ]);
  });

  it('should convert text-only content parts to structured array', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-jkl',
            toolName: 'text_tool',
            output: {
              type: 'content',
              value: [
                {
                  type: 'text',
                  text: 'Just some text output',
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(Array.isArray(result[0]?.content)).toBe(true);

    expect(result[0]?.content).toEqual([
      { type: 'text', text: 'Just some text output' },
    ]);
  });

  it('should still return string for text output type', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-mno',
            toolName: 'calculator',
            output: {
              type: 'text',
              value: 'The result is 42',
            },
          },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(typeof result[0]?.content).toBe('string');
    expect(result[0]?.content).toBe('The result is 42');
  });

  it('should still return string for json output type', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-pqr',
            toolName: 'weather_api',
            output: {
              type: 'json',
              value: { temperature: 72 },
            },
          },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(typeof result[0]?.content).toBe('string');
    expect(result[0]?.content).toBe('{"temperature":72}');
  });

  it('should convert tool result with file-data (no filename) to file part with empty filename', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-stu',
            toolName: 'pdf_tool',
            output: {
              type: 'content',
              value: [
                {
                  type: 'file-data',
                  data: 'ZmlsZSBjb250ZW50',
                  mediaType: 'application/pdf',
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(Array.isArray(result[0]?.content)).toBe(true);

    expect(result[0]?.content).toEqual([
      {
        type: 'file',
        file: {
          filename: '',
          file_data: 'data:application/pdf;base64,ZmlsZSBjb250ZW50',
        },
      },
    ]);
  });

  it('should convert tool result with file-data (audio mediaType) to input_audio part', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-audio',
            toolName: 'audio_tool',
            output: {
              type: 'content',
              value: [
                {
                  type: 'file-data',
                  data: 'YXVkaW9fZGF0YQ==',
                  mediaType: 'audio/mpeg',
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(Array.isArray(result[0]?.content)).toBe(true);

    expect(result[0]?.content).toEqual([
      {
        type: 'input_audio',
        input_audio: {
          data: 'YXVkaW9fZGF0YQ==',
          format: 'mp3',
        },
      },
    ]);
  });

  it('should convert tool result with file-data (video mediaType) to video_url part', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-video',
            toolName: 'video_tool',
            output: {
              type: 'content',
              value: [
                {
                  type: 'file-data',
                  data: 'dmlkZW9fZGF0YQ==',
                  mediaType: 'video/mp4',
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(Array.isArray(result[0]?.content)).toBe(true);

    expect(result[0]?.content).toEqual([
      {
        type: 'video_url',
        video_url: { url: 'data:video/mp4;base64,dmlkZW9fZGF0YQ==' },
      },
    ]);
  });

  it('should handle mixed text and multiple images in tool result content', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-vwx',
            toolName: 'multi_screenshot',
            output: {
              type: 'content',
              value: [
                {
                  type: 'text',
                  text: 'Screenshots captured:',
                },
                {
                  type: 'image-data',
                  data: 'AAECAw==',
                  mediaType: 'image/png',
                },
                {
                  type: 'image-url',
                  url: 'https://example.com/screenshot2.png',
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(Array.isArray(result[0]?.content)).toBe(true);

    expect(result[0]?.content).toEqual([
      { type: 'text', text: 'Screenshots captured:' },
      {
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,AAECAw==' },
      },
      {
        type: 'image_url',
        image_url: { url: 'https://example.com/screenshot2.png' },
      },
    ]);
  });
});

describe('tool messages', () => {
  it('should include tool name from toolName', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-456',
            toolName: 'get_weather',
            output: {
              type: 'text',
              value: 'Sunny, 72°F',
            },
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'tool',
        tool_call_id: 'call-456',
        content: 'Sunny, 72°F',
        name: 'get_weather',
      },
    ]);
  });

  it('should include tool name for each tool result in a multi-tool response', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'get_weather',
            output: {
              type: 'text',
              value: 'Sunny',
            },
          },
          {
            type: 'tool-result',
            toolCallId: 'call-2',
            toolName: 'get_time',
            output: {
              type: 'json',
              value: { time: '12:00' },
            },
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'tool',
        tool_call_id: 'call-1',
        content: 'Sunny',
        name: 'get_weather',
      },
      {
        role: 'tool',
        tool_call_id: 'call-2',
        content: JSON.stringify({ time: '12:00' }),
        name: 'get_time',
      },
    ]);
  });
});
