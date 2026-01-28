/**
 * Regression test for GitHub issue #287
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/287
 *
 * Reported error: AI_TypeValidationError when tool calls have missing arguments field
 *
 * Some upstream providers may omit the `arguments` field in tool calls when there
 * are no arguments to pass. This caused validation errors because the schema
 * required `arguments` to be a string.
 *
 * This test verifies that tool calls work correctly even when the tool has no
 * parameters (and the upstream provider might omit the arguments field).
 */
import { generateText, tool } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

describe('Issue #287: Tool calls with missing arguments field', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  // Use Anthropic Haiku model - mentioned in original issue context as potentially
  // omitting the arguments field for tools with no parameters
  const model = openrouter('anthropic/claude-3.5-haiku');

  it('should handle tool with no parameters', async () => {
    // Tool with no parameters - some providers may omit the arguments field entirely
    const getCurrentTime = tool({
      description: 'Gets the current time',
      inputSchema: z.object({}),
      execute: async () => {
        return { time: new Date().toISOString() };
      },
    });

    const response = await generateText({
      model,
      system:
        'You are a helpful assistant. Always use the getCurrentTime tool when asked about time.',
      prompt: 'What time is it right now? Use the getCurrentTime tool.',
      tools: { getCurrentTime },
      toolChoice: 'required',
    });

    // Should complete without AI_TypeValidationError
    expect(response.text).toBeDefined();
    expect(response.finishReason).toBeDefined();

    // Verify tool was called
    const toolCalls = response.steps.flatMap((step) => step.toolCalls || []);
    expect(toolCalls.length).toBeGreaterThan(0);
    expect(toolCalls[0]?.toolName).toBe('getCurrentTime');
  });

  it('should handle tool with optional parameters where none are provided', async () => {
    // Tool with optional parameters - model might not provide any arguments
    const greet = tool({
      description: 'Greets the user',
      inputSchema: z.object({
        name: z.string().optional().describe('Optional name to greet'),
      }),
      execute: async ({ name }) => {
        return { greeting: name ? `Hello, ${name}!` : 'Hello!' };
      },
    });

    const response = await generateText({
      model,
      system:
        'You are a helpful assistant. Use the greet tool when asked to say hello.',
      prompt: 'Just say hello using the greet tool. No name needed.',
      tools: { greet },
      toolChoice: 'required',
    });

    // Should complete without AI_TypeValidationError
    expect(response.text).toBeDefined();
    expect(response.finishReason).toBeDefined();
  });
});
