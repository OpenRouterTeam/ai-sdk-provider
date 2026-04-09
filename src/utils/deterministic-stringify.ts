/**
 * Serializes a value to JSON with object keys sorted alphabetically at every
 * nesting level. This produces deterministic output regardless of the
 * insertion order of object keys, which is important for prompt caching —
 * the cache key includes serialized tool call arguments verbatim, so
 * different key orderings for semantically identical objects would cause
 * cache misses.
 *
 * Arrays preserve element order. Primitives and null pass through unchanged.
 */
export function deterministicStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }

  if (typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    const entries = Object.entries(value);
    entries.sort(([a], [b]) => a.localeCompare(b));
    for (const [key, val] of entries) {
      sorted[key] = sortKeys(val);
    }
    return sorted;
  }

  return value;
}
