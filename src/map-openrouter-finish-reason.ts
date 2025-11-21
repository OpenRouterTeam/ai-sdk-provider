import type { LanguageModelV2FinishReason } from '@ai-sdk/provider';

/**
 * Map OpenRouter finish reasons to AI SDK V2 finish reasons
 */
export function mapOpenRouterFinishReason(
  finishReason: string | null | undefined,
): LanguageModelV2FinishReason {
  if (!finishReason) {
    return 'unknown';
  }

  switch (finishReason) {
    case 'stop':
      return 'stop';

    case 'length':
    case 'max_tokens':
      return 'length';

    case 'tool_calls':
    case 'function_call':
      return 'tool-calls';

    case 'content_filter':
      return 'content-filter';

    case 'error':
      return 'error';

    default:
      return 'other';
  }
}