/**
 * Simple test server utility to replace the removed @ai-sdk/provider-utils/test createTestServer
 * This provides HTTP request interception for testing purposes.
 */

import { afterAll, afterEach, beforeAll } from 'vitest';
import { setupServer, SetupServerApi } from 'msw/node';
import { http, HttpResponse } from 'msw';
import type { JsonBodyType } from 'msw';

// Re-export utilities that were previously in @ai-sdk/provider-utils/test
export { convertReadableStreamToArray } from '@ai-sdk/provider-utils/test';

type ResponseConfig = {
  type: 'json-value' | 'stream-chunks' | 'error';
  body?: JsonBodyType;
  chunks?: string[];
  status?: number;
  headers?: Record<string, string>;
};

type CallRecord = {
  requestBody: string;
  requestBodyJson: Promise<unknown>;
  requestHeaders: Record<string, string>;
};

type UrlConfig = {
  response?: ResponseConfig;
};

type UrlConfigWithCalls = UrlConfig & {
  calls: CallRecord[];
};

type TestServerConfig = Record<string, UrlConfig>;

export function createTestServer(config: TestServerConfig): {
  urls: Record<string, UrlConfigWithCalls>;
  server: SetupServerApi;
  calls: CallRecord[];
} {
  const urls: Record<string, UrlConfigWithCalls> = {};
  const calls: CallRecord[] = [];

  // Initialize URL configs with call tracking
  for (const [url, urlConfig] of Object.entries(config)) {
    urls[url] = { ...urlConfig, calls: [] };
  }

  const handlers = Object.keys(config).map(url =>
    http.post(url, async ({ request }) => {
      const urlConfig = urls[url]!;

      // Record the call
      const bodyText = await request.clone().text();

      const headers: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        headers[key] = value;
      });

      const callRecord: CallRecord = {
        requestBody: bodyText,
        requestBodyJson: Promise.resolve().then(() => {
          try {
            return JSON.parse(bodyText);
          } catch {
            return bodyText;
          }
        }),
        requestHeaders: headers,
      };

      urlConfig.calls.push(callRecord);
      calls.push(callRecord);

      const response = urlConfig.response;

      if (!response) {
        return HttpResponse.json({ error: 'No response configured' }, { status: 500 });
      }

      const status = response.status ?? 200;
      const responseHeaders = response.headers ?? {};

      switch (response.type) {
        case 'json-value':
          return HttpResponse.json(response.body ?? null, { status, headers: responseHeaders });

        case 'stream-chunks': {
          const encoder = new TextEncoder();
          const chunks = response.chunks ?? [];
          const stream = new ReadableStream({
            async start(controller) {
              for (const chunk of chunks) {
                controller.enqueue(encoder.encode(chunk));
              }
              controller.close();
            },
          });
          return new HttpResponse(stream, {
            status,
            headers: {
              'Content-Type': 'text/event-stream',
              ...responseHeaders,
            },
          });
        }

        case 'error':
          return HttpResponse.json(response.body ?? { error: 'Test error' }, {
            status: response.status ?? 500,
            headers: responseHeaders,
          });

        default:
          return HttpResponse.json(response.body ?? null, { status, headers: responseHeaders });
      }
    })
  );

  const server = setupServer(...handlers);

  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterEach(() => {
    server.resetHandlers();
    // Clear calls between tests
    calls.length = 0;
    for (const url of Object.keys(urls)) {
      urls[url]!.calls = [];
    }
  });
  afterAll(() => server.close());

  return { urls, server, calls };
}
