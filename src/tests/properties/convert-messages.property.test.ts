import * as F from 'fast-check';
import { describe, expect, it } from 'vitest';
import { convertToOpenRouterChatMessages } from '../../chat/convert-to-openrouter-chat-messages';
import { log, runs } from './harness';

(globalThis as any).AI_SDK_LOG_WARNINGS = false;

const VALID_CC = [
  { type: 'ephemeral' },
  { type: 'ephemeral', ttl: '5m' },
  { type: 'ephemeral', ttl: '1h' },
];
// { type: 'ephemeral', ttl?: '5m' | '1h' }
const isValidCC = (v: any) =>
  typeof v === 'object' &&
  v !== null &&
  !Array.isArray(v) &&
  v.type === 'ephemeral' &&
  (v.ttl === undefined || v.ttl === '5m' || v.ttl === '1h');
const INVALID_CC = [
  'yes',
  true,
  1,
  {},
  { type: 'bogus' },
  { type: 'ephemeral', ttl: '7d' },
  [],
  null,
  0,
  '',
];
const cc = F.oneof(
  F.constantFrom(...VALID_CC.map((v) => ({ valid: true, v }))),
  F.constantFrom(...INVALID_CC.map((v) => ({ valid: false, v }))),
);
const ccKey = F.constantFrom('cacheControl', 'cache_control');
const ccNs = F.constantFrom('openrouter', 'anthropic');
const detail = F.constantFrom(
  { valid: true, v: 'low' },
  { valid: true, v: 'high' },
  { valid: true, v: 'auto' },
  { valid: false, v: 'HIGH' },
  { valid: false, v: 'medium' },
  { valid: false, v: 1 },
  { valid: false, v: null },
  { valid: false, v: {} },
);
const proc = F.constantFrom(
  { valid: true, v: 'agentic' },
  { valid: true, v: 'static' },
  { valid: false, v: 'Agentic' },
  { valid: false, v: 'dynamic' },
  { valid: false, v: true },
  { valid: false, v: null },
);

// build providerOptions and remember which values were invalid
const popts = F.option(
  F.record(
    {
      cc: F.option(F.record({ ns: ccNs, key: ccKey, val: cc }), {
        nil: undefined,
      }),
      detail: F.option(detail, { nil: undefined }),
      proc: F.option(proc, { nil: undefined }),
      junk: F.option(F.jsonValue({ maxDepth: 1 }), { nil: undefined }),
    },
    { requiredKeys: [] },
  ),
  { nil: undefined },
);
function toProviderOptions(p: any) {
  if (!p) {
    return undefined;
  }
  const o: any = {};
  if (p.cc) {
    o[p.cc.ns] = { ...(o[p.cc.ns] ?? {}), [p.cc.key]: p.cc.val.v };
  }
  if (p.detail) {
    o.openrouter = { ...(o.openrouter ?? {}), imageDetail: p.detail.v };
  }
  if (p.proc) {
    o.openrouter = { ...(o.openrouter ?? {}), videoProcessing: p.proc.v };
  }
  if (p.junk !== undefined) {
    o.other = { junk: p.junk };
  }
  return o;
}

const text = F.string({ maxLength: 6 });
const fileData = F.oneof(
  F.uint8Array({ maxLength: 6 }).map((d: Uint8Array) => ({
    type: 'data',
    data: d,
  })),
  F.constantFrom(
    'aGVsbG8=',
    'data:image/png;base64,AAAA',
    'https://e.com/a.png',
  ).map((d: string) => ({ type: 'data', data: d })),
  F.constantFrom('https://e.com/x.mp4', 'data:video/mp4;base64,AAAA').map(
    (u: string) => ({ type: 'url', url: new URL(u) }),
  ),
  text.map((t: string) => ({ type: 'text', text: t })),
);
const mediaType = F.constantFrom(
  'image/png',
  'image/jpeg',
  'video/mp4',
  'audio/mpeg',
  'audio/wav',
  'application/pdf',
  'text/plain',
);
const filePart = F.record({
  type: F.constant('file'),
  data: fileData,
  mediaType,
  filename: F.option(text, { nil: undefined }),
  po: popts,
});
const textPart = F.record({ type: F.constant('text'), text, po: popts });

const FORMATS = [
  'anthropic-claude-v1',
  'openai-responses-v1',
  'google-gemini-v1',
  undefined,
];
const rdetail = F.oneof(
  F.record({
    type: F.constant('reasoning.text'),
    text: F.constantFrom('a', 'b', '', 'x y'),
    signature: F.option(F.constantFrom('s1', 's2', 's3'), { nil: undefined }),
    format: F.constantFrom(...FORMATS),
  }),
  F.record({
    type: F.constant('reasoning.encrypted'),
    data: F.constantFrom('a', 'd1', 'd2'),
    id: F.option(F.constantFrom('i1', 'i2', 'a'), { nil: undefined }),
    format: F.constantFrom(...FORMATS),
  }),
  F.record({
    type: F.constant('reasoning.summary'),
    summary: F.constantFrom('a', 'b', 'sum'),
    format: F.constantFrom(...FORMATS),
  }),
).map((d: any) => JSON.parse(JSON.stringify(d)));
const rdetails = F.option(F.array(rdetail, { maxLength: 4 }), {
  nil: undefined,
});

