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
        model: 'openai/gpt-4o',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'A bird.' },
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

describe('bare top-level media types through generateText', () => {
  it('should send an image part URL without mediaType as image_url', async () => {
    const { mockFetch, bodies } = createMockFetch();
    const openrouter = createOpenRouter({ apiKey: 'test', fetch: mockFetch });

    await generateText({
      model: openrouter('openai/gpt-4o'),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              image: new URL('https://example.com/bird.webp'),
              providerOptions: { openrouter: { imageDetail: 'low' } },
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
            type: 'image_url',
            image_url: { url: 'https://example.com/bird.webp', detail: 'low' },
          },
        ],
      },
    ]);
  });

  it("should send a file part URL with mediaType 'image' as image_url without downloading it", async () => {
    const { mockFetch, bodies } = createMockFetch();
    const openrouter = createOpenRouter({ apiKey: 'test', fetch: mockFetch });
    const downloaded: string[] = [];

    await generateText({
      model: openrouter('openai/gpt-4o'),
      // Record (and never perform) downloads of URLs the model does not
      // support.
      experimental_download: async (requestedDownloads) =>
        requestedDownloads.map(({ url, isUrlSupportedByModel }) => {
          if (isUrlSupportedByModel) {
            return null;
          }
          downloaded.push(url.toString());
          return { data: new Uint8Array([1, 2, 3]), mediaType: 'image/webp' };
        }),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              mediaType: 'image',
              data: new URL('https://example.com/bird.webp'),
              providerOptions: { openrouter: { imageDetail: 'low' } },
            },
          ],
        },
      ],
    });

    expect(downloaded).toEqual([]);
    expect(bodies[0]?.messages).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: 'https://example.com/bird.webp', detail: 'low' },
          },
        ],
      },
    ]);
  });
});
