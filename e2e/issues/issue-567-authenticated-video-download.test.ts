/**
 * Regression test for GitHub issue #567
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/567
 *
 * Reported error: AI_DownloadError 401 Unauthorized
 * Model: google/veo-3.1
 *
 * This test verifies that authenticated OpenRouter video content URLs are
 * downloaded by the provider before AI SDK Core receives the video result.
 */
import type { AddressInfo } from 'node:net';

import { createServer } from 'node:http';
import { DownloadError, experimental_generateVideo as generateVideo } from 'ai';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createOpenRouter } from '@/src';

const apiKey = 'test-openrouter-key';
const videoBytes = new Uint8Array([0, 1, 2, 3, 4]);

function createLocalOpenRouterServer() {
  const requests: Array<{ url: string | undefined; authorization: string }> =
    [];

  const server = createServer((request, response) => {
    const authorization = request.headers.authorization ?? '';
    requests.push({ url: request.url, authorization });

    if (request.method === 'POST' && request.url === '/api/v1/videos') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          id: 'video-job-567',
          generation_id: 'generation-567',
          polling_url: '/api/v1/videos/video-job-567',
          status: 'pending',
        }),
      );
      return;
    }

    if (
      request.method === 'GET' &&
      request.url === '/api/v1/videos/video-job-567'
    ) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          id: 'video-job-567',
          generation_id: 'generation-567',
          polling_url: '/api/v1/videos/video-job-567',
          status: 'completed',
          unsigned_urls: [
            'https://openrouter.ai/api/v1/videos/video-job-567/content?index=0',
          ],
          usage: { cost: 0.02 },
        }),
      );
      return;
    }

    if (
      request.method === 'GET' &&
      request.url === '/api/v1/videos/video-job-567/content?index=0'
    ) {
      if (authorization !== `Bearer ${apiKey}`) {
        response.writeHead(401, { 'content-type': 'text/plain' });
        response.end('Unauthorized');
        return;
      }

      response.writeHead(200, { 'content-type': 'video/webm' });
      response.end(videoBytes);
      return;
    }

    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('Not found');
  });

  return { server, requests };
}

describe('Issue #567: authenticated video content download', () => {
  const localOpenRouter = createLocalOpenRouterServer();
  let localOrigin: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      localOpenRouter.server.listen(0, '127.0.0.1', resolve);
    });
    const address = localOpenRouter.server.address() as AddressInfo;
    localOrigin = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      localOpenRouter.server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  it('returns generated video bytes instead of an authenticated URL', async () => {
    const providerFetch: typeof fetch = (input, init) => {
      const url = new URL(input.toString());
      const localUrl =
        url.origin === 'https://openrouter.ai'
          ? `${localOrigin}${url.pathname}${url.search}`
          : url.toString();

      return fetch(localUrl, init);
    };

    const publicDownloadWithoutOpenRouterAuth = async ({
      url,
    }: {
      url: URL;
    }) => {
      const localUrl =
        url.origin === 'https://openrouter.ai'
          ? `${localOrigin}${url.pathname}${url.search}`
          : url.toString();
      const response = await fetch(localUrl);

      if (!response.ok) {
        throw new DownloadError({
          url: url.toString(),
          statusCode: response.status,
          statusText: response.statusText,
        });
      }

      return {
        data: new Uint8Array(await response.arrayBuffer()),
        mediaType: response.headers.get('content-type') ?? undefined,
      };
    };

    const openrouter = createOpenRouter({
      apiKey,
      fetch: providerFetch,
    });

    const result = await generateVideo({
      model: openrouter.videoModel('google/veo-3.1', {
        pollIntervalMs: 1,
      }),
      prompt: 'A test video',
      download: publicDownloadWithoutOpenRouterAuth,
    });

    expect(result.video.uint8Array).toEqual(videoBytes);
    expect(result.video.mediaType).toBe('video/webm');
    expect(localOpenRouter.requests).toContainEqual({
      url: '/api/v1/videos/video-job-567/content?index=0',
      authorization: `Bearer ${apiKey}`,
    });
  });
});
