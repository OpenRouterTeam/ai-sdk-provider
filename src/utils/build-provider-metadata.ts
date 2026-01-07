import type { JSONObject } from '@ai-sdk/provider';

/**
 * OpenRouter-specific provider metadata structure.
 */
export interface OpenRouterProviderMetadata {
  /**
   * The response ID from OpenRouter.
   */
  responseId?: string;

  /**
   * The upstream provider that served the request.
   */
  provider?: string;

  /**
   * Detailed usage information.
   */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    promptTokensDetails?: {
      cachedTokens?: number;
    };
    completionTokensDetails?: {
      reasoningTokens?: number;
    };
    /**
     * Cost in USD (omit if unavailable).
     */
    cost?: number;
    /**
     * Whether the request used BYOK (Bring Your Own Key).
     */
    isByok?: boolean;
    /**
     * Detailed cost breakdown.
     */
    costDetails?: JSONObject;
  };
}

/**
 * Response data from OpenRouter API used to build provider metadata.
 */
export interface OpenRouterResponseData {
  id?: string;
  provider?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    prompt_tokens_details?: {
      cached_tokens?: number;
    };
    completion_tokens_details?: {
      reasoning_tokens?: number;
    };
    cost?: number;
    is_byok?: boolean;
    cost_details?: JSONObject;
  };
}

/**
 * Builds provider metadata from OpenRouter API response data.
 *
 * @param response - The response data from OpenRouter API.
 * @returns Provider metadata in the format expected by AI SDK.
 */
export function buildProviderMetadata(
  _response: OpenRouterResponseData | undefined
): Record<string, JSONObject> | undefined {
  throw new Error('Not implemented');
}
