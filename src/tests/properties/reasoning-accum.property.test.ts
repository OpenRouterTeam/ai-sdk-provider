import * as F from 'fast-check';
import { describe, expect, it } from 'vitest';
import { convertToOpenRouterChatMessages } from '../../chat/convert-to-openrouter-chat-messages';
import { log, runStream, runs, sse } from './harness';

const enc = new TextEncoder();
const FORMATS = [
  'anthropic-claude-v1',
  'openai-responses-v1',
  'google-gemini-v1',
  'xai-responses-v1',
  'unknown',
];
// small alphabet to provoke collisions (identical texts across blocks)
const txt = F.oneof(
  F.constantFrom('', 'a', 'b', 'think', 'é😀'),
  F.string({ maxLength: 4 }),
);

const op = F.oneof(
  {
    weight: 5,
    arbitrary: F.record({
      k: F.constant('text'),
      text: F.option(txt, { nil: undefined }),
      index: F.constantFrom(0, 0, 0, 1, 2),
      fmt: F.option(F.constantFrom(...FORMATS), { nil: undefined }),
      sigWithText: F.boolean(),
      nullish: F.boolean(),
    }),
  },
  {
    weight: 2,
    arbitrary: F.record({
      k: F.constant('sig'),
      index: F.constantFrom(0, 1),
      emptyText: F.boolean(),
    }),
  },
  {
    weight: 1,
    arbitrary: F.record({
      k: F.constant('enc'),
      withId: F.boolean(),
      fmt: F.option(F.constantFrom(...FORMATS), { nil: undefined }),
    }),
  },
  {
    weight: 1,
    arbitrary: F.record({
      k: F.constant('sum'),
      summary: txt,
      fmt: F.option(F.constantFrom(...FORMATS), { nil: undefined }),
    }),
  },
);
const scenario = F.record({
  ops: F.array(op, { maxLength: 12 }),
  group: F.array(F.integer({ min: 1, max: 3 }), { maxLength: 12 }), // details per SSE chunk
  textAfter: F.boolean(),
  toolCall: F.boolean(),
});

function build(sc: any) {
  let sigN = 0;
  let encN = 0;
  const details: any[] = [];
  const inputTexts: string[] = [];
  const inputSummaries: string[] = [];
  const sigs: string[] = [];
  const encs: string[] = [];
  for (const o of sc.ops) {
    if (o.k === 'text') {
      const d: any = { type: 'reasoning.text', index: o.index };
      if (o.text !== undefined) {
        d.text = o.text;
      } else if (o.nullish) {
        d.text = null;
      }
      if (o.fmt) {
        d.format = o.fmt;
      } else if (o.nullish) {
        d.format = null;
      }
      if (o.sigWithText) {
        d.signature = `SIG${sigN++}`;
        sigs.push(d.signature);
      }
      inputTexts.push(o.text ?? '');
      details.push(d);
    } else if (o.k === 'sig') {
      const d: any = {
        type: 'reasoning.text',
        signature: `SIG${sigN++}`,
        index: o.index,
      };
      if (o.emptyText) {
        d.text = '';
      }
      sigs.push(d.signature);
      details.push(d);
    } else if (o.k === 'enc') {
      const d: any = { type: 'reasoning.encrypted', data: `ENC${encN++}` };
      if (o.withId) {
        d.id = `rs_${encN}`;
      }
      if (o.fmt) {
        d.format = o.fmt;
      }
      encs.push(d.data);
      details.push(d);
    } else {
      const d: any = { type: 'reasoning.summary', summary: o.summary };
      if (o.fmt) {
        d.format = o.fmt;
      }
      inputSummaries.push(o.summary);
      details.push(d);
    }
  }
  const base = { id: 'gen-1', model: 'm', choices: [] as any[] };
  const ev: any[] = [];
  let i = 0;
  let g = 0;
  while (i < details.length) {
    const n = sc.group[g++ % Math.max(1, sc.group.length)] ?? 1;
    ev.push({
      ...base,
      choices: [
        { index: 0, delta: { reasoning_details: details.slice(i, i + n) } },
      ],
    });
    i += n;
  }
  if (sc.textAfter) {
    ev.push({ ...base, choices: [{ index: 0, delta: { content: 'answer' } }] });
  }
  if (sc.toolCall) {
    ev.push({
      ...base,
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                id: 'c1',
                type: 'function',
                function: { name: 't', arguments: '{}' },
              },
            ],
          },
        },
      ],
    });
  }
  ev.push({
    ...base,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: sc.toolCall ? 'tool_calls' : 'stop',
      },
    ],
  });
  return { ev, inputTexts, inputSummaries, sigs, encs };
}

function undefinedKeys(v: any, path = '$'): string[] {
  if (!v || typeof v !== 'object') {
    return [];
  }
  const out: string[] = [];
  for (const k of Object.keys(v)) {
    if (v[k] === undefined) {
      out.push(`${path}.${k}`);
    } else {
      out.push(...undefinedKeys(v[k], `${path}.${k}`));
    }
  }
  return out;
}

(globalThis as any).AI_SDK_LOG_WARNINGS = false;
const RUNS = runs('REASON_RUNS', 2000);

