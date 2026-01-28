/**
 * Regression test for GitHub issue #181
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/181
 *
 * Issue: "tool response for image not working"
 *
 * Reported behavior: When a tool returns an image in its response using the AI SDK's
 * toModelOutput with multimodal content, the model cannot view or interpret the image.
 *
 * Observed behavior: Tool results with multimodal content (images) are JSON.stringified.
 */
import { describe, expect, it } from 'vitest';
import { convertToOpenRouterChatMessages } from '@/src/chat/convert-to-openrouter-chat-messages';

describe('Issue #181: Tool response for image not working', () => {
  it('should stringify tool result with content type containing image', () => {
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

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      role: 'tool',
      tool_call_id: 'call-123',
    });

    expect(typeof result[0]?.content).toBe('string');

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

    const content = result[0]?.content as string;
    expect(content).toBe(
      '{"temperature":72,"unit":"F","location":"San Francisco"}',
    );
  });

  it('should stringify tool result with file-data type (reproduces issue #181)', () => {
    // Reproduces issue #181 using AI SDK v3 format (file-data instead of V2's media type)
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
                  type: 'file-data',
                  mediaType: 'image/jpeg',
                  // Truncated JPEG from the original issue
                  data: '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBwgHBgkIBwgKCgkLDRYPDQwMDRsUFRAWIB0iIiAdHx8kKDQsJCYxJx8fLT0tMTU3Ojo6Iys/RD84QzQ5OjcBCgoKDQwNGg8PGjclHyU3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3N//AABEIAFgAXAMBIgACEQEDEQH/xAAcAAACAgMBAQAA',
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
      tool_call_id: 'call-original-issue',
    });

    expect(typeof result[0]?.content).toBe('string');

    const content = result[0]?.content as string;
    expect(content).toContain('"type":"file-data"');
    expect(content).toContain('"mediaType":"image/jpeg"');
    expect(content).toContain('/9j/4AAQSkZJRgABAQAAAQABAAD'); // JPEG magic bytes
  });
});
