import { streamText, tool } from 'ai';
import { readFile } from 'fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 120_000,
});

describe.skip('Gemini 3 multi-turn conversation with reasoning via OpenRouter', () => {
  it('should extract, preserve, and pass reasoning_details across 3 turns with tool errors', async () => {
    console.log(
      'testing multi-turn conversation with tool error via OpenRouter\n',
    );
    console.log(
      'this test verifies that reasoning_details from gemini 3 pro are:',
    );
    console.log(
      '1. extracted from OpenRouter API responses (including raw chunks)',
    );
    console.log('2. preserved through tool execution (including errors)');
    console.log('3. included in conversation history for multi-turn context\n');

    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: `http://127.0.0.1:54321/api/v1`,
    });

    const model = openrouter('google/gemini-3-pro-preview', {
      usage: {
        include: true,
      },
    });

    console.log('=== turn 1: tool call that will naturally fail ===');
    const turn1 = streamText({
      model,
      tools: {
        readuserdata: tool({
          description: 'read user data from file',
          inputSchema: z.object({
            userId: z.string(),
          }),
          execute: async ({ userId }) => {
            const data = await readFile(
              `/nonexistent/user-${userId}.json`,
              'utf-8',
            );
            return JSON.parse(data);
          },
        }),
      },
      prompt: 'read data for user 123',
      providerOptions: {
        openrouter: {
          reasoning: {
            exclude: false,
          },
          provider: {
            only: ['google-ai-studio'],
          },
        },
      },
      onStepFinish: ({ toolCalls, content }) => {
        if (toolCalls) {
          console.log(`\ntool calls: ${toolCalls.length}`);
          toolCalls.forEach((call) => {
            const details =
              call.providerMetadata?.openrouter?.reasoning_details;
            console.log(
              `  ${call.toolName}: ${details && Array.isArray(details) && details.length > 0 ? `✓ reasoning_details present (${details.length} items)` : '❌ NO REASONING_DETAILS'}`,
            );
          });
        }
        const toolResultParts = content.filter(
          (part) => part.type === 'tool-result',
        );
        if (toolResultParts.length > 0) {
          console.log(`\ntool results: ${toolResultParts.length}`);
          toolResultParts.forEach((part) => {
            if (part.type === 'tool-result') {
              const details =
                part.providerMetadata?.openrouter?.reasoning_details;
              console.log(
                `  ${part.toolName} result: ${details && Array.isArray(details) && details.length > 0 ? `✓ reasoning_details preserved (${details.length} items)` : '❌ NO REASONING_DETAILS'}`,
              );
            }
          });
        }
      },
    });

    console.log('\nturn 1 response:');

    let turn1ReasoningDetails: any[] = [];
    for await (const chunk of turn1.fullStream) {
      if (chunk.type === 'text-delta') {
        process.stdout.write(chunk.text);
      }
    }

    const response1 = await turn1.response;
    const providerMetadata1 = await turn1.providerMetadata;
    turn1ReasoningDetails =
      (providerMetadata1?.openrouter?.reasoning_details as any[]) || [];

    console.log('\n\nmessages after turn 1:');
    console.log(JSON.stringify(response1.messages, null, 2));

    // Verify reasoning_details were captured in turn 1
    expect(turn1ReasoningDetails.length).toBeGreaterThan(0);
    const hasGeminiFormat = turn1ReasoningDetails.some(
      (detail: any) => detail.format === 'google-gemini-v1',
    );
    expect(hasGeminiFormat).toBe(true);

    console.log('\n\n=== turn 2: continue with deeper analysis request ===');

    const messagesForTurn2 = [
      {
        role: 'user' as const,
        content:
          'analyze user 123 by reading their data and calculating their metrics',
      },
      ...response1.messages.map((msg) => ({
        ...msg,
        // Preserve reasoning_details in providerOptions for assistant messages
        ...(msg.role === 'assistant' && {
          providerOptions: {
            openrouter: {
              reasoning_details: turn1ReasoningDetails,
            },
          },
        }),
      })),
      {
        role: 'user' as const,
        content:
          'based on those errors, what is the root cause and what should we investigate next?',
      },
    ];

    console.log(
      '\nverifying reasoning_details in message history sent to turn 2:',
    );
    messagesForTurn2.forEach((msg, i) => {
      if (msg.role === 'assistant' && typeof msg.content !== 'string') {
        console.log(`message ${i} (assistant):`);
        const details = (msg as any).providerOptions?.openrouter
          ?.reasoning_details;
        console.log(
          `  reasoning_details: ${details && Array.isArray(details) && details.length > 0 ? `✓ present (${details.length} items)` : '❌ MISSING - WILL FAIL'}`,
        );
      }
    });

    console.log('\n\n=== DEBUG: Full messages being sent to turn 2 ===');
    console.log(JSON.stringify(messagesForTurn2, null, 2));

    try {
      const turn2 = streamText({
        model,
        messages: messagesForTurn2,
        tools: {
          readuserdata: tool({
            description: 'read user data from file',
            inputSchema: z.object({
              userId: z.string(),
            }),
            execute: async ({ userId }) => {
              return { userId, name: 'test user', data: 'mock data' };
            },
          }),
        },
        providerOptions: {
          openrouter: {
            reasoning: {
              exclude: false,
            },
            provider: {
              only: ['google-ai-studio'],
            },
          },
        },
      });

      console.log('\nturn 2 response:');

      for await (const chunk of turn2.fullStream) {
        if (chunk.type === 'text-delta') {
          process.stdout.write(chunk.text);
        } else if (chunk.type === 'reasoning-delta') {
          console.log(
            `\n[DEBUG] turn 2 reasoning-delta: ${chunk.text?.substring(0, 100)}...`,
          );
        } else if (chunk.type === 'finish') {
          console.log(
            `\n[DEBUG] turn 2 finish chunk:`,
            JSON.stringify(chunk, null, 2),
          );
        } else {
          console.log(
            `\n[DEBUG] turn 2 unknown chunk:`,
            JSON.stringify(chunk, null, 2),
          );
        }
      }

      const response2 = await turn2.response;
      const providerMetadata2 = await turn2.providerMetadata;
      const turn2ReasoningDetails =
        (providerMetadata2?.openrouter?.reasoning_details as any[]) || [];

      console.log('\n\n=== DEBUG: turn 2 full providerMetadata ===');
      console.log(JSON.stringify(providerMetadata2, null, 2));
      console.log(
        `\n=== DEBUG: turn 2 reasoning_details count: ${turn2ReasoningDetails.length} ===`,
      );

      console.log('\n\n=== DEBUG: turn 2 response messages ===');
      console.log(JSON.stringify(response2.messages, null, 2));

      console.log('\n\nturn 2 succeeded!');
      expect(turn2ReasoningDetails.length).toBeGreaterThan(0);

      console.log('\n\n=== turn 3: force successful tool call ===');

      const messagesForTurn3 = [
        {
          role: 'user' as const,
          content:
            'analyze user 123 by reading their data and calculating their metrics',
        },
        ...response1.messages.map((msg) => ({
          ...msg,
          ...(msg.role === 'assistant' && {
            providerOptions: {
              openrouter: {
                reasoning_details: turn1ReasoningDetails,
              },
            },
          }),
        })),
        {
          role: 'user' as const,
          content:
            'based on those errors, what is the root cause and what should we investigate next?',
        },
        ...response2.messages.map((msg) => ({
          ...msg,
          ...(msg.role === 'assistant' && {
            providerOptions: {
              openrouter: {
                reasoning_details: turn2ReasoningDetails,
              },
            },
          }),
        })),
        {
          role: 'user' as const,
          content:
            'try calling readuserdata now with userId 456. the system has been fixed.',
        },
      ];

      console.log('\n\n=== DEBUG: Full messages being sent to turn 3 ===');
      console.log(JSON.stringify(messagesForTurn3, null, 2));

      const turn3 = streamText({
        model,
        messages: messagesForTurn3,
        tools: {
          readuserdata: tool({
            description: 'read user data from file',
            inputSchema: z.object({
              userId: z.string(),
            }),
            execute: async ({ userId }) => {
              return {
                userId,
                name: 'john doe',
                email: 'john@example.com',
                plan: 'premium',
              };
            },
          }),
        },
        providerOptions: {
          openrouter: {
            reasoning: {
              exclude: false,
            },
            provider: {
              only: ['google-ai-studio'],
            },
          },
        },
        onStepFinish: ({ toolCalls, content }) => {
          if (toolCalls) {
            console.log(`\nturn 3 tool calls: ${toolCalls.length}`);
            toolCalls.forEach((call) => {
              const details =
                call.providerMetadata?.openrouter?.reasoning_details;
              console.log(
                `  ${call.toolName}: ${details && Array.isArray(details) && details.length > 0 ? `✓ reasoning_details present (${details.length} items)` : '❌ NO REASONING_DETAILS'}`,
              );
            });
          }
          const toolResultParts = content.filter(
            (part) => part.type === 'tool-result',
          );
          if (toolResultParts.length > 0) {
            console.log(`\nturn 3 tool results: ${toolResultParts.length}`);
            toolResultParts.forEach((part) => {
              if (part.type === 'tool-result') {
                const details =
                  part.providerMetadata?.openrouter?.reasoning_details;
                console.log(
                  `  ${part.toolName} result: ${details && Array.isArray(details) && details.length > 0 ? `✓ reasoning_details preserved (${details.length} items)` : '❌ NO REASONING_DETAILS - SUCCESS CASE BROKEN'}`,
                );
              }
            });
          }
        },
      });

      console.log('\nturn 3 response:');

      for await (const chunk of turn3.fullStream) {
        if (chunk.type === 'text-delta') {
          process.stdout.write(chunk.text);
        } else if (chunk.type === 'reasoning-delta') {
          console.log(
            `\n[DEBUG] turn 3 reasoning-delta: ${chunk.text?.substring(0, 100)}...`,
          );
        } else if (chunk.type === 'finish') {
          console.log(
            `\n[DEBUG] turn 3 finish chunk:`,
            JSON.stringify(chunk, null, 2),
          );
        }
      }

      const response3 = await turn3.response;
      const providerMetadata3 = await turn3.providerMetadata;
      const turn3ReasoningDetails =
        (providerMetadata3?.openrouter?.reasoning_details as any[]) || [];

      console.log('\n\n=== DEBUG: turn 3 full providerMetadata ===');
      console.log(JSON.stringify(providerMetadata3, null, 2));
      console.log(
        `\n=== DEBUG: turn 3 reasoning_details count: ${turn3ReasoningDetails.length} ===`,
      );

      console.log('\n\n=== DEBUG: turn 3 response messages ===');
      console.log(JSON.stringify(response3.messages, null, 2));

      console.log('\n\nturn 3 succeeded!');
      expect(turn3ReasoningDetails.length).toBeGreaterThan(0);
    } catch (error) {
      console.error('\nFAILED with error:');
      console.error(error);
      if (
        error instanceof Error &&
        error.message?.includes('reasoning_details')
      ) {
        console.error(
          'The reasoning_details were not preserved in tool-result messages.',
        );
      }
      throw error;
    }
  });
});
