/**
 * Regression test for GitHub Issues #419 and #420
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/419
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/420
 *
 * Reported error (#419): Standard usage object contains undefined values while
 * providerMetadata.openrouter.usage has correct data.
 * Model: z-ai/glm-5:free
 *
 * Reported error (#420): Kimi K2.5 returns undefined finishReason after tool
 * calls, breaking agentic loops.
 * Model: moonshotai/kimi-k2.5
 *
 * This test verifies that finishReason is correctly set to 'tool-calls' when
 * tool calls are present, and that usage data is populated in the standard
 * usage object.
 */
import { generateText, streamText, tool } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 120_000,
});

const weatherTool = tool({
  description: 'Get the current weather for a location',
  inputSchema: z.object({
    city: z.string().describe('The city to get weather for'),
  }),
  execute: async () => ({
    temperature: 22,
    condition: 'sunny',
  }),
});

describe('Issue #419/#420: finishReason inference and usage population', () => {
  const provider = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  it('should populate usage in streaming mode (#419)', async () => {
    const response = streamText({
      model: provider('openai/gpt-4o-mini'),
      messages: [
        {
          role: 'user',
          content: 'What is 2+2? Answer with just the number.',
        },
      ],
    });

    await response.consumeStream();
    const usage = await response.usage;

    expect(usage.inputTokens).toEqual(expect.any(Number));
    expect(usage.inputTokens).toBeGreaterThan(0);
    expect(usage.outputTokens).toEqual(expect.any(Number));
    expect(usage.outputTokens).toBeGreaterThanOrEqual(0);
  });

  it('should return tool-calls finishReason with tools in generateText (#420)', async () => {
    const result = await generateText({
      model: provider('openai/gpt-4o-mini'),
      messages: [
        {
          role: 'user',
          content: 'What is the weather in Tokyo? Use the get_weather tool.',
        },
      ],
      tools: {
        get_weather: weatherTool,
      },
    });

    // Check that usage is populated (not NaN or undefined)
    expect(result.usage.inputTokens).toBeGreaterThan(0);
    expect(result.usage.outputTokens).toBeGreaterThanOrEqual(0);

    // If there were tool calls, verify finishReason was 'tool-calls'
    if (result.toolCalls && result.toolCalls.length > 0) {
      expect(result.finishReason).toBe('tool-calls');
    }
  });
});