const asstPart = F.oneof(
  textPart,
  F.record({ type: F.constant('reasoning'), text, rd: rdetails }),
  F.record({
    type: F.constant('tool-call'),
    toolCallId: F.constantFrom('c1', 'c2'),
    toolName: F.constant('t'),
    input: F.jsonValue({ maxDepth: 2 }),
    rd: rdetails,
  }),
  F.record({ type: F.constant('file'), data: fileData, mediaType }),
);
const toolOutput = F.oneof(
  F.record({ type: F.constant('text'), value: text }),
  F.record({ type: F.constant('json'), value: F.jsonValue({ maxDepth: 2 }) }),
  F.record({ type: F.constant('error-text'), value: text }),
  F.record({
    type: F.constant('execution-denied'),
    reason: F.option(text, { nil: undefined }),
  }),
  F.record({
    type: F.constant('content'),
    value: F.array(
      F.oneof(
        F.record({ type: F.constant('text'), text }),
        F.record({
          type: F.constant('file'),
          data: fileData.filter((d: any) => d.type === 'data'),
          mediaType,
          po: popts,
        }),
      ),
      { maxLength: 3 },
    ),
  }),
);
const msg = F.oneof(
  F.record({ role: F.constant('system'), content: text, po: popts }),
  F.record({
    role: F.constant('user'),
    content: F.array(F.oneof(textPart, filePart), {
      minLength: 1,
      maxLength: 4,
    }),
    po: popts,
  }),
  F.record({
    role: F.constant('assistant'),
    content: F.array(asstPart, { maxLength: 4 }),
    po: popts,
    rd: rdetails,
  }),
  F.record({
    role: F.constant('tool'),
    content: F.array(
      F.record({
        type: F.constant('tool-result'),
        toolCallId: F.constant('c1'),
        toolName: F.constant('t'),
        output: toolOutput,
        po: popts,
      }),
      { minLength: 1, maxLength: 2 },
    ),
    po: popts,
  }),
);

function realize(m: any): any {
  const po = toProviderOptions(m.po);
  const withPo = (o: any, p: any) => (p ? { ...o, providerOptions: p } : o);
  const part = (p: any) => {
    const { po: ppo, rd, ...rest } = p;
    let pp = toProviderOptions(ppo);
    if (rd) {
      pp = {
        ...(pp ?? {}),
        openrouter: { ...(pp?.openrouter ?? {}), reasoning_details: rd },
      };
    }
    if (rest.type === 'tool-result' && rest.output.type === 'content') {
      rest.output = {
        ...rest.output,
        value: rest.output.value.map((x: any) => {
          const { po: xpo, ...r } = x;
          return withPo(r, toProviderOptions(xpo));
        }),
      };
    }
    return withPo(rest, pp);
  };
  if (m.role === 'system') {
    return withPo({ role: 'system', content: m.content }, po);
  }
  let mpo = po;
  if (m.role === 'assistant' && m.rd) {
    mpo = {
      ...(mpo ?? {}),
      openrouter: { ...(mpo?.openrouter ?? {}), reasoning_details: m.rd },
    };
  }
  return withPo({ role: m.role, content: m.content.map(part) }, mpo);
}

const KNOWN_ERRORS = /Only http\(s\) and data|not supported|audio|Audio/;

function walk(
  v: any,
  f: (v: any, path: string, parent: any, key: string) => void,
  path = '$',
  parent: any = null,
  key = '',
) {
  f(v, path, parent, key);
  if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) {
      walk(v[k], f, `${path}.${k}`, v, k);
    }
  }
}

const RUNS = runs('CONVERT_RUNS', 3000);

