import type {
  ImageModelV2,
  ImageModelV2CallOptions,
  ImageModelV2CallWarning,
  ImageModelV2ProviderMetadata,
} from '@ai-sdk/provider';
import type { OpenRouterModelConfig } from './openrouter-chat-language-model';
import type { OpenRouterImageSettings } from './openrouter-provider';

/**
 * OpenRouter image generation model implementation
 */
type OpenRouterImageResponse = {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
  model?: string;
};

export class OpenRouterImageModel implements ImageModelV2 {
  readonly specificationVersion = 'v2' as const;
  readonly provider: string;
  readonly modelId: string;
  readonly maxImagesPerCall = 10;

  private readonly settings: OpenRouterImageSettings;
  private readonly config: OpenRouterModelConfig;

  constructor(modelId: string, settings: OpenRouterImageSettings, config: OpenRouterModelConfig) {
    this.provider = config.provider;
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }

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

    if (options.aspectRatio !== undefined) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'aspectRatio',
        details: 'OpenRouter image generation currently ignores aspect ratios.',
      });
    }

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
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        if (typeof value === 'string') {
          requestHeaders[key] = value;
        }
      }
    }

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
