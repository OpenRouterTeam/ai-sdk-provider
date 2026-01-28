/**
 * Regression test for GitHub issue #269
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/269
 *
 * Issue: "Add support for image_size parameter for google/gemini-3-pro-image-preview"
 *
 * The user reports that while aspect_ratio is supported via image_config,
 * the image_size parameter (values: "1K", "2K", "4K") is not supported.
 * They request: "The API should include a parameter that allows requesting
 * specific resolutions (1k, 2k, 4k)."
 *
 * Status: UNRESOLVED - The image_size parameter can be passed through the SDK
 * via providerOptions, but it does not actually affect the output resolution.
 * Both 1K and 2K requests return identical 1024x1024 images.
 */
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

function getImageDimensions(base64Data: string): {
  width: number;
  height: number;
} {
  const buffer = Buffer.from(base64Data, 'base64');

  const pngSignature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  if (buffer.subarray(0, 8).equals(pngSignature)) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) {
        break;
      }
      const marker = buffer[offset + 1] as number;
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      ) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }
      const segmentLength = buffer.readUInt16BE(offset + 2);
      offset += 2 + segmentLength;
    }
  }

  throw new Error('Unable to determine image dimensions - unsupported format');
}

describe('Issue #269: image_size parameter for Gemini image generation', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  describe('Feature request: image_size should produce different resolutions', () => {
    it('should generate higher resolution image with 2K vs 1K image_size', async () => {
      const model = openrouter.imageModel('google/gemini-2.5-flash-image');

      const result1K = await model.doGenerate({
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

      const result2K = await model.doGenerate({
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
              image_size: '2K',
            },
          },
        },
      });

      expect(result1K.images.length).toBeGreaterThan(0);
      expect(result2K.images.length).toBeGreaterThan(0);

      const dim1K = getImageDimensions(result1K.images[0] as string);
      const dim2K = getImageDimensions(result2K.images[0] as string);

      expect(dim2K.width).toBeGreaterThan(dim1K.width);
      expect(dim2K.height).toBeGreaterThan(dim1K.height);
    });
  });

  describe('Workaround: image_size can be passed via providerOptions', () => {
    it('should pass image_size via providerOptions.openrouter.image_config', async () => {
      const model = openrouter.imageModel('google/gemini-2.5-flash-image');

      const result = await model.doGenerate({
        prompt: 'A simple blue square on a white background',
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
      expect(result.images[0]).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('should pass image_size via settings.extraBody.image_config', async () => {
      const model = openrouter.imageModel('google/gemini-2.5-flash-image', {
        extraBody: {
          image_config: {
            aspect_ratio: '1:1',
            image_size: '1K',
          },
        },
      });

      const result = await model.doGenerate({
        prompt: 'A simple green triangle on a white background',
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
      expect(result.images[0]).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });
  });
});
