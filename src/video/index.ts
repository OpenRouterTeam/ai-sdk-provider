import type {
  SharedV4ProviderMetadata,
  SharedV4Warning,
  Experimental_VideoModelV4 as VideoModelV4,
  Experimental_VideoModelV4CallOptions as VideoModelV4CallOptions,
  Experimental_VideoModelV4File as VideoModelV4File,
  Experimental_VideoModelV4VideoData as VideoModelV4VideoData,
} from '@ai-sdk/provider';
import type {
  OpenRouterVideoModelId,
  OpenRouterVideoSettings,
} from '../types/openrouter-video-settings';

import { APICallError } from '@ai-sdk/provider';
import {
  combineHeaders,
  createJsonResponseHandler,
  delay,
  getFromApi,
  postJsonToApi,
} from '@ai-sdk/provider-utils';
import { buildFileDataUrl } from '../chat/file-url-utils';
import { openrouterFailedResponseHandler } from '../schemas/error-response';
import {
  VideoGenerationPollResponseSchema,
  VideoGenerationSubmitResponseSchema,
} from './schemas';

type OpenRouterVideoConfig = {
  provider: string;
  headers: () => Record<string, string | undefined>;
  url: (options: { modelId: string; path: string }) => string;
  fetch?: typeof fetch;
  extraBody?: Record<string, unknown>;
};

const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_MAX_POLL_TIME_MS = 600_000;

export class OpenRouterVideoModel implements VideoModelV4 {
  readonly specificationVersion = 'v4';
  readonly provider = 'openrouter';
  readonly modelId: OpenRouterVideoModelId;
  readonly settings: OpenRouterVideoSettings;
  readonly maxVideosPerCall = 1;

  private readonly config: OpenRouterVideoConfig;

  constructor(
    modelId: OpenRouterVideoModelId,
    settings: OpenRouterVideoSettings,
    config: OpenRouterVideoConfig,
  ) {
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }

  async doGenerate(options: VideoModelV4CallOptions): Promise<{
    videos: Array<VideoModelV4VideoData>;
    warnings: Array<SharedV4Warning>;
    providerMetadata?: SharedV4ProviderMetadata;
    response: {
      timestamp: Date;
      modelId: string;
      headers: Record<string, string> | undefined;
    };
  }> {
    const {
      prompt,
      n,
      aspectRatio,
      resolution,
      duration,
      seed,
      image,
      abortSignal,
      headers,
      providerOptions,
    } = options;

    const warnings: SharedV4Warning[] = [];

    if (n > 1) {
      warnings.push({
        type: 'unsupported',
        feature: 'n > 1',
        details: `OpenRouter video generation returns 1 video per call. Requested ${n} videos.`,
      });
    }

    const body: Record<string, unknown> = {
      model: this.modelId,
      prompt: prompt ?? '',
      ...(aspectRatio !== undefined && { aspect_ratio: aspectRatio }),
      ...(resolution !== undefined && { size: resolution }),
      ...(duration !== undefined && { duration }),
      ...(seed !== undefined && { seed }),
      ...(this.settings.generateAudio !== undefined && {
        generate_audio: this.settings.generateAudio,
      }),
      ...(image !== undefined && {
        frame_images: [convertImageToFrameImage(image)],
      }),
      ...this.config.extraBody,
      ...this.settings.extraBody,
      ...providerOptions.openrouter,
    };

    const mergedHeaders = combineHeaders(this.config.headers(), headers);

    const { value: submitResponse, responseHeaders } = await postJsonToApi({
      url: this.config.url({
        path: '/videos',
        modelId: this.modelId,
      }),
      headers: mergedHeaders,
      body,
      failedResponseHandler: openrouterFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        VideoGenerationSubmitResponseSchema,
      ),
      abortSignal,
      fetch: this.config.fetch,
    });

    const pollIntervalMs =
      this.settings.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const maxPollTimeMs =
      this.settings.maxPollTimeMs ?? DEFAULT_MAX_POLL_TIME_MS;

    const pollResult = await this.pollUntilComplete({
      jobId: submitResponse.id,
      headers: mergedHeaders,
      abortSignal,
      pollIntervalMs,
      maxPollTimeMs,
    });

    const videos: VideoModelV4VideoData[] = [];

    if (pollResult.unsigned_urls) {
      for (const url of pollResult.unsigned_urls) {
        videos.push({
          type: 'url',
          url,
          mediaType: 'video/mp4',
        });
      }
    }

    const providerMetadata: SharedV4ProviderMetadata = {
      openrouter: {
        generationId: pollResult.generation_id ?? null,
        cost: pollResult.usage?.cost ?? null,
      },
    };

    return {
      videos,
      warnings,
      providerMetadata,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: responseHeaders,
      },
    };
  }

  private async pollUntilComplete({
    jobId,
    headers,
    abortSignal,
    pollIntervalMs,
    maxPollTimeMs,
  }: {
    jobId: string;
    headers: Record<string, string | undefined>;
    abortSignal?: AbortSignal;
    pollIntervalMs: number;
    maxPollTimeMs: number;
  }): Promise<{
    generation_id?: string;
    unsigned_urls?: string[];
    usage?: { cost?: number; is_byok?: boolean };
  }> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxPollTimeMs) {
      abortSignal?.throwIfAborted();

      await delay(pollIntervalMs);

      abortSignal?.throwIfAborted();

      const { value: pollResponse } = await getFromApi({
        url: this.config.url({
          path: `/videos/${jobId}`,
          modelId: this.modelId,
        }),
        headers,
        failedResponseHandler: openrouterFailedResponseHandler,
        successfulResponseHandler: createJsonResponseHandler(
          VideoGenerationPollResponseSchema,
        ),
        abortSignal,
        fetch: this.config.fetch,
      });

      if (pollResponse.status === 'completed') {
        return {
          generation_id: pollResponse.generation_id,
          unsigned_urls: pollResponse.unsigned_urls,
          usage: pollResponse.usage,
        };
      }

      if (
        pollResponse.status === 'failed' ||
        pollResponse.status === 'dead' ||
        pollResponse.status === 'cancelled' ||
        pollResponse.status === 'expired'
      ) {
        throw new APICallError({
          message:
            pollResponse.error ??
            `Video generation failed with status: ${pollResponse.status}`,
          url: this.config.url({
            path: `/videos/${jobId}`,
            modelId: this.modelId,
          }),
          requestBodyValues: {},
          statusCode: 500,
          isRetryable: false,
        });
      }
    }

    throw new APICallError({
      message: `Video generation timed out after ${maxPollTimeMs}ms`,
      url: this.config.url({
        path: `/videos/${jobId}`,
        modelId: this.modelId,
      }),
      requestBodyValues: {},
      statusCode: 408,
      isRetryable: true,
    });
  }
}

function convertImageToFrameImage(
  file: VideoModelV4File,
): Record<string, unknown> {
  if (file.type === 'url') {
    return {
      type: 'image_url',
      image_url: { url: file.url },
      frame_type: 'first_frame',
    };
  }

  const url = buildFileDataUrl({
    data: file.data,
    mediaType: file.mediaType,
    defaultMediaType: 'image/png',
  });

  return {
    type: 'image_url',
    image_url: { url },
    frame_type: 'first_frame',
  };
}
