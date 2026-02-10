/**
 * Regression test for GitHub issue #386
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/386
 *
 * Issue: "Support for `files` parameter in image generation"
 *
 * User report:
 * - OpenRouterImageModel.doGenerate() throws UnsupportedFunctionalityError
 *   when the `files` parameter is provided
 * - This prevents image editing and image-to-image generation use cases
 *   that are supported by the AI SDK's `generateImage` function through
 *   `prompt.images`
 */
import { deflateSync } from 'node:zlib';
import { generateImage } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 120_000,
});

function generateTestPng(): string {
  const width = 100;
  const height = 100;

  const rawData = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * 3 + 1);
    rawData[rowOffset] = 0;
    for (let x = 0; x < width; x++) {
      rawData[rowOffset + 1 + x * 3] = 255;
      rawData[rowOffset + 1 + x * 3 + 1] = 0;
      rawData[rowOffset + 1 + x * 3 + 2] = 0;
    }
  }

  const compressed = deflateSync(rawData);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf: Buffer): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i]!;
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function createChunk(type: string, data: Buffer): Buffer {
    const typeBuffer = Buffer.from(type);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc32Input = Buffer.concat([typeBuffer, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crc32Input));
    return Buffer.concat([length, typeBuffer, data, crc]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;

  const png = Buffer.concat([
    signature,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', compressed),
    createChunk('IEND', Buffer.alloc(0)),
  ]);

  return png.toString('base64');
}

describe('Issue #386: files parameter in image generation', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  it('should generate image from text-only prompt without regression', async () => {
    const result = await generateImage({
      model: openrouter.imageModel('google/gemini-2.5-flash-image'),
      prompt: 'A simple red circle on a white background',
    });

    expect(result.images).toBeDefined();
    expect(result.images.length).toBeGreaterThan(0);
    expect(result.images[0]?.base64).toBeTruthy();
  });

  it('should accept files parameter for image editing without throwing UnsupportedFunctionalityError', async () => {
    const testImageBase64 = generateTestPng();

    const result = await generateImage({
      model: openrouter.imageModel('google/gemini-2.5-flash-image'),
      prompt: {
        text: 'Add a blue border around this image',
        images: [`data:image/png;base64,${testImageBase64}`],
      },
    });

    expect(result.images).toBeDefined();
    expect(result.images.length).toBeGreaterThan(0);
    expect(result.images[0]?.base64).toBeTruthy();
  });
});
