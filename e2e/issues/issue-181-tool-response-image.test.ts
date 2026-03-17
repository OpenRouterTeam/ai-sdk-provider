/**
 * Regression test for GitHub issue #181
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/181
 *
 * Issue: "tool response for image not working"
 *
 * Reported behavior: When a tool returns an image in its response using the AI SDK's
 * toModelOutput with multimodal content, the model cannot view or interpret the image.
 *
 * Fix: Tool results with output.type === 'content' now return structured
 * ChatCompletionContentPart arrays instead of JSON.stringify-ing the value.
 */
import { describe, expect, it } from 'vitest';
import { convertToOpenRouterChatMessages } from '@/src/chat/convert-to-openrouter-chat-messages';

describe('Issue #181: Tool response for image not working', () => {
  it('should preserve structured content with text + image in tool result', () => {
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

  it('should preserve structured content with text + file-url in tool result', () => {
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
    expect(Array.isArray(result[0]?.content)).toBe(true);

    expect(result[0]?.content).toEqual([
      { type: 'text', text: 'Generated image:' },
      {
        type: 'image_url',
        image_url: { url: 'https://example.com/generated-image.png' },
      },
    ]);
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

    expect(result[0]?.content).toBe(
      '{"temperature":72,"unit":"F","location":"San Francisco"}',
    );
  });

  it('should convert file-data image to structured image_url part (reproduces issue #181)', () => {
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

    expect(Array.isArray(result[0]?.content)).toBe(true);

    expect(result[0]?.content).toEqual([
      {
        type: 'image_url',
        image_url: {
          url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBwgHBgkIBwgKCgkLDRYPDQwMDRsUFRAWIB0iIiAdHx8kKDQsJCYxJx8fLT0tMTU3Ojo6Iys/RD84QzQ5OjcBCgoKDQwNGg8PGjclHyU3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3N//AABEIAFgAXAMBIgACEQEDEQH/xAAcAAACAgMBAQAA',
        },
      },
    ]);
  });
});
