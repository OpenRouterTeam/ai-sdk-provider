import type {
  ImageModelV2,
  ImageModelV2CallOptions,
  ImageModelV2CallWarning,
  ImageModelV2ProviderMetadata,
} from '@ai-sdk/provider';
import {
  postJsonToApi,
  createJsonResponseHandler,
} from '@ai-sdk/provider-utils';
import type {
  OpenRouterImageSettings,
  OpenRouterModelConfig,
  OpenRouterImageResponse,
} from './types';

/**
 * OpenRouter image generation model implementation
 */
export class OpenRouterImageModel implements ImageModelV2 {
  readonly specificationVersion = 'v2' as const;
  readonly provider: string;
  readonly modelId: string;
  readonly maxImagesPerCall = 10;

  private readonly settings: OpenRouterImageSettings;
  private readonly config: OpenRouterModelConfig;

  constructor(
    modelId: string,
    settings: OpenRouterImageSettings,
    config: OpenRouterModelConfig,
  ) {
    this.provider = config.provider;
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }

  /**
   * Generate images based on the prompt
   */
  async doGenerate(
    options: ImageModelV2CallOptions,
  ): Promise<{
    images: Array<string> | Array<Uint8Array>;
    warnings: Array<ImageModelV2CallWarning>;
    providerMetadata?: ImageModelV2ProviderMetadata;
    response: {
      timestamp: Date;
      modelId: string;
      headers: Record<string, string> | undefined;
    };
  }> {
    const warnings: ImageModelV2CallWarning[] = [];

    // Prepare the request body
    const body: Record<string, any> = {
      model: this.modelId,
      prompt: options.prompt,
      n: options.n ?? this.settings.n ?? 1,
      size: this.settings.size ?? '1024x1024',
      quality: this.settings.quality ?? 'standard',
      style: this.settings.style ?? 'vivid',
      user: this.settings.user,
    };

    // Handle response format
    if (options.providerOptions?.openrouter?.response_format) {
      body.response_format = options.providerOptions.openrouter.response_format;
    } else {
      // Default to b64_json for the V2 interface
      body.response_format = 'b64_json';
    }

    // Merge provider options
    const providerOptions = {
      ...this.settings.providerOptions?.openrouter,
      ...options.providerOptions?.openrouter,
    };

    if (providerOptions) {
      // Don't override response_format if already set
      const { response_format, ...otherOptions } = providerOptions;
      Object.assign(body, otherOptions);
    }

    // Combine headers
    const headers = {
      ...this.config.headers(),
      ...options.headers,
    };

    // Make the API call
    const { value: response } = await postJsonToApi({
      url: `${this.config.baseURL}/images/generations`,
      headers,
      body,
      failedResponseHandler: createJsonResponseHandler({} as any),
      successfulResponseHandler: createJsonResponseHandler({} as any),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const openRouterResponse = response as OpenRouterImageResponse;

    // Convert response to V2 format - return base64 strings
    const images: string[] = [];
    const imageMetadata: Array<{ revisedPrompt?: string }> = [];

    for (const item of openRouterResponse.data) {
      if (item.b64_json) {
        images.push(item.b64_json);
      } else if (item.url) {
        // If we got a URL, we need to fetch the image
        // For now, just return the URL as a string
        images.push(item.url);
      }

      if (item.revised_prompt) {
        imageMetadata.push({ revisedPrompt: item.revised_prompt });
      }
    }

    // Add warning if no images were generated
    if (images.length === 0) {
      warnings.push({
        type: 'other',
        message: 'No images were generated',
      });
    }

    // Add warning if fewer images than requested
    if (body.n && images.length < body.n) {
      warnings.push({
        type: 'other',
        message: `Requested ${body.n} images but only ${images.length} were generated`,
      });
    }

    return {
      images,
      warnings,
      providerMetadata: {
        openrouter: {
          images: imageMetadata,
        },
      },
      response: {
        timestamp: new Date(openRouterResponse.created * 1000),
        modelId: this.modelId,
        headers: undefined,
      },
    };
  }
}