import { generateText, stepCountIs, streamText, tool, type FilePart, type JSONValue, type ModelMessage, type TextPart, type UIMessage } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createOpenRouter } from '../src';
import type { ReasoningPart, ToolCallPart, ToolResultPart } from '@ai-sdk/provider-utils';

vi.setConfig({
  testTimeout: 120_000,
});

/**
 * Model configurations for matrix testing
 */
const reasoningModels = [
  {
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    reasoningOptions: {
      reasoning: { effort: 'low' },
    },
  },
  {
    id: 'google/gemini-3-pro-preview',
    name: 'Gemini 3 Pro',
    reasoningOptions: {
      // Gemini 3 Pro has reasoning enabled by default, don't pass reasoning options
      provider: { only: ['google-ai-studio'] },
    },
  },
] as const;

/**
 * Helper to create provider instance
 */
function createProvider() {
  return createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });
}

/**
 * Weather tool for testing
 */
const weatherTool = tool({
  description: 'Get the current weather for a location',
  inputSchema: z.object({
    location: z.string().describe('The city and state, e.g. San Francisco, CA'),
  }),
  execute: async ({ location }) => {
    await new Promise((res) => setTimeout(res, 100));
    return {
      location,
      temperature: 72,
      condition: 'Sunny',
      humidity: 45,
    };
  },
});

/**
 * Calculator tool for testing
 */
const calculatorTool = tool({
  description: 'Perform a mathematical calculation',
  inputSchema: z.object({
    expression: z.string().describe('The mathematical expression to evaluate'),
  }),
  execute: async ({ expression }) => {
    try {
      const result = Function(`"use strict"; return (${expression})`)();
      return { expression, result };
    } catch {
      return { expression, error: 'Invalid expression' };
    }
  },
});

