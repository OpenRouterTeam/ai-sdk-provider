import { describe, expect, it } from 'vitest';
import { mergeProviderRouting } from './merge-provider-routing';

describe('mergeProviderRouting', () => {
  it('returns undefined when no source is a plain object', () => {
    expect(mergeProviderRouting([])).toBeUndefined();
    expect(
      mergeProviderRouting([undefined, null, ['a'], 'x', 1], undefined),
    ).toBeUndefined();
  });

  it('shallow merges objects with later sources taking precedence', () => {
    expect(
      mergeProviderRouting(
        [
          { order: ['google'], allow_fallbacks: false, sort: 'price' },
          { sort: 'latency' },
          undefined,
        ],
        { order: ['anthropic'] },
      ),
    ).toStrictEqual({
      order: ['anthropic'],
      allow_fallbacks: false,
      sort: 'latency',
    });
  });

  it('replaces nested arrays and objects instead of merging them', () => {
    expect(
      mergeProviderRouting(
        [{ only: ['a', 'b'], ignore: ['c'], max_price: { prompt: 1 } }],
        { only: ['c'], max_price: { completion: 2 } },
      ),
    ).toStrictEqual({
      only: ['c'],
      ignore: ['c'],
      max_price: { completion: 2 },
    });
  });

  it('ignores null, array and primitive configured sources', () => {
    expect(
      mergeProviderRouting([{ order: ['google'] }, null, ['anthropic'], 'x'], {
        sort: 'price',
      }),
    ).toStrictEqual({ order: ['google'], sort: 'price' });
  });

  it('ignores non-plain objects such as class instances and dates', () => {
    class Routing {
      order = ['google'];
    }
    expect(
      mergeProviderRouting([new Routing(), new Date()], new Map()),
    ).toBeUndefined();
  });

  it('accepts objects with a null prototype', () => {
    const source: Record<string, unknown> = Object.create(null);
    source.sort = 'price';
    expect(mergeProviderRouting([source])).toStrictEqual({ sort: 'price' });
  });

  it('clears all routing when the runtime value is null', () => {
    expect(
      mergeProviderRouting(
        [{ order: ['google'] }, { allow_fallbacks: false }],
        null,
      ),
    ).toBeUndefined();
  });

  it('ignores non-object runtime values other than null', () => {
    expect(
      mergeProviderRouting([{ order: ['google'] }], ['anthropic']),
    ).toStrictEqual({ order: ['google'] });
  });

  it('does not mutate inputs', () => {
    const a = { order: ['google'] };
    const b = { sort: 'price' };
    mergeProviderRouting([a], b);
    expect(a).toStrictEqual({ order: ['google'] });
    expect(b).toStrictEqual({ sort: 'price' });
  });
});
