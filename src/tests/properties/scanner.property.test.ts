import * as F from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  createJsonCompletenessScanner,
  mayBeCompleteJson,
} from '../../utils/json-completeness-scanner';
import { log, runs } from './harness';

function parses(s: string) {
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
}

// feed text split into chunks; check after each chunk
function checkChunks(text: string, cuts: number[]) {
  const sc = createJsonCompletenessScanner();
  let acc = '';
  let prev = 0;
  const points = [...new Set(cuts.map((c) => c % (text.length + 1)))].sort(
    (a, b) => a - b,
  );
  points.push(text.length);
  for (const p of points) {
    if (p < prev) {
      continue;
    }
    const chunk = text.slice(prev, p);
    prev = p;
    acc += chunk;
    const may = mayBeCompleteJson(sc, chunk);
    if (!may && parses(acc)) {
      return acc;
    }
  }
  return null;
}

function everyCodeUnit(text: string) {
  const sc = createJsonCompletenessScanner();
  for (let i = 0; i < text.length; i++) {
    const may = mayBeCompleteJson(sc, text[i] as string);
    if (!may && parses(text.slice(0, i + 1))) {
      return text.slice(0, i + 1);
    }
  }
  return null;
}

const ws = F.constantFrom('', ' ', '\n', '\t', '\r', '  ', ' ', '﻿', ' ');
const rawStr = F.oneof(
  F.string({ unit: 'binary' }),
  F.string({
    unit: F.constantFrom(
      '"',
      '\\',
      '{',
      '}',
      '[',
      ']',
      ',',
      ':',
      'a',
      'u',
      '0',
    ),
  }),
  F.string({ unit: 'grapheme' }),
);
const anyJson = F.oneof(
  {
    weight: 3,
    arbitrary: F.jsonValue({ maxDepth: 6 }).map((v: unknown) =>
      JSON.stringify(v),
    ),
  },
  {
    weight: 2,
    arbitrary: F.jsonValue({ maxDepth: 4 }).map((v: unknown) =>
      JSON.stringify(v, null, 2),
    ),
  },
  {
    weight: 1,
    arbitrary: F.jsonValue({ maxDepth: 4, stringUnit: 'binary' }).map(
      (v: unknown) => JSON.stringify(v),
    ),
  },
);
const token = F.oneof(
  F.constantFrom(
    '{',
    '}',
    '[',
    ']',
    ',',
    ':',
    '"',
    '\\',
    '\\"',
    'true',
    'tr',
    'ue',
    'false',
    'null',
    'nul',
    '-0',
    '1e5',
    '1.',
    '.5',
    '-',
    '0',
    '01',
    '1E+2',
    '"\\u12',
    '"\\ud800"',
    '﻿',
    ' ',
    '\n',
    'x',
  ),
  rawStr.map((s: string) => JSON.stringify(s)),
  anyJson,
);
const soup = F.array(token, { maxLength: 12 }).map((a: string[]) => a.join(''));
const docs = F.oneof(
  {
    weight: 4,
    arbitrary: F.tuple(ws, anyJson, ws).map(
      ([a, b, c]: [string, string, string]) => a + b + c,
    ),
  },
  {
    weight: 1,
    arbitrary: F.tuple(anyJson, ws, anyJson).map(
      ([a, b, c]: [string, string, string]) => a + b + c,
    ),
  },
  {
    weight: 1,
    arbitrary: F.tuple(anyJson, F.string()).map(
      ([a, b]: [string, string]) => a + b,
    ),
  },
  { weight: 3, arbitrary: soup },
);

const RUNS = runs('SCAN_RUNS', 5000);

describe('json completeness scanner (differential)', () => {
  it('never says incomplete when JSON.parse succeeds (every code-unit prefix)', () => {
    F.assert(
      F.property(docs, (d: string) => {
        expect(everyCodeUnit(d)).toBeNull();
      }),
      { numRuns: RUNS, seed: 42 },
    );
  });
  it('random chunking', () => {
    F.assert(
      F.property(
        docs,
        F.array(F.nat(), { maxLength: 10 }),
        (d: string, cuts: number[]) => {
          expect(checkChunks(d, cuts)).toBeNull();
        },
      ),
      { numRuns: Math.ceil(RUNS * 0.7), seed: 7 },
    );
  });
  it('adversarial fixed inputs', () => {
    const deep = 10000;
    const inputs = [
      '﻿{}',
      '{}﻿',
      '"\ud800"',
      '"\udc00\ud800"',
      '-0',
      '1e5',
      '1.',
      '.5',
      '-',
      '1',
      '12 3',
      'tr',
      'true',
      'true ',
      'true x',
      'nulll',
      '[]]',
      '{"a":"}"}',
      '"\\\\"',
      '"\\\\\\""',
      '['.repeat(deep) + ']'.repeat(deep),
      '{"a":'.repeat(deep) + '1' + '}'.repeat(deep),
      JSON.stringify('x'.repeat(1_000_000)),
      JSON.stringify('\\"{}[]'.repeat(100000)),
      '1 2',
      '{} {}',
      '[] ',
      ' [ ] ',
      '"a""b"',
      '0x1',
      'Infinity',
      'NaN',
      '+1',
      '"\u0000"',
      '"\n"',
      ' {}',
      '{} ',
    ];
    for (const s of inputs) {
      // Checking every prefix is quadratic, so only do it for short inputs.
      if (s.length < 2000) {
        expect(everyCodeUnit(s)).toBeNull();
      }
      const sc = createJsonCompletenessScanner();
      const may = mayBeCompleteJson(sc, s);
      if (parses(s)) {
        expect(may).toBe(true);
      }
    }
  });
  // Asserts on JSON.parse call counts rather than wall time, so slow CI
  // machines cannot make it flaky.
  it('signals a possibly complete document only once for long arg streams', () => {
    for (const n of [1000, 10000, 100000]) {
      const deltas: string[] = ['{"items":['];
      for (let i = 0; i < n; i++) {
        deltas.push(`${i ? ',' : ''}{"k":"v\\"${i}{["}`);
      }
      deltas.push(']}');
      const t0 = performance.now();
      const sc = createJsonCompletenessScanner();
      let calls = 0;
      let acc = '';
      for (const d of deltas) {
        acc += d;
        if (mayBeCompleteJson(sc, d)) {
          calls++;
          JSON.parse(acc);
        }
      }
      expect(calls).toBe(1);
      log(
        `LINEAR n=${n} chars=${acc.length} parseCalls=${calls} ms=${(performance.now() - t0).toFixed(1)}`,
      );
    }
  });
});
