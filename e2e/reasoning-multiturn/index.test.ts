import { stepCountIs, streamText, tool } from 'ai';
import { describe, it } from 'vitest';
import { z } from 'zod/v4';
import { writeOutputJsonFile } from '@/e2e/utils';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 42_000,
});

describe('Vercel AI SDK tools call with reasoning', () => {
  it('should work with reasoning content', async () => {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
      extraBody: {
        reasoning: {
          exclude: false,
          max_tokens: 3500,
        },
      },
    });

    const model = openrouter('anthropic/claude-sonnet-4.5');

    const stream = streamText({
      system:
        'You are a helpful assistant. You must call the test_tool once on every request.',
      model,
      messages: [
        {
          role: 'user',
          content: 'Hello, how are you today?',
        },
      ],
      maxOutputTokens: 64000,
      stopWhen: stepCountIs(5),
      tools: {
        test_tool: tool({
          description:
            'A test tool that you MUST call once on every single request before responding. Always call this tool first.',
          inputSchema: z.object({
            message: z.string().describe('Any message to pass to the tool'),
          }),
          execute: async () => {
            return "Tool was called successfully! Don't call anymore this tool and provide an answer to the user.";
          },
        }),
      },
      onError: (e: unknown) => {
        writeOutputJsonFile({
          fileName: 'error.ignore.json',
          fileData: e,
          baseUrl: import.meta.url,
        });
        expect(e).toBeUndefined();
      },
      onStepFinish: async (event) => {
        await writeOutputJsonFile({
          fileName: 'finish.ignore.json',
          fileData: event,
          baseUrl: import.meta.url,
        });
      },
    });

    await stream.consumeStream();
  });

  it('should handle parallel tool calls with reasoning (deduplication test)', async () => {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
      extraBody: {
        reasoning: {
          exclude: false,
          max_tokens: 3500,
        },
      },
    });

    const model = openrouter('anthropic/claude-sonnet-4.5');

    let finishEventCount = 0;
    let hasReasoningDetails = false;

    const stream = streamText({
      system:
        'You are a helpful assistant with SQL query capabilities. You can execute multiple queries in parallel.',
      model,
      messages: [
        {
          role: 'user',
          content:
            'Please execute 2 parallel SQL queries: SELECT 1 and SELECT 2. Use the execute_query tool for both.',
        },
      ],
      maxOutputTokens: 64000,
      stopWhen: stepCountIs(3),
      tools: {
        execute_query: tool({
          description: 'Executes a SQL query and returns the result',
          inputSchema: z.object({
            query: z.string().describe('The SQL query to execute'),
          }),
          execute: async ({ query }) => {
            return {
              result: `Executed: ${query}`,
              rows: [{ value: query.includes('1') ? 1 : 2 }],
            };
          },
        }),
      },
      onError: (e: unknown) => {
        writeOutputJsonFile({
          fileName: 'error-parallel.ignore.json',
          fileData: e,
          baseUrl: import.meta.url,
        });
        expect(e).toBeUndefined();
      },
      onStepFinish: async (event) => {
        await writeOutputJsonFile({
          fileName: `finish-parallel-${finishEventCount}.ignore.json`,
          fileData: event,
          baseUrl: import.meta.url,
        });

        finishEventCount++;

        // Check if reasoning_details exist in providerMetadata
        if (event.providerMetadata?.openrouter?.reasoning_details) {
          hasReasoningDetails = true;
        }

        // Verify finishReason is not 'unknown'
        expect(event.finishReason).not.toBe('unknown');

        // Verify usage is not empty
        expect(event.usage).toBeDefined();
        expect(event.usage.totalTokens).toBeGreaterThan(0);
      },
    });

    await stream.consumeStream();

    // Verify we got finish events and reasoning was present
    expect(finishEventCount).toBeGreaterThan(0);
    expect(hasReasoningDetails).toBe(true);
  });

  it('should handle sequential tool calls with reasoning (preservation test)', async () => {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
      extraBody: {
        reasoning: {
          exclude: false,
          max_tokens: 3500,
        },
      },
    });

    const model = openrouter('anthropic/claude-sonnet-4.5');

    let finishEventCount = 0;
    let reasoningDetailsCount = 0;

    const stream = streamText({
      system:
        'You are a helpful assistant. You will be asked to perform multiple sequential tasks. Call one tool, wait for the result, then call the next tool based on the result.',
      model,
      messages: [
        {
          role: 'user',
          content:
            'First, search for "user data" using search_data. Then, based on the result, analyze it using analyze_data.',
        },
      ],
      maxOutputTokens: 64000,
      stopWhen: stepCountIs(5),
      tools: {
        search_data: tool({
          description: 'Searches for data based on a query',
          inputSchema: z.object({
            query: z.string().describe('The search query'),
          }),
          execute: async ({ query }) => {
            return { found: true, data: `Results for "${query}"`, count: 42 };
          },
        }),
        analyze_data: tool({
          description: 'Analyzes data and provides insights',
          inputSchema: z.object({
            data: z.string().describe('The data to analyze'),
          }),
          execute: async ({ data }) => {
            return {
              analysis: `Analyzed: ${data}`,
              insights: ['Pattern A', 'Pattern B'],
            };
          },
        }),
      },
      onError: (e: unknown) => {
        writeOutputJsonFile({
          fileName: 'error-sequential.ignore.json',
          fileData: e,
          baseUrl: import.meta.url,
        });
        expect(e).toBeUndefined();
      },
      onStepFinish: async (event) => {
        await writeOutputJsonFile({
          fileName: `finish-sequential-${finishEventCount}.ignore.json`,
          fileData: event,
          baseUrl: import.meta.url,
        });

        finishEventCount++;

        // Count reasoning_details occurrences
        if (event.providerMetadata?.openrouter?.reasoning_details) {
          reasoningDetailsCount++;
        }

        // Verify finishReason is not 'unknown'
        expect(event.finishReason).not.toBe('unknown');

        // Verify usage is not empty
        expect(event.usage).toBeDefined();
        expect(event.usage.totalTokens).toBeGreaterThan(0);
      },
    });

    await stream.consumeStream();

    // Verify we got multiple finish events with reasoning
    expect(finishEventCount).toBeGreaterThan(1);
    expect(reasoningDetailsCount).toBeGreaterThan(0);
  });
});
