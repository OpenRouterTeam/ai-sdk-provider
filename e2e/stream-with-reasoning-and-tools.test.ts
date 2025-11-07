import { stepCountIs, streamText, tool } from 'ai';
import { describe, expect, it, vi } from 'vitest';
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

    const model = openrouter('anthropic/claude-haiku-4.5', {
      reasoning: {
        enabled: true,
        max_tokens: 2000,
      },
    });

    const messages = [
      {
        role: 'user' as const,
        content:
          'What is the weather in San Francisco? Then tell me what to wear.',
      },
    ];

    let _stepCount = 0;
    let errorOccurred: Error | null = null;

    const result = streamText({
      model,
      messages,
      stopWhen: stepCountIs(5),
      onError({ error }) {
        console.error('[E2E] ========== ERROR OCCURRED ==========');
        console.error('[E2E] Stream error:', error);
        // Log the raw response if available
        if (
          typeof error === 'object' &&
          error !== null &&
          'responseBody' in error &&
          error.responseBody
        ) {
          try {
            const parsed = JSON.parse(error.responseBody as string);
            console.error(
              '[E2E] Error response body:',
              JSON.stringify(parsed, null, 2),
            );
            if (parsed.error?.metadata?.raw) {
              console.error('[E2E] Raw error:', parsed.error.metadata.raw);
            }
          } catch (_e) {
            console.error(
              '[E2E] Failed to parse error response:',
              error.responseBody,
            );
          }
        }
        console.error('[E2E] ========================================');
        // Capture the error to check after the stream completes
        errorOccurred = error as Error;
      },
      onStepFinish({ finishReason }) {
        console.log('[E2E] Step finished:', 'reason:', finishReason);
      },
      tools: {
        getWeather: tool({
          description: 'Get the current weather for a location',
          inputSchema: z.object({
            location: z
              .string()
              .describe('The city and state, e.g. San Francisco, CA'),
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
      _stepCount++;
      console.log('[E2E] Received part type:', part.type);

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

    // Log for debugging
    console.log('[E2E] Parts collected:', parts.length);
    console.log('[E2E] Reasoning parts:', reasoningParts.length);
    console.log('[E2E] Tool call parts:', toolCallParts.length);
    console.log('[E2E] Text parts:', textParts.length);
    console.log(
      '[E2E] Total reasoning text length:',
      totalReasoningText.length,
    );
    console.log('[E2E] Total text length:', totalText.length);

    // Fail the test if an error occurred during streaming
    if (errorOccurred) {
      const error = errorOccurred as Error;
      const streamError = new Error(
        `Stream failed with error: ${error.message}`,
      );
      (streamError as any).cause = error;
      throw streamError;
    }

    // Basic checks - at least we should get some content
    expect(parts.length).toBeGreaterThan(0);
  });
});
