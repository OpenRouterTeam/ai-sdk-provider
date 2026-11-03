import { describe, expect, it } from 'vitest';
import { mergeProviderRouting } from './merge-provider-routing';

describe('mergeProviderRouting', () => {
  it('returns undefined when no source is an object', () => {
    expect(mergeProviderRouting()).toBeUndefined();
    expect(
      mergeProviderRouting(undefined, null, ['a'], 'x', 1),
    ).toBeUndefined();
  });

  it('shallow merges objects with later sources taking precedence', () => {
    expect(
      mergeProviderRouting(
        { order: ['google'], allow_fallbacks: false, sort: 'price' },
        { sort: 'latency' },
        undefined,
        { order: ['anthropic'] },
      ),
    ).toStrictEqual({
      order: ['anthropic'],
      allow_fallbacks: false,
      sort: 'latency',
    });
  });

  it('ignores null and array sources', () => {
    expect(
      mergeProviderRouting({ order: ['google'] }, null, ['anthropic'], {
        sort: 'price',
      }),
    ).toStrictEqual({ order: ['google'], sort: 'price' });
  });

  it('does not mutate inputs', () => {
    const a = { order: ['google'] };
    const b = { sort: 'price' };
    mergeProviderRouting(a, b);
    expect(a).toStrictEqual({ order: ['google'] });
    expect(b).toStrictEqual({ sort: 'price' });
  });
});
