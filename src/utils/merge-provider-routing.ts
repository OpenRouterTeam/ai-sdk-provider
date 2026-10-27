/**
 * Shallow merge provider routing preferences instead of letting a later
 * `provider` replace an earlier one. Pass sources in the same precedence as
 * the rest of the request body, lowest first (later wins). Non-object values
 * (null, arrays, primitives) are ignored.
 */
export function mergeProviderRouting(
  ...sources: unknown[]
): Record<string, unknown> | undefined {
  const objects = sources.filter(
    (p) => typeof p === 'object' && p !== null && !Array.isArray(p),
  );
  return objects.length > 0 ? Object.assign({}, ...objects) : undefined;
}
