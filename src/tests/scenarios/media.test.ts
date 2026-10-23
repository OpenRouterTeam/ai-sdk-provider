// Scenarios: #552 (imageDetail), #584 (videoProcessing), #551 (image routing
// merge) and video generation (unchanged; #570 not merged).
import type { ModelMessage } from 'ai';

import {
  experimental_generateVideo,
  generateImage,
  generateText,
  jsonSchema,
  tool,
} from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  chatCompletion,
  createMockFetch,
  jsonResponse,
  mockProvider,
  PNG_BASE64,
} from './helpers';

// Never download URLs in these scenarios: keep them as URLs for the provider.
const keepUrls = async (files: Array<{ url: URL }>) => files.map(() => null);

beforeEach(() => {
  // Guard: any request that bypasses the mock fetch fails loudly.
  vi.stubGlobal('fetch', async (input: unknown) => {
    throw new Error(`Unexpected network request: ${String(input)}`);
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function chatProvider() {
  return mockProvider(() => jsonResponse(chatCompletion({ content: 'ok' })));
}

function userParts(body: any) {
  return body.messages.find((m: any) => m.role === 'user').content;
}

describe('imageDetail on user parts (#552)', () => {
  for (const detail of ['low', 'high', 'auto'] as const) {
    it(`file part (image/png URL) forwards detail=${detail}`, async () => {
      const { provider, calls } = chatProvider();
      await generateText({
        model: provider('openai/gpt-4o'),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe' },
              {
                type: 'file',
                mediaType: 'image/png',
                data: new URL('https://example.com/cat.png'),
                providerOptions: { openrouter: { imageDetail: detail } },
              },
            ],
          },
        ],
      });
      expect(userParts(calls[0]?.body)[1]).toEqual({
        type: 'image_url',
        image_url: { url: 'https://example.com/cat.png', detail },
      });
    });
  }

  it('image part (base64) forwards detail and keeps cache_control', async () => {
    const { provider, calls } = chatProvider();
    await generateText({
      model: provider('openai/gpt-4o'),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              image: PNG_BASE64,
              mediaType: 'image/png',
              providerOptions: {
                openrouter: {
                  imageDetail: 'low',
                  cacheControl: { type: 'ephemeral' },
                },
              },
            },
            { type: 'text', text: 'What is this?' },
          ],
        },
      ],
    });
    expect(userParts(calls[0]?.body)[0]).toEqual({
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${PNG_BASE64}`, detail: 'low' },
      cache_control: { type: 'ephemeral' },
    });
  });

  it('invalid detail values are dropped', async () => {
    const { provider, calls } = chatProvider();
    await generateText({
      model: provider('openai/gpt-4o'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'x' },
            {
              type: 'file',
              mediaType: 'image/png',
              data: PNG_BASE64,
              providerOptions: { openrouter: { imageDetail: 'ultra' } },
            },
          ],
        },
      ],
    });
    expect(userParts(calls[0]?.body)[1].image_url).not.toHaveProperty('detail');
  });
});

describe('imageDetail / videoProcessing on tool-result parts (#552, #584)', () => {
  const screenshotTool = tool({
    description: 'Screenshot',
    inputSchema: jsonSchema({ type: 'object', properties: {} }),
  });

  function toolResultMessages(
    value: Array<Record<string, unknown>>,
  ): ModelMessage[] {
    return [
      { role: 'user', content: 'Take a screenshot' },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 't1',
            toolName: 'screenshot',
            input: {},
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 't1',
            toolName: 'screenshot',
            output: { type: 'content', value: value as any },
          },
        ],
      },
    ];
  }

  it('image file in tool-result content forwards detail', async () => {
    const { provider, calls } = chatProvider();
    await generateText({
      model: provider('openai/gpt-4o'),
      tools: { screenshot: screenshotTool },
      messages: toolResultMessages([
        { type: 'text', text: 'Here it is' },
        {
          type: 'file',
          mediaType: 'image/png',
          data: { type: 'data', data: PNG_BASE64 },
          providerOptions: { openrouter: { imageDetail: 'high' } },
        },
      ]),
    });
    const toolMessage = calls[0]?.body.messages.find(
      (m: any) => m.role === 'tool',
    );
    expect(toolMessage.content).toEqual([
      { type: 'text', text: 'Here it is' },
      {
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${PNG_BASE64}`,
          detail: 'high',
        },
      },
    ]);
  });

  it('video file in tool-result content forwards processing', async () => {
    const { provider, calls } = chatProvider();
    await generateText({
      experimental_download: keepUrls,
      model: provider('google/gemini-3-pro'),
      tools: { screenshot: screenshotTool },
      messages: toolResultMessages([
        {
          type: 'file',
          mediaType: 'video/mp4',
          data: { type: 'url', url: new URL('https://example.com/clip.mp4') },
          providerOptions: { openrouter: { videoProcessing: 'static' } },
        },
      ]),
    });
    const toolMessage = calls[0]?.body.messages.find(
      (m: any) => m.role === 'tool',
    );
    expect(toolMessage.content).toEqual([
      {
        type: 'video_url',
        video_url: {
          url: 'https://example.com/clip.mp4',
          processing: 'static',
        },
      },
    ]);
  });
});

