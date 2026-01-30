import type { LanguageModelV3, LanguageModelV3Prompt } from '@ai-sdk/provider';

export type { LanguageModelV3, LanguageModelV3Prompt };

export * from './openrouter-embedding-settings';
export * from './openrouter-image-settings';

export type OpenRouterProviderOptions = {
  models?: string[];

  /**
   * https://openrouter.ai/docs/use-cases/reasoning-tokens
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
   * help OpenRouter to monitor and detect abuse.
   */
  user?: string;
};

export type OpenRouterSharedSettings = OpenRouterProviderOptions & {
  /**
   * @deprecated use `reasoning` instead
   */
  includeReasoning?: boolean;

  extraBody?: Record<string, unknown>;

  /**
   * Enable usage accounting to get detailed token usage information.
   * https://openrouter.ai/docs/use-cases/usage-accounting
   */
  usage?: {
    /**
     * When true, includes token usage information in the response.
     */
    include: boolean;
  };

  /**
   * Default temperature for model calls. Controls randomness in the output.
   * Can be overridden at call time via generateText/streamText options.
   * Range: 0 to 2, where 0 is deterministic and higher values are more random.
   */
  temperature?: number;

  /**
   * Default top-p (nucleus sampling) for model calls.
   * Can be overridden at call time via generateText/streamText options.
   * Range: 0 to 1.
   */
  topP?: number;

  /**
   * Default top-k sampling for model calls.
   * Can be overridden at call time via generateText/streamText options.
   */
  topK?: number;

  /**
   * Default frequency penalty for model calls.
   * Can be overridden at call time via generateText/streamText options.
   * Range: -2 to 2.
   */
  frequencyPenalty?: number;

  /**
   * Default presence penalty for model calls.
   * Can be overridden at call time via generateText/streamText options.
   * Range: -2 to 2.
   */
  presencePenalty?: number;

  /**
   * Default maximum number of tokens to generate.
   * Can be overridden at call time via generateText/streamText options.
   */
  maxTokens?: number;
};

/**
 * Usage accounting response
 * @see https://openrouter.ai/docs/use-cases/usage-accounting
 */
export type OpenRouterUsageAccounting = {
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
  costDetails?: {
    upstreamInferenceCost: number;
  };
};
