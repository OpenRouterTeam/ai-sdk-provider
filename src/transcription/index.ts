import type {
  JSONObject,
  SharedV4Warning,
  TranscriptionModelV4,
  TranscriptionModelV4CallOptions,
} from '@ai-sdk/provider';
import type {
  OpenRouterTranscriptionModelId,
  OpenRouterTranscriptionSettings,
} from '../types/openrouter-transcription-settings';

import {
  combineHeaders,
  convertUint8ArrayToBase64,
  createJsonResponseHandler,
  postJsonToApi,
} from '@ai-sdk/provider-utils';
import { openrouterFailedResponseHandler } from '../schemas/error-response';
import { mergeProviderRouting } from '../utils/merge-provider-routing';
import { OpenRouterTranscriptionResponseSchema } from './schemas';

type OpenRouterTranscriptionConfig = {
  provider: string;
  headers: () => Record<string, string | undefined>;
  url: (options: { modelId: string; path: string }) => string;
  fetch?: typeof fetch;
  extraBody?: Record<string, unknown>;
};

type TranscriptionResult = Awaited<
  ReturnType<TranscriptionModelV4['doGenerate']>
>;

export class OpenRouterTranscriptionModel implements TranscriptionModelV4 {
  readonly specificationVersion = 'v4' as const;
  readonly provider = 'openrouter';
  readonly modelId: OpenRouterTranscriptionModelId;
  readonly settings: OpenRouterTranscriptionSettings;

  private readonly config: OpenRouterTranscriptionConfig;

  constructor(
    modelId: OpenRouterTranscriptionModelId,
    settings: OpenRouterTranscriptionSettings,
    config: OpenRouterTranscriptionConfig,
  ) {
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }

  async doGenerate(
    options: TranscriptionModelV4CallOptions,
  ): Promise<TranscriptionResult> {
    const {
      audio,
      mediaType,
      timestampGranularities,
      abortSignal,
      headers,
      providerOptions,
    } = options;

    const warnings: SharedV4Warning[] = [];

    const openrouterOptions =
      (providerOptions?.openrouter as Record<string, unknown>) || {};
    const { provider: runtimeProvider, ...restOpenrouterOptions } =
      openrouterOptions;

    const provider = mergeProviderRouting(
      [
        this.settings.provider,
        this.config.extraBody?.provider,
        this.settings.extraBody?.provider,
      ],
      runtimeProvider,
    );

    const bodyOptions: Record<string, unknown> = {
      ...this.config.extraBody,
      ...this.settings.extraBody,
      ...restOpenrouterOptions,
    };

    const requestedGranularities =
      bodyOptions.timestamp_granularities === undefined &&
      timestampGranularities !== undefined &&
      timestampGranularities.length > 0
        ? timestampGranularities
        : undefined;

    // Timestamps and speaker labels are only returned in `verbose_json`, and
    // some models reject `verbose_json`, so it is only requested when needed.
    const needsVerboseJson =
      requestedGranularities !== undefined ||
      bodyOptions.timestamp_granularities !== undefined ||
      bodyOptions.diarize === true;

    const body: Record<string, unknown> = {
      model: this.modelId,
      input_audio: {
        data:
          typeof audio === 'string' ? audio : convertUint8ArrayToBase64(audio),
        format: mediaTypeToAudioFormat(mediaType),
      },
      ...(needsVerboseJson && { response_format: 'verbose_json' }),
      ...(requestedGranularities !== undefined && {
        timestamp_granularities: requestedGranularities,
      }),
      ...(this.settings.user !== undefined && { user: this.settings.user }),
      ...bodyOptions,
      provider,
    };

    const {
      value: response,
      responseHeaders,
      rawValue,
    } = await postJsonToApi({
      url: this.config.url({
        path: '/audio/transcriptions',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers(), headers),
      body,
      failedResponseHandler: openrouterFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        OpenRouterTranscriptionResponseSchema,
      ),
      abortSignal,
      fetch: this.config.fetch,
    });

    const segments = (response.segments ?? []).map((segment) => ({
      text: segment.text,
      startSecond: segment.start,
      endSecond: segment.end,
    }));

    const words = response.words
      ?.filter((word) => word.type == null || word.type === 'word')
      .map((word) => ({
        text: word.word,
        startSecond: word.start,
        endSecond: word.end,
      }));

    const granularities = new Set(
      (body.timestamp_granularities as string[] | undefined) ?? [],
    );
    if (granularities.has('word') && response.words == null) {
      warnings.push({
        type: 'unsupported',
        feature: 'timestampGranularities: word',
        details: `${this.modelId} did not return word-level timestamps.`,
      });
    }
    if (granularities.has('segment') && response.segments == null) {
      warnings.push({
        type: 'unsupported',
        feature: 'timestampGranularities: segment',
        details: `${this.modelId} did not return segment-level timestamps.`,
      });
    }

    const generationId = getHeader(responseHeaders, 'x-generation-id');

    return {
      text: response.text,
      segments,
      ...(words !== undefined && { words }),
      language: response.language ?? undefined,
      durationInSeconds:
        response.duration ?? response.usage?.seconds ?? undefined,
      warnings,
      ...(response.usage != null && {
        usage: response.usage as JSONObject,
      }),
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: responseHeaders,
        body: rawValue,
      },
      providerMetadata: {
        openrouter: {
          generationId: generationId ?? null,
          cost: response.usage?.cost ?? null,
          // Raw words keep fields the AI SDK type drops, such as speaker
          // labels from `diarize` and per-word confidence.
          ...(response.words != null && {
            words: response.words as JSONObject[],
          }),
        },
      },
    };
  }
}

const SUBTYPE_TO_FORMAT: Record<string, string> = {
  mpeg: 'mp3',
  mpga: 'mp3',
  mp3: 'mp3',
  wav: 'wav',
  wave: 'wav',
  'vnd.wave': 'wav',
  mp4: 'm4a',
  m4a: 'm4a',
  vorbis: 'ogg',
};

/**
 * Maps an audio media type (e.g. `audio/mpeg`) to the `input_audio.format`
 * value the transcription endpoint expects (e.g. `mp3`). Unknown subtypes are
 * passed through so the API can decide whether it supports them.
 */
export function mediaTypeToAudioFormat(mediaType: string): string {
  const subtype = mediaType
    .split(';', 1)[0]!
    .trim()
    .toLowerCase()
    .replace(/^audio\//, '')
    .replace(/^x-/, '');
  return SUBTYPE_TO_FORMAT[subtype] ?? subtype;
}

function getHeader(
  headers: Record<string, string> | undefined,
  name: string,
): string | undefined {
  return Object.entries(headers ?? {}).find(
    ([key]) => key.toLowerCase() === name,
  )?.[1];
}
