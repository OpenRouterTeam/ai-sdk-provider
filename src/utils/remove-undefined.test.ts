import { describe, expect, it } from 'vitest';
import { removeUndefinedEntries } from './remove-undefined';

describe('removeUndefinedEntries', () => {
  it('removes nullish values and preserves other values', () => {
    expect(
      removeUndefinedEntries({
        text: 'hello',
        count: 0,
        enabled: false,
        empty: '',
        missing: undefined,
        nullable: null,
      }),
    ).toEqual({
      text: 'hello',
      count: 0,
      enabled: false,
      empty: '',
    });
  });
});
