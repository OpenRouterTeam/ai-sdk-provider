import type { LanguageModelV2, LanguageModelV2Prompt } from '@ai-sdk/provider';

export type { LanguageModelV2, LanguageModelV2Prompt };

/**
 * Options for the OpenRouter provider.
 */
export type OpenRouterProviderOptions = {
  /**
   * A list of models to use for the request.
   */
  models?: string[];

  /**
   * Options for reasoning tokens.
   * @see https://openrouter.ai/docs/use-cases/reasoning-tokens
   */
  reasoning?: {
    /**
     * Whether to enable reasoning.
     */
    enabled?: boolean;
    /**
     * Whether to exclude reasoning from the response.
     */
    exclude?: boolean;
  } & (
    | {
        /**
         * The maximum number of tokens to use for reasoning.
         */
        max_tokens: number;
      }
    | {
        /**
         * The effort level for reasoning.
         */
        effort: 'high' | 'medium' | 'low';
      }
  );

  /**
   * A unique identifier representing your end-user, which can
   * help OpenRouter to monitor and detect abuse.
   */
  user?: string;
};

/**
 * Shared settings for the OpenRouter provider.
 */
export type OpenRouterSharedSettings = OpenRouterProviderOptions & {
  /**
   * @deprecated use `reasoning` instead
   */
  includeReasoning?: boolean;

  /**
   * Extra body parameters to send to the API.
   */
  extraBody?: Record<string, unknown>;

  /**
   * Enable usage accounting to get detailed token usage information.
   * @see https://openrouter.ai/docs/use-cases/usage-accounting
   */
  usage?: {
    /**
     * When true, includes token usage information in the response.
     */
    include: boolean;
  };
};

/**
 * Usage accounting response from the OpenRouter API.
 * @see https://openrouter.ai/docs/use-cases/usage-accounting
 */
export type OpenRouterUsageAccounting = {
  /**
   * The number of tokens in the prompt.
   */
  promptTokens: number;
  /**
   * Details about the prompt tokens.
   */
  promptTokensDetails?: {
    /**
     * The number of cached tokens in the prompt.
     */
    cachedTokens: number;
  };
  /**
   * The number of tokens in the completion.
   */
  completionTokens: number;
  /**
   * Details about the completion tokens.
   */
  completionTokensDetails?: {
    /**
     * The number of reasoning tokens in the completion.
     */
    reasoningTokens: number;
  };
  /**
   * The total number of tokens.
   */
  totalTokens: number;
  /**
   * The cost of the request.
   */
  cost?: number;
  /**
   * Details about the cost.
   */
  costDetails: {
    /**
     * The cost of the upstream inference.
     */
    upstreamInferenceCost: number;
  };
};
