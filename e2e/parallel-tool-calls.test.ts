/**
 * Parameterized tests for parallel tool calls across different providers
 *
 * This test verifies that parallel tool calls (multiple tools called at once)
 * work correctly across different providers and API methods.
 *
 * For providers with reasoning/thinking enabled (Claude, Gemini), it also verifies:
 * 1. reasoning_details are only attached to the first tool call (not duplicated)
 * 2. The first tool call has valid, non-empty reasoning_details
 * 3. Continuation requests succeed (the main symptom of issue #339)
 *
 * This addresses the bug where duplicate thinking blocks caused Anthropic to reject
 * continuation requests with "thinking or redacted_thinking blocks cannot be modified".
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

interface ProviderConfig {
  name: string;
  model: string;
  providerOptions:
    | { openrouter: { reasoning: { effort: string } } }
    | { openrouter: { includeReasoning: boolean } }
    | undefined;
  hasReasoning: boolean;
}

const providersWithReasoning: ProviderConfig[] = [
  {
    name: 'claude',
    model: 'anthropic/claude-haiku-4.5',
    providerOptions: { openrouter: { reasoning: { effort: 'medium' } } },
    hasReasoning: true,
  },
  {
    name: 'gemini',
    model: 'google/gemini-3-flash-preview',
    providerOptions: { openrouter: { includeReasoning: true } },
    hasReasoning: true,
  },
];

const providersWithoutReasoning: ProviderConfig[] = [
  {
    name: 'openai',
    model: 'openai/gpt-4o-mini',
    providerOptions: undefined,
    hasReasoning: false,
  },
];

/**
 * Verifies reasoning_details handling for parallel tool calls:
 * 1. First tool call should have non-empty reasoning_details
 * 2. Subsequent tool calls should NOT have reasoning_details (to avoid duplication)
 */
function verifyReasoningDetailsDeduplication(
  toolCallContents: Array<{
    type: string;
    providerOptions?: Record<string, unknown>;
  }>,
): void {
  // Must have at least 2 tool calls for this to be a "parallel" test
  expect(toolCallContents.length).toBeGreaterThanOrEqual(2);

  // Get reasoning_details from first tool call
  const firstToolCallProviderOptions = toolCallContents[0]?.providerOptions as
    | Record<string, Record<string, unknown>>
    | undefined;
  const firstReasoningDetails = firstToolCallProviderOptions?.openrouter
    ?.reasoning_details as Array<unknown> | undefined;

  // First tool call MUST have non-empty reasoning_details
  expect(firstReasoningDetails).toBeDefined();
  expect(Array.isArray(firstReasoningDetails)).toBe(true);
  expect(firstReasoningDetails!.length).toBeGreaterThan(0);

  // Verify reasoning_details contains valid structure (has type field)
  const firstReasoningItem = firstReasoningDetails![0] as Record<
    string,
    unknown
  >;
  expect(firstReasoningItem).toHaveProperty('type');

  // All subsequent tool calls should NOT have reasoning_details
  for (let i = 1; i < toolCallContents.length; i++) {
    const toolCallProviderOptions = toolCallContents[i]?.providerOptions as
      | Record<string, Record<string, unknown>>
      | undefined;
    const reasoningDetails = toolCallProviderOptions?.openrouter
      ?.reasoning_details as Array<unknown> | undefined;

    expect(
      reasoningDetails === undefined || reasoningDetails.length === 0,
    ).toBe(true);
  }
}

/**
 * Verifies parallel tool calls work (without reasoning_details checks)
 */
function verifyParallelToolCalls(
  toolCallContents: Array<{
    type: string;
    providerOptions?: Record<string, unknown>;
  }>,
): void {
  // Should have at least 1 tool call (ideally 2 for parallel)
  expect(toolCallContents.length).toBeGreaterThanOrEqual(1);
}

function verifyResponseContent(text: string): void {
  expect(text).toBeDefined();
  expect(text.length).toBeGreaterThan(0);

  const lowerText = text.toLowerCase();
  const hasRelevantInfo =
    lowerText.includes('72') ||
    lowerText.includes('sunny') ||
    lowerText.includes('weather') ||
    lowerText.includes('san francisco') ||
    lowerText.includes('2:30') ||
    lowerText.includes('time');
  expect(hasRelevantInfo).toBe(true);
}

