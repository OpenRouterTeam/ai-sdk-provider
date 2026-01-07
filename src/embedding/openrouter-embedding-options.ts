import type { OpenRouterModelOptions } from '../openrouter-config.js';

/**
 * Embedding-specific options for OpenRouter embedding models.
 */
export interface OpenRouterEmbeddingOptions extends OpenRouterModelOptions {
  /**
   * The number of dimensions to reduce embeddings to.
   * Only supported by certain models.
   */
  dimensions?: number;
}

/**
 * Settings passed to the embedding model at construction time.
 */
export interface OpenRouterEmbeddingSettings {
  /**
   * Model ID to use for embeddings.
   */
  modelId: string;

  /**
   * Model-level options that apply to all calls.
   */
  options?: OpenRouterEmbeddingOptions;
}
