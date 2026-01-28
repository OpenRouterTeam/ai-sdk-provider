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
 * This test reproduces the EXACT code pattern from the issue report.
 */
import type { ModelMessage, ProviderMetadata } from 'ai';

import { streamText, tool } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 300_000,
});

describe('Issue #381: Gemini reasoning details with tool calls', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  // Use exact model from issue report
  const model = openrouter('google/gemini-3-flash-preview');

  // Tools similar to what the user described (listDirectory, glob, readFile, readFiles)
  const listDirectory = tool({
    description: 'Lists files in a directory',
    inputSchema: z.object({
      path: z.string().describe('The directory path to list'),
    }),
    execute: async ({ path }) => {
      return {
        files: ['file1.ts', 'file2.ts', 'README.md', 'package.json'],
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
        content: `// Contents of ${path}\nexport const example = true;\nexport function main() { console.log('hello'); }`,
        path,
      };
    },
  });

  const glob = tool({
    description: 'Find files matching a pattern',
    inputSchema: z.object({
      pattern: z.string().describe('The glob pattern to match'),
    }),
    execute: async ({ pattern }) => {
      return {
        matches: ['src/index.ts', 'src/utils.ts', 'src/types.ts'],
        pattern,
      };
    },
  });

  /**
   * This test reproduces the EXACT code pattern from issue #381:
   * - Uses fullStream to iterate over events
   * - Manually builds messages array from stream events
   * - Passes providerMetadata on tool-call and tool-result messages
   * - Recursively calls generateResponse on 'tool-calls' finish reason
   */
  it('should handle manual message building from fullStream with providerMetadata (exact issue pattern)', async () => {
    // This matches the user's code pattern exactly
    const messages: ModelMessage[] = [];
    let generationCount = 0;
    const maxGenerations = 5; // Limit to prevent infinite loops
    let lastError: Error | null = null;

    const generateResponse = async (): Promise<void> => {
      generationCount++;
      if (generationCount > maxGenerations) {
        return;
      }

      try {
        const response = streamText({
          model,
          messages:
            messages.length > 0
              ? messages
              : [
                  {
                    role: 'user',
                    content:
                      'Can you please explore the codebase located at ~/Code/veridian and give me an overview of it?',
                  },
                ],
          tools: { listDirectory, readFile, glob },
          providerOptions: {
            openrouter: {
              includeReasoning: true,
            },
          },
        });

        // Track accumulated content for text/reasoning parts
        let accumulatedText = '';
        let textProviderMetadata: ProviderMetadata | undefined;

        for await (const token of response.fullStream) {
          switch (token.type) {
            case 'text-delta':
              accumulatedText += token.text;
              break;

            case 'tool-call':
              // Exact pattern from issue: push assistant message with tool call
              messages.push({
                role: 'assistant',
                content: [
                  {
                    type: 'tool-call',
                    toolCallId: token.toolCallId,
                    toolName: token.toolName,
                    input: token.input,
                    providerOptions: token.providerMetadata,
                  },
                ],
                providerOptions: token.providerMetadata,
              });
              break;

            case 'tool-result':
              // Exact pattern from issue: push tool message with result
              messages.push({
                role: 'tool',
                content: [
                  {
                    type: 'tool-result',
                    toolCallId: token.toolCallId,
                    toolName: token.toolName,
                    output: {
                      type: 'text',
                      value:
                        typeof token.output === 'string'
                          ? token.output
                          : JSON.stringify(token.output, null, 2),
                    },
                    providerOptions: token.providerMetadata,
                  },
                ],
                providerOptions: token.providerMetadata,
              });
              break;

            case 'finish':
              // Add any accumulated text as assistant message
              if (accumulatedText) {
                messages.push({
                  role: 'assistant',
                  content: accumulatedText,
                  providerOptions: textProviderMetadata,
                });
              }

              // Exact pattern from issue: recursive call on tool-calls finish
              if (token.finishReason === 'tool-calls') {
                await generateResponse();
              }
              break;

            case 'error':
              lastError = new Error(String(token.error));
              break;
          }
        }
      } catch (error) {
        lastError = error as Error;
        throw error;
      }
    };

    // Run the generation loop (matching the user's pattern)
    await generateResponse();

    // Verify we completed without the "reasoning details must be preserved" error
    if (lastError) {
      // If we got the specific error from the issue, the test should fail
      const errorMessage = (lastError as Error).message;
      expect(errorMessage).not.toContain(
        'Gemini models require OpenRouter reasoning details to be preserved',
      );
    }

    // We should have made multiple generations (tool calls)
    expect(generationCount).toBeGreaterThan(1);
    expect(messages.length).toBeGreaterThan(0);
  });

  /**
   * Comparison test using response.messages (the recommended approach)
   * This should always work - if it fails, there's a fundamental issue
   */
  it('should work with response.messages (recommended approach)', async () => {
    const firstResult = await streamText({
      model,
      system:
        'You are a helpful assistant that explores codebases. Use the tools to explore.',
      prompt:
        'Can you please explore the codebase located at ~/Code/veridian and give me an overview of it?',
      tools: { listDirectory, readFile, glob },
      providerOptions: {
        openrouter: {
          includeReasoning: true,
        },
      },
    });

    const firstResponse = await firstResult.response;
    expect(firstResponse.messages).toBeDefined();

    // Second request using response.messages
    const secondResult = await streamText({
      model,
      system:
        'You are a helpful assistant that explores codebases. Use the tools to explore.',
      messages: firstResponse.messages,
      tools: { listDirectory, readFile, glob },
      providerOptions: {
        openrouter: {
          includeReasoning: true,
        },
      },
    });

    const secondResponse = await secondResult.response;
    expect(secondResponse.messages).toBeDefined();

    // Third request
    const thirdResult = await streamText({
      model,
      system:
        'You are a helpful assistant that explores codebases. Use the tools to explore.',
      messages: secondResponse.messages,
      tools: { listDirectory, readFile, glob },
      providerOptions: {
        openrouter: {
          includeReasoning: true,
        },
      },
    });

    const thirdText = await thirdResult.text;
    expect(thirdText).toBeDefined();
  });
});
