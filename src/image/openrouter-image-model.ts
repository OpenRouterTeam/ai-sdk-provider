import type {
  ImageModelV3,
  ImageModelV3CallOptions,
  SharedV3Warning,
} from '@ai-sdk/provider';

/**
 * OpenRouter image model implementing AI SDK V3 ImageModelV3 interface.
 *
 * Note: Image generation is Tier 3 functionality. The doGenerate method
 * throws an error with guidance on tracking progress.
 */
export class OpenRouterImageModel implements ImageModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider = 'openrouter';
  readonly modelId: string;

  /**
   * Maximum number of images that can be generated in a single API call.
   */
  readonly maxImagesPerCall = 1;

  constructor(modelId: string, _settings: unknown) {
    this.modelId = modelId;
  }

  async doGenerate(_options: ImageModelV3CallOptions): Promise<{
    images: Array<string> | Array<Uint8Array>;
    warnings: Array<SharedV3Warning>;
    response: {
      timestamp: Date;
      modelId: string;
      headers: Record<string, string> | undefined;
    };
  }> {
    throw new Error(
      'Image generation not yet supported. ' +
        'See: https://github.com/OpenRouterTeam/ai-sdk-provider/issues/new?title=Image+generation+support'
    );
  }
}