describe('videoProcessing on user parts (#584)', () => {
  for (const processing of ['agentic', 'static'] as const) {
    it(`video URL part forwards processing=${processing}`, async () => {
      const { provider, calls } = chatProvider();
      await generateText({
        experimental_download: keepUrls,
        model: provider('google/gemini-3-pro'),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Summarise' },
              {
                type: 'file',
                mediaType: 'video/mp4',
                data: new URL('https://example.com/talk.mp4'),
                providerOptions: {
                  openrouter: { videoProcessing: processing },
                },
              },
            ],
          },
        ],
      });
      expect(userParts(calls[0]?.body)[1]).toEqual({
        type: 'video_url',
        video_url: { url: 'https://example.com/talk.mp4', processing },
      });
    });
  }

  it('base64 video data forwards processing on a data URL', async () => {
    const { provider, calls } = chatProvider();
    await generateText({
      model: provider('google/gemini-3-pro'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Summarise' },
            {
              type: 'file',
              mediaType: 'video/mp4',
              data: 'AAAAGGZ0eXBtcDQy',
              providerOptions: { openrouter: { videoProcessing: 'agentic' } },
            },
          ],
        },
      ],
    });
    expect(userParts(calls[0]?.body)[1]).toEqual({
      type: 'video_url',
      video_url: {
        url: 'data:video/mp4;base64,AAAAGGZ0eXBtcDQy',
        processing: 'agentic',
      },
    });
  });

  it('unknown processing value is dropped, cache_control preserved', async () => {
    const { provider, calls } = chatProvider();
    await generateText({
      experimental_download: keepUrls,
      model: provider('google/gemini-3-pro'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'x' },
            {
              type: 'file',
              mediaType: 'video/webm',
              data: new URL('https://example.com/a.webm'),
              providerOptions: {
                openrouter: {
                  videoProcessing: 'turbo',
                  cache_control: { type: 'ephemeral' },
                },
              },
            },
          ],
        },
      ],
    });
    expect(userParts(calls[0]?.body)[1]).toEqual({
      type: 'video_url',
      video_url: { url: 'https://example.com/a.webm' },
      cache_control: { type: 'ephemeral' },
    });
  });
});

describe('image generation routing merge (#551)', () => {
  const imageResponse = () =>
    jsonResponse({
      created: 1,
      data: [{ b64_json: PNG_BASE64 }],
      usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
    });

  function imageSetup(
    providerSettings: Record<string, unknown> = {},
    modelSettings: Record<string, unknown> = {},
  ) {
    const { provider, calls } = mockProvider(imageResponse, providerSettings);
    return {
      model: provider.imageModel(
        'google/gemini-2.5-flash-image',
        modelSettings,
      ),
      calls,
    };
  }

  it('runtime provider options merge into configured routing preferences', async () => {
    const { model, calls } = imageSetup(
      {},
      { provider: { order: ['google'], allow_fallbacks: false } },
    );
    const result = await generateImage({
      model,
      prompt: 'a cat',
      providerOptions: { openrouter: { provider: { sort: 'price' } } },
    });
    expect(result.images).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://openrouter.ai/api/v1/images');
    expect(calls[0]?.body.provider).toEqual({
      order: ['google'],
      allow_fallbacks: false,
      sort: 'price',
    });
  });

  it('precedence: settings < provider extraBody < model extraBody < runtime', async () => {
    const { model, calls } = imageSetup(
      { extraBody: { provider: { order: ['b'], only: ['b'] } } },
      {
        provider: { order: ['a'], sort: 'latency', ignore: ['x'] },
        extraBody: { provider: { order: ['c'] } },
      },
    );
    await generateImage({
      model,
      prompt: 'p',
      providerOptions: { openrouter: { provider: { sort: 'throughput' } } },
    });
    expect(calls[0]?.body.provider).toEqual({
      order: ['c'],
      only: ['b'],
      ignore: ['x'],
      sort: 'throughput',
    });
  });

  it('runtime provider: null keeps configured preferences', async () => {
    const { model, calls } = imageSetup(
      {},
      { provider: { order: ['google'] } },
    );
    await generateImage({
      model,
      prompt: 'p',
      providerOptions: { openrouter: { provider: null } },
    });
    expect(calls[0]?.body.provider).toEqual({ order: ['google'] });
  });

  it('runtime provider array is ignored rather than replacing preferences', async () => {
    const { model, calls } = imageSetup(
      {},
      { provider: { order: ['google'] } },
    );
    await generateImage({
      model,
      prompt: 'p',
      providerOptions: { openrouter: { provider: ['bogus'] as any } },
    });
    expect(calls[0]?.body.provider).toEqual({ order: ['google'] });
  });

  it('no routing anywhere -> no provider key; other options still forwarded', async () => {
    const { model, calls } = imageSetup();
    await generateImage({
      model,
      prompt: 'p',
      aspectRatio: '16:9',
      providerOptions: { openrouter: { image_config: { quality: 'hd' } } },
    });
    expect(calls[0]?.body).not.toHaveProperty('provider');
    expect(calls[0]?.body).toMatchObject({
      prompt: 'p',
      aspect_ratio: '16:9',
      image_config: { quality: 'hd' },
    });
  });
});