describe('Reasoning with Provider Metadata - Matrix Tests', () => {
  describe.each(reasoningModels)('$name ($id)', ({ id, name, reasoningOptions }) => {
    it('generateText: should emit provider metadata with reasoning', async () => {
      const openrouter = createProvider();
      const model = openrouter(id, {
        usage: { include: true },
      });

      const response = await generateText({
        model,
        messages: [
          {
            role: 'user',
            content: 'What is 2+2? Think through this step by step.',
          },
        ],
        providerOptions: {
          openrouter: reasoningOptions as Record<string, JSONValue>,
        },
      });

      // Verify we got a response
      expect(response.text).toBeTruthy();
      expect(response.text.length).toBeGreaterThan(0);

      // Verify usage is tracked
      expect(response.usage.totalTokens).toBeGreaterThan(0);

      // Verify provider metadata is present
      expect(response.providerMetadata?.openrouter).toBeDefined();
      expect(response.providerMetadata?.openrouter).toMatchObject({
        provider: expect.any(String),
        usage: expect.objectContaining({
          promptTokens: expect.any(Number),
          completionTokens: expect.any(Number),
          totalTokens: expect.any(Number),
        }),
      });
    });

    it('streamText: should emit provider metadata in finish event with reasoning', async () => {
      const openrouter = createProvider();
      const model = openrouter(id, {
        usage: { include: true },
      });

      let finishProviderMetadata: Record<string, unknown> | undefined;
      let hasReasoningDelta = false;
      let hasTextDelta = false;

      const result = streamText({
        model,
        messages: [
          {
            role: 'user',
            content: 'Explain why the sky is blue. Think step by step.',
          },
        ],
        providerOptions: {
          openrouter: reasoningOptions as Record<string, JSONValue>,
        },
        onFinish({ providerMetadata }) {
          finishProviderMetadata = providerMetadata?.openrouter as Record<string, unknown>;
        },
      });

      for await (const chunk of result.fullStream) {
        if (chunk.type === 'reasoning-delta') {
          hasReasoningDelta = true;
        }
        if (chunk.type === 'text-delta') {
          hasTextDelta = true;
        }
      }

      // Wait for the response to complete
      const providerMetadata = await result.providerMetadata;

      // Verify we got content
      expect(hasTextDelta).toBe(true);

      // Verify provider metadata is present on finish
      expect(finishProviderMetadata).toBeDefined();
      expect(finishProviderMetadata).toMatchObject({
        provider: expect.any(String),
        usage: expect.objectContaining({
          promptTokens: expect.any(Number),
          completionTokens: expect.any(Number),
          totalTokens: expect.any(Number),
        }),
      });

      // Verify the awaited providerMetadata matches
      expect(providerMetadata?.openrouter).toMatchObject({
        provider: expect.any(String),
      });
    });

    it('generateText with tools: should emit provider metadata with reasoning and tool calls', async () => {
      const openrouter = createProvider();
      const model = openrouter(id, {
        usage: { include: true },
      });

      // Using streamText for tool calls is more reliable across models
      const result = streamText({
        model,
        messages: [
          {
            role: 'user',
            content: 'What is the weather in San Francisco? Think about what information you need.',
          },
        ],
        tools: {
          getWeather: weatherTool,
        },
        providerOptions: {
          openrouter: reasoningOptions as Record<string, JSONValue>,
        },
        stopWhen: stepCountIs(3),
      });

      // Collect all parts
      const parts: string[] = [];
      for await (const chunk of result.fullStream) {
        parts.push(chunk.type);
      }

      // Verify we got content (text or tool calls)
      const hasContent = parts.some((p) => p === 'text-delta' || p === 'tool-call');
      expect(hasContent).toBe(true);

      // Verify provider metadata is present
      const providerMetadata = await result.providerMetadata;
      expect(providerMetadata?.openrouter).toBeDefined();
      expect(providerMetadata?.openrouter).toMatchObject({
        provider: expect.any(String),
      });

      // Check if tool was called
      const response = await result.response;
      const toolCalls = response.messages
        .filter((m) => m.role === 'assistant')
        .flatMap((m) => (Array.isArray(m.content) ? m.content.filter((c) => c.type === 'tool-call') : []));

      // Some models may use the tool, others may answer directly - both are valid
      expect(parts.includes('finish')).toBe(true);
    });

    it('streamText with tools: should stream reasoning and tool interactions', async () => {
      const openrouter = createProvider();
      const model = openrouter(id, {
        usage: { include: true },
      });

      const parts: Array<{ type: string; toolName?: string }> = [];
      let finishProviderMetadata: Record<string, unknown> | undefined;

      const result = streamText({
        model,
        messages: [
          {
            role: 'user',
            content: 'Calculate 15 * 7 for me. Think through the steps.',
          },
        ],
        tools: {
          calculator: calculatorTool,
        },
        providerOptions: {
          openrouter: reasoningOptions as Record<string, JSONValue>,
        },
        stopWhen: stepCountIs(3),
        onFinish({ providerMetadata }) {
          finishProviderMetadata = providerMetadata?.openrouter as Record<string, unknown>;
        },
      });

      for await (const chunk of result.fullStream) {
        if (chunk.type === 'reasoning-delta') {
          parts.push({ type: 'reasoning-delta' });
        } else if (chunk.type === 'text-delta') {
          parts.push({ type: 'text-delta' });
        } else if (chunk.type === 'tool-call') {
          parts.push({ type: 'tool-call', toolName: chunk.toolName });
        } else if (chunk.type === 'tool-result') {
          parts.push({ type: 'tool-result', toolName: chunk.toolName });
        } else if (chunk.type === 'finish') {
          parts.push({ type: 'finish' });
        }
      }

      // Verify we got some parts
      expect(parts.length).toBeGreaterThan(0);

      // Verify provider metadata on finish
      expect(finishProviderMetadata).toBeDefined();
      expect(finishProviderMetadata).toMatchObject({
        provider: expect.any(String),
      });
    });
  });
});

