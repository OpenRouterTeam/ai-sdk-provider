import type { OpenRouterSharedSettings } from '..';

// https://openrouter.ai/models?fmt=cards&supported_parameters=rerank
export type OpenRouterRerankingModelId = string;

export type OpenRouterRerankingSettings = {
  /**
   * Provider routing preferences to control request routing behavior.
   */
  provider?: {
    /**
     * List of provider slugs to try in order.
     */
    order?: string[];
    /**
     * Whether to allow backup providers when primary is unavailable.
     */
    allow_fallbacks?: boolean;
    /**
     * Only use providers that support all parameters in your request.
     */
    require_parameters?: boolean;
    /**
     * Control whether to use providers that may store data.
     */
    data_collection?: 'allow' | 'deny';
    /**
     * List of provider slugs to allow for this request.
     */
    only?: string[];
    /**
     * List of provider slugs to skip for this request.
     */
    ignore?: string[];
    /**
     * Sort providers by price, throughput, or latency.
     */
    sort?: 'price' | 'throughput' | 'latency';
  };
} & Pick<OpenRouterSharedSettings, 'extraBody' | 'user'>;
