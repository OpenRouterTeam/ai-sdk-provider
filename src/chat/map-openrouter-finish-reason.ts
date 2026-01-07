import type { LanguageModelV3FinishReason } from '@ai-sdk/provider';

/**
 * Maps OpenRouter finish reasons to the AI SDK V3 unified format.
 *
 * Mapping table:
 * - 'end_turn', 'stop', 'stop_sequence' -> 'stop'
 * - 'max_tokens', 'length' -> 'length'
 * - 'tool_use', 'tool_calls' -> 'tool-calls'
 * - 'content_filter' -> 'content-filter'
 * - 'error' -> 'error'
 * - null/undefined/unknown -> 'other'
 *
 * @param finishReason - The finish reason from OpenRouter API response
 * @returns Object containing the unified finish reason and raw original value
 */
export function mapOpenRouterFinishReason(
  finishReason: string | null | undefined
): LanguageModelV3FinishReason {
  // Handle null/undefined
  if (finishReason == null) {
    return { unified: 'other', raw: undefined };
  }

  // Map to unified format
  switch (finishReason) {
    case 'end_turn':
    case 'stop':
    case 'stop_sequence':
      return { unified: 'stop', raw: finishReason };

    case 'max_tokens':
    case 'length':
      return { unified: 'length', raw: finishReason };

    case 'tool_use':
    case 'tool_calls':
      return { unified: 'tool-calls', raw: finishReason };

    case 'content_filter':
      return { unified: 'content-filter', raw: finishReason };

    case 'error':
      return { unified: 'error', raw: finishReason };

    default:
      return { unified: 'other', raw: finishReason };
  }
}
