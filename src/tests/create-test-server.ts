type TestServerJsonResponse = {
  type: 'json-value';
  body: unknown;
};

type TestServerStreamResponse = {
  type: 'stream-chunks';
  chunks: string[];
};

type TestServerResponse = TestServerJsonResponse | TestServerStreamResponse;

export type TestServerUrlConfig = {
  response: TestServerResponse;
};

export type TestServerCall = {
  url: string;
  requestHeaders: Record<string, string>;
  requestBodyText: string | undefined;
  requestBodyJson: Promise<any>;
};

export type TestServer = {
  urls: Record<string, TestServerUrlConfig>;
  calls: TestServerCall[];
  fetch: typeof fetch;
};

function toHeadersRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};

  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  return { ...headers };
}

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

/**
 * Minimal replacement for the removed `createTestServer` helper from `@ai-sdk/provider-utils/test`.
 * It provides:
 * - `server.urls[url].response` for configuring responses
 * - `server.calls[]` for request inspection
 * - `server.fetch` to inject into provider options (`createLLMGateway({ fetch: server.fetch })`)
 */
export function createTestServer(urls: Record<string, TestServerUrlConfig>): TestServer {
  const calls: TestServerCall[] = [];

  const testFetch: typeof fetch = async (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const route = urls[url];

    if (!route) {
      throw new Error(`No test server route registered for URL: ${url}`);
    }

    const requestHeaders =
      typeof input === 'string' || input instanceof URL
        ? toHeadersRecord(init?.headers)
        : {
            ...toHeadersRecord(input.headers),
            ...toHeadersRecord(init?.headers),
          };

    const body =
      typeof input === 'string' || input instanceof URL
        ? (init?.body ?? undefined)
        : (init?.body ?? undefined);

    const requestBodyText =
      typeof body === 'string'
        ? body
        : body instanceof Uint8Array
          ? new TextDecoder().decode(body)
          : undefined;

    calls.push({
      url,
      requestHeaders,
      requestBodyText,
      requestBodyJson: Promise.resolve().then(() => {
        if (requestBodyText == null) return undefined;
        return JSON.parse(requestBodyText);
      }),
    });

    const response = route.response;

    if (response.type === 'json-value') {
      return new Response(JSON.stringify(response.body), {
        headers: { 'content-type': 'application/json' },
      });
    }

    return new Response(streamFromChunks(response.chunks), {
      headers: { 'content-type': 'text/event-stream' },
    });
  };

  return { urls, calls, fetch: testFetch };
}


