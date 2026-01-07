import type { ImageModelV3CallOptions } from '@ai-sdk/provider';

import { describe, expect, it } from 'vitest';
import { OpenRouterImageModel } from '../../image/openrouter-image-model.js';

/**
 * Minimal valid options for ImageModelV3CallOptions
 */
function createTestOptions(
  overrides: Partial<ImageModelV3CallOptions> = {},
): ImageModelV3CallOptions {
  return {
    prompt: 'A beautiful sunset',
    n: 1,
    size: undefined,
    aspectRatio: undefined,
    seed: undefined,
    files: [],
    mask: undefined,
    headers: {},
    providerOptions: {},
    abortSignal: undefined,
    ...overrides,
  };
}

describe('OpenRouterImageModel', () => {
  describe('constructor', () => {
    it('sets specificationVersion to v3', () => {
      const model = new OpenRouterImageModel('test/model', {});
      expect(model.specificationVersion).toBe('v3');
    });

    it('sets provider to openrouter', () => {
      const model = new OpenRouterImageModel('test/model', {});
      expect(model.provider).toBe('openrouter');
    });

    it('sets modelId correctly', () => {
      const model = new OpenRouterImageModel('stability-ai/sdxl', {});
      expect(model.modelId).toBe('stability-ai/sdxl');
    });

    it('sets maxImagesPerCall to 1', () => {
      const model = new OpenRouterImageModel('test/model', {});
      expect(model.maxImagesPerCall).toBe(1);
    });
  });

  describe('doGenerate', () => {
    it('throws an error indicating image generation is not yet supported', async () => {
      const model = new OpenRouterImageModel('test/model', {});

      await expect(model.doGenerate(createTestOptions())).rejects.toThrow(
        'Image generation not yet supported',
      );
    });

    it('includes issue tracker link in error message', async () => {
      const model = new OpenRouterImageModel('test/model', {});

      await expect(
        model.doGenerate(createTestOptions({ prompt: 'Test prompt' })),
      ).rejects.toThrow(
        'https://github.com/OpenRouterTeam/ai-sdk-provider/issues/new',
      );
    });
  });
});
