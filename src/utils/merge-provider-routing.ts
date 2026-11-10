/**
 * Returns true when `value` is a plain object: a non-null object whose
 * prototype is `Object.prototype` or `null`. Arrays, class instances, dates
 * and other exotic objects are rejected.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Resolves the OpenRouter provider routing preferences (`provider`) for a
 * request.
 *
 * `configured` sources (model settings, factory/model `extraBody`) are listed
 * in ascending precedence order, and `runtime` is the call-time
 * `providerOptions.openrouter.provider`, which wins over all of them.
 *
 * - Plain-object sources are shallow merged; later sources win. Nested values
 *   such as arrays (`order`, `only`, `ignore`) or objects (`max_price`) are
 *   replaced, not merged.
 * - Other values (`undefined`, `null`, arrays, primitives, class instances)
 *   in `configured` are ignored.
 * - An explicit `runtime` value of `null` clears provider routing: the
 *   configured sources are ignored and `undefined` is returned.
 *
 * Returns `undefined` when nothing applies, so callers can assign the result
 * to `provider` and have it dropped from the JSON body.
 */
export function mergeProviderRouting(
  configured: readonly unknown[],
  runtime?: unknown,
): Record<string, unknown> | undefined {
  if (runtime === null) {
    return undefined;
  }
  const objects = [...configured, runtime].filter(isPlainObject);
  return objects.length > 0 ? Object.assign({}, ...objects) : undefined;
}
