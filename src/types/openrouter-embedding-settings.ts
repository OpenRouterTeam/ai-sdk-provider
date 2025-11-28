import type { OpenRouterSharedSettings } from '..';

// https://openrouter.ai/api/v1/models
export type OpenRouterEmbeddingModelId = string;

export type OpenRouterEmbeddingSettings = {
  /**
   * A unique identifier representing your end-user, which can help OpenRouter to
   * monitor and detect abuse.
   */
  user?: string;

  /**
   * Provider routing preferences to control request routing behavior
   */
  provider?: {
    /**
     * List of provider slugs to try in order (e.g. ["openai", "voyageai"])
     */
    order?: string[];
    /**
     * Whether to allow backup providers when primary is unavailable (default: true)
     */
    allow_fallbacks?: boolean;
    /**
     * Only use providers that support all parameters in your request (default: false)
     */
    require_parameters?: boolean;
    /**
     * Control whether to use providers that may store data
     */
    data_collection?: 'allow' | 'deny';
    /**
     * List of provider slugs to allow for this request
     */
    only?: string[];
    /**
     * List of provider slugs to skip for this request
     */
    ignore?: string[];
    /**
     * Sort providers by price, throughput, or latency
     */
    sort?: 'price' | 'throughput' | 'latency';
    /**
     * Maximum pricing you want to pay for this request
     */
    max_price?: {
      prompt?: number | string;
      completion?: number | string;
      image?: number | string;
      audio?: number | string;
      request?: number | string;
    };
  };
} & OpenRouterSharedSettings;
