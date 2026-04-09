import { describe, expect, it } from 'vitest';
import { deterministicStringify } from './deterministic-stringify';

describe('deterministicStringify', () => {
  it('should sort top-level keys alphabetically', () => {
    const obj: Record<string, string> = {};
    obj.z = 'last';
    obj.a = 'first';
    obj.m = 'middle';

    expect(deterministicStringify(obj)).toBe(
      '{"a":"first","m":"middle","z":"last"}',
    );
  });

  it('should produce identical output for objects with same keys in different insertion order', () => {
    const objA = { city: 'Tokyo', unit: 'celsius' };

    const objB: Record<string, string> = {};
    objB.unit = 'celsius';
    objB.city = 'Tokyo';

    expect(deterministicStringify(objA)).toBe(deterministicStringify(objB));
  });

  it('should recursively sort keys in nested objects', () => {
    expect(
      deterministicStringify({
        outer: { z: 1, a: 2 },
        inner: { b: { d: 4, c: 3 } },
      }),
    ).toBe('{"inner":{"b":{"c":3,"d":4}},"outer":{"a":2,"z":1}}');
  });

  it('should preserve array element order', () => {
    expect(deterministicStringify([3, 1, 2])).toBe('[3,1,2]');
  });

  it('should sort keys within objects inside arrays', () => {
    expect(
      deterministicStringify([
        { b: 2, a: 1 },
        { d: 4, c: 3 },
      ]),
    ).toBe('[{"a":1,"b":2},{"c":3,"d":4}]');
  });

  it('should handle empty objects', () => {
    expect(deterministicStringify({})).toBe('{}');
  });

  it('should handle empty arrays', () => {
    expect(deterministicStringify([])).toBe('[]');
  });

  it('should handle null', () => {
    expect(deterministicStringify(null)).toBe('null');
  });

  it('should handle primitive values', () => {
    expect(deterministicStringify('hello')).toBe('"hello"');
    expect(deterministicStringify(42)).toBe('42');
    expect(deterministicStringify(true)).toBe('true');
    expect(deterministicStringify(false)).toBe('false');
  });

  it('should handle null values within objects', () => {
    expect(deterministicStringify({ b: null, a: 1 })).toBe('{"a":1,"b":null}');
  });

  it('should handle undefined values (omitted by JSON.stringify)', () => {
    expect(deterministicStringify({ b: undefined, a: 1 })).toBe('{"a":1}');
  });

  it('should handle deeply nested mixed structures', () => {
    const input = {
      config: {
        rules: [{ pattern: '*.ts', options: { strict: true, level: 'error' } }],
        metadata: { version: 1, name: 'default' },
      },
    };

    expect(deterministicStringify(input)).toBe(
      '{"config":{"metadata":{"name":"default","version":1},"rules":[{"options":{"level":"error","strict":true},"pattern":"*.ts"}]}}',
    );
  });
});
