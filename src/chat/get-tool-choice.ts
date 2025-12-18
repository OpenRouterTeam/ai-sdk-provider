import type { LanguageModelV3ToolChoice } from '@ai-sdk/provider';

import { InvalidArgumentError } from '@ai-sdk/provider';
import { z } from 'zod/v4';

const ChatCompletionToolChoiceSchema = z.union([
  z.literal('auto'),
  z.literal('none'),
  z.literal('required'),
  z.object({
    type: z.literal('function'),
    function: z.object({
      name: z.string(),
    }),
  }),
]);

type ChatCompletionToolChoice = z.infer<typeof ChatCompletionToolChoiceSchema>;

export function getChatCompletionToolChoice(
  toolChoice: LanguageModelV3ToolChoice,
): ChatCompletionToolChoice {
  switch (toolChoice.type) {
    case 'auto':
    case 'none':
    case 'required':
      return toolChoice.type;
    case 'tool': {
      return {
        type: 'function',
        function: { name: toolChoice.toolName },
      };
    }
    default: {
      toolChoice satisfies never;
      throw new InvalidArgumentError({
        argument: 'toolChoice',
        message: `Invalid tool choice type: ${JSON.stringify(toolChoice)}`,
      });
    }
  }
}
