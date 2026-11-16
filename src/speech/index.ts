import type {
  SharedV4Warning,
  SpeechModelV4,
  SpeechModelV4CallOptions,
} from '@ai-sdk/provider';
import type {
  OpenRouterSpeechModelId,
  OpenRouterSpeechSettings,
} from '../types/openrouter-speech-settings';

import {
  combineHeaders,
  createBinaryResponseHandler,
  postJsonToApi,
} from '@ai-sdk/provider-utils';
import { openrouterFailedResponseHandler } from '../schemas/error-response';
import { mergeProviderRouting } from '../utils/merge-provider-routing';

type OpenRouterSpeechConfig = {
  provider: string;
  headers: () => Record<string, string | undefined>;
  url: (options: { modelId: string; path: string }) => string;
  fetch?: typeof fetch;
  extraBody?: Record<string, unknown>;
};

type SpeechResult = Awaited<ReturnType<SpeechModelV4['doGenerate']>>;

export class OpenRouterSpeechModel implements SpeechModelV4 {
  readonly specificationVersion = 'v4' as const;
  readonly provider = 'openrouter';
  readonly modelId: OpenRouterSpeechModelId;
  readonly settings: OpenRouterSpeechSettings;

  private readonly config: OpenRouterSpeechConfig;

  constructor(
    modelId: OpenRouterSpeechModelId,
    settings: OpenRouterSpeechSettings,
    config: OpenRouterSpeechConfig,
  ) {
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }

  async doGenerate(options: SpeechModelV4CallOptions): Promise<SpeechResult> {
    const {
      text,
      voice,
      outputFormat,
      instructions,
      speed,
      language,
      abortSignal,
      headers,
      providerOptions,
    } = options;

    const warnings: SharedV4Warning[] = [];

    if (language !== undefined) {
      warnings.push({
        type: 'unsupported',
        feature: 'language',
        details:
          'OpenRouter speech generation has no language parameter; the language is inferred from the input text.',
      });
    }

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

    const body: Record<string, unknown> = {
      model: this.modelId,
      input: text,
      ...(voice !== undefined && { voice }),
      ...(outputFormat !== undefined && { response_format: outputFormat }),
      ...(instructions !== undefined && { instructions }),
      ...(speed !== undefined && { speed }),
      ...(this.settings.user !== undefined && { user: this.settings.user }),
      ...this.config.extraBody,
      ...this.settings.extraBody,
      ...restOpenrouterOptions,
      provider,
    };

    const { value: audio, responseHeaders } = await postJsonToApi({
      url: this.config.url({
        path: '/audio/speech',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers(), headers),
      body,
      failedResponseHandler: openrouterFailedResponseHandler,
      successfulResponseHandler: createBinaryResponseHandler(),
      abortSignal,
      fetch: this.config.fetch,
    });

    const generationId = Object.entries(responseHeaders ?? {}).find(
      ([key]) => key.toLowerCase() === 'x-generation-id',
    )?.[1];

    return {
      audio,
      warnings,
      request: { body: JSON.stringify(body) },
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: responseHeaders,
      },
      providerMetadata: {
        openrouter: {
          generationId: generationId ?? null,
        },
      },
    };
  }
}