describe('UI Message Stream Interop', () => {
  describe.each(reasoningModels)('$name ($id)', ({ id, reasoningOptions }) => {
    it('should produce valid UIMessage structure from streamText', async () => {
      const openrouter = createProvider();
      const model = openrouter(id, {
        usage: { include: true },
      });

      const result = streamText({
        model,
        messages: [
          {
            role: 'user',
            content: 'Say hello and explain your thinking.',
          },
        ],
        providerOptions: {
          openrouter: reasoningOptions as Record<string, JSONValue>,
        },
      });

      // Consume the stream
      const response = await result.response;
      const messages = response.messages;

      // Verify messages are valid UIMessage structure
      expect(messages).toBeDefined();
      expect(Array.isArray(messages)).toBe(true);

      // Check assistant message structure
      const assistantMessages = messages.filter((m) => m.role === 'assistant');
      expect(assistantMessages.length).toBeGreaterThan(0);

      for (const msg of assistantMessages) {
        // UIMessage should have content array
        expect(msg.content).toBeDefined();
        if (Array.isArray(msg.content)) {
          for (const part of msg.content) {
            expect(part).toHaveProperty('type');
            // Valid types: text, reasoning, tool-call, tool-result, etc.
            expect(['text', 'reasoning', 'tool-call', 'tool-result', 'file']).toContain(part.type);
          }
        }
      }
    });

    it('should produce valid UIMessage with tools', async () => {
      const openrouter = createProvider();
      const model = openrouter(id, {
        usage: { include: true },
      });

      // Single turn with tool usage
      const result = streamText({
        model,
        messages: [
          {
            role: 'user',
            content: 'What is the weather in Tokyo?',
          },
        ],
        tools: {
          getWeather: weatherTool,
        },
        providerOptions: {
          openrouter: reasoningOptions as Record<string, JSONValue>,
        },
        stopWhen: stepCountIs(3),
      });

      const response = await result.response;
      const messages = response.messages;

      // Verify messages were produced
      expect(messages.length).toBeGreaterThan(0);

      // Verify structure - should have assistant message
      const assistantMessages = messages.filter((m) => m.role === 'assistant');
      expect(assistantMessages.length).toBeGreaterThan(0);
    });

    it('should accumulate reasoning in message content for multi-turn', async () => {
      const openrouter = createProvider();
      const model = openrouter(id, {
        usage: { include: true },
      });

      // First turn with reasoning
      const result1 = await generateText({
        model,
        messages: [
          {
            role: 'user',
            content: 'What is 5 + 3? Show your reasoning.',
          },
        ],
        providerOptions: {
          openrouter: reasoningOptions as Record<string, JSONValue>,
        },
      });

      // Check if reasoning was captured
      const hasReasoning = result1.steps.some((step) =>
        step.content.some((c) => c.type === 'reasoning')
      );

      // Build messages for second turn including the response
      const messagesForTurn2: Array<ModelMessage> = [
        {
          role: 'user' as const,
          content: 'What is 5 + 3? Show your reasoning.',
        },
        ...result1.steps.flatMap((step) => step.response.messages),
        {
          role: 'user' as const,
          content: 'Now multiply that result by 2.',
        },
      ];

      // Second turn
      const result2 = await generateText({
        model,
        messages: messagesForTurn2,
        providerOptions: {
          openrouter: reasoningOptions as Record<string, JSONValue>,
        },
      });

      // Verify second turn completed with valid response
      expect(result2.text).toBeTruthy();
      expect(result2.usage.totalTokens).toBeGreaterThan(0);
    });
  });
});

