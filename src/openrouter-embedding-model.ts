import type { EmbeddingModelV2, EmbeddingModelV2Embedding } from '@ai-sdk/provider';
import type { CreateEmbeddingsResponseBody } from '@openrouter/sdk/esm/models/operations/createembeddings';
import type { OpenRouterModelConfig } from './openrouter-chat-language-model';
import type { OpenRouterEmbeddingSettings } from './openrouter-provider';

/**
 * OpenRouter embedding model implementation.
 *
 * Embeddings convert text into numerical vectors that capture semantic meaning,
 * enabling similarity search, clustering, and retrieval-augmented generation (RAG).
 * OpenRouter provides access to various embedding models like OpenAI's text-embedding-3
 * and Cohere's embed-v3 through a unified API.
 */
export class OpenRouterEmbeddingModel implements EmbeddingModelV2<string> {
  readonly specificationVersion = 'v2' as const;
  readonly provider: string;
  readonly modelId: string;

  // Batch limit based on the most restrictive underlying provider to ensure
  // consistent behavior across all embedding models. Most providers support
  // at least 2048 inputs per batch.
  readonly maxEmbeddingsPerCall = 2048;

  // OpenRouter can parallelize embedding requests across multiple backend instances
  readonly supportsParallelCalls = true;

  private readonly settings: OpenRouterEmbeddingSettings;
  private readonly config: OpenRouterModelConfig;

  constructor(
    modelId: string,
    settings: OpenRouterEmbeddingSettings,
    config: OpenRouterModelConfig,
  ) {
    this.provider = config.provider;
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async doEmbed(options: { values: string[]; abortSignal?: AbortSignal }): Promise<{
    embeddings: Array<EmbeddingModelV2Embedding>;
    usage?: {
      tokens: number;
    };
  }> {
    // Use raw fetch instead of SDK client because the SDK's embeddings method
    // doesn't yet expose all the parameters we need (dimensions, user)
    const response = await fetch(`${this.config.baseURL}/embeddings`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: this.modelId,
        input: options.values,
        dimensions: this.settings.dimensions,
        user: this.settings.user,
      }),
      signal: options.abortSignal,
    });

    if (!response.ok) {
      throw new Error(`Embedding request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as CreateEmbeddingsResponseBody;

    return {
      // SDK returns embedding as Array<number> | string, we need Array<number>
      embeddings: data.data.map((item) =>
        typeof item.embedding === 'string'
          ? JSON.parse(item.embedding)
          : item.embedding,
      ),
      usage: data.usage
        ? {
            // SDK uses camelCase (totalTokens) matching the parsed response
            tokens: data.usage.totalTokens,
          }
        : undefined,
    };
  }
}