describe('convertToOpenRouterChatMessages properties', () => {
  it('invariants', () => {
    let n = 0;
    let threw = 0;
    const obs = new Map<string, any>();
    const note = (k: string, v: any) => {
      if (!obs.has(k)) {
        obs.set(k, v);
      }
      obs.set(`${k}#count`, (obs.get(`${k}#count`) ?? 0) + 1);
    };
    F.assert(
      F.property(F.array(msg, { minLength: 1, maxLength: 6 }), (ms: any[]) => {
        n++;
        const prompt = ms.map(realize);
        let out: any;
        try {
          out = convertToOpenRouterChatMessages(prompt);
        } catch (e: any) {
          threw++;
          if (!KNOWN_ERRORS.test(String(e?.message))) {
            throw e;
          }
          note(`throws: ${String(e.message).slice(0, 80)}`, prompt);
          return;
        }
        // JSON-serializable and stable
        const json = JSON.stringify(out);
        const back = JSON.parse(json);
        // undefined keys that vanish on the JSON round trip
        const undef: string[] = [];
        walk(out, (v, path) => {
          if (v === undefined) {
            undef.push(path.replace(/\[\d+\]|\.\d+/g, '[]'));
          }
        });
        if (undef.length) {
          for (const u of new Set(undef)) {
            note(`undefined key in output: ${u}`, null);
          }
        }
        expect(back).toEqual(out); // toEqual ignores undefined keys -> semantic content survives
        // invalid option values never reach the wire
        walk(back, (v, path, _parent, key) => {
          if (key === 'cache_control') {
            const ok = VALID_CC.some(
              (c) => JSON.stringify(c) === JSON.stringify(v),
            );
            if (!ok) {
              note(
                `INVALID cache_control on wire: ${JSON.stringify(v)} at ${path.replace(/\.\d+/g, '[]')}`,
                prompt,
              );
            }
          }
          if (
            key === 'detail' &&
            path.includes('image_url') &&
            !['low', 'high', 'auto'].includes(v)
          ) {
            throw new Error(`invalid detail ${v}`);
          }
          if (key === 'processing' && !['agentic', 'static'].includes(v)) {
            throw new Error(`invalid processing ${v}`);
          }
        });
        // assistant content is a string unless some text part has cache
        // control. Whether an invalid (but truthy) value counts depends on
        // whether cache control is validated, so only assert the shape when
        // no text part has a truthy value (string) or some text part has a
        // valid one (array).
        let ai = 0;
        for (const m of prompt) {
          if (m.role !== 'assistant') {
            continue;
          }
          const o = out.filter((x: any) => x.role === 'assistant')[ai++];
          const textCC = m.content
            .filter((p: any) => p.type === 'text')
            .flatMap((p: any) => [
              p.providerOptions?.openrouter?.cacheControl,
              p.providerOptions?.openrouter?.cache_control,
              p.providerOptions?.anthropic?.cacheControl,
              p.providerOptions?.anthropic?.cache_control,
            ]);
          if (!textCC.some(Boolean)) {
            expect(o.content === null || typeof o.content === 'string').toBe(
              true,
            );
          } else if (textCC.some(isValidCC)) {
            expect(Array.isArray(o.content)).toBe(true);
          }
          if (Array.isArray(o.content)) {
            expect(o.content.map((x: any) => x.text).join('')).toBe(
              m.content
                .filter((p: any) => p.type === 'text')
                .map((p: any) => p.text)
                .join(''),
            );
          }
        }
        // dedupe never drops a unique detail (unique = not deep-equal to one already sent)
        const sent: string[] = [];
        const canon = (v: any): any =>
          Array.isArray(v)
            ? v.map(canon)
            : v && typeof v === 'object'
              ? Object.fromEntries(
                  Object.keys(v)
                    .sort()
                    .map((k) => [k, canon(v[k])]),
                )
              : v;
        ai = 0;
        for (const m of prompt) {
          if (m.role !== 'assistant') {
            continue;
          }
          const o = out.filter((x: any) => x.role === 'assistant')[ai++];
          const mrd = m.providerOptions?.openrouter?.reasoning_details;
          const cands: any[] = Array.isArray(mrd)
            ? mrd
            : (m.content.find(
                (p: any) =>
                  p.type === 'tool-call' &&
                  p.providerOptions?.openrouter?.reasoning_details?.length,
              )?.providerOptions.openrouter.reasoning_details ??
              m.content.find(
                (p: any) =>
                  p.type === 'reasoning' &&
                  p.providerOptions?.openrouter?.reasoning_details?.length,
              )?.providerOptions.openrouter.reasoning_details ??
              []);
          const outD = (o.reasoning_details ?? []).map((d: any) =>
            JSON.stringify(canon(d)),
          );
          for (const d of cands) {
            const f = d.format ?? 'anthropic-claude-v1';
            if (
              d.type === 'reasoning.text' &&
              (f === 'anthropic-claude-v1' || f === 'google-gemini-v1') &&
              !d.signature
            ) {
              continue;
            }
            if (d.type === 'reasoning.text' && !d.text && !d.signature) {
              continue;
            }
            const k = JSON.stringify(canon(d));
            if (!sent.includes(k) && !outD.includes(k)) {
              note(`dedupe dropped a unique detail (${d.type})`, {
                dropped: d,
                previouslySent: sent.map((s) => JSON.parse(s)),
                candidates: cands,
              });
            }
            if (outD.includes(k)) {
              sent.push(k);
            }
          }
        }
      }),
      { numRuns: RUNS, seed: 31 },
    );
    log(`CONVERT cases=${n} threw(known)=${threw}`);
    for (const [k, v] of obs) {
      log(
        'OBS',
        k,
        typeof v === 'number' ? v : JSON.stringify(v)?.slice(0, 900),
      );
    }
  });
});
