/**
 * Shared harness for the live probe suite.
 *
 * - `HAS_KEY` gates every `describe` via `describe.skipIf(!HAS_KEY)`.
 * - `probe()` wraps `it()`: it enforces the cost guard, gives the probe a
 *   capturing `fetch` (request bodies, HTTP statuses, error bodies, cost), and
 *   writes one JSON record per probe to `$LIVE_VERIFY_RESULTS/probes.d/`.
 *   `global-setup.ts` merges them into `probes.json` at teardown.
 *
 * The API key is only ever read from `process.env` and is never written to a
 * record (records hold request bodies, never headers).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { it } from 'vitest';

export const HAS_KEY = Boolean(process.env.OPENROUTER_API_KEY);
export const API_BASE = (
  process.env.OPENROUTER_API_BASE || 'https://openrouter.ai'
).replace(/\/+$/, '');
export const RESULTS_DIR =
  process.env.LIVE_VERIFY_RESULTS || join(process.cwd(), 'lv-results');
export const RECORDS_DIR = join(RESULTS_DIR, 'probes.d');

/** Max number of probes (it-blocks) that may hit the API. */
export const MAX_PROBES = Number(process.env.MAX_PROBES || 40);
/** Hard cap on HTTP requests across the whole probe run. */
export const MAX_REQUESTS = Number(process.env.MAX_REQUESTS || 90);

export type Exchange = {
  url: string;
  status: number;
  requestBody?: unknown;
  errorBody?: string;
  cost?: number;
  provider?: string;
};

export type ProbeStatus =
  | 'pass'
  | 'fail'
  | 'optional-fail'
  | 'info'
  | 'skipped';

export type ProbeRecord = {
  id: string;
  pr: string;
  title: string;
  status: ProbeStatus;
  model?: string;
  httpStatuses: number[];
  effect?: Record<string, unknown>;
  error?: string;
  notes?: string;
  costUsd?: number;
  durationMs?: number;
  exchanges?: Exchange[];
};

// ---------------------------------------------------------------------------
// Budget (file based: probe files run sequentially in separate workers)
// ---------------------------------------------------------------------------

const BUDGET_FILE = join(RECORDS_DIR, '_budget.json');

type Budget = { probes: number; requests: number };

function readBudget(): Budget {
  try {
    return JSON.parse(readFileSync(BUDGET_FILE, 'utf8')) as Budget;
  } catch {
    return { probes: 0, requests: 0 };
  }
}

function writeBudget(b: Budget) {
  mkdirSync(RECORDS_DIR, { recursive: true });
  writeFileSync(BUDGET_FILE, JSON.stringify(b));
}

function takeProbeSlot(): boolean {
  const b = readBudget();
  if (b.probes >= MAX_PROBES) {
    return false;
  }
  b.probes += 1;
  writeBudget(b);
  return true;
}

function takeRequestSlot() {
  const b = readBudget();
  if (b.requests >= MAX_REQUESTS) {
    throw new Error(
      `MAX_REQUESTS=${MAX_REQUESTS} reached; refusing to send more requests`,
    );
  }
  b.requests += 1;
  writeBudget(b);
}

// ---------------------------------------------------------------------------
// Capturing fetch
// ---------------------------------------------------------------------------

function truncateDeep(value: unknown, max = 600): unknown {
  if (typeof value === 'string') {
    return value.length > max
      ? `${value.slice(0, max)}...[+${value.length - max} chars]`
      : value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => truncateDeep(v, max));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, truncateDeep(v, max)]),
    );
  }
  return value;
}

