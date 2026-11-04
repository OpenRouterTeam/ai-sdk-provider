import type {
  EmbeddingModelV4,
  EmbeddingModelV4CallOptions,
  EmbeddingModelV4Result,
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
import { OpenRouterProviderMetadataSchema } from '../schemas/provider-metadata';
import { OpenRouterEmbeddingResponseSchema } from './schemas';

type OpenRouterEmbeddingConfig = {
  provider: string;
  headers: () => Record<string, string | undefined>;
  url: (options: { modelId: string; path: string }) => string;
  fetch?: typeof fetch;
  extraBody?: Record<string, unknown>;
};

/**
 * Shallow merges provider routing preferences in ascending precedence order.
 * Non-object sources (`undefined`, `null`, arrays, primitives) are ignored.
 *
 * TODO(#628): replace with the shared `mergeProviderRouting` helper from
 * `src/utils/merge-provider-routing.ts` once that PR is merged.
 */
function mergeProviderRouting(
  ...sources: unknown[]
): Record<string, unknown> | undefined {
  const objects = sources.filter(
    (source): source is Record<string, unknown> =>
      typeof source === 'object' && source !== null && !Array.isArray(source),
  );
  return objects.length > 0 ? Object.assign({}, ...objects) : undefined;
}

export class OpenRouterEmbeddingModel implements EmbeddingModelV4 {
  readonly specificationVersion = 'v4' as const;
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

  async doEmbed(
    options: EmbeddingModelV4CallOptions,
  ): Promise<EmbeddingModelV4Result> {
    const { values, abortSignal, headers } = options;

    // Call-time options (`providerOptions.openrouter`) are passed through to
    // the request body, mirroring the chat and completion models. `model` and
    // `input` are dropped so call-time options cannot change which model is
    // used or which values are embedded.
    const {
      provider: runtimeProvider,
      model: _ignoredModel,
      input: _ignoredInput,
      ...runtimeOptions
    } = options.providerOptions?.openrouter ?? {};

    // Provider routing preferences are shallow merged rather than replaced,
    // with the same precedence as the rest of the body (later wins).
    const providerRouting = mergeProviderRouting(
      this.settings.provider,
      this.config.extraBody?.provider,
      this.settings.extraBody?.provider,
      runtimeProvider,
    );

    const args = {
      model: this.modelId,
      input: values,
      user: this.settings.user,
      ...this.config.extraBody,
      ...this.settings.extraBody,
      ...runtimeOptions,
      provider: providerRouting,
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
      providerMetadata: {
        openrouter: OpenRouterProviderMetadataSchema.parse({
          provider: responseValue.provider ?? '',
          usage: {
            promptTokens: responseValue.usage?.prompt_tokens ?? 0,
            completionTokens: 0,
            totalTokens: responseValue.usage?.total_tokens ?? 0,
            ...(responseValue.usage?.cost != null
              ? { cost: responseValue.usage.cost }
              : {}),
          },
        }),
      },
      response: {
        headers: responseHeaders,
        body: responseValue,
      },
      warnings: [],
    };
  }
}
