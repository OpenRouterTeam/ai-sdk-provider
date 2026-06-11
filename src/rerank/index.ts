import type {
  RerankingModelV3,
  RerankingModelV3CallOptions,
  SharedV3Warning,
} from '@ai-sdk/provider';
import type {
  OpenRouterRerankModelId,
  OpenRouterRerankSettings,
} from '../types/openrouter-rerank-settings';

import {
  combineHeaders,
  createJsonResponseHandler,
  postJsonToApi,
} from '@ai-sdk/provider-utils';
import { openrouterFailedResponseHandler } from '../schemas/error-response';
import { OpenRouterRerankResponseSchema } from './schemas';

type OpenRouterRerankingConfig = {
  headers: () => Record<string, string | undefined>;
  url: (options: { modelId: string; path: string }) => string;
  fetch?: typeof fetch;
  extraBody?: Record<string, unknown>;
};

export class OpenRouterRerankingModel implements RerankingModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider = 'openrouter.reranking';
  readonly modelId: OpenRouterRerankModelId;

  private readonly settings: OpenRouterRerankSettings;
  private readonly config: OpenRouterRerankingConfig;

  constructor(
    modelId: OpenRouterRerankModelId,
    settings: OpenRouterRerankSettings,
    config: OpenRouterRerankingConfig,
  ) {
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }

  async doRerank({
    documents,
    query,
    topN,
    headers,
    abortSignal,
    providerOptions,
  }: RerankingModelV3CallOptions) {
    const openrouterOptions =
      (providerOptions?.openrouter as Record<string, unknown>) || {};

    const warnings: SharedV3Warning[] = [];

    if (documents.type === 'object') {
      warnings.push({
        type: 'compatibility' as const,
        feature: 'object documents',
        details:
          'Object documents are not natively supported. They are converted to JSON strings.',
      });
    }

    const {
      responseHeaders,
      value: response,
      rawValue,
    } = await postJsonToApi({
      url: this.config.url({ modelId: this.modelId, path: '/rerank' }),
      headers: combineHeaders(this.config.headers(), headers),
      body: {
        model: this.modelId,
        query,
        documents:
          documents.type === 'text'
            ? documents.values
            : documents.values.map((v) => JSON.stringify(v)),
        ...(topN !== undefined && { top_n: topN }),
        ...this.config.extraBody,
        ...this.settings.extraBody,
        ...openrouterOptions,
      },
      failedResponseHandler: openrouterFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        OpenRouterRerankResponseSchema,
      ),
      abortSignal,
      fetch: this.config.fetch,
    });

    return {
      ranking: response.results.map((r) => ({
        index: r.index,
        relevanceScore: r.relevance_score,
      })),
      providerMetadata: {
        openrouter: {
          ...(response.provider && { provider: response.provider }),
          ...(response.usage && { usage: response.usage }),
        },
      },
      warnings,
      response: {
        id: response.id,
        modelId: response.model,
        headers: responseHeaders,
        body: rawValue,
      },
    };
  }
}
