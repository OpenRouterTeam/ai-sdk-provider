import { ReasoningDetailType } from '../schemas/reasoning-details';
import { ReasoningFormat } from '../schemas/format';
import type { ReasoningDetailUnion } from '../schemas/reasoning-details';

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

  it('should deduplicate reasoning_details from parallel tool calls (Claude format)', () => {
    // This test verifies that when 2 parallel tool calls have the same reasoning_details
    // (as happens during streaming), they are deduplicated based on signature (Claude format)
    const sharedReasoningDetails = [
      {
        type: ReasoningDetailType.Text,
        text: 'User wants to execute 2 parallel tool calls with SELECT 1 and SELECT 2',
        signature: 'SHARED_SIGNATURE_ABC123',
        format: 'anthropic-claude-v1',
        index: 0,
      },
    ];

    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'User wants to execute 2 parallel tool calls',
          },
          {
            type: 'text',
            text: 'Executing two queries:',
          },
          {
            type: 'tool-call',
            toolCallId: 'call_1',
            toolName: 'execute_query',
            input: { query: 'SELECT 1' },
            providerOptions: {
              openrouter: {
                reasoning_details: sharedReasoningDetails,
              },
            },
          },
          {
            type: 'tool-call',
            toolCallId: 'call_2',
            toolName: 'execute_query',
            input: { query: 'SELECT 2' },
            providerOptions: {
              openrouter: {
                reasoning_details: sharedReasoningDetails,
              },
            },
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'assistant',
        content: 'Executing two queries:',
        reasoning: 'User wants to execute 2 parallel tool calls',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'execute_query',
              arguments: '{"query":"SELECT 1"}',
            },
          },
          {
            id: 'call_2',
            type: 'function',
            function: {
              name: 'execute_query',
              arguments: '{"query":"SELECT 2"}',
            },
          },
        ],
        // Should only include reasoning_details once, not twice
        reasoning_details: sharedReasoningDetails,
      },
    ]);
  });

  it('should deduplicate reasoning_details from parallel tool calls (Gemini format)', () => {
    // This test verifies deduplication with Gemini's format which includes
    // both reasoning.text and reasoning.encrypted types
    const sharedReasoningDetails: ReasoningDetailUnion[] = [
      {
        type: ReasoningDetailType.Text,
        text: 'Investigating parallel query execution. Will use execute_any_sql_query tool.',
        format: ReasoningFormat.GoogleGeminiV1,
        index: 0,
      },
      {
        type: ReasoningDetailType.Encrypted,
        data: 'CiQBjz1rX3AUnuJbEscd2c28pUpzqQ9Pe9Y0fyB9LUKO+emeE/YKawGPPWtf',
        id: 'tool_execute_any_sql_query_IEiiyNbzNfZ99pGmaMHx',
        format: ReasoningFormat.GoogleGeminiV1,
        index: 0,
      },
    ];

    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Executing two queries:',
          },
          {
            type: 'tool-call',
            toolCallId: 'call_1',
            toolName: 'execute_query',
            input: { query: 'SELECT 1' },
            providerOptions: {
              openrouter: {
                reasoning_details: sharedReasoningDetails,
              },
            },
          },
          {
            type: 'tool-call',
            toolCallId: 'call_2',
            toolName: 'execute_query',
            input: { query: 'SELECT 2' },
            providerOptions: {
              openrouter: {
                reasoning_details: sharedReasoningDetails,
              },
            },
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'assistant',
        content: 'Executing two queries:',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'execute_query',
              arguments: '{"query":"SELECT 1"}',
            },
          },
          {
            id: 'call_2',
            type: 'function',
            function: {
              name: 'execute_query',
              arguments: '{"query":"SELECT 2"}',
            },
          },
        ],
        // Should only include reasoning_details once, not twice
        // Verifies both text and encrypted types are properly deduplicated
        reasoning_details: sharedReasoningDetails,
      },
    ]);
  });

  it('should preserve unique reasoning_details from sequential tool calls', () => {
    // This test verifies that different reasoning_details from sequential calls
    // are all preserved (not deduplicated)
    const result = convertToOpenRouterChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'First action',
          },
          {
            type: 'tool-call',
            toolCallId: 'call_1',
            toolName: 'search',
            input: { query: 'data' },
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Text,
                    text: 'Need to search for data first',
                    signature: 'SIGNATURE_1',
                    format: 'anthropic-claude-v1',
                    index: 0,
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
            toolCallId: 'call_1',
            toolName: 'search',
            output: {
              type: 'text',
              value: 'Found data',
            },
          },
        ],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Second action',
          },
          {
            type: 'tool-call',
            toolCallId: 'call_2',
            toolName: 'analyze',
            input: { data: 'result' },
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Text,
                    text: 'Now analyzing the search results',
                    signature: 'SIGNATURE_2',
                    format: 'anthropic-claude-v1',
                    index: 0,
                  },
                ],
              },
            },
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        role: 'assistant',
        content: 'First action',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'search',
              arguments: '{"query":"data"}',
            },
          },
        ],
        reasoning_details: [
          {
            type: ReasoningDetailType.Text,
            text: 'Need to search for data first',
            signature: 'SIGNATURE_1',
            format: 'anthropic-claude-v1',
            index: 0,
          },
        ],
      },
      {
        role: 'tool',
        tool_call_id: 'call_1',
        content: 'Found data',
      },
      {
        role: 'assistant',
        content: 'Second action',
        tool_calls: [
          {
            id: 'call_2',
            type: 'function',
            function: {
              name: 'analyze',
              arguments: '{"data":"result"}',
            },
          },
        ],
        reasoning_details: [
          {
            type: ReasoningDetailType.Text,
            text: 'Now analyzing the search results',
            signature: 'SIGNATURE_2',
            format: 'anthropic-claude-v1',
            index: 0,
          },
        ],
      },
    ]);
  });
});
