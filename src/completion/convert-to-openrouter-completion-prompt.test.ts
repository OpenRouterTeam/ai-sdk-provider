import type { LanguageModelV4Prompt } from '@ai-sdk/provider';

import { describe, expect, it } from 'vitest';
import { convertToOpenRouterCompletionPrompt } from './convert-to-openrouter-completion-prompt';

describe('convertToOpenRouterCompletionPrompt', () => {
  it('returns a single user prompt unchanged in prompt mode', () => {
    const prompt: LanguageModelV4Prompt = [
      { role: 'user', content: [{ type: 'text', text: 'Write a poem' }] },
    ];

    expect(
      convertToOpenRouterCompletionPrompt({
        prompt,
        inputFormat: 'prompt',
      }),
    ).toEqual({ prompt: 'Write a poem' });
  });

  it('formats system, user, and assistant messages', () => {
    const prompt: LanguageModelV4Prompt = [
      { role: 'system', content: 'You are concise.' },
      { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Hi' }] },
    ];

    expect(
      convertToOpenRouterCompletionPrompt({
        prompt,
        inputFormat: 'messages',
        user: 'Human',
        assistant: 'AI',
      }),
    ).toEqual({
      prompt: 'You are concise.\n\nHuman:\nHello\n\nAI:\nHi\n\nAI:\n',
    });
  });

  it('supports custom role labels', () => {
    const prompt: LanguageModelV4Prompt = [
      { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
    ];

    expect(
      convertToOpenRouterCompletionPrompt({
        prompt,
        inputFormat: 'messages',
        user: 'Q',
        assistant: 'A',
      }),
    ).toEqual({ prompt: 'Q:\nHello\n\nA:\n' });
  });

  it('rejects unsupported tool messages', () => {
    const prompt: LanguageModelV4Prompt = [
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'weather',
            output: { type: 'text', value: 'sunny' },
          },
        ],
      },
    ];

    expect(() =>
      convertToOpenRouterCompletionPrompt({
        prompt,
        inputFormat: 'messages',
      }),
    ).toThrow('tool messages');
  });
});
