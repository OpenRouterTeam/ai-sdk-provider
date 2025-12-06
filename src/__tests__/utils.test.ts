import { describe, expect, it } from 'vitest';
import { filterDefined, pruneUndefined } from '../utils';

describe('pruneUndefined', () => {
  it('removes undefined values from an object', () => {
    const input = {
      a: 'value',
      b: undefined,
      c: 123,
      d: undefined,
    };
    const result = pruneUndefined(input);
    expect(result).toEqual({
      a: 'value',
      c: 123,
    });
  });

  it('returns empty object when all values are undefined', () => {
    const input = {
      a: undefined,
      b: undefined,
    };
    const result = pruneUndefined(input);
    expect(result).toEqual({});
  });

  it('returns all values when none are undefined', () => {
    const input = {
      a: 'value',
      b: 123,
      c: true,
    };
    const result = pruneUndefined(input);
    expect(result).toEqual(input);
  });

  it('preserves null values', () => {
    const input = {
      a: null,
      b: undefined,
      c: 'value',
    };
    const result = pruneUndefined(input);
    expect(result).toEqual({
      a: null,
      c: 'value',
    });
  });

  it('preserves falsy values that are not undefined', () => {
    const input = {
      a: 0,
      b: '',
      c: false,
      d: undefined,
    };
    const result = pruneUndefined(input);
    expect(result).toEqual({
      a: 0,
      b: '',
      c: false,
    });
  });
});

describe('filterDefined', () => {
  it('filters out undefined values from an object', () => {
    const input = {
      temperature: 0.7,
      maxTokens: undefined,
      topP: 0.9,
    };
    const result = filterDefined(input);
    expect(result).toEqual({
      temperature: 0.7,
      topP: 0.9,
    });
  });

  it('returns empty object when all values are undefined', () => {
    const input = {
      a: undefined,
      b: undefined,
    };
    const result = filterDefined(input);
    expect(result).toEqual({});
  });

  it('returns all values when none are undefined', () => {
    const input = {
      a: 'value',
      b: 123,
    };
    const result = filterDefined(input);
    expect(result).toEqual(input);
  });

  it('preserves null values', () => {
    const input = {
      a: null,
      b: undefined,
    };
    const result = filterDefined(input);
    expect(result).toEqual({
      a: null,
    });
  });

  it('preserves zero and empty string', () => {
    const input = {
      count: 0,
      name: '',
      missing: undefined,
    };
    const result = filterDefined(input);
    expect(result).toEqual({
      count: 0,
      name: '',
    });
  });
});