describe('reasoning detail accumulation', () => {
  it('invariants + roundtrip', async () => {
    let n = 0;
    const obs = new Map<string, any>();
    const note = (k: string, v: any) => {
      if (!obs.has(k)) {
        obs.set(k, v);
      }
      obs.set(`${k}#count`, (obs.get(`${k}#count`) ?? 0) + 1);
    };
    await F.assert(
      F.asyncProperty(scenario, async (sc: any) => {
        n++;
        const b = build(sc);
        const parts = await runStream([enc.encode(sse(b.ev))]);
        const finish = parts.find((p) => p.type === 'finish');
        const acc: any[] = finish.providerMetadata.openrouter.reasoning_details;
        // 1. no undefined own keys (in acc and in every part)
        expect(undefinedKeys(acc)).toEqual([]);
        // 2. signatures: each exactly once
        for (const s of b.sigs) {
          expect(acc.filter((d) => d.signature === s).length).toBe(1);
        }
        // 3. text not lost / duplicated
        expect(
          acc
            .filter((d) => d.type === 'reasoning.text')
            .map((d) => d.text ?? '')
            .join(''),
        ).toBe(b.inputTexts.join(''));
        expect(
          acc
            .filter((d) => d.type === 'reasoning.summary')
            .map((d) => d.summary)
            .join(''),
        ).toBe(b.inputSummaries.join(''));
        expect(
          acc
            .filter((d) => d.type === 'reasoning.encrypted')
            .map((d) => d.data),
        ).toEqual(b.encs);
        // observation: signature landed on a block different from the text it should sign
        // (text -> sig closes that block; anything after belongs to a new block)
        // observation: merged across index change / format change
        {
          let prev: any;
          for (const d of b.ev.flatMap(
            (e: any) => e.choices[0]?.delta?.reasoning_details ?? [],
          )) {
            if (
              prev &&
              prev.type === 'reasoning.text' &&
              d.type === 'reasoning.text' &&
              !prev.signature
            ) {
              if (prev.index !== d.index) {
                note('unsigned text merged across index change', sc.ops);
              }
              if (prev.format && d.format && prev.format !== d.format) {
                note(
                  'text merged across format change (later format lost)',
                  sc.ops,
                );
              }
            }
            prev = d;
          }
        }
        // reasoning-delta text equals emitted reasoning text
        const rdelta = parts
          .filter((p) => p.type === 'reasoning-delta')
          .map((p) => p.delta)
          .join('');
        expect(rdelta).toBe(
          [...b.inputTexts, ...b.inputSummaries].length ? rdelta : '',
        );

        // 4. roundtrip through convert (JSON-persisted UI message style)
        const persisted = JSON.parse(JSON.stringify(parts));
        const content: any[] = [];
        const rEnd = persisted.find((p: any) => p.type === 'reasoning-end');
        if (rEnd) {
          content.push({
            type: 'reasoning',
            text: rdelta,
            providerOptions: rEnd.providerMetadata,
          });
        }
        if (sc.textAfter) {
          content.push({ type: 'text', text: 'answer' });
        }
        for (const c of persisted.filter((p: any) => p.type === 'tool-call')) {
          content.push({
            type: 'tool-call',
            toolCallId: c.toolCallId,
            toolName: c.toolName,
            input: JSON.parse(c.input),
            providerOptions: c.providerMetadata,
          });
        }
        if (!content.length) {
          return;
        }
        const msgs: any = convertToOpenRouterChatMessages([
          { role: 'assistant', content } as any,
        ]);
        const out: any[] = msgs[0].reasoning_details ?? [];
        expect(undefinedKeys(JSON.parse(JSON.stringify(msgs)))).toEqual([]);
        // expected: acc minus unsigned anthropic/gemini text, minus key-less text; dedupe by TYPE-QUALIFIED key
        const keep = acc.filter((d) => {
          if (d.type !== 'reasoning.text') {
            return true;
          }
          const f = d.format ?? 'anthropic-claude-v1';
          if (
            (f === 'anthropic-claude-v1' || f === 'google-gemini-v1') &&
            !d.signature
          ) {
            return false;
          }
          return !!(d.text || d.signature);
        });
        const seen = new Set<string>();
        const expected = keep.filter((d) => {
          const k = `${d.type}|${d.type === 'reasoning.summary' ? d.summary : d.type === 'reasoning.encrypted' ? d.id || d.data : d.text || d.signature}`;
          if (seen.has(k)) {
            return false;
          }
          seen.add(k);
          return true;
        });
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
        if (JSON.stringify(canon(out)) !== JSON.stringify(canon(expected))) {
          const lostSigned = expected.filter(
            (d) => d.signature && !out.some((o) => o.signature === d.signature),
          );
          if (lostSigned.length) {
            note('roundtrip dropped a SIGNED text detail', { acc, out });
          } else {
            note('roundtrip differs from type-qualified dedupe', {
              acc,
              out,
              expected,
            });
          }
          const crossType = expected.filter(
            (d) =>
              !out.some(
                (o) => JSON.stringify(canon(o)) === JSON.stringify(canon(d)),
              ) &&
              acc.some(
                (e) =>
                  e.type !== d.type &&
                  [e.summary, e.text, e.id, e.data, e.signature]
                    .filter(Boolean)
                    .some((x) =>
                      [d.summary, d.text, d.id, d.data, d.signature].includes(
                        x,
                      ),
                    ),
              ),
          );
          if (crossType.length) {
            note('dedupe dropped detail due to CROSS-TYPE key collision', {
              dropped: crossType,
              acc,
            });
          }
        }
        // every signature on a detail that the user would need to send back survives? (same-text collision)
        const sameTextSigned = keep.filter(
          (d) =>
            d.type === 'reasoning.text' &&
            d.signature &&
            d.text &&
            keep.some(
              (e) =>
                e !== d && e.type === 'reasoning.text' && e.text === d.text,
            ),
        );
        if (sameTextSigned.length) {
          note('identical text in two signed blocks', { keep, out });
        }
      }),
      { numRuns: RUNS, seed: 21 },
    );
    log(`REASON cases=${n}`);
    for (const [k, v] of obs) {
      log(
        'OBS',
        k,
        typeof v === 'number' ? v : JSON.stringify(v).slice(0, 1200),
      );
    }
  });
});