/** Extracts `usage.cost` / `provider` from a JSON body or an SSE stream. */
function scanBody(text: string): { cost?: number; provider?: string } {
  const out: { cost?: number; provider?: string } = {};
  const visit = (obj: unknown) => {
    if (!obj || typeof obj !== 'object') {
      return;
    }
    const o = obj as Record<string, unknown>;
    const usage = o.usage as Record<string, unknown> | undefined;
    if (usage && typeof usage.cost === 'number') {
      out.cost = usage.cost;
    }
    if (typeof o.provider === 'string') {
      out.provider = o.provider;
    }
  };
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{')) {
    try {
      visit(JSON.parse(trimmed));
    } catch {
      // ignore
    }
    return out;
  }
  for (const line of text.split('\n')) {
    if (!line.startsWith('data:')) {
      continue;
    }
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') {
      continue;
    }
    try {
      visit(JSON.parse(data));
    } catch {
      // ignore partial lines
    }
  }
  return out;
}

export type Capture = {
  exchanges: Exchange[];
  fetch: typeof fetch;
  /** Waits until every response body has been scanned for cost. */
  settle: () => Promise<void>;
  /** Request bodies sent to a URL containing `pathPart`. */
  bodies: (pathPart?: string) => Array<Record<string, unknown>>;
};

export function createCapture(): Capture {
  const exchanges: Exchange[] = [];
  const pending: Array<Promise<void>> = [];

  const capturingFetch: typeof fetch = async (input, init) => {
    takeRequestSlot();
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    let requestBody: unknown;
    if (init?.body != null) {
      try {
        requestBody = JSON.parse(String(init.body));
      } catch {
        requestBody = String(init.body).slice(0, 2000);
      }
    }
    const res = await fetch(input, init);
    const exchange: Exchange = { url, status: res.status, requestBody };
    exchanges.push(exchange);
    const clone = res.clone();
    pending.push(
      clone
        .text()
        .then((text) => {
          if (!res.ok) {
            exchange.errorBody = text.slice(0, 4000);
          }
          const { cost, provider } = scanBody(text);
          exchange.cost = cost;
          exchange.provider = provider;
        })
        .catch(() => undefined),
    );
    return res;
  };

  return {
    exchanges,
    fetch: capturingFetch,
    settle: async () => {
      await Promise.all(pending);
    },
    bodies: (pathPart = '') =>
      exchanges
        .filter((e) => e.url.includes(pathPart))
        .map((e) => (e.requestBody ?? {}) as Record<string, unknown>),
  };
}

/** An OpenRouter provider (built from the repo dist) wired to a capture. */
export function providerFor(
  capture: Capture,
  options: Omit<
    NonNullable<Parameters<typeof createOpenRouter>[0]>,
    'apiKey' | 'fetch'
  > = {},
) {
  return createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: `${API_BASE}/api/v1`,
    ...options,
    fetch: capture.fetch,
  });
}

