/**
 * Regression test for GitHub Issue #166 — finish_reason is null for some models
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/166
 *
 * Reported error: Some models return `finish_reason: null` in streaming responses
 * even when tool calls are present. This causes the AI SDK to see finishReason as
 * 'other' instead of 'tool-calls', breaking agentic loops that rely on
 * finishReason === 'tool-calls' to continue iterating.
 *
 * Models mentioned: google/gemini-2.5-flash, various free-tier models.
 *
 * The fix: In both doGenerate and doStream, when tool calls are present but
 * finishReason maps to 'other' (which includes null/undefined/unrecognized values),
 * override finishReason to 'tool-calls' so agentic loops continue correctly.
 */
import { generateText, stepCountIs, streamText, tool } from 'ai';
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

describe('Issue #166: finish_reason null should not break agentic loops', () => {
  const provider = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  it('should return tool-calls finishReason when streaming with tools (google/gemini-2.5-flash)', async () => {
    const response = streamText({
      model: provider('google/gemini-2.5-flash'),
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

    await response.consumeStream();
    const finishReason = await response.finishReason;
    const toolCalls = await response.toolCalls;

    // If the model made tool calls, finishReason must be 'tool-calls'
    if (toolCalls && toolCalls.length > 0) {
      expect(finishReason).toBe('tool-calls');
    }
  });

  it('should return tool-calls finishReason when streaming with tools (openai/gpt-4o-mini)', async () => {
    const response = streamText({
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

    await response.consumeStream();
    const finishReason = await response.finishReason;
    const toolCalls = await response.toolCalls;

    if (toolCalls && toolCalls.length > 0) {
      expect(finishReason).toBe('tool-calls');
    }
  });

  it('should return tool-calls finishReason in generateText with tools (google/gemini-2.5-flash)', async () => {
    const result = await generateText({
      model: provider('google/gemini-2.5-flash'),
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

    if (result.toolCalls && result.toolCalls.length > 0) {
      expect(result.finishReason).toBe('tool-calls');
    }
  });

  it('should complete a full agentic loop without breaking (google/gemini-2.5-flash)', async () => {
    const result = await generateText({
      model: provider('google/gemini-2.5-flash'),
      messages: [
        {
          role: 'user',
          content: 'What is the weather in Tokyo?',
        },
      ],
      tools: {
        get_weather: weatherTool,
      },
      stopWhen: stepCountIs(3),
    });

    // The agentic loop should complete without errors.
    // If finish_reason were incorrectly mapped, the loop would stop
    // after the first tool call instead of continuing to produce a final answer.
    expect(result.steps.length).toBeGreaterThanOrEqual(1);
    expect(result.text.length).toBeGreaterThan(0);
  });
});
