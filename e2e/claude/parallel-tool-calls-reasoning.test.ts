/**
 * Test for Claude parallel tool calls with reasoning/thinking enabled
 *
 * This test verifies that when using Claude models with thinking enabled,
 * parallel tool calls (multiple tools called at once) correctly handle
 * reasoning_details - only the first tool call should have reasoning_details
 * to avoid duplicating thinking blocks which causes Anthropic to reject
 * the continuation request.
 */
import { generateText, streamText, tool } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { writeOutputJsonFile } from '@/e2e/utils';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 120_000,
});

const weatherTool = tool({
  description: 'Gets the current weather for a location',
  inputSchema: z.object({
    location: z.string().describe('The city and state, e.g. San Francisco, CA'),
  }),
  execute: async () => {
    return {
      temperature: 72,
      conditions: 'Sunny',
    };
  },
});

const timeTool = tool({
  description: 'Gets the current time',
  inputSchema: z.object({}),
  execute: async () => {
    return {
      time: '2:30 PM',
    };
  },
});

describe('Claude parallel tool calls with reasoning', () => {
  it('should only attach reasoning_details to first tool call with streamText', async () => {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
    });

    const model = openrouter('anthropic/claude-sonnet-4');

    const firstResult = await streamText({
      model,
      system:
        'You are a helpful assistant. When asked for weather and time, always call BOTH tools in parallel.',
      prompt: 'What is the weather in San Francisco and what time is it?',
      tools: { weatherTool, timeTool },
      providerOptions: {
        openrouter: {
          reasoning: {
            effort: 'medium',
          },
        },
      },
    });

    const firstResponse = await firstResult.response;

    await writeOutputJsonFile({
      fileName: 'streamText-parallel-firstResponse.ignore.json',
      fileData: {
        messages: firstResponse.messages,
      },
      baseUrl: import.meta.url,
    });

    const assistantMessage = firstResponse.messages.find(
      (m) => m.role === 'assistant',
    );
    expect(assistantMessage).toBeDefined();

    const assistantContent = assistantMessage?.content;
    expect(Array.isArray(assistantContent)).toBe(true);

    const contentArray = assistantContent as Array<{
      type: string;
      providerOptions?: Record<string, unknown>;
    }>;

    const toolCallContents = contentArray.filter((c) => c.type === 'tool-call');

    // We expect at least one tool call (ideally two for parallel calls)
    expect(toolCallContents.length).toBeGreaterThanOrEqual(1);

    // Count how many tool calls have reasoning_details
    let toolCallsWithReasoningDetails = 0;
    for (const toolCall of toolCallContents) {
      const toolCallProviderOptions = toolCall.providerOptions as
        | Record<string, Record<string, unknown>>
        | undefined;
      const reasoningDetails = toolCallProviderOptions?.openrouter
        ?.reasoning_details as Array<unknown> | undefined;
      if (reasoningDetails && reasoningDetails.length > 0) {
        toolCallsWithReasoningDetails++;
      }
    }

    // Only the first tool call should have reasoning_details
    // This prevents duplicate thinking blocks when sending back to Claude
    expect(toolCallsWithReasoningDetails).toBeLessThanOrEqual(1);

    // If we have multiple tool calls, verify only the first has reasoning_details
    if (toolCallContents.length > 1) {
      const firstToolCallProviderOptions = toolCallContents[0]
        ?.providerOptions as
        | Record<string, Record<string, unknown>>
        | undefined;
      const firstReasoningDetails = firstToolCallProviderOptions?.openrouter
        ?.reasoning_details as Array<unknown> | undefined;

      // First tool call should have reasoning_details (if any exist)
      if (toolCallsWithReasoningDetails > 0) {
        expect(firstReasoningDetails).toBeDefined();
        expect(firstReasoningDetails?.length).toBeGreaterThan(0);
      }

      // Second tool call should NOT have reasoning_details
      const secondToolCallProviderOptions = toolCallContents[1]
        ?.providerOptions as
        | Record<string, Record<string, unknown>>
        | undefined;
      const secondReasoningDetails = secondToolCallProviderOptions?.openrouter
        ?.reasoning_details as Array<unknown> | undefined;
      expect(
        secondReasoningDetails === undefined ||
          secondReasoningDetails.length === 0,
      ).toBe(true);
    }

    // Now test that the second request succeeds (this would fail before the fix)
    const secondResult = await streamText({
      model,
      system:
        'You are a helpful assistant. When asked for weather and time, always call BOTH tools in parallel.',
      messages: firstResponse.messages,
      tools: { weatherTool, timeTool },
      providerOptions: {
        openrouter: {
          reasoning: {
            effort: 'medium',
          },
        },
      },
    });

    const secondText = await secondResult.text;

    await writeOutputJsonFile({
      fileName: 'streamText-parallel-secondResponse.ignore.json',
      fileData: {
        text: secondText,
      },
      baseUrl: import.meta.url,
    });

    // The second request should succeed and return meaningful content
    expect(secondText).toBeDefined();
    expect(secondText.length).toBeGreaterThan(0);

    // Verify we got a proper response about weather and/or time
    const lowerText = secondText.toLowerCase();
    const hasRelevantInfo =
      lowerText.includes('72') ||
      lowerText.includes('sunny') ||
      lowerText.includes('weather') ||
      lowerText.includes('san francisco') ||
      lowerText.includes('2:30') ||
      lowerText.includes('time');
    expect(hasRelevantInfo).toBe(true);
  });

  it('should only attach reasoning_details to first tool call with generateText', async () => {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
    });

    const model = openrouter('anthropic/claude-sonnet-4');

    const firstResult = await generateText({
      model,
      system:
        'You are a helpful assistant. When asked for weather and time, always call BOTH tools in parallel.',
      prompt: 'What is the weather in San Francisco and what time is it?',
      tools: { weatherTool, timeTool },
      providerOptions: {
        openrouter: {
          reasoning: {
            effort: 'medium',
          },
        },
      },
    });

    const firstResponse = await firstResult.response;

    await writeOutputJsonFile({
      fileName: 'generateText-parallel-firstResponse.ignore.json',
      fileData: {
        messages: firstResponse.messages,
      },
      baseUrl: import.meta.url,
    });

    const assistantMessage = firstResponse.messages.find(
      (m) => m.role === 'assistant',
    );
    expect(assistantMessage).toBeDefined();

    const assistantContent = assistantMessage?.content;
    expect(Array.isArray(assistantContent)).toBe(true);

    const contentArray = assistantContent as Array<{
      type: string;
      providerOptions?: Record<string, unknown>;
    }>;

    const toolCallContents = contentArray.filter((c) => c.type === 'tool-call');

    // We expect at least one tool call (ideally two for parallel calls)
    expect(toolCallContents.length).toBeGreaterThanOrEqual(1);

    // Count how many tool calls have reasoning_details
    let toolCallsWithReasoningDetails = 0;
    for (const toolCall of toolCallContents) {
      const toolCallProviderOptions = toolCall.providerOptions as
        | Record<string, Record<string, unknown>>
        | undefined;
      const reasoningDetails = toolCallProviderOptions?.openrouter
        ?.reasoning_details as Array<unknown> | undefined;
      if (reasoningDetails && reasoningDetails.length > 0) {
        toolCallsWithReasoningDetails++;
      }
    }

    // Only the first tool call should have reasoning_details
    expect(toolCallsWithReasoningDetails).toBeLessThanOrEqual(1);

    // If we have multiple tool calls, verify only the first has reasoning_details
    if (toolCallContents.length > 1) {
      // Second tool call should NOT have reasoning_details
      const secondToolCallProviderOptions = toolCallContents[1]
        ?.providerOptions as
        | Record<string, Record<string, unknown>>
        | undefined;
      const secondReasoningDetails = secondToolCallProviderOptions?.openrouter
        ?.reasoning_details as Array<unknown> | undefined;
      expect(
        secondReasoningDetails === undefined ||
          secondReasoningDetails.length === 0,
      ).toBe(true);
    }

    // Now test that the second request succeeds (this would fail before the fix)
    const secondResult = await generateText({
      model,
      system:
        'You are a helpful assistant. When asked for weather and time, always call BOTH tools in parallel.',
      messages: firstResponse.messages,
      tools: { weatherTool, timeTool },
      providerOptions: {
        openrouter: {
          reasoning: {
            effort: 'medium',
          },
        },
      },
    });

    await writeOutputJsonFile({
      fileName: 'generateText-parallel-secondResponse.ignore.json',
      fileData: {
        text: secondResult.text,
      },
      baseUrl: import.meta.url,
    });

    // The second request should succeed and return meaningful content
    expect(secondResult.text).toBeDefined();
    expect(secondResult.text.length).toBeGreaterThan(0);

    // Verify we got a proper response about weather and/or time
    const lowerText = secondResult.text.toLowerCase();
    const hasRelevantInfo =
      lowerText.includes('72') ||
      lowerText.includes('sunny') ||
      lowerText.includes('weather') ||
      lowerText.includes('san francisco') ||
      lowerText.includes('2:30') ||
      lowerText.includes('time');
    expect(hasRelevantInfo).toBe(true);
  });
});