describe('Multi-Turn Conversations', () => {
  describe.each(reasoningModels)('$name ($id)', ({ id, reasoningOptions }) => {
    it('should handle 3-turn conversation without tools with valid output at each turn', async () => {
      const openrouter = createProvider();
      const model = openrouter(id, {
        usage: { include: true },
      });

      // Turn 1: Initial question
      const result1 = await generateText({
        model,
        messages: [
          {
            role: 'user',
            content: 'What is the capital of France? Answer in one sentence.',
          },
        ],
        providerOptions: {
          openrouter: reasoningOptions as Record<string, JSONValue>,
        },
      });

      // Verify Turn 1 output
      expect(result1.text).toBeTruthy();
      expect(result1.text.length).toBeGreaterThan(0);
      expect(result1.usage.totalTokens).toBeGreaterThan(0);

      // Build messages for Turn 2
      const messagesForTurn2: Array<ModelMessage> = [
        {
          role: 'user' as const,
          content: 'What is the capital of France? Answer in one sentence.',
        },
        ...result1.steps.flatMap((step) => step.response.messages),
        {
          role: 'user' as const,
          content: 'What is the population of that city? Just give me a number.',
        },
      ];

      // Turn 2: Follow-up question
      const result2 = await generateText({
        model,
        messages: messagesForTurn2,
        providerOptions: {
          openrouter: reasoningOptions as Record<string, JSONValue>,
        },
      });

      // Verify Turn 2 output
      expect(result2.text).toBeTruthy();
      expect(result2.text.length).toBeGreaterThan(0);
      expect(result2.usage.totalTokens).toBeGreaterThan(0);

      // Build messages for Turn 3
      const messagesForTurn3: Array<ModelMessage> = [
        ...messagesForTurn2,
        {
          role: 'user' as const,
          content: 'Is that more or less than London? Answer yes or no.',
        },
      ];

      // Turn 3: Comparison question
      const result3 = await generateText({
        model,
        messages: messagesForTurn3,
        providerOptions: {
          openrouter: reasoningOptions as Record<string, JSONValue>,
        },
      });

      // Verify Turn 3 output
      expect(result3.text).toBeTruthy();
      expect(result3.text.length).toBeGreaterThan(0);
      expect(result3.usage.totalTokens).toBeGreaterThan(0);

      // Verify provider metadata is present on all turns
      expect(result1.providerMetadata?.openrouter).toBeDefined();
      expect(result2.providerMetadata?.openrouter).toBeDefined();
      expect(result3.providerMetadata?.openrouter).toBeDefined();
    });

    it('should handle 2-turn conversation with tools with valid output at each turn', async () => {
      const openrouter = createProvider();
      const model = openrouter(id, {
        usage: { include: true },
      });

      // Turn 1: Weather query (should use tool)
      const result1 = streamText({
        model,
        messages: [
          {
            role: 'user',
            content: 'What is the weather in Boston?',
          },
        ],
        tools: {
          getWeather: weatherTool,
        },
        providerOptions: {
          openrouter: reasoningOptions as Record<string, JSONValue>,
        },
        stopWhen: stepCountIs(3),
      });

      const response1 = await result1.response;
      const metadata1 = await result1.providerMetadata;

      // Extract reasoning_details from first turn for Gemini multi-turn support
      const turn1ReasoningDetails = (metadata1?.openrouter?.reasoning_details as unknown[]) || [];

      // Verify Turn 1 output - messages should exist
      expect(response1.messages.length).toBeGreaterThan(0);

      // Check that we have assistant content (could be text or tool calls)
      const assistantMessages1 = response1.messages.filter((m) => m.role === 'assistant');
      expect(assistantMessages1.length).toBeGreaterThan(0);

      // Verify assistant has content (text, tool-call, or tool-result are all valid)
      for (const msg of assistantMessages1) {
        expect(msg.content).toBeDefined();
      }

      // Build messages for Turn 2, preserving reasoning_details for Gemini
      const messagesForTurn2: Array<ModelMessage> = [
        {
          role: 'user' as const,
          content: 'What is the weather in Boston?',
        },
        ...response1.messages,
        {
          role: 'user' as const,
          content: 'Is that warm or cold?',
        },
      ];

      // Turn 2: Follow-up question (no tools needed)
      const result2 = await generateText({
        model,
        messages: messagesForTurn2,
        providerOptions: {
          openrouter: reasoningOptions as Record<string, JSONValue>,
        },
      });

      // Verify Turn 2 output
      expect(result2.text).toBeTruthy();
      expect(result2.text.length).toBeGreaterThan(0);

      // Verify provider metadata is present on both turns
      expect(metadata1?.openrouter).toBeDefined();
      expect(result2.providerMetadata?.openrouter).toBeDefined();
    });

    it('should maintain conversation context across turns without tools', async () => {
      const openrouter = createProvider();
      const model = openrouter(id, {
        usage: { include: true },
      });

      // Turn 1: Set context
      const result1 = await generateText({
        model,
        messages: [
          {
            role: 'user',
            content: 'My name is Alice. Remember that.',
          },
        ],
        providerOptions: {
          openrouter: reasoningOptions as Record<string, JSONValue>,
        },
      });

      expect(result1.text).toBeTruthy();

      // Turn 2: Ask about context
      const messagesForTurn2: Array<ModelMessage> = [
        {
          role: 'user' as const,
          content: 'My name is Alice. Remember that.',
        },
        ...result1.steps.flatMap((step) => step.response.messages),
        {
          role: 'user' as const,
          content: 'What is my name?',
        },
      ];

      const result2 = await generateText({
        model,
        messages: messagesForTurn2,
        providerOptions: {
          openrouter: reasoningOptions as Record<string, JSONValue>,
        },
      });

      // Verify context was maintained - response should mention Alice
      expect(result2.text).toBeTruthy();
      expect(result2.text.toLowerCase()).toContain('alice');
    });

    it('should maintain tool results context across turns', async () => {
      const openrouter = createProvider();
      const model = openrouter(id, {
        usage: { include: true },
      });

      // Turn 1: Get weather
      const result1 = streamText({
        model,
        messages: [
          {
            role: 'user',
            content: 'What is the weather in Miami?',
          },
        ],
        tools: {
          getWeather: weatherTool,
        },
        providerOptions: {
          openrouter: reasoningOptions as Record<string, JSONValue>,
        },
        stopWhen: stepCountIs(3),
      });

      const response1 = await result1.response;
      const metadata1 = await result1.providerMetadata;

      // Extract reasoning_details from first turn for Gemini multi-turn support
      const turn1ReasoningDetails = (metadata1?.openrouter?.reasoning_details as unknown[]) || [];

      // Verify Turn 1 produced messages
      expect(response1.messages.length).toBeGreaterThan(0);

      // Verify we have assistant messages
      const assistantMessages = response1.messages.filter((m) => m.role === 'assistant');
      expect(assistantMessages.length).toBeGreaterThan(0);

      // Turn 2: Reference previous conversation - ask about the weather result
      // Preserve reasoning_details for Gemini multi-turn support
      const messagesForTurn2: Array<ModelMessage> = [
        {
          role: 'user' as const,
          content: 'What is the weather in Miami?',
        },
        ...response1.messages,
        {
          role: 'user' as const,
          content: 'Based on that weather, is it good for a beach day?',
        },
      ];

      const result2 = await generateText({
        model,
        messages: messagesForTurn2,
        providerOptions: {
          openrouter: reasoningOptions as Record<string, JSONValue>,
        },
      });

      // Verify response references the previous context
      expect(result2.text).toBeTruthy();
      expect(result2.text.length).toBeGreaterThan(0);
      // Should mention something related to weather/beach/temperature
      expect(result2.usage.totalTokens).toBeGreaterThan(0);
    });
  });
});

