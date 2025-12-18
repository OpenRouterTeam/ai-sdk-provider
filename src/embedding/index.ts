import type {
  EmbeddingModelV3,
  SharedV3Headers,
  SharedV3ProviderMetadata,
} from '@ai-sdk/provider';
import type {
  OpenRouterEmbeddingModelId,
  OpenRouterEmbeddingSettings,
} from '../types/openrouter-embedding-settings';

import {
  combineHeaders,
  createJsonResponseHandler,
  postJsonToApi,
} from '@ai-sdk/provider-utils';
import { openrouterFailedResponseHandler } from '../schemas/error-response';
import { OpenRouterEmbeddingResponseSchema } from './schemas';

type OpenRouterEmbeddingConfig = {
  provider: string;
  headers: () => Record<string, string | undefined>;
  url: (options: { modelId: string; path: string }) => string;
  fetch?: typeof fetch;
  extraBody?: Record<string, unknown>;
};

export class OpenRouterEmbeddingModel implements EmbeddingModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider = 'openrouter';
  readonly modelId: OpenRouterEmbeddingModelId;
  readonly settings: OpenRouterEmbeddingSettings;
  readonly maxEmbeddingsPerCall = undefined;
  readonly supportsParallelCalls = true;

  private readonly config: OpenRouterEmbeddingConfig;

  constructor(
    modelId: OpenRouterEmbeddingModelId,
    settings: OpenRouterEmbeddingSettings,
    config: OpenRouterEmbeddingConfig,
  ) {
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }

  async doEmbed(options: {
    values: Array<string>;
    abortSignal?: AbortSignal;
    headers?: Record<string, string | undefined>;
  }): Promise<{
    embeddings: Array<Array<number>>;
    usage?: { tokens: number };
    providerMetadata?: SharedV3ProviderMetadata;
    response?: {
      headers?: SharedV3Headers;
      body?: unknown;
    };
    warnings: Array<import('@ai-sdk/provider').SharedV3Warning>;
  }> {
    const { values, abortSignal, headers } = options;

    const args = {
      model: this.modelId,
      input: values,
      user: this.settings.user,
      provider: this.settings.provider,
      ...this.config.extraBody,
      ...this.settings.extraBody,
    };

    const { value: responseValue, responseHeaders } = await postJsonToApi({
      url: this.config.url({
        path: '/embeddings',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers(), headers),
      body: args,
      failedResponseHandler: openrouterFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        OpenRouterEmbeddingResponseSchema,
      ),
      abortSignal,
      fetch: this.config.fetch,
    });

    return {
      embeddings: responseValue.data.map((item) => item.embedding),
      usage: responseValue.usage
        ? { tokens: responseValue.usage.prompt_tokens }
        : undefined,
      providerMetadata: responseValue.usage?.cost
        ? {
            openrouter: {
              usage: {
                cost: responseValue.usage.cost,
              },
            },
          }
        : undefined,
      response: {
        headers: responseHeaders,
        body: responseValue,
      },
      warnings: [],
    };
  }
}
