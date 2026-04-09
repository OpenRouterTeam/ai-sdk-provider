/**
 * Regression test for GitHub issue #160
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/160
 *
 * Reported error: toolCallId is not unique across models/providers, causing
 * tool result matching failures in multi-turn conversations. When tool call
 * IDs are empty, null, or duplicated, tool results get mismatched or lost.
 *
 * A comment from Sept 2025 noted that Gemini added random IDs, resolving
 * the issue at the API level. This test verifies that the SDK returns
 * unique tool call IDs for parallel tool calls across both streaming and
 * non-streaming paths.
 */
import { generateText, streamText, tool } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

describe('Issue #160: toolCallId uniqueness for parallel tool calls', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  // Use the model from the issue report (Gemini) which was known to
  // return non-unique tool call IDs.
  const model = openrouter('google/gemini-2.5-flash');

  const weatherTool = tool({
    description: 'Gets the weather for a given city',
    inputSchema: z.object({
      city: z.string().describe('The city to get the weather for'),
    }),
    execute: async ({ city }) => {
      return { city, temperature: 22, conditions: 'sunny' };
    },
  });

  it('should return unique toolCallIds for parallel tool calls (non-streaming)', async () => {
    const response = await generateText({
      model,
      prompt:
        'What is the weather in Tokyo, London, and Paris? Call the get_weather tool for each city in parallel.',
      tools: { get_weather: weatherTool },
      toolChoice: 'required',
    });

    const toolCalls = response.steps.flatMap((step) => step.toolCalls || []);
    expect(toolCalls.length).toBeGreaterThanOrEqual(2);

    // All tool call IDs must be unique and non-empty
    const ids = toolCalls.map((tc) => tc.toolCallId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toBeTruthy();
    }
  });

  it('should return unique toolCallIds for parallel tool calls (streaming)', async () => {
    const response = await streamText({
      model,
      prompt:
        'What is the weather in Tokyo, London, and Paris? Call the get_weather tool for each city in parallel.',
      tools: { get_weather: weatherTool },
      toolChoice: 'required',
    });

    const toolCalls: Array<{ toolCallId: string }> = [];
    for await (const part of response.fullStream) {
      if (part.type === 'tool-call') {
        toolCalls.push({ toolCallId: part.toolCallId });
      }
    }

    expect(toolCalls.length).toBeGreaterThanOrEqual(2);

    // All tool call IDs must be unique and non-empty
    const ids = toolCalls.map((tc) => tc.toolCallId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toBeTruthy();
    }
  });
});
