import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamResult,
} from '@ai-sdk/provider';

/**
 * OpenRouter chat language model implementing AI SDK V3 LanguageModelV3 interface.
 *
 * Uses the OpenRouter Responses API for chat completions.
 */
export class OpenRouterChatLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider = 'openrouter';
  readonly modelId: string;

  /**
   * Supported URL patterns by media type.
   * OpenRouter supports image URLs and PDF URLs natively.
   */
  readonly supportedUrls: Record<string, RegExp[]> = {
    'image/*': [/^https?:\/\/.*$/],
    'application/pdf': [/^https?:\/\/.*$/],
  };

  constructor(modelId: string, _settings: unknown) {
    this.modelId = modelId;
  }

  async doGenerate(
    _options: LanguageModelV3CallOptions
  ): Promise<LanguageModelV3GenerateResult> {
    throw new Error('Not implemented');
  }

  async doStream(
    _options: LanguageModelV3CallOptions
  ): Promise<LanguageModelV3StreamResult> {
    throw new Error('Not implemented');
  }
}
