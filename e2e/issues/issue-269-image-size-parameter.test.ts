/**
 * Regression test for GitHub issue #269
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/269
 *
 * Issue: "Add support for image_size parameter for google/gemini-3-pro-image-preview"
 *
 * Root cause: The image_size parameter (values: "1K", "2K", "4K") is a Gemini-specific
 * feature for controlling image resolution. This is supported via the standard
 * provider-specific options mechanism (providerOptions.openrouter and extraBody).
 *
 * This test verifies that image_size can be passed to the OpenRouter API via:
 * - providerOptions.openrouter.image_config.image_size (per-request)
 * - settings.extraBody.image_config.image_size (per-model)
 */
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

describe('Issue #269: image_size parameter for Gemini image generation', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  it('should generate image with image_size via providerOptions.openrouter.image_config', async () => {
    const model = openrouter.imageModel('google/gemini-2.5-flash-image');

    const result = await model.doGenerate({
      prompt: 'A simple red circle on a white background',
      n: 1,
      size: undefined,
      aspectRatio: '1:1',
      seed: 12345,
      files: undefined,
      mask: undefined,
      providerOptions: {
        openrouter: {
          image_config: {
            image_size: '1K',
          },
        },
      },
    });

    expect(result.images.length).toBeGreaterThan(0);
    expect(result.images[0]).toBeTruthy();
    // Image should be base64 encoded
    expect(result.images[0]).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('should generate image with image_size via settings.extraBody.image_config', async () => {
    const model = openrouter.imageModel('google/gemini-2.5-flash-image', {
      extraBody: {
        image_config: {
          aspect_ratio: '1:1',
          image_size: '1K',
        },
      },
    });

    const result = await model.doGenerate({
      prompt: 'A simple blue square on a white background',
      n: 1,
      size: undefined,
      aspectRatio: undefined,
      seed: 12345,
      files: undefined,
      mask: undefined,
      providerOptions: {},
    });

    expect(result.images.length).toBeGreaterThan(0);
    expect(result.images[0]).toBeTruthy();
    // Image should be base64 encoded
    expect(result.images[0]).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('should support both aspect_ratio and image_size together', async () => {
    const model = openrouter.imageModel('google/gemini-2.5-flash-image');

    const result = await model.doGenerate({
      prompt: 'A simple green triangle on a white background',
      n: 1,
      size: undefined,
      aspectRatio: undefined,
      seed: 12345,
      files: undefined,
      mask: undefined,
      providerOptions: {
        openrouter: {
          image_config: {
            aspect_ratio: '16:9',
            image_size: '2K',
          },
        },
      },
    });

    expect(result.images.length).toBeGreaterThan(0);
    expect(result.images[0]).toBeTruthy();
    // Image should be base64 encoded
    expect(result.images[0]).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});
