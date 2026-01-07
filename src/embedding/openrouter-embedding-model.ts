import type {
  EmbeddingModelV3,
  EmbeddingModelV3CallOptions,
  EmbeddingModelV3Result,
  SharedV3Warning,
} from '@ai-sdk/provider';
import type { CreateEmbeddingsResponseBody } from '@openrouter/sdk/models/operations';
import type { OpenRouterModelSettings } from '../openrouter-provider.js';

import { combineHeaders, normalizeHeaders } from '@ai-sdk/provider-utils';
import { OpenRouter } from '@openrouter/sdk';
import { HTTPClient } from '@openrouter/sdk/lib/http';

/**
 * OpenRouter embedding model implementing AI SDK V3 EmbeddingModelV3 interface.
 */
export class OpenRouterEmbeddingModel implements EmbeddingModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider = 'openrouter';
  readonly modelId: string;

  private readonly settings: OpenRouterModelSettings;

  /**
   * Maximum number of embeddings that can be generated in a single API call.
   * Set to 2048 as a reasonable default for most embedding models.
   */
  readonly maxEmbeddingsPerCall = 2048;

  /**
   * Whether the model supports parallel calls.
   */
  readonly supportsParallelCalls = true;

  constructor(modelId: string, settings: OpenRouterModelSettings) {
    this.modelId = modelId;
    this.settings = settings;
  }

  async doEmbed(
    options: EmbeddingModelV3CallOptions,
  ): Promise<EmbeddingModelV3Result> {
    const warnings: SharedV3Warning[] = [];

    // Create OpenRouter client with optional custom fetch
    const httpClient = this.settings.fetch
      ? new HTTPClient({ fetcher: this.settings.fetch })
      : undefined;
    const client = new OpenRouter({
      apiKey: this.settings.apiKey,
      serverURL: this.settings.baseURL,
      userAgent: this.settings.userAgent,
      httpClient,
    });

    // Build request with provider routing options if configured
    // Note: extraBody is spread first so explicit params can override
    const requestParams: {
      model: string;
      input: string[];
      user?: string;
      provider?: {
        order?: string[];
        allowFallbacks?: boolean;
        requireParameters?: boolean;
      };
      [key: string]: unknown;
    } = {
      ...this.settings.extraBody,
      model: this.modelId,
      input: options.values,
    };

    // Add provider routing options from model settings
    const modelOptions = this.settings.modelOptions;
    if (modelOptions?.user) {
      requestParams.user = modelOptions.user as string;
    }
    if (modelOptions?.provider) {
      requestParams.provider = modelOptions.provider;
    }

    // Make the embeddings request
    const combinedHeaders = normalizeHeaders(
      combineHeaders(this.settings.headers, options.headers),
    );

    const response = await client.embeddings.generate(requestParams, {
      fetchOptions: {
        signal: options.abortSignal,
        headers: combinedHeaders,
      },
    });

    // Handle string response (shouldn't happen in practice but type allows it)
    if (typeof response === 'string') {
      throw new Error(
        `Unexpected string response from embeddings API: ${response}`,
      );
    }

    const responseBody = response as CreateEmbeddingsResponseBody;

    // Extract embeddings from response data
    // Sort by index to ensure correct order, then extract embedding vectors
    const sortedData = [...responseBody.data].sort(
      (a, b) => (a.index ?? 0) - (b.index ?? 0),
    );
    const embeddings = sortedData.map((item) => {
      // Embedding can be number[] or base64 string - we only support number[]
      if (typeof item.embedding === 'string') {
        throw new Error('Base64 encoded embeddings are not supported');
      }
      return item.embedding;
    });

    return {
      embeddings,
      usage: responseBody.usage
        ? { tokens: responseBody.usage.promptTokens }
        : undefined,
      warnings,
    };
  }
}
