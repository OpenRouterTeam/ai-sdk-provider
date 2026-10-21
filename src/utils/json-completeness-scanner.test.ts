import { describe, expect, it } from 'vitest';
import {
  createJsonCompletenessScanner,
  mayBeCompleteJson,
} from './json-completeness-scanner';

function scan(chunks: string[]): boolean[] {
  const scanner = createJsonCompletenessScanner();
  return chunks.map((chunk) => mayBeCompleteJson(scanner, chunk));
}

describe('mayBeCompleteJson', () => {
  it('returns true only once the top-level object closes', () => {
    expect(scan(['{"a":', '[1,{"b":2}', ']', '}', ' '])).toStrictEqual([
      false,
      false,
      false,
      true,
      true,
    ]);
  });

  it('ignores braces, brackets and escaped quotes inside strings', () => {
    expect(scan(['{"a":"}]', '\\"{', '\\\\', '"', '}'])).toStrictEqual([
      false,
      false,
      false,
      false,
      true,
    ]);
  });

  it('handles an escape split across chunks', () => {
    expect(scan(['{"a":"x\\', '"}', '"}'])).toStrictEqual([false, false, true]);
  });

  it('returns true for empty input and top-level primitives', () => {
    expect(scan([''])).toStrictEqual([true]);
    expect(scan(['"ab', 'c"'])).toStrictEqual([false, true]);
  });

  it('never returns true again after an unmatched closer', () => {
    expect(scan(['{}', '}', '{'])).toStrictEqual([true, false, false]);
  });

  it('never returns true again once the first character cannot start JSON', () => {
    expect(scan(['x', '{}'])).toStrictEqual([false, false]);
    expect(scan([' \n\t\r', 'x', '1'])).toStrictEqual([true, false, false]);
    // JSON.parse rejects a leading BOM, so it can never become valid JSON.
    expect(scan(['\uFEFF', '{}'])).toStrictEqual([false, false]);
  });

  it('never returns true again after content follows a complete value', () => {
    expect(scan(['{"a":1}', ' ', '{"b":2}'])).toStrictEqual([
      true,
      true,
      false,
    ]);
    expect(scan(['"a"', 'b'])).toStrictEqual([true, false]);
    expect(scan(['12', '3', ' ', '4'])).toStrictEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it('returns true whenever JSON.parse accepts the text seen so far', () => {
    // Seeded so failures are reproducible.
    let seed = 581;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const pick = <T>(items: readonly T[]): T =>
      items[Math.floor(random() * items.length)] as T;
    const whitespace = () => pick(['', '', '', ' ', '\n', '\t', '\r\n  ']);
    const stringValue = () =>
      JSON.stringify(
        Array.from({ length: Math.floor(random() * 6) }, () =>
          pick(['a', '{', '}', '[', ']', '"', '\\', ':', ',', 'é', '\n']),
        ).join(''),
      );
    const value = (depth: number): string => {
      const kind =
        depth > 3 ? Math.floor(random() * 4) : pick([0, 1, 2, 3, 4, 5]);
      switch (kind) {
        case 0:
          return stringValue();
        case 1:
          return pick(['0', '-1', '12.5e3', 'true', 'false', 'null']);
        case 2:
          return pick(['{}', '[]', '""']);
        case 3:
          return stringValue();
        case 4:
          return `{${Array.from(
            { length: Math.floor(random() * 4) },
            () =>
              `${whitespace()}${stringValue()}${whitespace()}:${whitespace()}${value(depth + 1)}${whitespace()}`,
          ).join(',')}}`;
        default:
          return `[${Array.from(
            { length: Math.floor(random() * 4) },
            () => `${whitespace()}${value(depth + 1)}${whitespace()}`,
          ).join(',')}]`;
      }
    };
    // Mutations reach the dead states and nearby invalid text.
    const mutate = (text: string): string => {
      const position = Math.floor(random() * (text.length + 1));
      const insert = pick(['x', '}', ']', '{', '"', '\\', ' ', '1', '\uFEFF']);
      switch (Math.floor(random() * 5)) {
        case 0:
          return text.slice(0, position) + insert + text.slice(position);
        case 1:
          return text.slice(0, position) + text.slice(position + 1);
        case 2:
          return `${text}${whitespace()}${value(0)}`;
        case 3:
          return `${insert}${text}`;
        default:
          return text;
      }
    };

    let parsablePrefixes = 0;
    let deadScanners = 0;
    for (let iteration = 0; iteration < 2000; iteration++) {
      let text = `${whitespace()}${value(0)}${whitespace()}`;
      if (random() < 0.5) {
        text = mutate(text);
      }

      const scanner = createJsonCompletenessScanner();
      let offset = 0;
      while (offset < text.length) {
        const end = offset + 1 + Math.floor(random() * 4);
        const mayBeComplete = mayBeCompleteJson(
          scanner,
          text.slice(offset, end),
        );
        offset = end;

        const prefix = text.slice(0, offset);
        let parsable = true;
        try {
          JSON.parse(prefix);
        } catch {
          parsable = false;
        }
        if (parsable) {
          parsablePrefixes++;
          if (!mayBeComplete) {
            throw new Error(`Scanner rejected parsable JSON: ${prefix}`);
          }
        }
      }
      if (scanner.dead) {
        deadScanners++;
      }
    }

    // Guard against a generator that never exercises either side.
    expect(parsablePrefixes).toBeGreaterThan(500);
    expect(deadScanners).toBeGreaterThan(200);
  });
});
