/**
 * E2E Test Setup - HTTP Request Recording/Replay
 *
 * Uses @effect-native/fetch-hooks for deterministic E2E tests.
 *
 * Usage:
 *   - Recording mode: E2E_RECORD=1 bun run test:e2e
 *   - Replay mode (default): bun run test:e2e
 *
 * Fixtures stored in: e2e/__fixtures__/
 */

import {
  createCachedFetch,
  createFilesystemStorage,
  type HashableRequest,
} from '@effect-native/fetch-hooks';
import { SDK_METADATA } from '@openrouter/sdk';
import { beforeAll, afterAll } from 'vitest';

const FIXTURES_DIR = new URL('./__fixtures__', import.meta.url).pathname;

/** Headers to redact from stored fixtures (security) */
const SENSITIVE_HEADERS = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];

/** Redact sensitive header values before storing */
function redactSensitiveHeaders(request: HashableRequest): HashableRequest {
  const redactedHeaders: Record<string, string> = {};

  for (const [key, value] of Object.entries(request.headers)) {
    const lowerKey = key.toLowerCase();

    if (SENSITIVE_HEADERS.includes(lowerKey)) {
      redactedHeaders[key] = '[REDACTED]';
      continue;
    }

    // Keep fixtures stable: normalize OpenRouter API `user-agent` back to the SDK default
    // so UA changes don't invalidate recorded cassette keys.
    if (lowerKey === 'user-agent' && request.url.includes('openrouter.ai')) {
      redactedHeaders[key] = SDK_METADATA.userAgent;
      continue;
    }

    redactedHeaders[key] = value;
  }

  return {
    ...request,
    headers: redactedHeaders,
  };
}

/** Determine mode from environment */
const isRecordMode = process.env.E2E_RECORD === '1';

let originalFetch: typeof globalThis.fetch | null = null;

beforeAll(() => {
  originalFetch = globalThis.fetch;

  const storage = createFilesystemStorage(FIXTURES_DIR);

  const cachedFetch = createCachedFetch(originalFetch, {
    storage,
    // In replay mode, fail if cache miss (no network calls allowed)
    replayOnly: !isRecordMode,
    // Redact sensitive headers before hashing (affects cache key)
    beforeHash: redactSensitiveHeaders,
    // Redact sensitive headers before storing to disk
    beforeStoreRequest: redactSensitiveHeaders,
  });

  globalThis.fetch = cachedFetch as typeof globalThis.fetch;

  if (isRecordMode) {
    // biome-ignore lint/suspicious/noConsole: E2E setup banner is intentional
    console.info('[e2e/setup] Recording mode: real API calls will be made and cached');
  } else {
    // biome-ignore lint/suspicious/noConsole: E2E setup banner is intentional
    console.info('[e2e/setup] Replay mode: using cached fixtures (no network calls)');
  }
});

afterAll(() => {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
    originalFetch = null;
  }
});
