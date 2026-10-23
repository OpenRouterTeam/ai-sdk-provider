import { describe, expect, it } from 'vitest';
import { mergeProviderRouting } from './merge-provider-routing';

describe('mergeProviderRouting', () => {
  it('shallow merges sources, later sources winning', () => {
    expect(
      mergeProviderRouting(
        { order: ['google'], sort: 'price' },
        { sort: 'latency' },
        { order: ['anthropic'] },
      ),
    ).toStrictEqual({ order: ['anthropic'], sort: 'latency' });
  });

  it('ignores null, arrays and primitives', () => {
    expect(
      mergeProviderRouting({ sort: 'price' }, null, ['x'], 'y', undefined),
    ).toStrictEqual({ sort: 'price' });
  });

  it('returns undefined when no source is an object', () => {
    expect(mergeProviderRouting(undefined, null, [])).toBeUndefined();
  });
});
