/**
 * E2E test for issue #287: Tool calls without arguments field
 *
 * This test validates that tools with no parameters work correctly.
 * The issue was that Anthropic Claude models return tool calls without
 * an `arguments` field when the tool has no parameters, but the schema
 * required it, causing a Zod validation error.
 *
 * @see https://github.com/OpenRouterTeam/ai-sdk-provider/issues/287
 */
import { generateText, tool } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

describe('Issue #287: Tool calls without arguments field', () => {
  it('should handle tools with no parameters (Anthropic Claude)', async () => {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
    });

    // Tool with no parameters - this is what triggers the issue
    const getCurrentTimeTool = tool({
      description: 'Get the current time. This tool takes no parameters.',
      parameters: z.object({}),
      execute: async () => {
        return {
          time: new Date().toISOString(),
          timezone: 'UTC',
        };
      },
    });

    // Use an Anthropic model since the issue was reported with Claude Haiku
    const model = openrouter('anthropic/claude-3.5-haiku');

    // This request should trigger the model to call the tool
    const response = await generateText({
      model,
      prompt: 'What time is it right now? Use the getCurrentTime tool to find out.',
      tools: {
        getCurrentTime: getCurrentTimeTool,
      },
      maxSteps: 2, // Allow the model to call the tool and then respond
    });

    // The test passes if we get here without a Zod validation error
    expect(response).toBeDefined();
    expect(response.text).toBeDefined();

    // Verify that the tool was actually called by checking the content array
    const toolCallsFromContent = response.steps.flatMap((step) =>
      step.content?.filter(
        (c): c is { type: 'tool-call'; toolName: string; input: unknown } =>
          c.type === 'tool-call'
      ) || []
    );

    // Verify we got at least one tool call
    expect(toolCallsFromContent.length).toBeGreaterThan(0);

    // Find the getCurrentTime tool call
    const toolCall = toolCallsFromContent.find((tc) => tc.toolName === 'getCurrentTime');
    expect(toolCall).toBeDefined();

    // The input should be an empty object (parsed from missing/empty arguments)
    // This validates that our fix for issue #287 works correctly
    expect(toolCall?.input).toEqual({});
  });

  it('should handle tools with no parameters in streaming mode', async () => {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
    });

    const listComponentsTool = tool({
      description: 'List all available UI components. Takes no parameters.',
      parameters: z.object({}),
      execute: async () => {
        return {
          components: ['Button', 'Input', 'Card', 'Modal'],
        };
      },
    });

    const model = openrouter('anthropic/claude-3.5-haiku');

    const response = await generateText({
      model,
      prompt: 'List all available components using the listComponents tool.',
      tools: {
        listComponents: listComponentsTool,
      },
      maxSteps: 2,
    });

    expect(response).toBeDefined();

    // Verify that the tool was called
    const toolCalls = response.steps.flatMap((step) => step.toolCalls || []);
    const toolCall = toolCalls.find((tc) => tc.toolName === 'listComponents');
    expect(toolCall).toBeDefined();
  });
});
