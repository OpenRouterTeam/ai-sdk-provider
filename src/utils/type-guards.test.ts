import { describe, expect, it } from 'vitest';
import { isDefinedOrNotNull } from './type-guards';

describe('isDefinedOrNotNull', () => {
  it('returns true for defined values', () => {
    expect(isDefinedOrNotNull('value')).toBe(true);
    expect(isDefinedOrNotNull(0)).toBe(true);
    expect(isDefinedOrNotNull(false)).toBe(true);
  });

  it('returns false for null and undefined', () => {
    expect(isDefinedOrNotNull(null)).toBe(false);
    expect(isDefinedOrNotNull(undefined)).toBe(false);
  });
});
