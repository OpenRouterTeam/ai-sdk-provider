/**
 * Regression test for GitHub issue #194
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/194
 *
 * Reported error: "AI_APICallError: Invalid JSON response"
 * Model: x-ai/grok-4-fast
 *
 * This test verifies that Grok 4 Fast works correctly with the SDK.
 */
import { generateText, streamText, tool } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

describe('Issue #194: Grok 4 Fast Invalid JSON response', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  const model = openrouter('x-ai/grok-4-fast');

  it('should return valid JSON response with generateText', async () => {
    const response = await generateText({
      model,
      messages: [
        {
          role: 'user',
          content: 'What is 2+2? Answer with just the number.',
        },
      ],
    });

    expect(response.text).toBeDefined();
    expect(response.text.length).toBeGreaterThan(0);
    expect(response.finishReason).toBeDefined();
  });

  it('should return valid streaming response with streamText', async () => {
    const result = await streamText({
      model,
      messages: [
        {
          role: 'user',
          content: 'Count from 1 to 3, one number per line.',
        },
      ],
    });

    const text = await result.text;

    expect(text).toBeDefined();
    expect(text.length).toBeGreaterThan(0);
  });

  it('should handle tool calls correctly', async () => {
    const weatherTool = tool({
      description: 'Gets the current weather for a location',
      inputSchema: z.object({
        location: z.string().describe('The city name'),
      }),
      execute: async ({ location }) => {
        return { temperature: 72, location };
      },
    });

    const response = await generateText({
      model,
      messages: [
        {
          role: 'user',
          content: 'What is the weather in San Francisco?',
        },
      ],
      tools: { weatherTool },
      toolChoice: 'auto',
    });

    // Should either have tool calls or a text response
    const hasToolCalls = response.toolCalls && response.toolCalls.length > 0;
    const hasText = response.text && response.text.length > 0;

    expect(hasToolCalls || hasText).toBe(true);

    if (hasToolCalls && response.toolCalls) {
      expect(response.toolCalls[0]?.toolName).toBe('weatherTool');
    }
  });
});