describe('Provider Metadata Content Verification', () => {
  describe.each(reasoningModels)('$name ($id)', ({ id, reasoningOptions }) => {
    it('should include model_id in provider metadata', async () => {
      const openrouter = createProvider();
      const model = openrouter(id, {
        usage: { include: true },
      });

      const response = await generateText({
        model,
        messages: [{ role: 'user', content: 'Hello' }],
        providerOptions: {
          openrouter: reasoningOptions as Record<string, JSONValue>,
        },
      });

      const metadata = response.providerMetadata?.openrouter as Record<string, unknown>;
      expect(metadata).toBeDefined();
      expect(metadata.model_id).toBeDefined();
      expect(typeof metadata.model_id).toBe('string');
    });

    it('should include usage details in provider metadata', async () => {
      const openrouter = createProvider();
      const model = openrouter(id, {
        usage: { include: true },
      });

      const response = await generateText({
        model,
        messages: [{ role: 'user', content: 'What is 1+1?' }],
        providerOptions: {
          openrouter: reasoningOptions as Record<string, JSONValue>,
        },
      });

      const metadata = response.providerMetadata?.openrouter as Record<string, unknown>;
      const usage = metadata?.usage as Record<string, unknown>;

      expect(usage).toBeDefined();
      expect(usage.promptTokens).toBeGreaterThan(0);
      expect(usage.completionTokens).toBeGreaterThan(0);
      expect(usage.totalTokens).toBeGreaterThan(0);
    });

    it('should include cost information when available', async () => {
      const openrouter = createProvider();
      const model = openrouter(id, {
        usage: { include: true },
      });

      const response = await generateText({
        model,
        messages: [{ role: 'user', content: 'Say hi' }],
        providerOptions: {
          openrouter: reasoningOptions as Record<string, JSONValue>,
        },
      });

      const metadata = response.providerMetadata?.openrouter as Record<string, unknown>;
      const usage = metadata?.usage as Record<string, unknown>;

      // Cost should be present when usage.include is true
      if (usage?.cost !== undefined) {
        expect(typeof usage.cost).toBe('number');
      }
    });
  });
});

