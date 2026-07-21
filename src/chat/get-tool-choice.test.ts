import type { LanguageModelV4ToolChoice } from '@ai-sdk/provider';

import { describe, expect, it } from 'vitest';
import { getChatCompletionToolChoice } from './get-tool-choice';

describe('getChatCompletionToolChoice', () => {
  it.each([
    'auto',
    'none',
    'required',
  ] as const)('passes through %s', (type) => {
    const toolChoice: LanguageModelV4ToolChoice = { type };

    expect(getChatCompletionToolChoice(toolChoice)).toBe(type);
  });

  it('converts a named tool choice to a function choice', () => {
    expect(
      getChatCompletionToolChoice({
        type: 'tool',
        toolName: 'get_weather',
      }),
    ).toEqual({
      type: 'function',
      function: { name: 'get_weather' },
    });
  });
});