describe('video generation (unchanged; #570 not merged)', () => {
  it('submits, polls and downloads the video through experimental_generateVideo', async () => {
    const videoBytes = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]);
    const mock = createMockFetch((call) => {
      if (call.url.endsWith('/videos') && call.method === 'POST') {
        return jsonResponse({
          id: 'job-1',
          polling_url: 'https://openrouter.ai/api/v1/videos/job-1',
          status: 'pending',
        });
      }
      if (call.url.endsWith('/videos/job-1')) {
        return jsonResponse({
          id: 'job-1',
          generation_id: 'gen-v1',
          polling_url: 'https://openrouter.ai/api/v1/videos/job-1',
          status: 'completed',
          unsigned_urls: ['https://cdn.example.com/video.mp4'],
          usage: { cost: 0.5, is_byok: false },
        });
      }
      if (call.url === 'https://cdn.example.com/video.mp4') {
        return new Response(videoBytes, {
          headers: { 'content-type': 'video/mp4' },
        });
      }
      return new Response('not found', { status: 404 });
    });
    const { createOpenRouter } = await import('../../provider');
    const provider = createOpenRouter({
      apiKey: 'sk-or-test',
      fetch: mock.fetch,
    });

    const result = await experimental_generateVideo({
      model: provider.videoModel('google/veo-3.1', { pollIntervalMs: 1 }),
      prompt: 'a sunset',
      aspectRatio: '16:9',
      duration: 4,
      providerOptions: { openrouter: { provider: { order: ['google'] } } },
      download: async ({ url }) => {
        const response = await mock.fetch(url.toString());
        return {
          data: new Uint8Array(await response.arrayBuffer()),
          mediaType: response.headers.get('content-type') ?? undefined,
        };
      },
    });
    expect(mock.calls.map((c) => c.url)).toContain(
      'https://cdn.example.com/video.mp4',
    );
    const submit = mock.calls.find((c) => c.method === 'POST');
    expect(submit?.body).toEqual({
      model: 'google/veo-3.1',
      prompt: 'a sunset',
      aspect_ratio: '16:9',
      duration: 4,
      provider: { order: ['google'] },
    });
    expect(result.videos).toHaveLength(1);
    expect(result.videos[0]?.mediaType).toBe('video/mp4');
    expect(result.providerMetadata?.openrouter).toMatchObject({
      generationId: 'gen-v1',
      cost: 0.5,
    });
  });

  it('a failed job surfaces an error', async () => {
    const mock = createMockFetch((call) =>
      call.method === 'POST'
        ? jsonResponse({ id: 'job-2', polling_url: 'u', status: 'pending' })
        : jsonResponse({
            id: 'job-2',
            polling_url: 'u',
            status: 'failed',
            error: 'content policy',
          }),
    );
    const { createOpenRouter } = await import('../../provider');
    const provider = createOpenRouter({
      apiKey: 'sk-or-test',
      fetch: mock.fetch,
    });
    await expect(
      experimental_generateVideo({
        model: provider.videoModel('google/veo-3.1', { pollIntervalMs: 1 }),
        prompt: 'x',
        maxRetries: 0,
      }),
    ).rejects.toThrow(/content policy/);
  });
});
