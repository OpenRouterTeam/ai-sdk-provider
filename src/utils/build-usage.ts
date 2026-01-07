import type { LanguageModelV3Usage } from '@ai-sdk/provider';

/**
 * Raw usage data from OpenRouter API response.
 */
export interface OpenRouterRawUsage {
  inputTokens?: number;
  outputTokens?: number;
  inputTokensDetails?: {
    cachedTokens?: number;
  };
  outputTokensDetails?: {
    reasoningTokens?: number;
  };
}

/**
 * Builds a LanguageModelV3Usage object from OpenRouter API usage data.
 *
 * @param usage - The raw usage data from the OpenRouter API response.
 * @returns A LanguageModelV3Usage object with standardized token counts.
 */
export function buildUsage(_usage: OpenRouterRawUsage | undefined): LanguageModelV3Usage {
  throw new Error('Not implemented');
}
