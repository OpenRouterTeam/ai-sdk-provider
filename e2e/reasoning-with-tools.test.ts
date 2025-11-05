import { generateText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { sendSMSTool } from '@/e2e/tools';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

describe('Issue #177: Claude Sonnet 4 Thinking Mode with tool use', () => {
  it('should work with reasoning enabled alongside tool calls', async () => {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
    });

    const model = openrouter('anthropic/claude-sonnet-4', {
      usage: {
        include: true,
      },
    });

    // This should NOT throw an error about "Expected thinking or redacted_thinking, but found text"
    const response = await generateText({
      model,
      system: 'You are a helpful assistant that can send SMS messages.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Send an SMS to 555-1234 saying "Hello from Claude"',
            },
          ],
        },
      ],
      tools: {
        sendSMS: sendSMSTool,
      },
      providerOptions: {
        openrouter: {
          reasoning: {
            max_tokens: 2048,
            exclude: false,
          },
        },
      },
    });

    // Verify the response contains tool calls
    expect(response.toolCalls).toBeDefined();
    expect(response.toolCalls.length).toBeGreaterThan(0);

    // Verify reasoning was included
    expect(response.reasoning).toBeDefined();

    // Verify no errors occurred
    expect(response.finishReason).not.toBe('error');
  });

  it('should handle multi-turn conversations with reasoning and tools', async () => {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
    });

    const model = openrouter('anthropic/claude-sonnet-4', {
      usage: {
        include: true,
      },
    });

    // First turn: user asks to send SMS
    const firstResponse = await generateText({
      model,
      system: 'You are a helpful assistant that can send SMS messages.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Send an SMS to 555-9999 with a test message',
            },
          ],
        },
      ],
      tools: {
        sendSMS: sendSMSTool,
      },
      providerOptions: {
        openrouter: {
          reasoning: {
            max_tokens: 2048,
            exclude: false,
          },
        },
      },
    });

    expect(firstResponse.toolCalls).toBeDefined();
    expect(firstResponse.reasoning).toBeDefined();

    // Second turn: continue conversation with tool results
    const secondResponse = await generateText({
      model,
      system: 'You are a helpful assistant that can send SMS messages.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Send an SMS to 555-9999 with a test message',
            },
          ],
        },
        {
          role: 'assistant',
          content: firstResponse.steps.map((step) => ({
            type: 'text' as const,
            text: step.text,
          })),
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Great! Now send another one saying "Follow up message"',
            },
          ],
        },
      ],
      tools: {
        sendSMS: sendSMSTool,
      },
      providerOptions: {
        openrouter: {
          reasoning: {
            max_tokens: 2048,
            exclude: false,
          },
        },
      },
    });

    expect(secondResponse.toolCalls).toBeDefined();
    expect(secondResponse.reasoning).toBeDefined();
    expect(secondResponse.finishReason).not.toBe('error');
  });
});
