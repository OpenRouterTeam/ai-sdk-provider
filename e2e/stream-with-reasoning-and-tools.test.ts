import { streamText, tool } from 'ai';
import { describe, it, vi, expect } from 'vitest';
import { z } from 'zod/v4';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

describe('Stream with reasoning and tools', () => {
  it('should work with streamText, reasoning enabled, and tool calls', async () => {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
    });

    const model = openrouter('anthropic/claude-sonnet-4', {
      reasoning: {
        enabled: true,
        effort: 'medium',
      },
    });

    const messages = [
      {
        role: 'user' as const,
        content: 'What is the weather in San Francisco? Then tell me what to wear.',
      },
    ];

    let stepCount = 0;

    const result = streamText({
      model,
      messages,
      onError({ error }) {
        console.error('[E2E] Stream error:', error);
        // Log the raw response if available
        if (typeof error === 'object' && error !== null && 'responseBody' in error && error.responseBody) {
          try {
            const parsed = JSON.parse(error.responseBody as string);
            console.error('[E2E] Error response body:', JSON.stringify(parsed, null, 2));
            if (parsed.error?.metadata?.raw) {
              console.error('[E2E] Raw error:', parsed.error.metadata.raw);
            }
          } catch (e) {
            console.error('[E2E] Failed to parse error response:', error.responseBody);
          }
        }
        throw error;
      },
      tools: {
        getWeather: tool({
          description: 'Get the current weather for a location',
          inputSchema: z.object({
            location: z.string().describe('The city and state, e.g. San Francisco, CA'),
          }),
          execute: async ({ location }) => {
            // Simulate some delay
            await new Promise((res) => setTimeout(res, 1000));
            // Simulate weather data
            return {
              location,
              temperature: 72,
              condition: 'Sunny',
              humidity: 45,
            };
          },
        }),
      },
    });

    // Collect all parts from the stream
    const parts: Array<{
      type: string;
      text?: string;
      reasoning?: string;
      toolName?: string;
    }> = [];

    for await (const part of result.fullStream) {
      stepCount++;

      if (part.type === 'text-delta') {
        parts.push({ type: 'text-delta', text: part.text });
      } else if (part.type === 'reasoning-delta') {
        parts.push({ type: 'reasoning-delta', reasoning: part.text });
      } else if (part.type === 'tool-call') {
        parts.push({ type: 'tool-call', toolName: part.toolName });
      } else if (part.type === 'tool-result') {
        parts.push({ type: 'tool-result', toolName: part.toolName });
      } else if (part.type === 'finish') {
        parts.push({ type: 'finish' });
      }
    }

    // Verify we got reasoning deltas
    const reasoningParts = parts.filter((p) => p.type === 'reasoning-delta');
    const totalReasoningText = reasoningParts.map((p) => p.reasoning).join('');

    // Verify we got tool calls
    const toolCallParts = parts.filter((p) => p.type === 'tool-call');

    // Verify we got text deltas
    const textParts = parts.filter((p) => p.type === 'text-delta');
    const totalText = textParts.map((p) => p.text).join('');

    // Assertions
    expect(reasoningParts.length).toBeGreaterThan(0);
    expect(totalReasoningText.length).toBeGreaterThan(1);

    expect(toolCallParts.length).toBeGreaterThan(0);
    expect(toolCallParts.some((p) => p.toolName === 'getWeather')).toBe(true);

    expect(textParts.length).toBeGreaterThan(0);
    expect(totalText.length).toBeGreaterThan(1);
  });
});
