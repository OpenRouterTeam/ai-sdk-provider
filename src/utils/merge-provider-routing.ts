/**
 * Shallow merges `provider` routing preferences instead of replacing them.
 * Pass the sources from lowest to highest precedence (later wins). Values
 * that are not plain objects (null, arrays, primitives) are ignored. Returns
 * undefined when no source is an object.
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
