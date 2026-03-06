/**
 * Regression test for GitHub Issue #411
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/411
 *
 * Reported error: When using generateText with Output.object() and tools,
 * the model returns tool call arguments as plain text instead of structured
 * tool_calls. This happens because both response_format (json_schema) and
 * tools are sent in the request, creating conflicting instructions for the
 * model.
 *
 * Fix: Omit response_format from the request body when tools are present.
 */
import { generateText, Output, tool } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
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

    const result = await generateText({
      model,
      prompt: 'Look up the email for john@example.com and return the result.',
      experimental_output: Output.object({
        schema: z.object({
          name: z.string(),
          email: z.string(),
        }),
      }),
      tools: {
        lookupEmail: tool({
          description: 'Look up information about an email address',
          parameters: z.object({
            email: z.string().describe('The email address to look up'),
          }),
          execute: async ({ email }) => ({
            name: 'John Doe',
            email,
          }),
        }),
      },
      maxSteps: 3,
    });

    // The model should have made at least one tool call step
    // and should NOT have dumped tool arguments as plain text
    expect(result.text).toBeDefined();
    expect(result.steps.length).toBeGreaterThan(0);

    // Check that at least one step had a proper tool call
    const toolCallSteps = result.steps.filter(
      (step) => step.toolCalls && step.toolCalls.length > 0,
    );
    expect(toolCallSteps.length).toBeGreaterThan(0);

    // Verify the tool call has structured arguments, not text
    const firstToolCall = toolCallSteps[0]!.toolCalls[0]!;
    expect(firstToolCall.toolName).toBe('lookupEmail');
    expect(firstToolCall.args).toBeDefined();
    expect(typeof firstToolCall.args).toBe('object');
    expect(firstToolCall.args.email).toBeDefined();
  });
});
