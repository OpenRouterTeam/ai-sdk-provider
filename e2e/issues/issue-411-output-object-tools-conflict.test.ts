/**
 * Regression test for GitHub Issue #411
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/411
 *
 * Reported error: When using generateText with Output.object() and tools,
 * the model returns tool call arguments as plain text instead of structured
 * tool_calls.
 *
 * This test verifies that both response_format and tools are sent together
 * in the request (matching @ai-sdk/openai behavior), and that models can
 * produce structured tool_calls alongside Output.object().
 */
import { generateText, Output, tool } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 120_000,
});

describe('Issue #411: generateText with Output.object() + tools should return structured tool_calls', () => {
  const provider = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  it('should produce structured tool calls when Output.object and tools are both present', async () => {
    const model = provider('openai/gpt-4o-mini');

    const lookupEmailTool = tool({
      description: 'Look up information about an email address',
      inputSchema: z.object({
        email: z.string().describe('The email address to look up'),
      }),
      execute: async ({ email }) => ({
        name: 'John Doe',
        email,
      }),
    });

    const result = await generateText({
      model,
      messages: [
        {
          role: 'user',
          content:
            'Look up the email for john@example.com and return the result.',
        },
      ],
      experimental_output: Output.object({
        schema: z.object({
          name: z.string(),
          email: z.string(),
        }),
      }),
      tools: {
        lookupEmail: lookupEmailTool,
      },
    });

    // The model should have made at least one step
    expect(result.steps.length).toBeGreaterThan(0);

    // Check that at least one step had a proper tool call
    const toolCallSteps = result.steps.filter(
      (step) => step.toolCalls && step.toolCalls.length > 0,
    );
    expect(toolCallSteps.length).toBeGreaterThan(0);

    // Verify the tool call has the correct tool name (structured, not text)
    const firstToolCall = toolCallSteps[0]!.toolCalls[0]!;
    expect(firstToolCall.toolName).toBe('lookupEmail');
  });
});
