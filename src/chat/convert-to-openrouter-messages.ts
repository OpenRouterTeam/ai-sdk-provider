import type { LanguageModelV3Prompt } from '@ai-sdk/provider';

/**
 * Converts AI SDK V3 prompt format to OpenRouter Responses API message format.
 *
 * @param prompt - The AI SDK V3 prompt
 * @returns Array of messages in OpenRouter format
 */
export function convertToOpenRouterMessages(
  _prompt: LanguageModelV3Prompt
): unknown[] {
  throw new Error('Not implemented');
}
