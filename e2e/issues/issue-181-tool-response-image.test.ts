/**
 * Regression test for GitHub issue #181
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/181
 *
 * Issue: "tool response for image not working"
 *
 * Root cause: The `getToolResultContent` function in convert-to-openrouter-chat-messages.ts
 * only returns strings. When a tool result contains multimodal content (images via the
 * AI SDK v3 'content' output type), the content is JSON.stringified rather than being
 * converted to the OpenRouter multimodal format (image_url).
 *
 * Current behavior: This is expected behavior because the OpenRouter API backend does not
 * currently support multimodal content in tool messages. The backend extracts only text
 * from tool message content arrays, so properly formatting images would not help.
 *
 * This test documents the current behavior and serves as a regression monitor for when
 * multimodal tool results may be supported in the future.
 */
import { describe, expect, it } from 'vitest';
import { convertToOpenRouterChatMessages } from '@/src/chat/convert-to-openrouter-chat-messages';

describe('Issue #181: Tool response for image not working', () => {
  it('should stringify tool result with content type containing image (current behavior)', () => {
    // This test documents that tool results with multimodal content are stringified
    // rather than converted to image_url format
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
                  type: 'file-data',
                  data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                  mediaType: 'image/png',
                },
              ],
            },
          },
        ],
      },
    ]);

    // The tool message content should be a string (JSON stringified)
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      role: 'tool',
      tool_call_id: 'call-123',
    });

    // Content is stringified, not converted to multimodal format
    expect(typeof result[0]?.content).toBe('string');

    // The stringified content contains the original structure
    const content = result[0]?.content as string;
    expect(content).toContain('"type":"text"');
    expect(content).toContain('"type":"file-data"');
    expect(content).toContain('iVBORw0KGgo'); // Base64 image data
  });

  it('should stringify tool result with content type containing image URL', () => {
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
                  // file-url type doesn't have mediaType in AI SDK v3
                  type: 'file-url',
                  url: 'https://example.com/generated-image.png',
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(typeof result[0]?.content).toBe('string');

    const content = result[0]?.content as string;
    expect(content).toContain('"type":"file-url"');
    expect(content).toContain('https://example.com/generated-image.png');
  });

  it('should handle text-only tool results normally', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-789',
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
    expect(result[0]).toMatchObject({
      role: 'tool',
      tool_call_id: 'call-789',
      content: 'The result is 42',
    });
  });

  it('should handle JSON tool results normally', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-abc',
            toolName: 'weather_api',
            output: {
              type: 'json',
              value: { temperature: 72, unit: 'F', location: 'San Francisco' },
            },
          },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      role: 'tool',
      tool_call_id: 'call-abc',
    });

    // JSON output is also stringified
    const content = result[0]?.content as string;
    expect(content).toBe(
      '{"temperature":72,"unit":"F","location":"San Francisco"}',
    );
  });

  it('should stringify tool result with media type (exact format from original issue #181)', () => {
    // This test uses the EXACT format from the original issue:
    // toModelOutput returns { type: "content", value: [{ type: "media", mediaType: "image/jpeg", data: ... }] }
    // Note: "media" type is from LanguageModelV2, but the function handles it at runtime
    // We use 'unknown' cast to test the actual runtime behavior with the exact issue format
    const result = convertToOpenRouterChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-original-issue',
            toolName: 'webFetch',
            output: {
              type: 'content',
              value: [
                {
                  // Exact format from issue #181's toModelOutput function
                  type: 'media',
                  mediaType: 'image/jpeg',
                  // Truncated version of the flower JPEG from the original issue
                  data: '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBwgHBgkIBwgKCgkLDRYPDQwMDRsUFRAWIB0iIiAdHx8kKDQsJCYxJx8fLT0tMTU3Ojo6Iys/RD84QzQ5OjcBCgoKDQwNGg8PGjclHyU3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3N//AABEIAFgAXAMBIgACEQEDEQH/xAAcAAACAgMBAQAA',
                },
              ],
            },
          },
        ],
      },
    ] as unknown as Parameters<typeof convertToOpenRouterChatMessages>[0]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      role: 'tool',
      tool_call_id: 'call-original-issue',
    });

    // Content is stringified, not converted to image_url format
    // This is the core issue: the model cannot "see" the image because it's just a JSON string
    expect(typeof result[0]?.content).toBe('string');

    const content = result[0]?.content as string;
    expect(content).toContain('"type":"media"');
    expect(content).toContain('"mediaType":"image/jpeg"');
    expect(content).toContain('/9j/4AAQSkZJRgABAQAAAQABAAD'); // JPEG magic bytes
  });
});
