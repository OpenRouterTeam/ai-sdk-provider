import type { OpenRouterSharedSettings } from '.';

export type OpenRouterRerankModelId = 'cohere/rerank-v3.5' | 'cohere/rerank-4-fast' | 'cohere/rerank-4-pro' | (string & {});

/**
 * Provider-specific options for OpenRouter reranking models.
 * Pass these via `providerOptions.openrouter` in the `rerank()` call.
 */
export type OpenRouterRerankProviderOptions = {
  /**
   * Provider routing preferences for the reranking request.
   * @see https://openrouter.ai/docs/features/provider-routing
   */
  provider?: Record<string, unknown>;
};

/**
 * Settings for OpenRouter reranking models, passed at model creation time.
 */
export type OpenRouterRerankSettings = OpenRouterSharedSettings;
