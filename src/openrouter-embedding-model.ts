import type { EmbeddingModelV2, EmbeddingModelV2Embedding } from '@ai-sdk/provider';
import type { OpenRouterModelConfig } from './openrouter-chat-language-model';
import type { OpenRouterEmbeddingSettings } from './openrouter-provider';

interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
  }>;
  usage?: {
    total_tokens: number;
  };
}

/**
 * OpenRouter embedding model implementation
 */
export class OpenRouterEmbeddingModel implements EmbeddingModelV2<string> {
  readonly specificationVersion = 'v2' as const;
  readonly provider: string;
  readonly modelId: string;
  readonly maxEmbeddingsPerCall = 2048;
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
    // Use SDK for embeddings
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

    const data = (await response.json()) as EmbeddingResponse;

    return {
      embeddings: data.data.map((item) => item.embedding),
      usage: data.usage
        ? {
            tokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }
}
