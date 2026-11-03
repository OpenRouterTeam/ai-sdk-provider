/**
 * Shallow merges OpenRouter provider routing preferences (`provider`) from
 * multiple sources, in ascending precedence order (later sources win).
 *
 * Only plain-object sources are merged; `undefined`, `null`, arrays and
 * primitives are ignored. Returns `undefined` when no source is an object,
 * so callers can omit the `provider` field entirely.
 */
export function mergeProviderRouting(
  ...sources: unknown[]
): Record<string, unknown> | undefined {
  const objects = sources.filter(
    (source): source is Record<string, unknown> =>
      typeof source === 'object' && source !== null && !Array.isArray(source),
  );
  return objects.length > 0 ? Object.assign({}, ...objects) : undefined;
}
