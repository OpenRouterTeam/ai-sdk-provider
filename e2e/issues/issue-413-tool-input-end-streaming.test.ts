/**
 * Regression test for GitHub issue #413
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/413
 *
 * Issue: "Tool call events are buffered until stream ends (flush) causing
 * perceived streaming delay"
 *
 * The reporter observed that streaming tool calls with @openrouter/ai-sdk-provider
 * were missing `tool-input-end` events in the multi-chunk tool call path, diverging
 * from the protocol used by @ai-sdk/openai. The single-chunk path correctly emitted
 * tool-input-start -> tool-input-delta -> tool-input-end -> tool-call, but the
 * multi-chunk merge path skipped tool-input-end before tool-call.
 *
 * This test verifies that streamText with tool calls emits the complete event
 * sequence including tool-input-end before tool-call.
 */
import { streamText, tool } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

describe('Issue #413: Tool call streaming should emit tool-input-end before tool-call', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  it('should emit tool-input-end before tool-call with openai/gpt-4.1-nano', async () => {
    const getWeather = tool({
      description: 'Gets the current weather for a given city',
      inputSchema: z.object({
        city: z.string().describe('The city to get weather for'),
      }),
      execute: async ({ city }) => {
        return { city, temperature: 72, condition: 'sunny' };
      },
    });

    const response = streamText({
      model: openrouter('openai/gpt-4.1-nano'),
      prompt: 'What is the weather in San Francisco? Use the getWeather tool.',
      tools: { getWeather },
      toolChoice: 'required',
    });

    const events: string[] = [];
    for await (const event of response.fullStream) {
      events.push(event.type);
    }

    expect(events).toContain('tool-input-start');
    expect(events).toContain('tool-input-end');
    expect(events).toContain('tool-call');

    const toolInputEndIndex = events.indexOf('tool-input-end');
    const toolCallIndex = events.indexOf('tool-call');
    expect(toolInputEndIndex).toBeLessThan(toolCallIndex);
  });

  it('should emit tool-input-end before tool-call with openai/gpt-4.1-mini', async () => {
    const getWeather = tool({
      description: 'Gets the current weather for a given city',
      inputSchema: z.object({
        city: z.string().describe('The city to get weather for'),
      }),
      execute: async ({ city }) => {
        return { city, temperature: 72, condition: 'sunny' };
      },
    });

    const response = streamText({
      model: openrouter('openai/gpt-4.1-mini'),
      prompt: 'What is the weather in San Francisco? Use the getWeather tool.',
      tools: { getWeather },
      toolChoice: 'required',
    });

    const events: string[] = [];
    for await (const event of response.fullStream) {
      events.push(event.type);
    }

    expect(events).toContain('tool-input-start');
    expect(events).toContain('tool-input-end');
    expect(events).toContain('tool-call');

    const toolInputEndIndex = events.indexOf('tool-input-end');
    const toolCallIndex = events.indexOf('tool-call');
    expect(toolInputEndIndex).toBeLessThan(toolCallIndex);
  });
});
