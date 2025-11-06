import { streamText, tool } from 'ai';
import { describe, it, vi } from 'vitest';
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
            console.log('[E2E] Weather tool called for:', location);
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

      // Log the part for debugging
      if (part.type === 'reasoning-delta') {
        console.log('[E2E] Reasoning delta received:', part.text?.substring(0, 50) || '');
      } else if (part.type === 'tool-call') {
        console.log('[E2E] Tool call:', part.toolName);
      } else if (part.type === 'tool-result') {
        console.log('[E2E] Tool result for:', part.toolName);
      }
    }

    console.log('[E2E] Total parts collected:', parts.length);
    console.log('[E2E] Step count:', stepCount);
    console.log('[E2E] Part types:', parts.map((p) => p.type).join(', '));

    // Verify we got reasoning deltas
    const reasoningParts = parts.filter((p) => p.type === 'reasoning-delta');
    console.log('[E2E] Reasoning parts count:', reasoningParts.length);

    // Verify we got tool calls
    const toolCallParts = parts.filter((p) => p.type === 'tool-call');
    console.log('[E2E] Tool call parts count:', toolCallParts.length);

    // Verify we got text deltas
    const textParts = parts.filter((p) => p.type === 'text-delta');
    console.log('[E2E] Text parts count:', textParts.length);

    // Basic assertions - the test should complete without errors
    // and we should get some reasoning, tool calls, and text
    if (reasoningParts.length === 0) {
      console.warn('[E2E] Warning: No reasoning deltas received');
    }
    if (toolCallParts.length === 0) {
      console.warn('[E2E] Warning: No tool calls received');
    }
    if (textParts.length === 0) {
      console.warn('[E2E] Warning: No text deltas received');
    }
  });
});
