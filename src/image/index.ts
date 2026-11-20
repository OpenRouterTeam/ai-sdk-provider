import type {
  ImageModelV4,
  ImageModelV4CallOptions,
  ImageModelV4File,
  ImageModelV4ProviderMetadata,
  ImageModelV4Usage,
  SharedV4Warning,
} from '@ai-sdk/provider';
import type {
  OpenRouterImageModelId,
  OpenRouterImageSettings,
} from '../types/openrouter-image-settings';

import {
  NoContentGeneratedError,
  UnsupportedFunctionalityError,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  convertBase64ToUint8Array,
  createBinaryResponseHandler,
  createJsonResponseHandler,
  createStatusCodeErrorResponseHandler,
  getFromApi,
  postJsonToApi,
} from '@ai-sdk/provider-utils';
import { buildFileDataUrl } from '../chat/file-url-utils';
import { openrouterFailedResponseHandler } from '../schemas/error-response';
import { mergeProviderRouting } from '../utils/merge-provider-routing';
import { OpenRouterImageResponseSchema } from './schemas';

type OpenRouterImageConfig = {
  provider: string;
  headers: () => Record<string, string | undefined>;
  url: (options: { modelId: string; path: string }) => string;
  fetch?: typeof fetch;
  extraBody?: Record<string, unknown>;
};

export class OpenRouterImageModel implements ImageModelV4 {
  readonly specificationVersion = 'v4' as const;
  readonly provider = 'openrouter';
  readonly modelId: OpenRouterImageModelId;
  readonly settings: OpenRouterImageSettings;
  readonly maxImagesPerCall = 10;
  // Files are sent as `input_references`; whether a model accepts them is
  // decided by the API. `mask` has no API equivalent and is rejected.
  readonly supportsFileInputs = true;
  readonly supportsMaskInputs = false;

  private readonly config: OpenRouterImageConfig;

  constructor(
    modelId: OpenRouterImageModelId,
    settings: OpenRouterImageSettings,
    config: OpenRouterImageConfig,
  ) {
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }

  async doGenerate(options: ImageModelV4CallOptions): Promise<{
    images: Array<string> | Array<Uint8Array>;
    warnings: Array<SharedV4Warning>;
    providerMetadata?: ImageModelV4ProviderMetadata;
    response: {
      timestamp: Date;
      modelId: string;
      headers: Record<string, string> | undefined;
    };
    usage?: ImageModelV4Usage;
  }> {
    const {
      prompt,
      n,
      size,
      aspectRatio,
      seed,
      files,
      mask,
      abortSignal,
      headers,
      providerOptions,
    } = options;

    const openrouterOptions =
      (providerOptions?.openrouter as Record<string, unknown>) || {};

    const warnings: SharedV4Warning[] = [];

    if (mask !== undefined) {
      throw new UnsupportedFunctionalityError({
        functionality: 'image inpainting (mask parameter)',
      });
    }

    const hasFiles = files !== undefined && files.length > 0;

    const inputReferences: Array<Record<string, unknown>> | undefined = hasFiles
      ? files.map((file: ImageModelV4File) => convertFileToInputReference(file))
      : undefined;

    const { provider: runtimeProvider, ...restOpenrouterOptions } =
      openrouterOptions;

    // Shallow merge provider routing preferences instead of replacing them,
    // keeping the same precedence as the rest of the body (later wins).
    // A call-time `provider: null` clears routing entirely.
    const provider = mergeProviderRouting(
      [
        this.settings.provider,
        this.config.extraBody?.provider,
        this.settings.extraBody?.provider,
      ],
      runtimeProvider,
    );

    const body: Record<string, unknown> = {
      model: this.modelId,
      prompt: prompt ?? '',
      ...(n !== undefined && { n }),
      ...(size !== undefined && { size }),
      ...(aspectRatio !== undefined && { aspect_ratio: aspectRatio }),
      ...(seed !== undefined && { seed }),
      ...(inputReferences !== undefined && {
        input_references: inputReferences,
      }),
      ...(this.settings.user !== undefined && { user: this.settings.user }),
      ...this.config.extraBody,
      ...this.settings.extraBody,
      ...restOpenrouterOptions,
      // Always set so non-object `provider` values from extraBody never leak;
      // `undefined` is dropped from the JSON body.
      provider,
    };

    const { value: responseValue, responseHeaders } = await postJsonToApi({
      url: this.config.url({
        path: '/images',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers(), headers),
      body,
      failedResponseHandler: openrouterFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        OpenRouterImageResponseSchema,
      ),
      abortSignal,
      fetch: this.config.fetch,
    });

    if (!responseValue.data || responseValue.data.length === 0) {
      throw new NoContentGeneratedError({
        message: 'No images in response',
      });
    }

    const images = await this.resolveImages(responseValue.data, abortSignal);

    const imageMetadata = responseValue.data.map((item) => {
      const meta: Record<string, string | number> = {};
      if (item.url !== undefined) {
        meta.url = item.url;
      }
      if (item.media_type !== undefined) {
        meta.mediaType = item.media_type;
      }
      if (item.url !== undefined && responseValue.expires_at !== undefined) {
        meta.expiresAt = responseValue.expires_at;
      }
      return meta;
    });

    const providerMetadata: ImageModelV4ProviderMetadata | undefined =
      imageMetadata.some((meta) => Object.keys(meta).length > 0)
        ? {
            openrouter: {
              images: imageMetadata,
            },
          }
        : undefined;

    const usage: ImageModelV4Usage | undefined = responseValue.usage
      ? {
          inputTokens: responseValue.usage.prompt_tokens,
          outputTokens: responseValue.usage.completion_tokens,
          totalTokens: responseValue.usage.total_tokens,
        }
      : undefined;

    return {
      images,
      warnings,
      ...(providerMetadata !== undefined && { providerMetadata }),
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: responseHeaders as Record<string, string> | undefined,
      },
      usage,
    };
  }

  private async resolveImages(
    data: Array<{ b64_json?: string; url?: string }>,
    abortSignal: AbortSignal | undefined,
  ): Promise<Array<string> | Array<Uint8Array>> {
    if (data.every((item) => item.b64_json !== undefined)) {
      return data.map((item) => item.b64_json ?? '');
    }

    const trustedOrigin = this.config.url({
      path: '/images',
      modelId: this.modelId,
    });

    return Promise.all(
      data.map(async (item) => {
        if (item.b64_json !== undefined) {
          return convertBase64ToUint8Array(item.b64_json);
        }
        if (item.url === undefined) {
          throw new NoContentGeneratedError({
            message: 'Image response item missing both b64_json and url',
          });
        }
        const { value } = await getFromApi({
          url: item.url,
          successfulResponseHandler: createBinaryResponseHandler(),
          failedResponseHandler: createStatusCodeErrorResponseHandler(),
          abortSignal,
          fetch: this.config.fetch,
          validateUrl: true,
          trustedOrigin,
        });
        return value;
      }),
    );
  }
}

const DEFAULT_IMAGE_MEDIA_TYPE = 'image/png';

function convertFileToInputReference(
  file: ImageModelV4File,
): Record<string, unknown> {
  if (file.type === 'url') {
    return {
      type: 'image_url',
      image_url: { url: file.url },
    };
  }

  const url = buildFileDataUrl({
    data: file.data,
    mediaType: file.mediaType,
    defaultMediaType: DEFAULT_IMAGE_MEDIA_TYPE,
  });

  return {
    type: 'image_url',
    image_url: { url },
  };
}
