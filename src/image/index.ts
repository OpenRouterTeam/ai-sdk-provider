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
  createJsonResponseHandler,
  postJsonToApi,
} from '@ai-sdk/provider-utils';
import { buildFileDataUrl } from '../chat/file-url-utils';
import { openrouterFailedResponseHandler } from '../schemas/error-response';
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
    images: Array<string>;
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
      ...(this.settings.provider !== undefined && {
        provider: this.settings.provider,
      }),
      ...this.config.extraBody,
      ...this.settings.extraBody,
      ...openrouterOptions,
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

    const images: string[] = responseValue.data.map((item) => item.b64_json);

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
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: responseHeaders as Record<string, string> | undefined,
      },
      usage,
    };
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
