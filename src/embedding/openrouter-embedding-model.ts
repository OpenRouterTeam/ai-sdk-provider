import type {
  EmbeddingModelV3,
  EmbeddingModelV3CallOptions,
  EmbeddingModelV3Result,
} from '@ai-sdk/provider';

/**
 * OpenRouter embedding model implementing AI SDK V3 EmbeddingModelV3 interface.
 */
export class OpenRouterEmbeddingModel implements EmbeddingModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider = 'openrouter';
  readonly modelId: string;

  /**
   * Maximum number of embeddings that can be generated in a single API call.
   * Set to 2048 as a reasonable default for most embedding models.
   */
  readonly maxEmbeddingsPerCall = 2048;

  /**
   * Whether the model supports parallel calls.
   */
  readonly supportsParallelCalls = true;

  constructor(modelId: string, _settings: unknown) {
    this.modelId = modelId;
  }

  async doEmbed(_options: EmbeddingModelV3CallOptions): Promise<EmbeddingModelV3Result> {
    throw new Error('Not implemented');
  }
}
