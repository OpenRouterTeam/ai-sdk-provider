import { generateText } from 'ai';
import { describe, expect, it } from 'vitest';
import { createOpenRouter } from '../provider';

function createMockFetch() {
  const bodies: Record<string, unknown>[] = [];
  const mockFetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = input instanceof Request ? input.url : input.toString();
    if (!url.startsWith('https://openrouter.ai/')) {
      throw new Error(`Unexpected request to ${url}`);
    }
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(
      JSON.stringify({
        id: 'gen-1',
        object: 'chat.completion',
        created: 1,
        model: 'google/gemini-2.5-flash',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'A video.' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };
  return { mockFetch, bodies };
}

describe('video URLs through generateText', () => {
  it.each([
    'https://example.com/video.mp4',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  ])('should send %s as video_url without downloading it', async (url) => {
    const { mockFetch, bodies } = createMockFetch();
    const openrouter = createOpenRouter({ apiKey: 'test', fetch: mockFetch });

    await generateText({
      model: openrouter('google/gemini-2.5-flash'),
      // Same as the AI SDK default download function (skip URLs the model
      // supports, download the rest), but downloads go through the mocked
      // fetch, which throws for anything that isn't OpenRouter. No real
      // network request can happen.
      experimental_download: (requestedDownloads) =>
        Promise.all(
          requestedDownloads.map(async ({ url, isUrlSupportedByModel }) => {
            if (isUrlSupportedByModel) {
              return null;
            }
            const response = await mockFetch(url);
            return {
              data: new Uint8Array(await response.arrayBuffer()),
              mediaType: response.headers.get('content-type') ?? undefined,
            };
          }),
        ),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: new URL(url),
              mediaType: 'video/mp4',
              providerOptions: { openrouter: { videoProcessing: 'agentic' } },
            },
          ],
        },
      ],
    });

    expect(bodies[0]?.messages).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'video_url',
            video_url: { url, processing: 'agentic' },
          },
        ],
      },
    ]);
  });
});
