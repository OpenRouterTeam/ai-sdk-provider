/**
 * Maps OpenRouter finish reasons to the AI SDK V3 unified format.
 *
 * @param finishReason - The finish reason from OpenRouter API response
 * @returns Object containing the unified finish reason and raw original value
 */
export function mapOpenRouterFinishReason(
  _finishReason: string | null | undefined
): { unified: string; raw: string | undefined } {
  throw new Error('Not implemented');
}
