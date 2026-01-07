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
  response: OpenRouterResponseData | undefined
): Record<string, JSONObject> | undefined {
  if (!response) {
    return undefined;
  }

  const usage = response.usage;
  const usageMetadata: OpenRouterProviderMetadata['usage'] | undefined = usage
    ? {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        ...(usage.prompt_tokens_details && {
          promptTokensDetails: {
            cachedTokens: usage.prompt_tokens_details.cached_tokens,
          },
        }),
        ...(usage.completion_tokens_details && {
          completionTokensDetails: {
            reasoningTokens: usage.completion_tokens_details.reasoning_tokens,
          },
        }),
        ...(usage.cost !== undefined && { cost: usage.cost }),
        ...(usage.is_byok !== undefined && { isByok: usage.is_byok }),
        ...(usage.cost_details && { costDetails: usage.cost_details }),
      }
    : undefined;

  const metadata: OpenRouterProviderMetadata = {
    ...(response.id !== undefined && { responseId: response.id }),
    ...(response.provider !== undefined && { provider: response.provider }),
    ...(usageMetadata && { usage: usageMetadata }),
  };

  return {
    openrouter: metadata as unknown as JSONObject,
  };
}
