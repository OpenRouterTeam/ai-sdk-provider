/**
 * Shared helpers for the property-based (fast-check) suite.
 *
 * Case counts default to values that keep each file well under ~10s in CI.
 * Scale them up locally with the per-file env vars, for example:
 *
 *   SCAN_RUNS=300000 STREAM_RUNS=5000 CONVERT_RUNS=20000 \
 *   REASON_RUNS=20000 SERDE_RUNS=3000 pnpm test:node src/tests/properties
 *
 * Set PROPERTY_VERBOSE=1 to print observations: anomalies the properties
 * record without failing on (they are not asserted because they are either
 * known issues or behaviour that mirrors the OpenRouter API).
 */
import { vi } from 'vitest';
import { createOpenRouter } from '../../provider';

const env: Record<string, string | undefined> =
  (globalThis as any).process?.env ?? {};

// The default case counts finish in a few seconds, but slow CI runners and
// scaled-up runs need more than vitest's 5s default.
vi.setConfig({ testTimeout: 10 * 60_000 });

/** Number of fast-check runs: `env[name]` if set, otherwise `fallback`. */
export function runs(name: string, fallback: number): number {
  const value = Number(env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Logs only when PROPERTY_VERBOSE is set, to keep CI output readable. */
export function log(...args: unknown[]) {
  if (env.PROPERTY_VERBOSE) {
    console.log(...args);
  }
}

export function sse(
  events: unknown[],
  opts: { crlf?: boolean; comments?: boolean; noSpace?: boolean } = {},
) {
  const nl = opts.crlf ? '\r\n' : '\n';
  let out = '';
  for (const e of events) {
    if (opts.comments) {
      out += `: OPENROUTER PROCESSING${nl}${nl}`;
    }
    out += `data:${opts.noSpace ? '' : ' '}${JSON.stringify(e)}${nl}${nl}`;
  }
  out += `data: [DONE]${nl}${nl}`;
  return out;
}

export function splitBytes(bytes: Uint8Array, cuts: number[]): Uint8Array[] {
  const pts = [...new Set(cuts.map((c) => c % (bytes.length + 1)))].sort(
    (a, b) => a - b,
  );
  const out: Uint8Array[] = [];
  let prev = 0;
  for (const p of [...pts, bytes.length]) {
    if (p <= prev) {
      continue;
    }
    out.push(bytes.slice(prev, p));
    prev = p;
  }
  return out;
}

export async function runStream(chunks: Uint8Array[], extra: any = {}) {
  const fetchFn = async () =>
    new Response(
      new ReadableStream({
        start(c) {
          for (const ch of chunks) {
            c.enqueue(ch);
          }
          c.close();
        },
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    );
  const model = createOpenRouter({ apiKey: 'k', fetch: fetchFn as any }).chat(
    'm',
  );
  const { stream } = await model.doStream({
    prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    ...extra,
  } as any);
  const parts: any[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    parts.push(value);
  }
  return parts;
}

/** Replace generated ids with stable placeholders in order of appearance. */
export function normalize(parts: any[]) {
  const map = new Map<string, string>();
  const norm = (v: string) => {
    if (!map.has(v)) {
      map.set(v, `ID${map.size}`);
    }
    return map.get(v)!;
  };
  return JSON.parse(
    JSON.stringify(parts, (k, v) => {
      if ((k === 'id' || k === 'toolCallId') && typeof v === 'string') {
        return norm(v);
      }
      if (v instanceof Error) {
        return { error: String(v.message) };
      }
      return v;
    }),
  );
}
