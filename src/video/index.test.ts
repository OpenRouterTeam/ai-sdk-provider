import { describe, expect, it } from 'vitest';
import { createOpenRouter } from '../provider';
import { OpenRouterVideoModel } from './index';

const testVideoBytes = new Uint8Array([0, 1, 2, 3]);

function createSubmitResponse(jobId: string) {
  return {
    id: jobId,
    generation_id: 'gen-test-123',
    polling_url: `/api/v1/videos/${jobId}`,
    status: 'pending',
  };
}

function createPollResponse(
  jobId: string,
  status: string,
  options?: {
    unsigned_urls?: string[];
    error?: string;
    usage?: { cost?: number; is_byok?: boolean };
  },
) {
  return {
    id: jobId,
    generation_id: 'gen-test-123',
    polling_url: `/api/v1/videos/${jobId}`,
    status,
    ...(options?.unsigned_urls && { unsigned_urls: options.unsigned_urls }),
    ...(options?.error && { error: options.error }),
    ...(options?.usage && { usage: options.usage }),
  };
}

function createVideoContentResponse(contentType: string | null = 'video/mp4') {
  return new Response(testVideoBytes, {
    status: 200,
    headers: contentType != null ? { 'content-type': contentType } : {},
  });
}

function toResponse(
  response: Record<string, unknown> | Response | undefined,
  callIndex: number,
  url: URL | RequestInfo,
): Response {
  if (response === undefined) {
    throw new Error(`Unexpected fetch call #${callIndex + 1}: ${String(url)}`);
  }
  if (response instanceof Response) {
    return response;
  }
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function createMockFetchSequence(
  responses: Array<Record<string, unknown> | Response>,
) {
  let callIndex = 0;
  return async (url: URL | RequestInfo): Promise<Response> => {
    const response = toResponse(responses[callIndex], callIndex, url);
    callIndex++;
    return response;
  };
}

function createCapturingMockFetch(
  responses: Array<Record<string, unknown> | Response>,
) {
  let callIndex = 0;
  const capturedRequests: Array<{
    url: string;
    method: string;
    headers: Headers;
    body: Record<string, unknown> | undefined;
  }> = [];

  const fetch = async (
    url: URL | RequestInfo,
    init?: RequestInit,
  ): Promise<Response> => {
    const bodyText = init?.body as string | undefined;
    capturedRequests.push({
      url: url.toString(),
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      body: bodyText ? JSON.parse(bodyText) : undefined,
    });
    const response = toResponse(responses[callIndex], callIndex, url);
    callIndex++;
    return response;
  };

  return { fetch, capturedRequests };
}

function generate(model: OpenRouterVideoModel) {
  return model.doGenerate({
    prompt: 'A cat',
    n: 1,
    aspectRatio: undefined,
    resolution: undefined,
    duration: undefined,
    fps: undefined,
    seed: undefined,
    image: undefined,
    frameImages: undefined,
    inputReferences: undefined,
    generateAudio: undefined,
    providerOptions: {},
  });
}

describe('OpenRouterVideoModel', () => {
  describe('provider methods', () => {
    it('should expose videoModel method', () => {
      const provider = createOpenRouter({ apiKey: 'test-key' });
      expect(typeof provider.videoModel).toBe('function');
    });

    it('should create a video model instance', () => {
      const provider = createOpenRouter({ apiKey: 'test-key' });
      const model = provider.videoModel('google/veo-3.1');
      expect(model).toBeInstanceOf(OpenRouterVideoModel);
      expect(model.modelId).toBe('google/veo-3.1');
      expect(model.provider).toBe('openrouter');
      expect(model.specificationVersion).toBe('v4');
    });

    it('should have maxVideosPerCall set to 1', () => {
      const provider = createOpenRouter({ apiKey: 'test-key' });
      const model = provider.videoModel('google/veo-3.1');
      expect(model.maxVideosPerCall).toBe(1);
    });
  });

  describe('doGenerate', () => {
    it('should submit and poll until complete, returning video bytes', async () => {
      const jobId = 'job-test-123';
      const videoUrl = 'https://storage.example.com/video.mp4';

      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: createMockFetchSequence([
          createSubmitResponse(jobId),
          createPollResponse(jobId, 'pending'),
          createPollResponse(jobId, 'completed', {
            unsigned_urls: [videoUrl],
            usage: { cost: 0.5 },
          }),
          createVideoContentResponse(),
        ]),
      });
      const model = provider.videoModel('google/veo-3.1', {
        pollIntervalMs: 10,
      });

      const result = await model.doGenerate({
        prompt: 'A cat playing piano',
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        generateAudio: undefined,
        providerOptions: {},
      });

      expect(result.videos).toHaveLength(1);
      expect(result.videos[0]).toEqual({
        type: 'binary',
        data: testVideoBytes,
        mediaType: 'video/mp4',
      });
      expect(result.warnings).toEqual([]);
      expect(result.response.modelId).toBe('google/veo-3.1');
    });

    it('should pass prompt, aspect_ratio, duration, and seed in the request body', async () => {
      const jobId = 'job-test-456';
      const mock = createCapturingMockFetch([
        createSubmitResponse(jobId),
        createPollResponse(jobId, 'completed', {
          unsigned_urls: ['https://example.com/video.mp4'],
        }),
        createVideoContentResponse(),
      ]);

      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
      });
      const model = provider.videoModel('google/veo-3.1', {
        pollIntervalMs: 10,
      });

      await model.doGenerate({
        prompt: 'Mountain landscape at sunset',
        n: 1,
        aspectRatio: '16:9',
        resolution: '1280x720',
        duration: 8,
        fps: undefined,
        seed: 42,
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        generateAudio: undefined,
        providerOptions: {},
      });

      const submitRequest = mock.capturedRequests[0]!;
      expect(submitRequest.body?.model).toBe('google/veo-3.1');
      expect(submitRequest.body?.prompt).toBe('Mountain landscape at sunset');
      expect(submitRequest.body?.aspect_ratio).toBe('16:9');
      expect(submitRequest.body?.size).toBe('1280x720');
      expect(submitRequest.body?.duration).toBe(8);
      expect(submitRequest.body?.seed).toBe(42);
    });

    it('should pass generate_audio from settings', async () => {
      const jobId = 'job-test-audio';
      const mock = createCapturingMockFetch([
        createSubmitResponse(jobId),
        createPollResponse(jobId, 'completed', {
          unsigned_urls: ['https://example.com/video.mp4'],
        }),
        createVideoContentResponse(),
      ]);

      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
      });
      const model = provider.videoModel('google/veo-3.1', {
        generateAudio: true,
        pollIntervalMs: 10,
      });

      await model.doGenerate({
        prompt: 'A cat',
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        generateAudio: undefined,
        providerOptions: {},
      });

      expect(mock.capturedRequests[0]!.body?.generate_audio).toBe(true);
    });

    it('should pass provider options via providerOptions.openrouter', async () => {
      const jobId = 'job-test-routing';
      const mock = createCapturingMockFetch([
        createSubmitResponse(jobId),
        createPollResponse(jobId, 'completed', {
          unsigned_urls: ['https://example.com/video.mp4'],
        }),
        createVideoContentResponse(),
      ]);

      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
      });
      const model = provider.videoModel('google/veo-3.1', {
        pollIntervalMs: 10,
      });

      await model.doGenerate({
        prompt: 'A cat',
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        generateAudio: undefined,
        providerOptions: {
          openrouter: {
            provider: {
              options: {
                'google-vertex': {
                  output_config: { effort: 'low' },
                },
              },
            },
          },
        },
      });

      expect(mock.capturedRequests[0]!.body?.provider).toEqual({
        options: {
          'google-vertex': {
            output_config: { effort: 'low' },
          },
        },
      });
    });

    it('should convert image input to frame_images', async () => {
      const jobId = 'job-test-image';
      const mock = createCapturingMockFetch([
        createSubmitResponse(jobId),
        createPollResponse(jobId, 'completed', {
          unsigned_urls: ['https://example.com/video.mp4'],
        }),
        createVideoContentResponse(),
      ]);

      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
      });
      const model = provider.videoModel('google/veo-3.1', {
        pollIntervalMs: 10,
      });

      await model.doGenerate({
        prompt: 'Animate this image',
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        image: {
          type: 'url',
          url: 'https://example.com/first-frame.png',
        },
        frameImages: undefined,
        inputReferences: undefined,
        generateAudio: undefined,
        providerOptions: {},
      });

      const body = mock.capturedRequests[0]!.body;
      expect(body?.frame_images).toEqual([
        {
          type: 'image_url',
          image_url: { url: 'https://example.com/first-frame.png' },
          frame_type: 'first_frame',
        },
      ]);
    });

    it('should return warning when n > 1', async () => {
      const jobId = 'job-test-n';
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: createMockFetchSequence([
          createSubmitResponse(jobId),
          createPollResponse(jobId, 'completed', {
            unsigned_urls: ['https://example.com/video.mp4'],
          }),
          createVideoContentResponse(),
        ]),
      });
      const model = provider.videoModel('google/veo-3.1', {
        pollIntervalMs: 10,
      });

      const result = await model.doGenerate({
        prompt: 'A cat',
        n: 3,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        generateAudio: undefined,
        providerOptions: {},
      });

      expect(result.warnings).toContainEqual({
        type: 'unsupported',
        feature: 'n > 1',
        details:
          'OpenRouter video generation returns 1 video per call. Requested 3 videos.',
      });
    });

    it('should throw when video generation fails', async () => {
      const jobId = 'job-test-fail';
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: createMockFetchSequence([
          createSubmitResponse(jobId),
          createPollResponse(jobId, 'failed', {
            error: 'Content policy violation',
          }),
        ]),
      });
      const model = provider.videoModel('google/veo-3.1', {
        pollIntervalMs: 10,
      });

      await expect(
        model.doGenerate({
          prompt: 'Something',
          n: 1,
          aspectRatio: undefined,
          resolution: undefined,
          duration: undefined,
          fps: undefined,
          seed: undefined,
          image: undefined,
          frameImages: undefined,
          inputReferences: undefined,
          generateAudio: undefined,
          providerOptions: {},
        }),
      ).rejects.toThrow('Content policy violation');
    });

    it('should throw on timeout', async () => {
      const jobId = 'job-test-timeout';

      let callCount = 0;
      const fetchThatNeverCompletes = async (): Promise<Response> => {
        callCount++;
        const response =
          callCount === 1
            ? createSubmitResponse(jobId)
            : createPollResponse(jobId, 'pending');
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      };

      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: fetchThatNeverCompletes,
      });
      const model = provider.videoModel('google/veo-3.1', {
        pollIntervalMs: 10,
        maxPollTimeMs: 50,
      });

      await expect(
        model.doGenerate({
          prompt: 'A cat',
          n: 1,
          aspectRatio: undefined,
          resolution: undefined,
          duration: undefined,
          fps: undefined,
          seed: undefined,
          image: undefined,
          frameImages: undefined,
          inputReferences: undefined,
          generateAudio: undefined,
          providerOptions: {},
        }),
      ).rejects.toThrow(/timed out/);
    });

    it('should include provider metadata with generation_id and cost', async () => {
      const jobId = 'job-test-metadata';
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: createMockFetchSequence([
          createSubmitResponse(jobId),
          createPollResponse(jobId, 'completed', {
            unsigned_urls: ['https://example.com/video.mp4'],
            usage: { cost: 1.25 },
          }),
          createVideoContentResponse(),
        ]),
      });
      const model = provider.videoModel('google/veo-3.1', {
        pollIntervalMs: 10,
      });

      const result = await model.doGenerate({
        prompt: 'A cat',
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        generateAudio: undefined,
        providerOptions: {},
      });

      expect(result.providerMetadata).toEqual({
        openrouter: {
          generationId: 'gen-test-123',
          cost: 1.25,
        },
      });
    });

    it('should handle response with empty unsigned_urls', async () => {
      const jobId = 'job-test-empty';
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: createMockFetchSequence([
          createSubmitResponse(jobId),
          createPollResponse(jobId, 'completed', {
            unsigned_urls: [],
          }),
        ]),
      });
      const model = provider.videoModel('google/veo-3.1', {
        pollIntervalMs: 10,
      });

      const result = await model.doGenerate({
        prompt: 'A cat',
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        generateAudio: undefined,
        providerOptions: {},
      });

      expect(result.videos).toEqual([]);
    });

    it('should handle multiple video URLs', async () => {
      const jobId = 'job-test-multi';
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: createMockFetchSequence([
          createSubmitResponse(jobId),
          createPollResponse(jobId, 'completed', {
            unsigned_urls: [
              'https://example.com/video1.mp4',
              'https://example.com/video2.mp4',
            ],
          }),
          createVideoContentResponse(),
          createVideoContentResponse(),
        ]),
      });
      const model = provider.videoModel('google/veo-3.1', {
        pollIntervalMs: 10,
      });

      const result = await model.doGenerate({
        prompt: 'A cat',
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        generateAudio: undefined,
        providerOptions: {},
      });

      expect(result.videos).toHaveLength(2);
      expect(result.videos[0]).toEqual({
        type: 'binary',
        data: testVideoBytes,
        mediaType: 'video/mp4',
      });
      expect(result.videos[1]).toEqual({
        type: 'binary',
        data: testVideoBytes,
        mediaType: 'video/mp4',
      });
    });
  });

  describe('video download', () => {
    const jobId = 'job-test-download';

    it('should download same-origin content URLs with the API key', async () => {
      const contentUrl = `https://openrouter.ai/api/v1/videos/${jobId}/content?index=0`;
      const mock = createCapturingMockFetch([
        createSubmitResponse(jobId),
        createPollResponse(jobId, 'completed', {
          unsigned_urls: [contentUrl],
        }),
        createVideoContentResponse(),
      ]);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
      });

      const result = await generate(
        provider.videoModel('google/veo-3.1', { pollIntervalMs: 10 }),
      );

      expect(mock.capturedRequests).toHaveLength(3);
      const download = mock.capturedRequests[2]!;
      expect(download.url).toBe(contentUrl);
      expect(download.headers.get('authorization')).toBe('Bearer test-key');
      expect(result.videos).toEqual([
        { type: 'binary', data: testVideoBytes, mediaType: 'video/mp4' },
      ]);
    });

    it('should not send the API key to a cross-origin content URL', async () => {
      const contentUrl = 'https://storage.example.com/video.mp4';
      const mock = createCapturingMockFetch([
        createSubmitResponse(jobId),
        createPollResponse(jobId, 'completed', {
          unsigned_urls: [contentUrl],
        }),
        createVideoContentResponse(),
      ]);
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mock.fetch,
      });

      await generate(
        provider.videoModel('google/veo-3.1', { pollIntervalMs: 10 }),
      );

      expect(mock.capturedRequests).toHaveLength(3);
      // The submit request does carry the key, so the mock captures headers.
      expect(mock.capturedRequests[0]!.headers.get('authorization')).toBe(
        'Bearer test-key',
      );
      const download = mock.capturedRequests[2]!;
      expect(download.url).toBe(contentUrl);
      expect(download.headers.has('authorization')).toBe(false);
    });

    it.each([
      { contentType: 'video/webm; codecs="vp9"', expected: 'video/webm' },
      { contentType: 'video/mp4;charset=binary', expected: 'video/mp4' },
      { contentType: 'application/octet-stream', expected: 'video/mp4' },
      { contentType: null, expected: 'video/mp4' },
    ])('should normalize content-type $contentType to $expected', async ({
      contentType,
      expected,
    }) => {
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: createMockFetchSequence([
          createSubmitResponse(jobId),
          createPollResponse(jobId, 'completed', {
            unsigned_urls: ['https://example.com/video.mp4'],
          }),
          createVideoContentResponse(contentType),
        ]),
      });

      const result = await generate(
        provider.videoModel('google/veo-3.1', { pollIntervalMs: 10 }),
      );

      expect(result.videos[0]?.mediaType).toBe(expected);
    });

    it('should surface OpenRouter error messages from a failed download', async () => {
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: createMockFetchSequence([
          createSubmitResponse(jobId),
          createPollResponse(jobId, 'completed', {
            unsigned_urls: [
              `https://openrouter.ai/api/v1/videos/${jobId}/content?index=0`,
            ],
          }),
          new Response(
            JSON.stringify({
              error: { message: 'Video content has expired', code: 404 },
            }),
            { status: 404, headers: { 'content-type': 'application/json' } },
          ),
        ]),
      });

      await expect(
        generate(provider.videoModel('google/veo-3.1', { pollIntervalMs: 10 })),
      ).rejects.toThrow('Video content has expired');
    });
  });
});