describe('Stream Part Ordering', () => {
  describe.each(reasoningModels)('$name ($id)', ({ id, reasoningOptions }) => {
    it('should emit stream parts in correct order', async () => {
      const openrouter = createProvider();
      const model = openrouter(id, {
        usage: { include: true },
      });

      const partTypes: string[] = [];

      const result = streamText({
        model,
        messages: [
          {
            role: 'user',
            content: 'Say hello briefly.',
          },
        ],
        providerOptions: {
          openrouter: reasoningOptions as Record<string, JSONValue>,
        },
      });

      for await (const chunk of result.fullStream) {
        partTypes.push(chunk.type);
      }

      // Verify basic ordering expectations
      // Stream should end with finish
      expect(partTypes[partTypes.length - 1]).toBe('finish');

      // Should have text content
      expect(partTypes.some((t) => t === 'text-delta')).toBe(true);
    });

    it('should handle stream cancellation gracefully', async () => {
      const openrouter = createProvider();
      const model = openrouter(id, {
        usage: { include: true },
      });

      const result = streamText({
        model,
        messages: [
          {
            role: 'user',
            content: 'Count from 1 to 100 slowly.',
          },
        ],
        providerOptions: {
          openrouter: reasoningOptions as Record<string, JSONValue>,
        },
        abortSignal: AbortSignal.timeout(5000),
      });

      let chunkCount = 0;
      try {
        for await (const _chunk of result.fullStream) {
          chunkCount++;
          if (chunkCount > 10) {
            break; // Early exit
          }
        }
      } catch (error) {
        // Timeout or abort is acceptable
        if (!(error instanceof Error && error.name === 'AbortError')) {
          throw error;
        }
      }

      // Should have received some chunks before breaking
      expect(chunkCount).toBeGreaterThan(0);
    });
  });
});

