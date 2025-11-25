import type {
  ImageModelV2,
  ImageModelV2CallOptions,
  ImageModelV2CallWarning,
  ImageModelV2ProviderMetadata,
} from '@ai-sdk/provider';
import type { OpenRouterModelConfig } from './openrouter-chat-language-model';
import type { OpenRouterImageSettings } from './openrouter-provider';

/**
 * Response format for OpenRouter's image generation endpoint.
 *
 * This follows the OpenAI-compatible images API format that OpenRouter uses.
 * Images can be returned as either base64-encoded data or temporary URLs.
 */
type OpenRouterImageResponse = {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
  model?: string;
};

/**
 * OpenRouter image generation model implementation.
 *
 * Provides access to image generation models like DALL-E 3, Stable Diffusion,
 * and others through OpenRouter's unified API. The implementation uses the
 * OpenAI-compatible images endpoint format.
 */
export class OpenRouterImageModel implements ImageModelV2 {
  readonly specificationVersion = 'v2' as const;
  readonly provider: string;
  readonly modelId: string;

  // Maximum images per request - limited by most restrictive provider.
  // DALL-E 3 supports 1, DALL-E 2 supports 10, SD models vary.
  readonly maxImagesPerCall = 10;

  private readonly settings: OpenRouterImageSettings;
  private readonly config: OpenRouterModelConfig;

  constructor(modelId: string, settings: OpenRouterImageSettings, config: OpenRouterModelConfig) {
    this.provider = config.provider;
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }

  /**
   * Generate images from a text prompt.
   *
   * Uses OpenRouter's OpenAI-compatible images endpoint. The SDK client isn't used
   * here because image generation requires direct control over request/response
   * handling for proper base64 image extraction.
   */
  async doGenerate(options: ImageModelV2CallOptions): Promise<{
    images: Array<string> | Array<Uint8Array>;
    warnings: Array<ImageModelV2CallWarning>;
    providerMetadata?: ImageModelV2ProviderMetadata;
    response: {
      timestamp: Date;
      modelId: string;
      headers: Record<string, string> | undefined;
    };
  }> {
    const fetchImpl = this.config.fetch ?? fetch;
    const warnings: ImageModelV2CallWarning[] = [];

    // Warn about unsupported AI SDK options.
    // OpenRouter's image API uses size (WxH) rather than aspect ratio.
    if (options.aspectRatio !== undefined) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'aspectRatio',
        details: 'OpenRouter image generation currently ignores aspect ratios.',
      });
    }

    // Deterministic seeds aren't universally supported across image models
    if (options.seed !== undefined) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'seed',
        details: 'OpenRouter image generation does not support deterministic seeds.',
      });
    }

    const requestHeaders: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
    };
    // Merge any additional headers from the call options
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        if (typeof value === 'string') {
          requestHeaders[key] = value;
        }
      }
    }

    // Build request body following OpenAI's images/generations format.
    // Request b64_json format for reliable image data extraction.
    const requestBody: Record<string, unknown> = {
      model: this.modelId,
      prompt: options.prompt,
      n: options.n ?? this.settings.n ?? 1,
      size: options.size ?? this.settings.size,
      quality: this.settings.quality,
      style: this.settings.style,
      user: this.settings.user,
      response_format: 'b64_json',
    };

    const providerOptions = options.providerOptions?.openrouter;
    if (providerOptions) {
      Object.assign(requestBody, providerOptions);
    }

    const sanitizedBody = Object.fromEntries(
      Object.entries(requestBody).filter(([, value]) => value !== undefined),
    );

    const response = await fetchImpl(`${this.config.baseURL}/images/generations`, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(sanitizedBody),
      signal: options.abortSignal,
    });

    const responseTimestamp = new Date();

    if (!response.ok) {
      throw new Error(`Image generation failed: ${response.statusText}`);
    }

    const data = (await response.json()) as OpenRouterImageResponse;
    const rawImages: Array<{
      b64_json?: string;
      url?: string;
    }> = Array.isArray(data?.data) ? data.data : [];

    const images = rawImages.map((item) => item.b64_json ?? item.url ?? '');
    const responseHeadersObject = Object.fromEntries(response.headers.entries());

    const providerMetadata: ImageModelV2ProviderMetadata | undefined = rawImages.length
      ? {
          openrouter: {
            images: rawImages,
          },
        }
      : undefined;

    return {
      images,
      warnings,
      providerMetadata,
      response: {
        timestamp: responseTimestamp,
        modelId: data?.model ?? this.modelId,
        headers: Object.keys(responseHeadersObject).length ? responseHeadersObject : undefined,
      },
    };
  }
}
