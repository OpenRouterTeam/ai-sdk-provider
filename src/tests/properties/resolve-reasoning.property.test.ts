import { describe, expect, it } from 'vitest';
import { createOpenRouter } from '../../provider';
import { resolveReasoning } from '../../utils/resolve-reasoning';
import { log } from './harness';

const CALL = [
  undefined,
  'provider-default',
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
] as const;
const SETTINGS: any[] = [undefined, {}];
for (const enabled of [undefined, true, false]) {
  for (const exclude of [undefined, true, false]) {
    for (const tail of [
      { effort: 'high' },
      { effort: 'max' },
      { effort: 'none' },
      { max_tokens: 1234 },
      {},
    ]) {
      const s: any = { ...tail };
      if (enabled !== undefined) {
        s.enabled = enabled;
      }
      if (exclude !== undefined) {
        s.exclude = exclude;
      }
      SETTINGS.push(s);
    }
  }
}
const PROVIDER_OPTS: any[] = [
  undefined,
  {},
  { openrouter: {} },
  { openrouter: { reasoning_effort: 'low' } },
  { openrouter: { reasoning_effort: null } },
  { openrouter: { reasoning: { effort: 'minimal' } } },
  { openrouter: { reasoning: { max_tokens: 50 }, reasoning_effort: 'low' } },
  { anthropic: { reasoning_effort: 'low' } },
];

// Written-out spec
function spec(call: any, settings: any, po: any): any {
  const custom = call !== undefined && call !== 'provider-default';
  const hasEffortOpt =
    po?.openrouter &&
    'reasoning_effort' in po.openrouter &&
    po.openrouter.reasoning_effort !== undefined;
  if (!custom || hasEffortOpt) {
    return settings;
  }
  const out: any = { effort: call };
  if (settings?.enabled !== undefined) {
    out.enabled = settings.enabled;
  }
  if (settings?.exclude !== undefined) {
    out.exclude = settings.exclude;
  }
  return out;
}
// what actually lands on the wire for `reasoning` after providerOptions spread
function wireSpec(call: any, settings: any, po: any) {
  const r = spec(call, settings, po);
  if (po?.openrouter && 'reasoning' in po.openrouter) {
    return po.openrouter.reasoning;
  }
  return r;
}

const canon = (v: any): any =>
  v && typeof v === 'object'
    ? Object.fromEntries(
        Object.keys(v)
          .sort()
          .filter((k) => v[k] !== undefined)
          .map((k) => [k, canon(v[k])]),
      )
    : v;
const strip = (v: any) =>
  v === undefined ? undefined : canon(JSON.parse(JSON.stringify(v)));

describe('resolveReasoning exhaustive', () => {
  it('unit: matches spec table', () => {
    let n = 0;
    const fails: string[] = [];
    for (const c of CALL) {
      for (const s of SETTINGS) {
        for (const p of PROVIDER_OPTS) {
          n++;
          const got = resolveReasoning({
            reasoning: c as any,
            settingsReasoning: s,
            providerOptions: p,
          });
          const want = spec(c, s, p);
          // identity for fallbacks
          if (want === s && got !== s) {
            fails.push(`identity ${JSON.stringify({ c, s, p })}`);
          }
          if (JSON.stringify(strip(got)) !== JSON.stringify(strip(want))) {
            fails.push(JSON.stringify({ c, s, p, got, want }));
          }
          if (got && typeof got === 'object') {
            for (const [k, v] of Object.entries(got)) {
              if (v === undefined) {
                fails.push(`undefined-key ${k} ${JSON.stringify({ c, s, p })}`);
              }
            }
          }
        }
      }
    }
    log(`RESOLVE unit cases=${n} fails=${fails.length}`);
    const undefKeys = fails.filter((f) => f.startsWith('undefined-key'));
    log(
      `RESOLVE undefined-key outputs=${undefKeys.length} e.g. ${undefKeys[0]}`,
    );
    expect(fails.filter((f) => !f.startsWith('undefined-key'))).toEqual([]);
  });

  it('e2e: request body (chat generate/stream, completion)', async () => {
    let last: any;
    const fetchFn = async (_url: any, init: any) => {
      last = JSON.parse(init.body);
      return new Response('{"error":{"message":"x","code":400}}', {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    };
    const provider = createOpenRouter({ apiKey: 'k', fetch: fetchFn as any });
    let n = 0;
    const fails: string[] = [];
    const conflicts: string[] = [];
    for (const c of CALL) {
      for (const s of SETTINGS) {
        for (const p of PROVIDER_OPTS) {
          for (const kind of ['gen', 'stream', 'completion'] as const) {
            n++;
            const m: any =
              kind === 'completion'
                ? provider.completion('m', { reasoning: s })
                : provider.chat('m', { reasoning: s });
            const opts: any = {
              prompt: [
                { role: 'user', content: [{ type: 'text', text: 'hi' }] },
              ],
              reasoning: c,
              providerOptions: p,
            };
            last = undefined;
            try {
              await (kind === 'stream' ? m.doStream(opts) : m.doGenerate(opts));
            } catch {}
            const want = strip(wireSpec(c, s, p));
            if (
              JSON.stringify(strip(last.reasoning)) !== JSON.stringify(want)
            ) {
              fails.push(
                JSON.stringify({ kind, c, s, p, got: last.reasoning, want }),
              );
            }
            if (
              last.reasoning_effort != null &&
              last.reasoning?.effort != null &&
              last.reasoning_effort !== last.reasoning.effort
            ) {
              conflicts.push(
                JSON.stringify({
                  kind,
                  c,
                  s,
                  p,
                  reasoning_effort: last.reasoning_effort,
                  reasoning: last.reasoning,
                }),
              );
            }
          }
        }
      }
    }
    log(
      `RESOLVE e2e cases=${n} fails=${fails.length} conflicts=${conflicts.length}`,
    );
    log(fails.slice(0, 3).join('\n'));
    log('CONFLICT e.g.', conflicts[0]);
    expect(fails).toEqual([]);
  });
});
