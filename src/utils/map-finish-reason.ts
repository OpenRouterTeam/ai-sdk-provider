import type { LanguageModelV2FinishReason } from '@ai-sdk/provider';

/**
 * Maps an OpenRouter finish reason to a language model finish reason.
 *
 * @param {string | null | undefined} finishReason - The finish reason from OpenRouter.
 * @returns {LanguageModelV2FinishReason} The mapped finish reason.
 */
export function mapOpenRouterFinishReason(
  finishReason: string | null | undefined,
): LanguageModelV2FinishReason {
  switch (finishReason) {
    case 'stop':
      return 'stop';
    case 'length':
      return 'length';
    case 'content_filter':
      return 'content-filter';
    case 'function_call':
    case 'tool_calls':
      return 'tool-calls';
    default:
      return 'unknown';
  }
}
