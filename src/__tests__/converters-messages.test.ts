/**
 * Unit tests for message conversion functions.
 */

import type { LanguageModelV2Prompt } from '@ai-sdk/provider';

import { describe, expect, it } from 'vitest';
import { convertToOpenRouterMessages, convertToResponsesInput } from '../converters';

describe('convertToOpenRouterMessages', () => {
  it('converts system message', () => {
    const prompt: LanguageModelV2Prompt = [
      {
        role: 'system',
        content: 'You are a helpful assistant.',
      },
    ];

    const result = convertToOpenRouterMessages(prompt);

    expect(result).toEqual([
      {
        role: 'system',
        content: 'You are a helpful assistant.',
      },
    ]);
  });

  it('converts simple user message', () => {
    const prompt: LanguageModelV2Prompt = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Hello!',
          },
        ],
      },
    ];

    const result = convertToOpenRouterMessages(prompt);

    expect(result).toEqual([
      {
        role: 'user',
        content: 'Hello!',
      },
    ]);
  });

  it('converts user message with multiple text parts', () => {
    const prompt: LanguageModelV2Prompt = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'First part. ',
          },
          {
            type: 'text',
            text: 'Second part.',
          },
        ],
      },
    ];

    const result = convertToOpenRouterMessages(prompt);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'First part. ',
          },
          {
            type: 'text',
            text: 'Second part.',
          },
        ],
      },
    ]);
  });

  it('converts simple assistant message', () => {
    const prompt: LanguageModelV2Prompt = [
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Hello there!',
          },
        ],
      },
    ];

    const result = convertToOpenRouterMessages(prompt);

    expect(result).toEqual([
      {
        role: 'assistant',
        content: 'Hello there!',
      },
    ]);
  });

  it('converts assistant message with reasoning', () => {
    const prompt: LanguageModelV2Prompt = [
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Let me think about this...',
          },
          {
            type: 'text',
            text: 'The answer is 42.',
          },
        ],
      },
    ];

    const result = convertToOpenRouterMessages(prompt);

    expect(result).toEqual([
      {
        role: 'assistant',
        content: 'The answer is 42.',
        reasoning: 'Let me think about this...',
      },
    ]);
  });

  it('converts assistant message with tool calls', () => {
    const prompt: LanguageModelV2Prompt = [
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_123',
            toolName: 'get_weather',
            input: {
              city: 'London',
            },
          },
        ],
      },
    ];

    const result = convertToOpenRouterMessages(prompt);

    expect(result).toEqual([
      {
        role: 'assistant',
        toolCalls: [
          {
            id: 'call_123',
            type: 'function',
            function: {
              name: 'get_weather',
              arguments: '{"city":"London"}',
            },
          },
        ],
      },
    ]);
  });

  it('converts tool message', () => {
    const prompt: LanguageModelV2Prompt = [
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_123',
            toolName: 'get_weather',
            output: {
              type: 'json',
              value: {
                temp: 20,
                unit: 'C',
              },
            },
          },
        ],
      },
    ];

    const result = convertToOpenRouterMessages(prompt);

    expect(result).toEqual([
      {
        role: 'tool',
        content: '{"temp":20,"unit":"C"}',
        toolCallId: 'call_123',
      },
    ]);
  });

  it('converts multi-turn conversation', () => {
    const prompt: LanguageModelV2Prompt = [
      {
        role: 'system',
        content: 'You are helpful.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Hi',
          },
        ],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Hello!',
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'How are you?',
          },
        ],
      },
    ];

    const result = convertToOpenRouterMessages(prompt);

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({
      role: 'system',
      content: 'You are helpful.',
    });
    expect(result[1]).toEqual({
      role: 'user',
      content: 'Hi',
    });
    expect(result[2]).toEqual({
      role: 'assistant',
      content: 'Hello!',
    });
    expect(result[3]).toEqual({
      role: 'user',
      content: 'How are you?',
    });
  });
});

describe('convertToResponsesInput', () => {
  it('converts system message', () => {
    const prompt: LanguageModelV2Prompt = [
      {
        role: 'system',
        content: 'You are a helpful assistant.',
      },
    ];

    const result = convertToResponsesInput(prompt);

    expect(result).toEqual([
      {
        type: 'message',
        role: 'system',
        content: 'You are a helpful assistant.',
      },
    ]);
  });

  it('converts simple user message', () => {
    const prompt: LanguageModelV2Prompt = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Hello!',
          },
        ],
      },
    ];

    const result = convertToResponsesInput(prompt);

    expect(result).toEqual([
      {
        type: 'message',
        role: 'user',
        content: 'Hello!',
      },
    ]);
  });

  it('converts assistant message with function calls', () => {
    const prompt: LanguageModelV2Prompt = [
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Let me check the weather.',
          },
          {
            type: 'tool-call',
            toolCallId: 'call_123',
            toolName: 'get_weather',
            input: {
              city: 'London',
            },
          },
        ],
      },
    ];

    const result = convertToResponsesInput(prompt);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      type: 'message',
      role: 'assistant',
      content: 'Let me check the weather.',
    });
    expect(result[1]).toMatchObject({
      type: 'function_call',
      callId: 'call_123',
      name: 'get_weather',
      arguments: '{"city":"London"}',
      status: 'completed',
    });
  });

  it('converts tool results to function call outputs', () => {
    const prompt: LanguageModelV2Prompt = [
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_123',
            toolName: 'get_weather',
            output: {
              type: 'text',
              value: 'Sunny, 20°C',
            },
          },
        ],
      },
    ];

    const result = convertToResponsesInput(prompt);

    expect(result).toEqual([
      {
        type: 'function_call_output',
        callId: 'call_123',
        id: 'call_123',
        output: 'Sunny, 20°C',
        status: 'completed',
      },
    ]);
  });

  it('handles tool error results', () => {
    const prompt: LanguageModelV2Prompt = [
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_456',
            toolName: 'get_data',
            output: {
              type: 'error-text',
              value: 'Network error',
            },
          },
        ],
      },
    ];

    const result = convertToResponsesInput(prompt);

    expect(result).toEqual([
      {
        type: 'function_call_output',
        callId: 'call_456',
        id: 'call_456',
        output: 'Error: Network error',
        status: 'completed',
      },
    ]);
  });
});
