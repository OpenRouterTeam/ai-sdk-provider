/**
 * Test for Gemini multi-turn tool calls with reasoning/thinking enabled
 *
 * This test verifies that when using Gemini models with thinking enabled,
 * the reasoning_details (thoughtSignature) are properly preserved in tool calls
 * and can be sent back in multi-turn conversations.
 *
 * The providerOptions containing reasoning_details must be preserved when
 * passing response.messages from a first request to a second request,
 * otherwise Gemini will reject the continuation.
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

describe('Gemini multi-turn tool calls with reasoning', () => {
  it('should preserve reasoning_details with streamText', async () => {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
    });

    const model = openrouter('google/gemini-3-flash-preview');

    const firstResult = await streamText({
      model,
      system:
        'You are a helpful weather assistant. Use the weatherTool to answer weather questions.',
      prompt: 'What is the weather in San Francisco?',
      tools: { weatherTool },
      providerOptions: {
        openrouter: {
          includeReasoning: true,
        },
      },
    });

    const firstResponse = await firstResult.response;

    await writeOutputJsonFile({
      fileName: 'streamText-firstResponse.ignore.json',
      fileData: {
        messages: firstResponse.messages,
        text: firstResult.text,
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
    const toolCallContent = contentArray.find((c) => c.type === 'tool-call');
    expect(toolCallContent).toBeDefined();

    const toolCallProviderOptions = toolCallContent?.providerOptions as
      | Record<string, Record<string, unknown>>
      | undefined;

    expect(toolCallProviderOptions).toBeDefined();

    const reasoningDetails = toolCallProviderOptions?.openrouter
      ?.reasoning_details as
      | Array<{ type: string; data?: string; format?: string }>
      | undefined;

    expect(reasoningDetails).toBeDefined();
    expect(Array.isArray(reasoningDetails)).toBe(true);
    expect(reasoningDetails?.length).toBeGreaterThan(0);

    const firstReasoningDetail = reasoningDetails?.[0];
    expect(firstReasoningDetail?.type).toBe('reasoning.encrypted');
    expect(firstReasoningDetail?.data).toBeDefined();
    expect(firstReasoningDetail?.format).toBe('google-gemini-v1');

    const secondResult = await streamText({
      model,
      system:
        'You are a helpful weather assistant. Use the weatherTool to answer weather questions.',
      messages: firstResponse.messages,
      tools: { weatherTool },
      providerOptions: {
        openrouter: {
          includeReasoning: true,
        },
      },
    });

    const secondText = await secondResult.text;

    expect(secondText).toBeDefined();
    expect(secondText.length).toBeGreaterThan(0);

    const lowerText = secondText.toLowerCase();
    const hasWeatherInfo =
      lowerText.includes('72') ||
      lowerText.includes('sunny') ||
      lowerText.includes('weather') ||
      lowerText.includes('san francisco');
    expect(hasWeatherInfo).toBe(true);
  });

  it('should preserve reasoning_details with generateText', async () => {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
    });

    const model = openrouter('google/gemini-3-flash-preview');

    const firstResult = await generateText({
      model,
      system:
        'You are a helpful weather assistant. Use the weatherTool to answer weather questions.',
      prompt: 'What is the weather in San Francisco?',
      tools: { weatherTool },
      providerOptions: {
        openrouter: {
          includeReasoning: true,
        },
      },
    });

    const firstResponse = await firstResult.response;

    await writeOutputJsonFile({
      fileName: 'generateText-firstResponse.ignore.json',
      fileData: {
        messages: firstResponse.messages,
        text: firstResult.text,
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
    const toolCallContent = contentArray.find((c) => c.type === 'tool-call');
    expect(toolCallContent).toBeDefined();

    const toolCallProviderOptions = toolCallContent?.providerOptions as
      | Record<string, Record<string, unknown>>
      | undefined;

    expect(toolCallProviderOptions).toBeDefined();

    const reasoningDetails = toolCallProviderOptions?.openrouter
      ?.reasoning_details as
      | Array<{ type: string; data?: string; format?: string }>
      | undefined;

    expect(reasoningDetails).toBeDefined();
    expect(Array.isArray(reasoningDetails)).toBe(true);
    expect(reasoningDetails?.length).toBeGreaterThan(0);

    const firstReasoningDetail = reasoningDetails?.[0];
    expect(firstReasoningDetail?.type).toBe('reasoning.encrypted');
    expect(firstReasoningDetail?.data).toBeDefined();
    expect(firstReasoningDetail?.format).toBe('google-gemini-v1');

    const secondResult = await generateText({
      model,
      system:
        'You are a helpful weather assistant. Use the weatherTool to answer weather questions.',
      messages: firstResponse.messages,
      tools: { weatherTool },
      providerOptions: {
        openrouter: {
          includeReasoning: true,
        },
      },
    });

    expect(secondResult.text).toBeDefined();
    expect(secondResult.text.length).toBeGreaterThan(0);

    const lowerText = secondResult.text.toLowerCase();
    const hasWeatherInfo =
      lowerText.includes('72') ||
      lowerText.includes('sunny') ||
      lowerText.includes('weather') ||
      lowerText.includes('san francisco');
    expect(hasWeatherInfo).toBe(true);
  });
});
