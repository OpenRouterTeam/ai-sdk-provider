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
});
