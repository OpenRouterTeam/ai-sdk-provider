/**
 * Regression test for GitHub issue #269
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/269
 *
 * Issue: "Add support for image_size parameter for google/gemini-3-pro-image-preview"
 *
 * User report:
 * - Model: "google/gemini-3-pro-image-preview"
 * - Endpoint: /chat/completions
 * - modalities: ["image", "text"]
 * - Currently supports: { "image_config": { "aspect_ratio": "16:9" } }
 * - Does NOT support: { "image_config": { "image_size": "4k" } }
 * - Request: "The API should include a parameter that allows requesting
 *   specific resolutions (1k, 2k, 4k)."
 *
 * Commenter report: "whatever I send as image_size it's always generating
 * 1024x1024 px, it does not work."
 */
import { generateText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 120_000,
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

function extractBase64FromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
  if (match?.[1]) {
    return match[1];
  }
  return dataUrl;
}

describe('Issue #269: image_size parameter for google/gemini-3-pro-image-preview', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  describe('Feature request: image_size should produce different resolutions', () => {
    it('should generate higher resolution image with 4k vs 1k image_size', async () => {
      const model = openrouter('google/gemini-3-pro-image-preview', {
        extraBody: {
          modalities: ['image', 'text'],
          image_config: {
            aspect_ratio: '1:1',
            image_size: '1k',
          },
        },
      });

      const result1k = await generateText({
        model,
        messages: [
          {
            role: 'user',
            content: 'Generate a simple red circle on a white background',
          },
        ],
      });

      const model4k = openrouter('google/gemini-3-pro-image-preview', {
        extraBody: {
          modalities: ['image', 'text'],
          image_config: {
            aspect_ratio: '1:1',
            image_size: '4k',
          },
        },
      });

      const result4k = await generateText({
        model: model4k,
        messages: [
          {
            role: 'user',
            content: 'Generate a simple red circle on a white background',
          },
        ],
      });

      expect(result1k.files).toBeDefined();
      expect(result1k.files?.length).toBeGreaterThan(0);
      expect(result4k.files).toBeDefined();
      expect(result4k.files?.length).toBeGreaterThan(0);

      const file1k = result1k.files?.[0];
      const file4k = result4k.files?.[0];

      expect(file1k).toBeDefined();
      expect(file4k).toBeDefined();

      const base641k = extractBase64FromDataUrl(file1k?.base64 ?? '');
      const base644k = extractBase64FromDataUrl(file4k?.base64 ?? '');

      const dim1k = getImageDimensions(base641k);
      const dim4k = getImageDimensions(base644k);

      expect(dim4k.width).toBeGreaterThan(dim1k.width);
      expect(dim4k.height).toBeGreaterThan(dim1k.height);
    });
  });

  describe('Workaround: image_size can be passed via extraBody', () => {
    it('should pass image_size via extraBody.image_config matching issue pattern', async () => {
      const model = openrouter('google/gemini-3-pro-image-preview', {
        extraBody: {
          modalities: ['image', 'text'],
          image_config: {
            aspect_ratio: '16:9',
            image_size: '4k',
          },
        },
      });

      const result = await generateText({
        model,
        messages: [
          {
            role: 'user',
            content: 'Generate a simple blue square on a white background',
          },
        ],
      });

      expect(result.files).toBeDefined();
      expect(result.files?.length).toBeGreaterThan(0);

      const file = result.files?.[0];
      expect(file).toBeDefined();
      expect(file?.base64).toBeTruthy();
    });

    it('should pass image_size via providerOptions.openrouter', async () => {
      const model = openrouter('google/gemini-3-pro-image-preview', {
        extraBody: {
          modalities: ['image', 'text'],
        },
      });

      const result = await generateText({
        model,
        messages: [
          {
            role: 'user',
            content: 'Generate a simple green triangle on a white background',
          },
        ],
        providerOptions: {
          openrouter: {
            image_config: {
              aspect_ratio: '1:1',
              image_size: '1k',
            },
          },
        },
      });

      expect(result.files).toBeDefined();
      expect(result.files?.length).toBeGreaterThan(0);

      const file = result.files?.[0];
      expect(file).toBeDefined();
      expect(file?.base64).toBeTruthy();
    });
  });
});
