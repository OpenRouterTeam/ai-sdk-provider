import type { OpenRouterSharedSettings } from '..';

// https://openrouter.ai/models?output_modalities=rerank
export type OpenRouterRerankingModelId = string;

export type OpenRouterRerankingSettings = {
  /**
   * Provider routing preferences to control request routing behavior
   */
  provider?: {
    /**
     * List of provider slugs to try in order (e.g. ["cohere"])
     */
    order?: string[];
    /**
     * Whether to allow backup providers when primary is unavailable (default: true)
     */
    allow_fallbacks?: boolean;
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
  };
} & OpenRouterSharedSettings;
