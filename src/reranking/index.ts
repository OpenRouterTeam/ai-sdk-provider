import type {
  JSONObject,
  RerankingModelV4,
  RerankingModelV4CallOptions,
  RerankingModelV4Result,
  SharedV4Warning,
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
    const { documents, query, topN, abortSignal, headers, providerOptions } =
      options;

    const openrouterOptions =
      (providerOptions?.openrouter as Record<string, unknown>) || {};

    const warnings: SharedV4Warning[] = [];

    let requestDocuments: Array<string | JSONObject> = documents.values;
    if (documents.type === 'object') {
      let convertedToString = false;
      requestDocuments = documents.values.map((document) => {
        if (isOpenRouterRerankDocument(document)) {
          return document;
        }
        convertedToString = true;
        return JSON.stringify(document);
      });
      if (convertedToString) {
        warnings.push({
          type: 'compatibility',
          feature: 'object documents',
          details:
            'OpenRouter rerank documents must be strings or { text?, image? } objects. Other object documents were converted to JSON strings.',
        });
      }
    }

    const args = {
      model: this.modelId,
      query,
      documents: requestDocuments,
      ...(topN != null && { top_n: topN }),
      provider: this.settings.provider,
      ...this.config.extraBody,
      ...this.settings.extraBody,
      ...openrouterOptions,
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
      warnings,
    };
  }
}

/**
 * OpenRouter accepts object documents only in the `{ text?, image? }` shape
 * with string values and at least one of the two fields.
 */
function isOpenRouterRerankDocument(document: JSONObject): boolean {
  const entries = Object.entries(document);
  return (
    entries.length > 0 &&
    entries.every(
      ([key, value]) =>
        (key === 'text' || key === 'image') &&
        (value === undefined || typeof value === 'string'),
    )
  );
}
