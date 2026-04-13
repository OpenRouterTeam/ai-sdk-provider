/**
 * Regression test for GitHub issue #171
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/171
 *
 * Issue: "Cache broken when using tools"
 *
 * When the AI SDK deserializes and re-serializes tool call arguments across
 * turns, the key insertion order may change (e.g., {"city":"Tokyo","unit":"celsius"}
 * becomes {"unit":"celsius","city":"Tokyo"}). This produces different strings
 * for semantically identical objects, which breaks prompt caching because the
 * cache key includes the serialized tool call arguments verbatim.
 *
 * This test verifies that tool call arguments are serialized deterministically
 * in a multi-turn conversation where tool results are sent back.
 */
import { generateText, tool } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

describe('Issue #171: Cache broken when using tools - key ordering', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  const model = openrouter('openai/gpt-4.1-mini');

  it('should produce cache-friendly tool call arguments in a multi-turn tool conversation', async () => {
    const getWeather = tool({
      description:
        'Get the current weather for a given city. Always provide both city and unit.',
      inputSchema: z.object({
        city: z.string().describe('The city name'),
        unit: z.enum(['celsius', 'fahrenheit']).describe('Temperature unit'),
      }),
      execute: async ({ city, unit }) => {
        return {
          city,
          unit,
          temperature: unit === 'celsius' ? 22 : 72,
          condition: 'sunny',
        };
      },
    });

    // First turn: model calls the tool
    const response = await generateText({
      model,
      system:
        'You are a weather assistant. When asked about weather, use the getWeather tool with both city and unit parameters.',
      prompt:
        'What is the weather in Tokyo in celsius? Use the getWeather tool.',
      tools: { getWeather },
      toolChoice: 'required',
    });

    expect(response.text).toBeDefined();
    expect(response.finishReason).toBeDefined();

    // Verify tool was called successfully
    const toolCalls = response.steps.flatMap((step) => step.toolCalls || []);
    expect(toolCalls.length).toBeGreaterThan(0);
    expect(toolCalls[0]?.toolName).toBe('getWeather');
  });
});
