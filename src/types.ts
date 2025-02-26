import type { LanguageModelV1 } from '@ai-sdk/provider';

// Re-export the LanguageModelV1 type to ensure proper type compatibility
export type { LanguageModelV1 };

// Export our model types with explicit type constraints
export type OpenRouterLanguageModel = LanguageModelV1;

export type OpenRouterProviderOptions = {
  models?: string[];

  /**
   * https://openrouter.ai/docs/use-cases/reasoning-tokens
   * One of `max_tokens` or `effort` is required.
   * If `exclude` is true, reasoning will be removed from the response. Default is false.
   */
  reasoning?: {
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

  extraBody?: Record<string, any>;
};
