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
});