/** Raw, curl-style POST through the capture (no SDK involved). */
export async function rawPost(
  capture: Capture,
  path: string,
  body: Record<string, unknown>,
): Promise<{ status: number; json?: any; text: string }> {
  const res = await capture.fetch(`${API_BASE}/api/v1${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: res.status, json, text };
}

// ---------------------------------------------------------------------------
// Errors and records
// ---------------------------------------------------------------------------

export function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const e = error as Error & {
    statusCode?: number;
    responseBody?: string;
    lastError?: unknown;
    cause?: unknown;
  };
  const parts = [`${e.name}: ${e.message}`];
  if (e.statusCode != null) {
    parts.push(`status=${e.statusCode}`);
  }
  if (e.responseBody) {
    parts.push(`body=${e.responseBody.slice(0, 2000)}`);
  }
  if (e.lastError && e.lastError !== error) {
    parts.push(`lastError=(${describeError(e.lastError)})`);
  }
  return parts
    .join(' | ')
    .replaceAll(
      process.env.OPENROUTER_API_KEY || '\u0000never\u0000',
      '[REDACTED]',
    );
}

export function writeRecord(record: ProbeRecord) {
  mkdirSync(RECORDS_DIR, { recursive: true });
  const safe = JSON.stringify(truncateDeep(record), null, 2).replaceAll(
    process.env.OPENROUTER_API_KEY || '\u0000never\u0000',
    '[REDACTED]',
  );
  writeFileSync(join(RECORDS_DIR, `${record.id}.json`), safe);
}

export type ProbeContext = {
  capture: Capture;
  /** Attach observations to the record (merged, last write wins). */
  observe: (effect: Record<string, unknown>) => void;
  note: (text: string) => void;
  /**
   * Downgrade a passing probe to `info`: the request shape was accepted, but
   * the backend did not produce the effect needed to fully verify the PR.
   */
  markInfo: (why: string) => void;
};

export type ProbeMeta = {
  id: string;
  pr: string;
  title: string;
  model?: string;
  /** Failures are recorded as `optional-fail` and do not turn the run red. */
  optional?: boolean;
  /** Recorded as `info`: the probe gathers data, it does not assert a fix. */
  informational?: boolean;
  /** Skip with this reason (recorded). */
  skipReason?: string | false;
  timeoutMs?: number;
};

/** Defines one live probe. Must be called inside a `describe.skipIf(!HAS_KEY)`. */
export function probe(
  meta: ProbeMeta,
  fn: (ctx: ProbeContext) => Promise<void>,
) {
  it(
    `${meta.pr} ${meta.title}`,
    async (testCtx) => {
      const base: ProbeRecord = {
        id: meta.id,
        pr: meta.pr,
        title: meta.title,
        model: meta.model,
        status: 'skipped',
        httpStatuses: [],
      };
      if (meta.skipReason) {
        writeRecord({ ...base, notes: meta.skipReason });
        testCtx.skip();
        return;
      }
      if (!takeProbeSlot()) {
        writeRecord({ ...base, notes: `MAX_PROBES=${MAX_PROBES} reached` });
        testCtx.skip();
        return;
      }

      const capture = createCapture();
      const effect: Record<string, unknown> = {};
      const notes: string[] = [];
      let infoOnly = Boolean(meta.informational);
      const started = Date.now();
      const finish = async (
        status: ProbeStatus,
        error?: string,
      ): Promise<void> => {
        await capture.settle();
        const cost = capture.exchanges.reduce((s, e) => s + (e.cost ?? 0), 0);
        writeRecord({
          ...base,
          status,
          httpStatuses: capture.exchanges.map((e) => e.status),
          effect,
          error,
          notes: notes.length ? notes.join(' ') : undefined,
          costUsd: Number(cost.toFixed(6)),
          durationMs: Date.now() - started,
          exchanges: capture.exchanges,
        });
      };

      try {
        await fn({
          capture,
          observe: (e) => Object.assign(effect, e),
          note: (t) => notes.push(t),
          markInfo: (why) => {
            infoOnly = true;
            notes.push(why);
          },
        });
        await finish(infoOnly ? 'info' : 'pass');
      } catch (error) {
        const message = describeError(error);
        if (meta.optional) {
          await finish('optional-fail', message);
          return;
        }
        await finish('fail', message);
        throw error;
      }
    },
    meta.timeoutMs ?? 120_000,
  );
}

/** Marks a probe as permanently skipped (e.g. not observable server-side). */
export function skippedProbe(meta: Omit<ProbeMeta, 'skipReason'>, why: string) {
  probe({ ...meta, skipReason: why }, async () => undefined);
}

export function assert2xx(capture: Capture, label = 'request') {
  const bad = capture.exchanges.filter((e) => e.status < 200 || e.status > 299);
  if (bad.length > 0) {
    throw new Error(
      `${label}: non-2xx response(s): ${bad
        .map((e) => `${e.status} ${e.errorBody ?? ''}`)
        .join(' || ')}`,
    );
  }
  if (capture.exchanges.length === 0) {
    throw new Error(`${label}: no HTTP request was sent`);
  }
}

export function lastBody(capture: Capture, pathPart = '/chat/completions') {
  const bodies = capture.bodies(pathPart);
  const body = bodies[bodies.length - 1];
  if (!body) {
    throw new Error(`no request body captured for ${pathPart}`);
  }
  return body;
}
