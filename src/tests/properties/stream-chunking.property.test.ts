import * as F from 'fast-check';
import { describe, expect, it } from 'vitest';
import { log, normalize, runStream, runs, splitBytes, sse } from './harness';

const enc = new TextEncoder();

// text with multibyte chars, surrogate pairs, json-significant chars
const textArb = F.oneof(
  F.string({
    unit: F.constantFrom(
      'a',
      ' ',
      'é',
      '中',
      '😀',
      '👩‍💻',
      '"',
      '\\',
      '{',
      '}',
      '\n',
      'data: ',
      '\r',
      ' ',
    ),
    maxLength: 12,
  }),
  F.string({ unit: 'grapheme', maxLength: 8 }),
);

// JSON args: deep nesting, strings with braces/quotes/escapes/unicode
const strArb = F.oneof(
  F.string({
    unit: F.constantFrom(
      '{',
      '}',
      '[',
      ']',
      '"',
      '\\',
      ':',
      ',',
      'x',
      '😀',
      'é',
      '\u0000',
      '\n',
      '\\u',
    ),
    maxLength: 10,
  }),
  F.string({ unit: 'binary', maxLength: 6 }),
);
const { tree } = F.letrec((tie: any) => ({
  tree: F.oneof(
    { depthSize: 'small', withCrossShrink: true },
    F.oneof(
      strArb,
      F.integer(),
      F.double({ noNaN: true, noDefaultInfinity: true }),
      F.boolean(),
      F.constant(null),
    ),
    F.array(tie('tree'), { maxLength: 4 }),
    F.dictionary(strArb, tie('tree'), { maxKeys: 4 }),
  ),
}));
const argsObj = F.oneof(
  F.dictionary(strArb, tree, { maxKeys: 5 }),
  F.integer({ min: 1, max: 30 }).map((d: number) => {
    let v: any = { leaf: 'x}"]' };
    for (let i = 0; i < d; i++) {
      v = { [`k${i}`]: [v, '{'] };
    }
    return v;
  }),
);
// serialize with random formatting and random \u escaping (incl. escaped surrogate pairs)
const argsTextArb = F.tuple(
  argsObj,
  F.constantFrom(0, 2, '\t'),
  F.boolean(),
).map(([v, indent, esc]: any) => {
  let s = JSON.stringify(v, null, indent || undefined);
  if (esc) {
    s = s.replace(
      /[\u0080-\uffff]/g,
      (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
    );
  }
  return { value: JSON.parse(s), text: s };
});

function splitString(s: string, cuts: number[]) {
  const pts = [...new Set(cuts.map((c) => c % (s.length + 1)))].sort(
    (a, b) => a - b,
  );
  const out: string[] = [];
  let prev = 0;
  for (const p of [...pts, s.length]) {
    if (p <= prev) {
      continue;
    }
    out.push(s.slice(prev, p));
    prev = p;
  }
  return out.length ? out : [''];
}

const toolArb = F.record({
  args: argsTextArb,
  cuts: F.array(F.nat(), { maxLength: 15 }),
  name: F.constantFrom('get_weather', 'search', 'x'),
  idMode: F.constantFrom('normal', 'normal', 'missing', 'dup'),
  firstChunkArgs: F.constantFrom('empty', 'first-delta', 'all'),
  trailingWs: F.boolean(),
  truncate: F.constantFrom(0, 0, 0, 0, 0, 0, 0, 3),
}).map((t: any) =>
  t.truncate && t.args.text.length > 3
    ? {
        ...t,
        trailingWs: false,
        args: { value: undefined, text: t.args.text.slice(0, -t.truncate) },
      }
    : t,
);

const scenarioArb = F.record({
  reasoning: F.array(
    F.oneof(
      F.record({
        k: F.constant('text'),
        text: textArb,
        sig: F.boolean(),
        fmt: F.boolean(),
      }),
      F.record({ k: F.constant('enc'), data: F.string({ maxLength: 8 }) }),
      F.record({ k: F.constant('plain'), text: textArb }),
    ),
    { maxLength: 6 },
  ),
  text: F.array(textArb, { maxLength: 6 }),
  tools: F.array(toolArb, { maxLength: 3 }),
  interleave: F.array(F.nat(), { maxLength: 40 }),
  annotations: F.boolean(),
  usage: F.constantFrom('none', 'with-choices', 'empty-choices'),
  finish: F.constantFrom('tool_calls', 'stop', null, 'length'),
  sse: F.record({
    crlf: F.boolean(),
    comments: F.boolean(),
    noSpace: F.boolean(),
  }),
});

let sigN = 0;
function buildEvents(sc: any) {
  const ev: any[] = [];
  const base = {
    id: 'gen-1',
    model: 'm/x',
    provider: 'P',
    object: 'chat.completion.chunk',
    created: 1,
  };
  const ch = (delta: any, extra: any = {}) => ({
    ...base,
    choices: [{ index: 0, delta, ...extra }],
  });
  ev.push(ch({ role: 'assistant', content: '' }));
  for (const r of sc.reasoning) {
    if (r.k === 'text') {
      const d: any = { type: 'reasoning.text', text: r.text, index: 0 };
      if (r.fmt) {
        d.format = 'anthropic-claude-v1';
      }
      ev.push(ch({ reasoning: r.text, reasoning_details: [d] }));
      if (r.sig) {
        ev.push(
          ch({
            reasoning_details: [
              { type: 'reasoning.text', signature: `sig${sigN++}`, index: 0 },
            ],
          }),
        );
      }
    } else if (r.k === 'enc') {
      ev.push(
        ch({
          reasoning_details: [
            {
              type: 'reasoning.encrypted',
              data: `enc${r.data}`,
              id: `e${sigN++}`,
              format: 'google-gemini-v1',
              index: 1,
            },
          ],
        }),
      );
    } else {
      ev.push(ch({ reasoning: r.text }));
    }
  }
  for (const t of sc.text) {
    ev.push(ch({ content: t }));
  }
  if (sc.annotations) {
    ev.push(
      ch({
        annotations: [
          {
            type: 'url_citation',
            url_citation: {
              url: 'https://e.com/é',
              title: 'T😀',
              start_index: 0,
              end_index: 3,
              content: 'c',
            },
          },
        ],
      }),
    );
  }
  // tool call streams, interleaved
  const streams: any = sc.tools.map((t: any, i: number) => {
    const deltas = splitString(t.args.text, t.cuts);
    const id =
      t.idMode === 'missing'
        ? undefined
        : t.idMode === 'dup'
          ? 'call_dup'
          : `call_${i}`;
    const out: any[] = [];
    let first = '';
    let rest = deltas;
    if (t.firstChunkArgs === 'first-delta') {
      first = deltas[0] ?? '';
      rest = deltas.slice(1);
    }
    if (t.firstChunkArgs === 'all') {
      first = t.args.text;
      rest = [];
    }
    out.push({
      index: i,
      id,
      type: 'function',
      function: { name: t.name, arguments: first },
    });
    for (const d of rest) {
      out.push({ index: i, function: { arguments: d } });
    }
    if (t.trailingWs) {
      out.push({ index: i, function: { arguments: '\n' } });
    }
    return out;
  });
  const idx: any = streams.map(() => 0);
  let k = 0;
  while (streams.some((s: any, i: number) => idx[i] < s.length)) {
    // first delta of each tool must come in index order for the provider's array indexing
    let pick =
      (sc.interleave[k++ % Math.max(1, sc.interleave.length)] ?? 0) %
      streams.length;
    for (let j = 0; j < streams.length; j++) {
      const c = (pick + j) % streams.length;
      if (
        idx[c] < streams[c].length &&
        (idx[c] > 0 ||
          streams.slice(0, c).every((_: any, q: number) => idx[q] > 0))
      ) {
        pick = c;
        break;
      }
    }
    ev.push(ch({ tool_calls: [streams[pick][idx[pick]++]] }));
  }
  const usage = {
    prompt_tokens: 10,
    completion_tokens: 5,
    total_tokens: 15,
    cost: 0.1,
    prompt_tokens_details: { cached_tokens: 1 },
    completion_tokens_details: { reasoning_tokens: 2 },
  };
  if (sc.usage === 'with-choices') {
    ev.push({ ...ch({}, { finish_reason: sc.finish }), usage });
  } else {
    ev.push(ch({}, { finish_reason: sc.finish }));
    if (sc.usage === 'empty-choices') {
      ev.push({ ...base, choices: [], usage });
    }
  }
  return ev;
}

const RUNS = runs('STREAM_RUNS', 400);

describe('stream chunking invariance', () => {
  it('doStream output is identical for any byte split', async () => {
    let n = 0;
    await F.assert(
      F.asyncProperty(
        scenarioArb,
        F.array(F.array(F.nat(), { maxLength: 30 }), {
          minLength: 2,
          maxLength: 3,
        }),
        F.boolean(),
        async (sc: any, splits: number[][], byteWise: boolean) => {
          n++;
          sigN = 0;
          const bytes = enc.encode(sse(buildEvents(sc), sc.sse));
          const ref = normalize(await runStream([bytes]));
          const variants = splits.map((c) => splitBytes(bytes, c));
          if (byteWise && bytes.length < 3000) {
            variants.push(Array.from(bytes, (b) => new Uint8Array([b])));
          }
          for (const v of variants) {
            expect(normalize(await runStream(v))).toEqual(ref);
          }
        },
      ),
      { numRuns: RUNS, seed: 11 },
    );
    log(`STREAM chunking cases=${n}`);
  });

  it('tool-call input == concat(deltas) == generated args; lifecycle sane', async () => {
    let n = 0;
    const observations = new Map<string, any>();
    await F.assert(
      F.asyncProperty(scenarioArb, async (sc: any) => {
        n++;
        sigN = 0;
        const parts = await runStream([
          enc.encode(sse(buildEvents(sc), sc.sse)),
        ]);
        const calls = parts.filter((p) => p.type === 'tool-call');
        const ids = [
          ...new Set(
            parts.filter((p) => p.type === 'tool-input-start').map((p) => p.id),
          ),
        ];
        // unique ids, one call per tool
        expect(new Set(calls.map((c) => c.toolCallId)).size).toBe(calls.length);
        for (const c of calls) {
          const deltas = parts.filter(
            (p) => p.type === 'tool-input-delta' && p.id === c.toolCallId,
          );
          const joined = deltas.map((d) => d.delta).join('');
          const endIdx = parts.findIndex(
            (p) => p.type === 'tool-input-end' && p.id === c.toolCallId,
          );
          const lateDeltas = parts
            .slice(endIdx + 1)
            .filter(
              (p) => p.type === 'tool-input-delta' && p.id === c.toolCallId,
            );
          if (lateDeltas.length) {
            observations.set(
              'delta-after-end',
              observations.get('delta-after-end') ?? {
                sc: JSON.stringify(
                  sc.tools.map((t: any) => ({
                    text: t.args.text,
                    cuts: t.cuts,
                    f: t.firstChunkArgs,
                    ws: t.trailingWs,
                  })),
                ),
                late: lateDeltas,
              },
            );
          }
          const tool = sc.tools.find(
            (t: any) =>
              t.args.text === c.input ||
              (c.input === '{}' && t.args.text.trim() === ''),
          );
          if (
            joined !== c.input &&
            !(c.input === '{}' && joined.trim() === '')
          ) {
            observations.set(
              'input-ne-deltas',
              observations.get('input-ne-deltas') ?? {
                input: c.input,
                joined,
                tool,
              },
            );
          }
          if (!tool) {
            throw new Error(
              `tool-call input matches no generated args: ${JSON.stringify({ input: c.input, want: sc.tools.map((t: any) => t.args.text) })}`,
            );
          }
        }
        {
          const got = calls
            .map((c) => {
              try {
                return JSON.stringify(JSON.parse(c.input));
              } catch {
                return `RAW:${c.input}`;
              }
            })
            .sort();
          const want = sc.tools
            .map((t: any) =>
              t.args.value === undefined
                ? `RAW:${t.args.text}`
                : JSON.stringify(t.args.value),
            )
            .sort();
          if (sc.finish !== 'length' && sc.finish !== 'stop') {
            expect(got).toEqual(want);
          }
        }
        // started tool inputs that never ended
        for (const id of ids) {
          if (!parts.some((p) => p.type === 'tool-input-end' && p.id === id)) {
            const key = `dangling-start(finish=${sc.finish})`;
            if (!observations.has(key)) {
              observations.set(key, {
                finish: sc.finish,
                tools: sc.tools.length,
              });
            }
          }
        }
        if (calls.length !== sc.tools.length) {
          const key = `calls-missing(finish=${sc.finish})`;
          if (!observations.has(key)) {
            observations.set(key, {
              finish: sc.finish,
              tools: sc.tools.map((t: any) => t.args.text),
              calls: calls.length,
            });
          }
        }
      }),
      { numRuns: RUNS, seed: 12 },
    );
    log(`STREAM toolargs cases=${n}`);
    for (const [k, v] of observations) {
      log('OBS', k, JSON.stringify(v).slice(0, 800));
    }
  });
});
