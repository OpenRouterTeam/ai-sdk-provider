import type { LanguageModelV2, LanguageModelV2Prompt } from '@ai-sdk/provider';

export type { LanguageModelV2, LanguageModelV2Prompt };

export type LLMGatewayProviderOptions = {
  models?: string[];

  /**
   * Reasoning configuration for supported models.
   * One of `max_tokens` or `effort` is required.
   * If `exclude` is true, reasoning will be removed from the response. Default is false.
   */
  reasoning?: {
    enabled?: boolean;
    exclude?: boolean;
  } & (
    | {
        max_tokens: number;
      }
    | {
        effort: 'high' | 'medium' | 'low';
      }
  );

  /**
   * A unique identifier representing your end-user, which can
   * help LLMGateway to monitor and detect abuse.
   */
  user?: string;
};

export type LLMGatewaySharedSettings = LLMGatewayProviderOptions & {
  /**
   * @deprecated use `reasoning` instead
   */
  includeReasoning?: boolean;

  extraBody?: Record<string, unknown>;

  /**
   * Enable usage accounting to get detailed token usage information.
   */
  usage?: {
    /**
     * When true, includes token usage information in the response.
     */
    include: boolean;
  };
};

/**
 * Usage accounting response
 */
export type LLMGatewayUsageAccounting = {
  promptTokens: number;
  promptTokensDetails?: {
    cachedTokens: number;
  };
  completionTokens: number;
  completionTokensDetails?: {
    reasoningTokens: number;
  };
  totalTokens: number;
  cost?: number;
  costDetails: {
    upstreamInferenceCost: number;
  };
};