describe('Parallel tool calls', () => {
  describe('with reasoning enabled (Claude, Gemini)', () => {
    describe.each(providersWithReasoning)('$name', ({
      name,
      model,
      providerOptions,
    }) => {
      it('should deduplicate reasoning_details with streamText', async () => {
        const openrouter = createOpenRouter({
          apiKey: process.env.OPENROUTER_API_KEY,
          baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
        });

        // First request - should trigger parallel tool calls with reasoning
        const firstResult = await streamText({
          model: openrouter(model),
          system:
            'You are a helpful assistant. When asked for weather and time, always call BOTH tools in parallel.',
          prompt: 'What is the weather in San Francisco and what time is it?',
          tools: { weatherTool, timeTool },
          providerOptions,
        });

        const firstResponse = await firstResult.response;

        await writeOutputJsonFile({
          fileName: `${name}-streamText-reasoning-firstResponse.ignore.json`,
          fileData: { messages: firstResponse.messages },
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

        const toolCallContents = contentArray.filter(
          (c) => c.type === 'tool-call',
        );

        // Verify reasoning_details deduplication (first has it, others don't)
        verifyReasoningDetailsDeduplication(toolCallContents);

        // Second request - continuation should succeed (this was the bug symptom)
        const secondResult = await streamText({
          model: openrouter(model),
          system:
            'You are a helpful assistant. When asked for weather and time, always call BOTH tools in parallel.',
          messages: firstResponse.messages,
          tools: { weatherTool, timeTool },
          providerOptions,
        });

        const secondText = await secondResult.text;

        await writeOutputJsonFile({
          fileName: `${name}-streamText-reasoning-secondResponse.ignore.json`,
          fileData: { text: secondText },
          baseUrl: import.meta.url,
        });

        // Verify continuation succeeded with relevant content
        verifyResponseContent(secondText);
      });

      it('should deduplicate reasoning_details with generateText', async () => {
        const openrouter = createOpenRouter({
          apiKey: process.env.OPENROUTER_API_KEY,
          baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
        });

        // First request - should trigger parallel tool calls with reasoning
        const firstResult = await generateText({
          model: openrouter(model),
          system:
            'You are a helpful assistant. When asked for weather and time, always call BOTH tools in parallel.',
          prompt: 'What is the weather in San Francisco and what time is it?',
          tools: { weatherTool, timeTool },
          providerOptions,
        });

        const firstResponse = await firstResult.response;

        await writeOutputJsonFile({
          fileName: `${name}-generateText-reasoning-firstResponse.ignore.json`,
          fileData: { messages: firstResponse.messages },
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

        const toolCallContents = contentArray.filter(
          (c) => c.type === 'tool-call',
        );

        // Verify reasoning_details deduplication (first has it, others don't)
        verifyReasoningDetailsDeduplication(toolCallContents);

        // Second request - continuation should succeed (this was the bug symptom)
        const secondResult = await generateText({
          model: openrouter(model),
          system:
            'You are a helpful assistant. When asked for weather and time, always call BOTH tools in parallel.',
          messages: firstResponse.messages,
          tools: { weatherTool, timeTool },
          providerOptions,
        });

        await writeOutputJsonFile({
          fileName: `${name}-generateText-reasoning-secondResponse.ignore.json`,
          fileData: { text: secondResult.text },
          baseUrl: import.meta.url,
        });

        // Verify continuation succeeded with relevant content
        verifyResponseContent(secondResult.text);
      });
    });
  });

  describe('without reasoning (OpenAI)', () => {
    describe.each(providersWithoutReasoning)('$name', ({
      name,
      model,
      providerOptions,
    }) => {
      it('should handle parallel tool calls with streamText', async () => {
        const openrouter = createOpenRouter({
          apiKey: process.env.OPENROUTER_API_KEY,
          baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
        });

        const firstResult = await streamText({
          model: openrouter(model),
          system:
            'You are a helpful assistant. When asked for weather and time, always call BOTH tools in parallel.',
          prompt: 'What is the weather in San Francisco and what time is it?',
          tools: { weatherTool, timeTool },
          providerOptions,
        });

        const firstResponse = await firstResult.response;

        await writeOutputJsonFile({
          fileName: `${name}-streamText-parallel-firstResponse.ignore.json`,
          fileData: { messages: firstResponse.messages },
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

        const toolCallContents = contentArray.filter(
          (c) => c.type === 'tool-call',
        );

        verifyParallelToolCalls(toolCallContents);

        const secondResult = await streamText({
          model: openrouter(model),
          system:
            'You are a helpful assistant. When asked for weather and time, always call BOTH tools in parallel.',
          messages: firstResponse.messages,
          tools: { weatherTool, timeTool },
          providerOptions,
        });

        const secondText = await secondResult.text;

        await writeOutputJsonFile({
          fileName: `${name}-streamText-parallel-secondResponse.ignore.json`,
          fileData: { text: secondText },
          baseUrl: import.meta.url,
        });

        verifyResponseContent(secondText);
      });

      it('should handle parallel tool calls with generateText', async () => {
        const openrouter = createOpenRouter({
          apiKey: process.env.OPENROUTER_API_KEY,
          baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
        });

        const firstResult = await generateText({
          model: openrouter(model),
          system:
            'You are a helpful assistant. When asked for weather and time, always call BOTH tools in parallel.',
          prompt: 'What is the weather in San Francisco and what time is it?',
          tools: { weatherTool, timeTool },
          providerOptions,
        });

        const firstResponse = await firstResult.response;

        await writeOutputJsonFile({
          fileName: `${name}-generateText-parallel-firstResponse.ignore.json`,
          fileData: { messages: firstResponse.messages },
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

        const toolCallContents = contentArray.filter(
          (c) => c.type === 'tool-call',
        );

        verifyParallelToolCalls(toolCallContents);

        const secondResult = await generateText({
          model: openrouter(model),
          system:
            'You are a helpful assistant. When asked for weather and time, always call BOTH tools in parallel.',
          messages: firstResponse.messages,
          tools: { weatherTool, timeTool },
          providerOptions,
        });

        await writeOutputJsonFile({
          fileName: `${name}-generateText-parallel-secondResponse.ignore.json`,
          fileData: { text: secondResult.text },
          baseUrl: import.meta.url,
        });

        verifyResponseContent(secondResult.text);
      });
    });
  });
});
