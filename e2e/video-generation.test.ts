import { experimental_generateVideo as generateVideo } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 300_000,
});

describe('video generation', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  // Video content URLs require auth, so we provide a custom download function
  async function download({ url }: { url: URL }) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
    });
    return {
      data: new Uint8Array(await response.arrayBuffer()),
      mediaType: response.headers.get('content-type') ?? undefined,
    };
  }

  it('should generate a video from a text prompt', async () => {
    const result = await generateVideo({
      model: openrouter.videoModel('google/veo-3.1', {
        pollIntervalMs: 5000,
      }),
      prompt: 'A slow pan across a calm mountain lake at sunrise',
      aspectRatio: '16:9',
      duration: 4,
      download,
    });

    expect(result.videos.length).toBeGreaterThanOrEqual(1);
    expect(result.video.uint8Array.byteLength).toBeGreaterThan(0);
    expect(result.video.mediaType).toBe('video/mp4');
    expect(result.warnings).toEqual([]);
  });
});