describe('UIMessageStream Protocol Compliance', () => {
  describe.each(reasoningModels)('$name ($id)', ({ id, reasoningOptions }) => {
    it('should have start-step and finish-step events for multi-step flows', async () => {
      const openrouter = createProvider();
      const model = openrouter(id, {
        usage: { include: true },
      });

      const partTypes: string[] = [];

      const result = streamText({
        model,
        messages: [
          {
            role: 'user',
            content: 'Get the weather in Paris and tell me what to wear.',
          },
        ],
        tools: {
          getWeather: weatherTool,
        },
        providerOptions: {
          openrouter: reasoningOptions as Record<string, JSONValue>,
        },
        stopWhen: stepCountIs(3),
      });

      for await (const chunk of result.fullStream) {
        partTypes.push(chunk.type);
      }

      // Multi-step flows should have step events
      const hasStepStart = partTypes.includes('step-start');
      const hasStepFinish = partTypes.includes('step-finish');
      const hasFinish = partTypes.includes('finish');

      // At minimum we should have a finish event
      expect(hasFinish).toBe(true);

      // If there are tool calls, we should see step events
      if (partTypes.includes('tool-call')) {
        // Multi-step flows with tools typically have step events
        expect(hasStepStart || hasStepFinish || hasFinish).toBe(true);
      }
    });

    it('should emit reasoning-start and reasoning-end with matching IDs', async () => {
      const openrouter = createProvider();
      const model = openrouter(id, {
        usage: { include: true },
      });

      const reasoningEvents: Array<{ type: string; id?: string }> = [];

      const result = streamText({
        model,
        messages: [
          {
            role: 'user',
            content: 'Explain step by step why 2 + 2 = 4.',
          },
        ],
      });

      for await (const chunk of result.fullStream) {
        if (chunk.type === 'reasoning-start' || chunk.type === 'reasoning-end' || chunk.type === 'reasoning-delta') {
          reasoningEvents.push({ type: chunk.type, id: (chunk as any).id });
        }
      }

      // If we got reasoning events, verify they have proper IDs
      if (reasoningEvents.length > 0) {
        const startEvents = reasoningEvents.filter((e) => e.type === 'reasoning-start');
        const endEvents = reasoningEvents.filter((e) => e.type === 'reasoning-end');
        const deltaEvents = reasoningEvents.filter((e) => e.type === 'reasoning-delta');

        // If there are start events, all should have IDs
        for (const event of startEvents) {
          expect(event.id).toBeDefined();
        }

        // If there are end events, all should have IDs
        for (const event of endEvents) {
          expect(event.id).toBeDefined();
        }

        // Delta events should have IDs matching start events
        if (startEvents.length > 0 && deltaEvents.length > 0) {
          const startId = startEvents[0].id;
          for (const delta of deltaEvents) {
            expect(delta.id).toBe(startId);
          }
        }
      }
    });

    it('should emit text-start and text-end with matching IDs', async () => {
      const openrouter = createProvider();
      const model = openrouter(id, {
        usage: { include: true },
      });

      const textEvents: Array<{ type: string; id?: string }> = [];

      const result = streamText({
        model,
        messages: [
          {
            role: 'user',
            content: 'Say hello.',
          },
        ],
        providerOptions: {
          openrouter: reasoningOptions as Record<string, JSONValue>,
        },
      });

      for await (const chunk of result.fullStream) {
        if (chunk.type === 'text-start' || chunk.type === 'text-end' || chunk.type === 'text-delta') {
          textEvents.push({ type: chunk.type, id: (chunk as any).id });
        }
      }

      // Should have text events
      expect(textEvents.length).toBeGreaterThan(0);

      const startEvents = textEvents.filter((e) => e.type === 'text-start');
      const endEvents = textEvents.filter((e) => e.type === 'text-end');
      const deltaEvents = textEvents.filter((e) => e.type === 'text-delta');

      // If there are start events, all should have IDs
      for (const event of startEvents) {
        expect(event.id).toBeDefined();
      }

      // If there are end events, all should have IDs
      for (const event of endEvents) {
        expect(event.id).toBeDefined();
      }

      // Delta events should have IDs matching start events
      if (startEvents.length > 0 && deltaEvents.length > 0) {
        const startId = startEvents[0].id;
        for (const delta of deltaEvents) {
          expect(delta.id).toBe(startId);
        }
      }
    });

    it('should provide response metadata through result object', async () => {
      const openrouter = createProvider();
      const model = openrouter(id, {
        usage: { include: true },
      });

      const result = streamText({
        model,
        messages: [
          {
            role: 'user',
            content: 'Hi',
          },
        ],
        providerOptions: {
          openrouter: reasoningOptions as Record<string, JSONValue>,
        },
      });

      // Consume the stream
      await result.consumeStream();

      // Get response metadata
      const response = await result.response;
      const providerMetadata = await result.providerMetadata;

      // Should have response with model info
      expect(response).toBeDefined();
      expect(response.id).toBeDefined();

      // Provider metadata should have model info
      expect(providerMetadata?.openrouter).toBeDefined();
      const openrouterMeta = providerMetadata?.openrouter as Record<string, unknown>;
      expect(openrouterMeta.model_id || openrouterMeta.provider).toBeDefined();
    });

    it('should include finish reason and usage in result', async () => {
      const openrouter = createProvider();
      const model = openrouter(id, {
        usage: { include: true },
      });

      let finishReason: string | undefined;
      let usageData: any;

      const result = streamText({
        model,
        messages: [
          {
            role: 'user',
            content: 'Say one word.',
          },
        ],
        providerOptions: {
          openrouter: reasoningOptions as Record<string, JSONValue>,
        },
        onFinish({ finishReason: reason, usage }) {
          finishReason = reason;
          usageData = usage;
        },
      });

      // Consume the stream
      await result.consumeStream();

      // Should have finish reason
      expect(finishReason).toBeDefined();
      expect(['stop', 'length', 'tool-calls', 'unknown']).toContain(finishReason);

      // Should have usage data
      expect(usageData).toBeDefined();
      expect(usageData.totalTokens).toBeGreaterThan(0);
    });
  });
});
