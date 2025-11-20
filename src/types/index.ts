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
   * Image generation configuration for supported models (e.g., Google's image generation models).
   * Specifies aspect ratio and image resolution for generated images.
   */
  image_config?: {
    /**
     * The aspect ratio of the generated image.
     * Examples: "1:1", "16:9", "4:3", "5:4"
     */
    aspect_ratio?: string;
    /**
     * The resolution of the generated image.
     * Options: "1K" (1024x1024), "2K" (2048x2048), "4K"
     */
    image_size?: string;
  };

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
