import type { JSONValue } from '@ai-sdk/provider';

/**
 * Removes entries with undefined values from an object.
 * Returns a new object with only defined values, cast to JSONValue types.
 */
export function pruneUndefined(value: Record<string, unknown>): Record<string, JSONValue> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Record<string, JSONValue>;
}

/**
 * Filters out undefined values from an object.
 * Returns a partial object containing only the defined properties.
 */
export function filterDefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
