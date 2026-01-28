/**
 * Regression test for GitHub issue #381
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/381
 *
 * Issue: "Gemini 3 flash returns a signature error despite proxying providerMetadata exactly"
 *
 * Reported error: "Gemini models require OpenRouter reasoning details to be preserved in each request."
 *
 * The user reported that when using streamText with google/gemini-3-flash-preview and tools,
 * after some number of tool calls (ranging from 1 to around a dozen), the error occurs
 * even when passing providerMetadata/providerOptions everywhere in the message history.
 *
 * The user manually builds the message array from fullStream events, preserving
 * providerMetadata on tool-call and tool-result messages.
 *
 * This test verifies that multi-turn tool calls with Gemini work correctly when
 * reasoning details are preserved in the message history.
 */
import { streamText, tool } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 180_000,
});

describe('Issue #381: Gemini reasoning details with tool calls', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  // Use exact model from issue report
  const model = openrouter('google/gemini-3-flash-preview');

  // Simple tools similar to what the user described (listDirectory, glob, readFile, readFiles)
  const listDirectory = tool({
    description: 'Lists files in a directory',
    inputSchema: z.object({
      path: z.string().describe('The directory path to list'),
    }),
    execute: async ({ path }) => {
      return {
        files: ['file1.ts', 'file2.ts', 'README.md'],
        path,
      };
    },
  });

  const readFile = tool({
    description: 'Reads the contents of a file',
    inputSchema: z.object({
      path: z.string().describe('The file path to read'),
    }),
    execute: async ({ path }) => {
      return {
        content: `// Contents of ${path}\nexport const example = true;`,
        path,
      };
    },
  });

  it('should preserve reasoning details across multiple tool calls using response.messages', async () => {
    // First request - should trigger a tool call
    const firstResult = await streamText({
      model,
      system:
        'You are a helpful assistant that explores codebases. Use the listDirectory tool to see files.',
      prompt:
        'Please list the files in the /src directory and tell me what you find.',
      tools: { listDirectory, readFile },
      providerOptions: {
        openrouter: {
          includeReasoning: true,
        },
      },
    });

    const firstResponse = await firstResult.response;

    // Verify first response has messages with reasoning details
    expect(firstResponse.messages).toBeDefined();
    expect(firstResponse.messages.length).toBeGreaterThan(0);

    // Second request using response.messages (the recommended approach)
    // This should work without the "reasoning details must be preserved" error
    const secondResult = await streamText({
      model,
      system:
        'You are a helpful assistant that explores codebases. Use the listDirectory tool to see files.',
      messages: firstResponse.messages,
      tools: { listDirectory, readFile },
      providerOptions: {
        openrouter: {
          includeReasoning: true,
        },
      },
    });

    const secondResponse = await secondResult.response;

    // Should complete without errors
    expect(secondResponse.messages).toBeDefined();

    // Third request to simulate more tool calls
    const thirdResult = await streamText({
      model,
      system:
        'You are a helpful assistant that explores codebases. Use the listDirectory tool to see files.',
      messages: secondResponse.messages,
      tools: { listDirectory, readFile },
      providerOptions: {
        openrouter: {
          includeReasoning: true,
        },
      },
    });

    const thirdText = await thirdResult.text;

    // Should complete without the "reasoning details must be preserved" error
    expect(thirdText).toBeDefined();
  });

  it('should handle multiple sequential tool calls without reasoning details error', async () => {
    // This test simulates the user's scenario of multiple tool calls in sequence
    // The issue reported that after 1 to around a dozen tool calls, the error occurs

    // First request
    const firstResult = await streamText({
      model,
      system:
        'You are a helpful assistant. Use the listDirectory and readFile tools to explore.',
      prompt: 'List the files in /src directory.',
      tools: { listDirectory, readFile },
      providerOptions: {
        openrouter: {
          includeReasoning: true,
        },
      },
    });

    const firstResponse = await firstResult.response;
    let currentMessages = firstResponse.messages;

    // Perform multiple follow-up requests (simulating the user's agentic loop)
    const followUpPrompts = [
      'Now read the file1.ts file.',
      'What about file2.ts?',
      'Can you summarize what you found?',
    ];

    for (const followUpPrompt of followUpPrompts) {
      // Add user message to continue the conversation
      const messagesWithFollowUp = [
        ...currentMessages,
        { role: 'user' as const, content: followUpPrompt },
      ];

      const result = await streamText({
        model,
        system:
          'You are a helpful assistant. Use the listDirectory and readFile tools to explore.',
        messages: messagesWithFollowUp,
        tools: { listDirectory, readFile },
        providerOptions: {
          openrouter: {
            includeReasoning: true,
          },
        },
      });

      const response = await result.response;

      // Should complete without the "reasoning details must be preserved" error
      expect(response.messages).toBeDefined();
      expect(response.messages.length).toBeGreaterThan(0);

      // Update messages for next iteration
      currentMessages = response.messages;
    }

    // Final verification - we should have completed all iterations without error
    expect(currentMessages.length).toBeGreaterThan(0);
  });
});
