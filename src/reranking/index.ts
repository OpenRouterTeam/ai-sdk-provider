import type {
  RerankingModelV4,
  RerankingModelV4CallOptions,
  RerankingModelV4Result,
} from '@ai-sdk/provider';
import type {
  OpenRouterRerankingModelId,
  OpenRouterRerankingSettings,
} from '../types/openrouter-reranking-settings';

import {
  combineHeaders,
  createJsonResponseHandler,
  postJsonToApi,
} from '@ai-sdk/provider-utils';
import { openrouterFailedResponseHandler } from '../schemas/error-response';
import { OpenRouterProviderMetadataSchema } from '../schemas/provider-metadata';
import { OpenRouterRerankingResponseSchema } from './schemas';

type OpenRouterRerankingConfig = {
  provider: string;
  headers: () => Record<string, string | undefined>;
  url: (options: { modelId: string; path: string }) => string;
  fetch?: typeof fetch;
  extraBody?: Record<string, unknown>;
};

export class OpenRouterRerankingModel implements RerankingModelV4 {
  readonly specificationVersion = 'v4' as const;
  readonly provider = 'openrouter';
  readonly modelId: OpenRouterRerankingModelId;
  readonly settings: OpenRouterRerankingSettings;

  private readonly config: OpenRouterRerankingConfig;

  constructor(
    modelId: OpenRouterRerankingModelId,
    settings: OpenRouterRerankingSettings,
    config: OpenRouterRerankingConfig,
  ) {
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }

  async doRerank(
    options: RerankingModelV4CallOptions,
  ): Promise<RerankingModelV4Result> {
    const { documents, query, topN, abortSignal, headers } = options;

    const args = {
      model: this.modelId,
      query,
      documents: documents.values,
      ...(topN != null && { top_n: topN }),
      provider: this.settings.provider,
      ...this.config.extraBody,
      ...this.settings.extraBody,
    };

    const { value: responseValue, responseHeaders } = await postJsonToApi({
      url: this.config.url({
        path: '/rerank',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers(), headers),
      body: args,
      failedResponseHandler: openrouterFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        OpenRouterRerankingResponseSchema,
      ),
      abortSignal,
      fetch: this.config.fetch,
    });

    return {
      ranking: responseValue.results.map((result) => ({
        index: result.index,
        relevanceScore: result.relevance_score,
      })),
      providerMetadata: {
        openrouter: OpenRouterProviderMetadataSchema.parse({
          provider: responseValue.provider ?? '',
          usage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: responseValue.usage?.total_tokens ?? 0,
            ...(responseValue.usage?.cost != null
              ? { cost: responseValue.usage.cost }
              : {}),
          },
        }),
      },
      response: {
        ...(responseValue.id != null && { id: responseValue.id }),
        modelId: responseValue.model,
        headers: responseHeaders,
        body: responseValue,
      },
      warnings: [],
    };
  }
}
