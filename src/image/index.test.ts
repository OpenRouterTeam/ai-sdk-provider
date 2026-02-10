import { UnsupportedFunctionalityError } from '@ai-sdk/provider';
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
}

function createCapturingMockFetch(imageBase64: string) {
  let capturedBody: Record<string, unknown> | undefined;
  const fetch = async (
    _url: URL | RequestInfo,
    init?: RequestInit,
  ): Promise<Response> => {
    capturedBody = JSON.parse(init?.body as string);
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
  return {
    fetch,
    get capturedBody() {
      return capturedBody;
    },
  };
}

function getMessageContent(
  body: Record<string, unknown> | undefined,
): Array<Record<string, unknown>> {
  const messages = body?.messages as Array<Record<string, unknown>>;
  return messages[0]?.content as Array<Record<string, unknown>>;
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
      expect(model.specificationVersion).toBe('v3');
    });

    it('should have maxImagesPerCall set to 1', () => {
      const provider = createOpenRouter({ apiKey: 'test-key' });
      const model = provider.imageModel('google/gemini-2.5-flash-image');
      expect(model.maxImagesPerCall).toBe(1);
    });
  });

  describe('doGenerate', () => {
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

      expect(mock.capturedBody?.image_config).toEqual({
        aspect_ratio: '16:9',
      });
      expect(mock.capturedBody?.modalities).toEqual(['image', 'text']);
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

    it('should include base64 file as image_url content part in user message', async () => {
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

      const messages = mock.capturedBody?.messages as Array<
        Record<string, unknown>
      >;
      expect(messages).toHaveLength(1);
      expect(messages[0]?.role).toBe('user');

      const content = getMessageContent(mock.capturedBody);
      expect(content).toHaveLength(2);
      expect(content[0]).toEqual({
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${TEST_IMAGE_BASE64}`,
        },
      });
      expect(content[1]).toEqual({
        type: 'text',
        text: 'Edit this image',
      });
    });

    it('should include URL file as image_url content part in user message', async () => {
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

      const content = getMessageContent(mock.capturedBody);
      expect(content).toHaveLength(2);
      expect(content[0]).toEqual({
        type: 'image_url',
        image_url: {
          url: 'https://example.com/image.png',
        },
      });
      expect(content[1]).toEqual({
        type: 'text',
        text: 'Edit this image',
      });
    });

    it('should include Uint8Array file as base64 image_url content part', async () => {
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

      const content = getMessageContent(mock.capturedBody);
      expect(content).toHaveLength(2);
      const imageUrlPart = content[0] as {
        type: string;
        image_url: { url: string };
      };
      expect(imageUrlPart.type).toBe('image_url');
      expect(imageUrlPart.image_url.url).toMatch(/^data:image\/png;base64,/);
    });

    it('should include multiple files as multiple image_url content parts', async () => {
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

      const content = getMessageContent(mock.capturedBody);
      expect(content).toHaveLength(3);
      expect(content[0]?.type).toBe('image_url');
      expect(content[1]?.type).toBe('image_url');
      expect(content[2]).toEqual({
        type: 'text',
        text: 'Combine these images',
      });
    });

    it('should send simple string content when no files are provided', async () => {
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

      const messages = mock.capturedBody?.messages as Array<
        Record<string, unknown>
      >;
      expect(messages[0]?.content).toBe('Generate a cat');
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

      const content = getMessageContent(mock.capturedBody);
      expect(content).toHaveLength(2);
      const imageUrlPart = content[0] as {
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

      const content = getMessageContent(mock.capturedBody);
      const imageUrlPart = content[0] as {
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

      const content = getMessageContent(mock.capturedBody);
      const imageUrlPart = content[0] as {
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
  });
});
