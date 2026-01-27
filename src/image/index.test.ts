import { UnsupportedFunctionalityError } from '@ai-sdk/provider';
import { describe, expect, it } from 'vitest';
import { createOpenRouter } from '../provider';
import { OpenRouterImageModel } from './index';

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
      expect(model.specificationVersion).toBe('v3');
    });

    it('should have maxImagesPerCall set to 1', () => {
      const provider = createOpenRouter({ apiKey: 'test-key' });
      const model = provider.imageModel('google/gemini-2.5-flash-image');
      expect(model.maxImagesPerCall).toBe(1);
    });
  });

  describe('doGenerate', () => {
    const createMockFetch = (imageBase64: string) => {
      return async (
        _url: URL | RequestInfo,
        _init?: RequestInit,
      ): Promise<Response> => {
        return new Response(
          JSON.stringify({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: 1711115037,
            model: 'google/gemini-2.5-flash-image',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: 'Here is the generated image.',
                  images: [
                    {
                      type: 'image_url',
                      image_url: {
                        url: `data:image/png;base64,${imageBase64}`,
                      },
                    },
                  ],
                },
                finish_reason: 'stop',
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
    };

    const TEST_IMAGE_BASE64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

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

    it('should pass aspectRatio via image_config', async () => {
      let capturedRequest: Record<string, unknown> | undefined;

      const mockFetchWithCapture = async (
        _url: URL | RequestInfo,
        init?: RequestInit,
      ): Promise<Response> => {
        capturedRequest = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: 1711115037,
            model: 'google/gemini-2.5-flash-image',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: '',
                  images: [
                    {
                      type: 'image_url',
                      image_url: {
                        url: `data:image/png;base64,${TEST_IMAGE_BASE64}`,
                      },
                    },
                  ],
                },
                finish_reason: 'stop',
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

      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetchWithCapture,
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

      expect(capturedRequest?.image_config).toEqual({
        aspect_ratio: '16:9',
      });
      expect(capturedRequest?.modalities).toEqual(['image', 'text']);
    });

    it('should pass seed parameter', async () => {
      let capturedRequest: Record<string, unknown> | undefined;

      const mockFetchWithCapture = async (
        _url: URL | RequestInfo,
        init?: RequestInit,
      ): Promise<Response> => {
        capturedRequest = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: 1711115037,
            model: 'google/gemini-2.5-flash-image',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: '',
                  images: [
                    {
                      type: 'image_url',
                      image_url: {
                        url: `data:image/png;base64,${TEST_IMAGE_BASE64}`,
                      },
                    },
                  ],
                },
                finish_reason: 'stop',
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

      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetchWithCapture,
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

      expect(capturedRequest?.seed).toBe(12345);
    });

    it('should throw UnsupportedFunctionalityError when files parameter is provided', async () => {
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: createMockFetch(TEST_IMAGE_BASE64),
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      await expect(
        model.doGenerate({
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
        }),
      ).rejects.toThrow(UnsupportedFunctionalityError);
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

    it('should return warning when n > 1 is requested', async () => {
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: createMockFetch(TEST_IMAGE_BASE64),
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      const result = await model.doGenerate({
        prompt: 'A cat',
        n: 3,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: undefined,
        mask: undefined,
        providerOptions: {},
      });

      expect(result.warnings).toContainEqual({
        type: 'unsupported',
        feature: 'n > 1',
        details:
          'OpenRouter image generation returns 1 image per call. Requested 3 images.',
      });
    });

    it('should return warning when size is provided', async () => {
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: createMockFetch(TEST_IMAGE_BASE64),
      });
      const model = provider.imageModel('google/gemini-2.5-flash-image');

      const result = await model.doGenerate({
        prompt: 'A cat',
        n: 1,
        size: '1024x1024',
        aspectRatio: undefined,
        seed: undefined,
        files: undefined,
        mask: undefined,
        providerOptions: {},
      });

      expect(result.warnings).toContainEqual({
        type: 'unsupported',
        feature: 'size',
        details:
          'Use aspectRatio instead. Size parameter is not supported by OpenRouter image generation.',
      });
    });

    it('should handle response without images in message', async () => {
      const mockFetchNoImages = async (
        _url: URL | RequestInfo,
        _init?: RequestInit,
      ): Promise<Response> => {
        return new Response(
          JSON.stringify({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: 1711115037,
            model: 'google/gemini-2.5-flash-image',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: 'I cannot generate that image.',
                },
                finish_reason: 'stop',
              },
            ],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 20,
              total_tokens: 30,
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
        fetch: mockFetchNoImages,
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

      expect(result.images).toEqual([]);
    });

    it('should throw NoContentGeneratedError when choices array is empty', async () => {
      const mockFetchEmptyChoices = async (
        _url: URL | RequestInfo,
        _init?: RequestInit,
      ): Promise<Response> => {
        return new Response(
          JSON.stringify({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: 1711115037,
            model: 'google/gemini-2.5-flash-image',
            choices: [],
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
        fetch: mockFetchEmptyChoices,
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
      ).rejects.toThrow('No choice in response');
    });

    it('should pass provider routing settings', async () => {
      let capturedRequest: Record<string, unknown> | undefined;

      const mockFetchWithCapture = async (
        _url: URL | RequestInfo,
        init?: RequestInit,
      ): Promise<Response> => {
        capturedRequest = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: 1711115037,
            model: 'google/gemini-2.5-flash-image',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: '',
                  images: [
                    {
                      type: 'image_url',
                      image_url: {
                        url: `data:image/png;base64,${TEST_IMAGE_BASE64}`,
                      },
                    },
                  ],
                },
                finish_reason: 'stop',
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

      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetchWithCapture,
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

      expect(capturedRequest?.provider).toEqual({
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
      let capturedRequest: Record<string, unknown> | undefined;

      const mockFetchWithCapture = async (
        _url: URL | RequestInfo,
        init?: RequestInit,
      ): Promise<Response> => {
        capturedRequest = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: 1711115037,
            model: 'google/gemini-2.5-flash-image',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: '',
                  images: [
                    {
                      type: 'image_url',
                      image_url: {
                        url: `data:image/png;base64,${TEST_IMAGE_BASE64}`,
                      },
                    },
                  ],
                },
                finish_reason: 'stop',
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

      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetchWithCapture,
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

      expect(capturedRequest?.custom_field).toBe('test_value');
      expect(capturedRequest?.provider).toEqual({
        order: ['google'],
      });
    });
  });
});
