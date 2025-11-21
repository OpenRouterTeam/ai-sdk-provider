import type {
  EmbeddingModelV2,
  EmbeddingModelV2Embedding,
  SharedV2ProviderOptions,
} from '@ai-sdk/provider';
import {
  postJsonToApi,
  createJsonResponseHandler,
} from '@ai-sdk/provider-utils';
import type {
  OpenRouterEmbeddingSettings,
  OpenRouterModelConfig,
  OpenRouterEmbeddingResponse,
} from './types';

/**
 * OpenRouter embedding model implementation
 */
export class OpenRouterEmbeddingModel implements EmbeddingModelV2<string> {
  readonly specificationVersion = 'v2' as const;
  readonly provider: string;
  readonly modelId: string;
  readonly maxEmbeddingsPerCall = 2048; // OpenRouter/OpenAI default
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

  /**
   * Generate embeddings for the given values
   */
  async doEmbed(options: {
    values: Array<string>;
    abortSignal?: AbortSignal;
    providerOptions?: SharedV2ProviderOptions;
    headers?: Record<string, string | undefined>;
  }): Promise<{
    embeddings: Array<EmbeddingModelV2Embedding>;
    usage?: { tokens: number };
  }> {
    const warnings: Array<{ type: string; message: string }> = [];

    // Check if we exceed the maximum number of embeddings per call
    if (options.values.length > this.maxEmbeddingsPerCall) {
      warnings.push({
        type: 'other',
        message: `OpenRouter embedding model ${this.modelId} can only process up to ${this.maxEmbeddingsPerCall} embeddings per call. Processing first ${this.maxEmbeddingsPerCall} values.`,
      });
    }

    // Prepare the request body
    const body: Record<string, any> = {
      model: this.modelId,
      input: options.values.slice(0, this.maxEmbeddingsPerCall),
      user: this.settings.user,
    };

    // Add dimensions if specified
    if (this.settings.dimensions) {
      body.dimensions = this.settings.dimensions;
    }

    // Merge provider options
    const providerOptions = {
      ...this.settings.providerOptions?.openrouter,
      ...options.providerOptions?.openrouter,
    };

    if (providerOptions) {
      Object.assign(body, providerOptions);
    }

    // Combine headers
    const headers = {
      ...this.config.headers(),
      ...options.headers,
    };

    // Make the API call
    const { value: response } = await postJsonToApi({
      url: `${this.config.baseURL}/embeddings`,
      headers,
      body,
      failedResponseHandler: createJsonResponseHandler({} as any),
      successfulResponseHandler: createJsonResponseHandler({} as any),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const openRouterResponse = response as OpenRouterEmbeddingResponse;

    // Sort embeddings by index and extract the vectors
    const sortedEmbeddings = openRouterResponse.data.sort((a, b) => a.index - b.index);
    const embeddings = sortedEmbeddings.map(item => item.embedding);

    return {
      embeddings,
      usage: openRouterResponse.usage?.prompt_tokens
        ? { tokens: openRouterResponse.usage.prompt_tokens }
        : undefined,
    };
  }
}