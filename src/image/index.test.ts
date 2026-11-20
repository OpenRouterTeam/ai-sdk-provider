import type { SharedV4ProviderOptions } from '@ai-sdk/provider';

import { APICallError, UnsupportedFunctionalityError } from '@ai-sdk/provider';
import {
  convertBase64ToUint8Array,
  DownloadError,
} from '@ai-sdk/provider-utils';
import { generateImage } from 'ai';
import { describe, expect, it } from 'vitest';
import { createOpenRouter } from '../provider';
import { OpenRouterImageModel } from './index';

const TEST_IMAGE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function createMockFetch(imageBase64: string) {
  return async (
    _url: URL | RequestInfo,
    _init?: RequestInit,
  ): Promise<Response> => {
    return new Response(
      JSON.stringify({
        created: 1711115037,
        data: [
          {
            b64_json: imageBase64,
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 100,
          total_tokens: 110,
        },
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      },
    );
  };
}

function createCapturingMockFetch(imageBase64: string) {
  let capturedBody: Record<string, unknown> | undefined;
  let capturedUrl: string | undefined;
  const fetch = async (
    url: URL | RequestInfo,
    init?: RequestInit,
  ): Promise<Response> => {
    capturedBody = JSON.parse(init?.body as string);
    capturedUrl = url.toString();
    return new Response(
      JSON.stringify({
        created: 1711115037,
        data: [
          {
            b64_json: imageBase64,
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 100,
          total_tokens: 110,
        },
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      },
    );
  };
  return {
    fetch,
    get capturedBody() {
      return capturedBody;
    },
    get capturedUrl() {
      return capturedUrl;
    },
  };
}

function generate(
  model: OpenRouterImageModel,
  providerOptions: SharedV4ProviderOptions,
) {
  return model.doGenerate({
    prompt: 'A cat',
    n: 1,
    size: undefined,
    aspectRatio: undefined,
    seed: undefined,
    files: undefined,
    mask: undefined,
    providerOptions,
  });
}

describe('OpenRouterImageModel', () => {
  describe('provider methods', () => {
    it('should expose imageModel method', () => {
      const provider = createOpenRouter({ apiKey: 'test-key' });
      expect(provider.imageModel).toBeDefined();
      expect(typeof provider.imageModel).toBe('function');
    });

    it('should create an image model instance', () => {
      const provider = createOpenRouter({ apiKey: 'test-key' });
      const model = provider.imageModel('google/gemini-2.5-flash-image');
      expect(model).toBeInstanceOf(OpenRouterImageModel);
      expect(model.modelId).toBe('google/gemini-2.5-flash-image');
      expect(model.provider).toBe('openrouter');
      expect(model.specificationVersion).toBe('v4');
    });

    it('should have maxImagesPerCall set to 10', () => {
      const provider = createOpenRouter({ apiKey: 'test-key' });
      const model = provider.imageModel('google/gemini-2.5-flash-image');
      expect(model.maxImagesPerCall).toBe(10);
    });

    it('should declare file input support and no mask support', () => {
      const provider = createOpenRouter({ apiKey: 'test-key' });
      const model = provider.imageModel('google/gemini-2.5-flash-image');
      expect(model.supportsFileInputs).toBe(true);
      expect(model.supportsMaskInputs).toBe(false);
    });
  });

  describe('doGenerate', () => {
    it('should post to /images endpoint', async () => {
      const mock = createCapturingMockFetch(TEST_IMAGE_BASE64);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      await model.doGenerate({
        prompt: 'A cat',
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: undefined,
        mask: undefined,
        providerOptions: {},
      });

      expect(mock.capturedUrl).toBe('https://openrouter.ai/api/v1/images');
    });

    it('should generate an image from a text prompt', async () => {
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: createMockFetch(TEST_IMAGE_BASE64),
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      const result = await model.doGenerate({
        prompt: 'A cute orange cat sitting on a windowsill at sunset',
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: undefined,
        mask: undefined,
        providerOptions: {},
      });

      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toBe(TEST_IMAGE_BASE64);
      expect(result.warnings).toEqual([]);
      expect(result.response.modelId).toBe('google/gemini-2.5-flash-image');
    });

    it('should handle responses without created timestamp', async () => {
      const mockFetchWithoutCreated = async (
        _url: URL | RequestInfo,
        _init?: RequestInit,
      ): Promise<Response> => {
        return new Response(
          JSON.stringify({
            data: [
              {
                b64_json: TEST_IMAGE_BASE64,
              },
            ],
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        );
      };

      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetchWithoutCreated,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      const result = await model.doGenerate({
        prompt: 'A cat',
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: undefined,
        mask: undefined,
        providerOptions: {},
      });

      expect(result.images).toEqual([TEST_IMAGE_BASE64]);
    });

    it('should send prompt directly in the request body', async () => {
      const mock = createCapturingMockFetch(TEST_IMAGE_BASE64);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      await model.doGenerate({
        prompt: 'Generate a cat',
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: undefined,
        mask: undefined,
        providerOptions: {},
      });

      expect(mock.capturedBody?.prompt).toBe('Generate a cat');
      expect(mock.capturedBody?.model).toBe('google/gemini-2.5-flash-image');
      // Should not have messages or modalities (legacy chat format)
      expect(mock.capturedBody?.messages).toBeUndefined();
      expect(mock.capturedBody?.modalities).toBeUndefined();
    });

    it('should pass aspect_ratio parameter', async () => {
      const mock = createCapturingMockFetch(TEST_IMAGE_BASE64);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      await model.doGenerate({
        prompt: 'A landscape photo',
        n: 1,
        size: undefined,
        aspectRatio: '16:9',
        seed: undefined,
        files: undefined,
        mask: undefined,
        providerOptions: {},
      });

      expect(mock.capturedBody?.aspect_ratio).toBe('16:9');
      // Should not use legacy image_config wrapper
      expect(mock.capturedBody?.image_config).toBeUndefined();
    });

    it('should pass size parameter', async () => {
      const mock = createCapturingMockFetch(TEST_IMAGE_BASE64);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      await model.doGenerate({
        prompt: 'A cat',
        n: 1,
        size: '1024x1024',
        aspectRatio: undefined,
        seed: undefined,
        files: undefined,
        mask: undefined,
        providerOptions: {},
      });

      expect(mock.capturedBody?.size).toBe('1024x1024');
    });

    it('should pass n parameter', async () => {
      const mock = createCapturingMockFetch(TEST_IMAGE_BASE64);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      await model.doGenerate({
        prompt: 'A cat',
        n: 3,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: undefined,
        mask: undefined,
        providerOptions: {},
      });

      expect(mock.capturedBody?.n).toBe(3);
    });

    it('should pass seed parameter', async () => {
      const mock = createCapturingMockFetch(TEST_IMAGE_BASE64);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      await model.doGenerate({
        prompt: 'A cat',
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: 12345,
        files: undefined,
        mask: undefined,
        providerOptions: {},
      });

      expect(mock.capturedBody?.seed).toBe(12345);
    });

    it('should include base64 file as input_references', async () => {
      const mock = createCapturingMockFetch(TEST_IMAGE_BASE64);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      const result = await model.doGenerate({
        prompt: 'Edit this image',
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: [
          {
            type: 'file',
            mediaType: 'image/png',
            data: TEST_IMAGE_BASE64,
          },
        ],
        mask: undefined,
        providerOptions: {},
      });

      expect(result.images).toHaveLength(1);

      const inputRefs = mock.capturedBody?.input_references as Array<
        Record<string, unknown>
      >;
      expect(inputRefs).toHaveLength(1);
      expect(inputRefs[0]).toEqual({
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${TEST_IMAGE_BASE64}`,
        },
      });
    });

    it('should include URL file as input_references', async () => {
      const mock = createCapturingMockFetch(TEST_IMAGE_BASE64);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      await model.doGenerate({
        prompt: 'Edit this image',
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: [
          {
            type: 'url',
            url: 'https://example.com/image.png',
          },
        ],
        mask: undefined,
        providerOptions: {},
      });

      const inputRefs = mock.capturedBody?.input_references as Array<
        Record<string, unknown>
      >;
      expect(inputRefs).toHaveLength(1);
      expect(inputRefs[0]).toEqual({
        type: 'image_url',
        image_url: {
          url: 'https://example.com/image.png',
        },
      });
    });

    it('should include Uint8Array file as base64 input_references', async () => {
      const mock = createCapturingMockFetch(TEST_IMAGE_BASE64);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      const binaryData = new Uint8Array([137, 80, 78, 71]);

      await model.doGenerate({
        prompt: 'Edit this image',
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: [
          {
            type: 'file',
            mediaType: 'image/png',
            data: binaryData,
          },
        ],
        mask: undefined,
        providerOptions: {},
      });

      const inputRefs = mock.capturedBody?.input_references as Array<
        Record<string, unknown>
      >;
      expect(inputRefs).toHaveLength(1);
      const imageUrlPart = inputRefs[0] as {
        type: string;
        image_url: { url: string };
      };
      expect(imageUrlPart.type).toBe('image_url');
      expect(imageUrlPart.image_url.url).toMatch(/^data:image\/png;base64,/);
    });

    it('should include multiple files as multiple input_references', async () => {
      const mock = createCapturingMockFetch(TEST_IMAGE_BASE64);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      await model.doGenerate({
        prompt: 'Combine these images',
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: [
          {
            type: 'file',
            mediaType: 'image/png',
            data: TEST_IMAGE_BASE64,
          },
          {
            type: 'url',
            url: 'https://example.com/second.png',
          },
        ],
        mask: undefined,
        providerOptions: {},
      });

      const inputRefs = mock.capturedBody?.input_references as Array<
        Record<string, unknown>
      >;
      expect(inputRefs).toHaveLength(2);
      expect(inputRefs[0]?.type).toBe('image_url');
      expect(inputRefs[1]?.type).toBe('image_url');
    });

    it('should not include input_references when no files are provided', async () => {
      const mock = createCapturingMockFetch(TEST_IMAGE_BASE64);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      await model.doGenerate({
        prompt: 'Generate a cat',
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: undefined,
        mask: undefined,
        providerOptions: {},
      });

      expect(mock.capturedBody?.input_references).toBeUndefined();
    });

    it('should default to image/png when file mediaType is undefined', async () => {
      const mock = createCapturingMockFetch(TEST_IMAGE_BASE64);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      await model.doGenerate({
        prompt: 'Edit this image',
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: [
          {
            type: 'file',
            mediaType: undefined as unknown as string,
            data: TEST_IMAGE_BASE64,
          },
        ],
        mask: undefined,
        providerOptions: {},
      });

      const inputRefs = mock.capturedBody?.input_references as Array<
        Record<string, unknown>
      >;
      expect(inputRefs).toHaveLength(1);
      const imageUrlPart = inputRefs[0] as {
        type: string;
        image_url: { url: string };
      };
      expect(imageUrlPart.image_url.url).toBe(
        `data:image/png;base64,${TEST_IMAGE_BASE64}`,
      );
    });

    it('should default to image/png when Uint8Array file has undefined mediaType', async () => {
      const mock = createCapturingMockFetch(TEST_IMAGE_BASE64);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      const binaryData = new Uint8Array([137, 80, 78, 71]);

      await model.doGenerate({
        prompt: 'Edit this image',
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: [
          {
            type: 'file',
            mediaType: undefined as unknown as string,
            data: binaryData,
          },
        ],
        mask: undefined,
        providerOptions: {},
      });

      const inputRefs = mock.capturedBody?.input_references as Array<
        Record<string, unknown>
      >;
      const imageUrlPart = inputRefs[0] as {
        type: string;
        image_url: { url: string };
      };
      expect(imageUrlPart.image_url.url).toMatch(/^data:image\/png;base64,/);
    });

    it('should passthrough existing data URL without re-wrapping', async () => {
      const mock = createCapturingMockFetch(TEST_IMAGE_BASE64);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      const dataUrl = `data:image/jpeg;base64,${TEST_IMAGE_BASE64}`;

      await model.doGenerate({
        prompt: 'Edit this image',
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: [
          {
            type: 'file',
            mediaType: 'image/jpeg',
            data: dataUrl,
          },
        ],
        mask: undefined,
        providerOptions: {},
      });

      const inputRefs = mock.capturedBody?.input_references as Array<
        Record<string, unknown>
      >;
      const imageUrlPart = inputRefs[0] as {
        type: string;
        image_url: { url: string };
      };
      expect(imageUrlPart.image_url.url).toBe(dataUrl);
    });

    it('should throw UnsupportedFunctionalityError when mask parameter is provided', async () => {
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: createMockFetch(TEST_IMAGE_BASE64),
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      await expect(
        model.doGenerate({
          prompt: 'Inpaint this area',
          n: 1,
          size: undefined,
          aspectRatio: undefined,
          seed: undefined,
          files: undefined,
          mask: {
            type: 'file',
            mediaType: 'image/png',
            data: TEST_IMAGE_BASE64,
          },
          providerOptions: {},
        }),
      ).rejects.toThrow(UnsupportedFunctionalityError);
    });

    it('should handle multiple images in response data', async () => {
      const mockFetchMultiple = async (
        _url: URL | RequestInfo,
        _init?: RequestInit,
      ): Promise<Response> => {
        return new Response(
          JSON.stringify({
            created: 1711115037,
            data: [
              { b64_json: TEST_IMAGE_BASE64 },
              { b64_json: TEST_IMAGE_BASE64 },
            ],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 200,
              total_tokens: 210,
            },
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        );
      };

      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetchMultiple,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      const result = await model.doGenerate({
        prompt: 'A cat',
        n: 2,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: undefined,
        mask: undefined,
        providerOptions: {},
      });

      expect(result.images).toHaveLength(2);
      expect(result.images[0]).toBe(TEST_IMAGE_BASE64);
      expect(result.images[1]).toBe(TEST_IMAGE_BASE64);
    });

    it('should throw NoContentGeneratedError when data array is empty', async () => {
      const mockFetchEmptyData = async (
        _url: URL | RequestInfo,
        _init?: RequestInit,
      ): Promise<Response> => {
        return new Response(
          JSON.stringify({
            created: 1711115037,
            data: [],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 0,
              total_tokens: 10,
            },
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        );
      };

      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetchEmptyData,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      await expect(
        model.doGenerate({
          prompt: 'A cat',
          n: 1,
          size: undefined,
          aspectRatio: undefined,
          seed: undefined,
          files: undefined,
          mask: undefined,
          providerOptions: {},
        }),
      ).rejects.toThrow('No images in response');
    });

    it('should pass provider routing settings', async () => {
      const mock = createCapturingMockFetch(TEST_IMAGE_BASE64);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image', {
        provider: {
          order: ['google'],
          allow_fallbacks: false,
        },
      });

      await model.doGenerate({
        prompt: 'A cat',
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: undefined,
        mask: undefined,
        providerOptions: {},
      });

      expect(mock.capturedBody?.provider).toEqual({
        order: ['google'],
        allow_fallbacks: false,
      });
    });

    it('should include usage information when available', async () => {
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: createMockFetch(TEST_IMAGE_BASE64),
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      const result = await model.doGenerate({
        prompt: 'A cat',
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: undefined,
        mask: undefined,
        providerOptions: {},
      });

      expect(result.usage).toEqual({
        inputTokens: 10,
        outputTokens: 100,
        totalTokens: 110,
      });
    });

    it('should apply runtime providerOptions.openrouter to request', async () => {
      const mock = createCapturingMockFetch(TEST_IMAGE_BASE64);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      await model.doGenerate({
        prompt: 'A cat',
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: undefined,
        mask: undefined,
        providerOptions: {
          openrouter: {
            custom_field: 'test_value',
            provider: {
              order: ['google'],
            },
          },
        },
      });

      expect(mock.capturedBody?.custom_field).toBe('test_value');
      expect(mock.capturedBody?.provider).toEqual({
        order: ['google'],
      });
    });

    it('should merge runtime providerOptions.openrouter.provider with configured model provider preferences', async () => {
      const mock = createCapturingMockFetch(TEST_IMAGE_BASE64);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image', {
        provider: {
          order: ['google'],
          allow_fallbacks: true,
          sort: 'price',
        },
      });

      await generate(model, {
        openrouter: { provider: { order: ['black-forest-labs'] } },
      });

      expect(mock.capturedBody?.provider).toEqual({
        order: ['black-forest-labs'],
        allow_fallbacks: true,
        sort: 'price',
      });
    });

    it('should preserve configured provider preferences when runtime provider options omit provider', async () => {
      const mock = createCapturingMockFetch(TEST_IMAGE_BASE64);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image', {
        provider: {
          order: ['google'],
          allow_fallbacks: true,
        },
      });

      await generate(model, { openrouter: { custom_field: 'test' } });

      expect(mock.capturedBody?.provider).toEqual({
        order: ['google'],
        allow_fallbacks: true,
      });
      expect(mock.capturedBody?.custom_field).toBe('test');
    });

    it('should keep configured provider preferences when runtime provider is an array', async () => {
      const mock = createCapturingMockFetch(TEST_IMAGE_BASE64);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image', {
        provider: {
          order: ['google'],
          allow_fallbacks: true,
        },
      });

      await generate(model, {
        openrouter: { provider: ['black-forest-labs'] },
      });

      expect(mock.capturedBody?.provider).toEqual({
        order: ['google'],
        allow_fallbacks: true,
      });
    });

    it('should clear all provider routing when runtime provider is null', async () => {
      const mock = createCapturingMockFetch(TEST_IMAGE_BASE64);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
        extraBody: { provider: { data_collection: 'deny' } },
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image', {
        provider: { order: ['google'] },
        extraBody: { provider: { allow_fallbacks: false } },
      });

      await generate(model, { openrouter: { provider: null } });

      expect(mock.capturedBody).not.toHaveProperty('provider');
    });

    it('should not leak a non-object extraBody provider into the body', async () => {
      const mock = createCapturingMockFetch(TEST_IMAGE_BASE64);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image', {
        extraBody: { provider: null },
      });

      await generate(model, { openrouter: {} });

      expect(mock.capturedBody).not.toHaveProperty('provider');
    });

    it('should merge config extraBody, model provider, and runtime provider options', async () => {
      const mock = createCapturingMockFetch(TEST_IMAGE_BASE64);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
        extraBody: {
          provider: {
            data_collection: 'deny',
          },
        },
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image', {
        provider: {
          order: ['google'],
          allow_fallbacks: true,
        },
      });

      await generate(model, {
        openrouter: { provider: { order: ['black-forest-labs'] } },
      });

      expect(mock.capturedBody?.provider).toEqual({
        data_collection: 'deny',
        order: ['black-forest-labs'],
        allow_fallbacks: true,
      });
    });

    it('should let extraBody.provider override settings.provider before runtime options', async () => {
      const mock = createCapturingMockFetch(TEST_IMAGE_BASE64);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image', {
        provider: {
          order: ['google'],
          sort: 'price',
          allow_fallbacks: true,
        },
        extraBody: {
          provider: {
            order: ['openai'],
            sort: 'latency',
          },
        },
      });

      await generate(model, {
        openrouter: { provider: { sort: 'throughput' } },
      });

      expect(mock.capturedBody?.provider).toEqual({
        order: ['openai'],
        sort: 'throughput',
        allow_fallbacks: true,
      });
    });
  });

  describe('signed URL responses', () => {
    const TEST_IMAGE_BYTES = convertBase64ToUint8Array(TEST_IMAGE_BASE64);
    const SIGNED_URL_1 =
      'https://storage.googleapis.com/generated-media/v1/image-1.png?X-Goog-Signature=abc123';
    const SIGNED_URL_2 =
      'https://storage.googleapis.com/generated-media/v1/image-2.png?X-Goog-Signature=def456';

    it('should parse a signed URL response, download bytes without auth headers, and expose providerMetadata', async () => {
      const requests: Array<{ url: string; headers: Headers }> = [];
      let capturedBody: Record<string, unknown> | undefined;

      const mockFetch = async (
        url: URL | RequestInfo,
        init?: RequestInit,
      ): Promise<Response> => {
        const urlStr = url.toString();
        requests.push({
          url: urlStr,
          headers: new Headers(init?.headers),
        });

        if (urlStr === 'https://openrouter.ai/api/v1/images') {
          capturedBody = JSON.parse(init?.body as string);
          return new Response(
            JSON.stringify({
              created: 1748372400,
              data: [
                {
                  url: SIGNED_URL_1,
                  media_type: 'image/png',
                },
              ],
              expires_at: 1748458800,
              usage: {
                prompt_tokens: 10,
                completion_tokens: 100,
                total_tokens: 110,
              },
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          );
        }

        if (urlStr === SIGNED_URL_1) {
          return new Response(TEST_IMAGE_BYTES, {
            status: 200,
            headers: { 'content-type': 'image/png' },
          });
        }

        return new Response('Not Found', { status: 404 });
      };

      const provider = createOpenRouter({
        apiKey: 'secret-api-key',
        fetch: mockFetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      const result = await generate(model, {
        openrouter: { response_format: 'url' },
      });

      expect(capturedBody?.response_format).toBe('url');
      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toBeInstanceOf(Uint8Array);
      expect(result.images[0]).toEqual(TEST_IMAGE_BYTES);
      expect(result.providerMetadata).toEqual({
        openrouter: {
          images: [
            {
              url: SIGNED_URL_1,
              mediaType: 'image/png',
              expiresAt: 1748458800,
            },
          ],
        },
      });

      expect(requests).toHaveLength(2);
      expect(requests[0]?.headers.get('authorization')).toBe(
        'Bearer secret-api-key',
      );
      // Signed URL download must not leak the OpenRouter API key.
      expect(requests[1]?.url).toBe(SIGNED_URL_1);
      expect(requests[1]?.headers.get('authorization')).toBeNull();
    });

    it('should download multiple signed URL images in order', async () => {
      const secondBytes = new Uint8Array([1, 2, 3, 4]);
      const mockFetch = async (url: URL | RequestInfo): Promise<Response> => {
        const urlStr = url.toString();
        if (urlStr === 'https://openrouter.ai/api/v1/images') {
          return new Response(
            JSON.stringify({
              created: 1748372400,
              data: [
                { url: SIGNED_URL_1, media_type: 'image/png' },
                { url: SIGNED_URL_2, media_type: 'image/webp' },
              ],
              expires_at: 1748458800,
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          );
        }
        if (urlStr === SIGNED_URL_1) {
          return new Response(TEST_IMAGE_BYTES, { status: 200 });
        }
        if (urlStr === SIGNED_URL_2) {
          return new Response(secondBytes, { status: 200 });
        }
        return new Response('Not Found', { status: 404 });
      };

      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      const result = await generate(model, {
        openrouter: { response_format: 'url' },
      });

      expect(result.images).toHaveLength(2);
      expect(result.images[0]).toEqual(TEST_IMAGE_BYTES);
      expect(result.images[1]).toEqual(secondBytes);
      expect(result.providerMetadata).toEqual({
        openrouter: {
          images: [
            {
              url: SIGNED_URL_1,
              mediaType: 'image/png',
              expiresAt: 1748458800,
            },
            {
              url: SIGNED_URL_2,
              mediaType: 'image/webp',
              expiresAt: 1748458800,
            },
          ],
        },
      });
    });

    it('should handle mixed signed URL and b64_json fallback items', async () => {
      const mockFetch = async (url: URL | RequestInfo): Promise<Response> => {
        const urlStr = url.toString();
        if (urlStr === 'https://openrouter.ai/api/v1/images') {
          return new Response(
            JSON.stringify({
              created: 1748372400,
              data: [
                { url: SIGNED_URL_1, media_type: 'image/png' },
                { b64_json: TEST_IMAGE_BASE64, media_type: 'image/png' },
              ],
              expires_at: 1748458800,
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          );
        }
        if (urlStr === SIGNED_URL_1) {
          return new Response(TEST_IMAGE_BYTES, { status: 200 });
        }
        return new Response('Not Found', { status: 404 });
      };

      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      const result = await generate(model, {
        openrouter: { response_format: 'url' },
      });

      expect(result.images).toHaveLength(2);
      expect(result.images[0]).toBeInstanceOf(Uint8Array);
      expect(result.images[1]).toBeInstanceOf(Uint8Array);
      expect(result.images[0]).toEqual(TEST_IMAGE_BYTES);
      expect(result.images[1]).toEqual(TEST_IMAGE_BYTES);
      expect(result.providerMetadata).toEqual({
        openrouter: {
          images: [
            {
              url: SIGNED_URL_1,
              mediaType: 'image/png',
              expiresAt: 1748458800,
            },
            {
              mediaType: 'image/png',
            },
          ],
        },
      });
    });

    it('should work end-to-end with AI SDK generateImage()', async () => {
      const mockFetch = async (url: URL | RequestInfo): Promise<Response> => {
        const urlStr = url.toString();
        if (urlStr === 'https://openrouter.ai/api/v1/images') {
          return new Response(
            JSON.stringify({
              created: 1748372400,
              data: [{ url: SIGNED_URL_1, media_type: 'image/png' }],
              expires_at: 1748458800,
              usage: {
                prompt_tokens: 5,
                completion_tokens: 50,
                total_tokens: 55,
              },
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          );
        }
        if (urlStr === SIGNED_URL_1) {
          return new Response(TEST_IMAGE_BYTES, {
            status: 200,
            headers: { 'content-type': 'image/png' },
          });
        }
        return new Response('Not Found', { status: 404 });
      };

      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });

      const result = await generateImage({
        model: provider.imageModel('google/gemini-2.5-flash-image'),
        prompt: 'A cat',
        providerOptions: {
          openrouter: { response_format: 'url' },
        },
      });

      expect(result.image.uint8Array).toEqual(TEST_IMAGE_BYTES);
      expect(result.image.base64).toBe(TEST_IMAGE_BASE64);
      expect(result.image.mediaType).toBe('image/png');
      expect(result.image.providerMetadata).toEqual({
        openrouter: {
          url: SIGNED_URL_1,
          mediaType: 'image/png',
          expiresAt: 1748458800,
        },
      });
      expect(result.providerMetadata).toEqual({
        openrouter: {
          images: [
            {
              url: SIGNED_URL_1,
              mediaType: 'image/png',
              expiresAt: 1748458800,
            },
          ],
        },
      });
    });

    it('should omit providerMetadata for plain b64_json responses', async () => {
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: createMockFetch(TEST_IMAGE_BASE64),
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      const result = await generate(model, {});
      expect(result.providerMetadata).toBeUndefined();
    });

    it('should reject a response item that has neither b64_json nor url', async () => {
      const mockFetch = async (): Promise<Response> =>
        new Response(
          JSON.stringify({
            created: 1748372400,
            data: [{ media_type: 'image/png' }],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        );

      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      await expect(generate(model, {})).rejects.toThrow();
    });

    it('should throw APICallError when downloading a signed URL fails', async () => {
      const mockFetch = async (url: URL | RequestInfo): Promise<Response> => {
        if (url.toString() === 'https://openrouter.ai/api/v1/images') {
          return new Response(
            JSON.stringify({
              created: 1748372400,
              data: [{ url: SIGNED_URL_1 }],
              expires_at: 1748458800,
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          );
        }
        return new Response('Expired', { status: 403 });
      };

      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      await expect(
        generate(model, { openrouter: { response_format: 'url' } }),
      ).rejects.toThrow(APICallError);
    });

    it('should not retry paid generation when signed URL download returns 503', async () => {
      let generateCalls = 0;
      const mockFetch = async (url: URL | RequestInfo): Promise<Response> => {
        if (url.toString() === 'https://openrouter.ai/api/v1/images') {
          generateCalls += 1;
          return new Response(
            JSON.stringify({
              created: 1748372400,
              data: [{ url: SIGNED_URL_1 }],
              expires_at: 1748458800,
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          );
        }
        return new Response('Service Unavailable', {
          status: 503,
          statusText: 'Service Unavailable',
        });
      };

      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      let thrown: unknown;
      try {
        await generateImage({
          model,
          prompt: 'A cat',
          maxRetries: 2,
          providerOptions: {
            openrouter: { response_format: 'url' },
          },
        });
      } catch (error) {
        thrown = error;
      }

      expect(APICallError.isInstance(thrown)).toBe(true);
      expect((thrown as APICallError).statusCode).toBe(503);
      expect((thrown as APICallError).isRetryable).toBe(false);
      expect(generateCalls).toBe(1);
    });

    it('should reject private/loopback image URLs from a different origin', async () => {
      const mockFetch = async (): Promise<Response> =>
        new Response(
          JSON.stringify({
            created: 1748372400,
            data: [{ url: 'http://127.0.0.1:8080/internal-image.png' }],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        );

      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      await expect(
        generate(model, { openrouter: { response_format: 'url' } }),
      ).rejects.toThrow(DownloadError);
    });
  });
});
