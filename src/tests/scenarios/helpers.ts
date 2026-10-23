// Shared helpers for the cross-PR scenario suite. Everything is mocked: no
// request ever leaves the process.
import { createOpenRouter } from '../../provider';

// Keep scenario output quiet (AI SDK warnings, deprecations).
(globalThis as any).AI_SDK_LOG_WARNINGS = false;

// Guard: every scenario file imports this module, so any request that
// bypasses the mock fetch (for example an AI SDK URL download) fails loudly
// instead of reaching the network. Files that stub fetch themselves restore
// this guard via `vi.unstubAllGlobals()`.
globalThis.fetch = async (input: RequestInfo | URL) => {
  throw new Error(`Unexpected network request: ${String(input)}`);
};

export type RecordedCall = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: any;
};

export type Responder = (
  call: RecordedCall,
  index: number,
) => Response | Promise<Response>;

/**
 * Creates a fetch implementation that records every request and answers with
 * `responder`. An array of responders answers calls in order (the last one is
 * reused for any further calls).
 */
export function createMockFetch(responder: Responder | Responder[]) {
  const calls: RecordedCall[] = [];
  const fetchImpl = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key] = value;
    });
    let body: any;
    if (typeof init?.body === 'string') {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    const call: RecordedCall = {
      url,
      method: init?.method ?? 'GET',
      headers,
      body,
    };
    const index = calls.length;
    calls.push(call);
    const fn = Array.isArray(responder)
      ? (responder[Math.min(index, responder.length - 1)] as Responder)
      : responder;
    return fn(call, index);
  };
  return { fetch: fetchImpl as typeof fetch, calls };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function sseResponse(events: unknown[]): Response {
  const text =
    events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('') +
    'data: [DONE]\n\n';
  return new Response(text, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

/** Chat completion stream chunk. */
export function chatChunk(
  delta: Record<string, unknown> | null,
  extra: {
    finish_reason?: string | null;
    usage?: Record<string, unknown>;
    id?: string;
    noChoices?: boolean;
  } = {},
) {
  return {
    id: extra.id ?? 'gen-scenario',
    object: 'chat.completion.chunk',
    created: 1711357598,
    model: 'anthropic/claude-sonnet-4.5',
    provider: 'Anthropic',
    choices: extra.noChoices
      ? []
      : [
          {
            index: 0,
            delta: delta ?? {},
            finish_reason: extra.finish_reason ?? null,
          },
        ],
    ...(extra.usage && { usage: extra.usage }),
  };
}

export const USAGE = {
  prompt_tokens: 10,
  completion_tokens: 20,
  total_tokens: 30,
  cost: 0.0012,
};

/** Non-streaming chat completion body. */
export function chatCompletion(
  message: Record<string, unknown>,
  extra: { finish_reason?: string; usage?: Record<string, unknown> } = {},
) {
  return {
    id: 'gen-scenario',
    object: 'chat.completion',
    created: 1711357598,
    model: 'anthropic/claude-sonnet-4.5',
    provider: 'Anthropic',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: '', ...message },
        finish_reason: extra.finish_reason ?? 'stop',
      },
    ],
    usage: extra.usage ?? USAGE,
  };
}

export function textCompletion(text = 'Hello!') {
  return chatCompletion({ content: text });
}

/** Provider wired to a mock fetch. */
export function mockProvider(
  responder: Responder | Responder[],
  settings: Parameters<typeof createOpenRouter>[0] = {},
) {
  const mock = createMockFetch(responder);
  const provider = createOpenRouter({
    apiKey: 'sk-or-test-key',
    ...settings,
    fetch: mock.fetch,
  });
  return { provider, calls: mock.calls };
}

/** Body of the n-th recorded call. */
export function bodyOf(calls: RecordedCall[], n = 0) {
  const call = calls[n];
  if (!call) {
    throw new Error(`No call #${n} (only ${calls.length} recorded)`);
  }
  return call.body;
}

export const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** Returns true when `value` contains a key whose value is `undefined`. */
export function hasUndefinedValues(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasUndefinedValues);
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).some(
      ([, v]) => v === undefined || hasUndefinedValues(v),
    );
  }
  return false;
}

/**
 * True when any defined `providerOptions` object in the messages carries an
 * `undefined`-valued key (which breaks AI SDK prompt validation, #540).
 */
export function hasUndefinedProviderOptions(messages: unknown[]): boolean {
  return messages.some((message: any) => {
    const parts = Array.isArray(message?.content) ? message.content : [];
    return [message, ...parts].some(
      (part: any) =>
        part?.providerOptions != null &&
        hasUndefinedValues(part.providerOptions),
    );
  });
}
