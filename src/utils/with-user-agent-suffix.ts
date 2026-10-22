import { combineHeaders } from '@ai-sdk/provider-utils';
import { removeUndefinedEntries } from '@/src/utils/remove-undefined';
import { VERSION } from '../version';

/**
 * Normalizes HeadersInit to a plain object.
 * Handles Headers objects, array-of-tuples, and plain objects.
 * @param headers - The headers in any HeadersInit format.
 * @returns A plain object with string keys and values.
 */
function normalizeHeaders(
  headers: HeadersInit | Record<string, string | undefined> | undefined,
): Record<string, string | undefined> {
  if (!headers) {
    return {};
  }
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return headers as Record<string, string | undefined>;
}

/**
 * Finds a header key in a case-insensitive manner.
 * @param headers - The headers object to search.
 * @param targetKey - The key to find (case-insensitive).
 * @returns The actual key in the headers object, or undefined if not found.
 */
function findHeaderKey(
  headers: Record<string, string>,
  targetKey: string,
): string | undefined {
  const lowerTarget = targetKey.toLowerCase();
  return Object.keys(headers).find((key) => key.toLowerCase() === lowerTarget);
}

/**
 * Sets the user-agent header, respecting user-specified values.
 * If a user explicitly provides a User-Agent header (any case), it is used verbatim.
 * If no User-Agent header is provided, the suffix parts are used as the default.
 * Automatically removes undefined entries from the headers.
 *
 * @param headers - The original headers.
 * @param userAgentSuffixParts - The parts to use as the default user-agent if none is provided.
 * @returns The new headers with the `user-agent` header set.
 */
export function withUserAgentSuffix(
  headers: HeadersInit | Record<string, string | undefined> | undefined,
  ...userAgentSuffixParts: string[]
): Record<string, string> {
  const normalizedHeaders = normalizeHeaders(headers);
  const cleanedHeaders = removeUndefinedEntries(normalizedHeaders);

  // Find user-agent header with case-insensitive lookup
  const existingUserAgentKey = findHeaderKey(cleanedHeaders, 'user-agent');
  const existingUserAgentValue = existingUserAgentKey
    ? cleanedHeaders[existingUserAgentKey]
    : undefined;

  // If user provided a non-empty User-Agent, use it verbatim
  // Otherwise, use the SDK identifier as the default
  const userAgent = existingUserAgentValue?.trim()
    ? existingUserAgentValue
    : userAgentSuffixParts.filter(Boolean).join(' ');

  // Remove any existing user-agent header (regardless of case) and add normalized one
  const headersWithoutUserAgent = Object.fromEntries(
    Object.entries(cleanedHeaders).filter(
      ([key]) => key.toLowerCase() !== 'user-agent',
    ),
  );

  return {
    ...headersWithoutUserAgent,
    'user-agent': userAgent,
  };
}

/**
 * Combines the model's config headers with call-level headers, keeping the
 * provider's user agent identifier.
 *
 * The AI SDK passes its own `user-agent` (e.g. `ai/7.0.0`) in the call-level
 * headers, which would otherwise replace the `ai-sdk/openrouter/<version>`
 * identifier set by the provider. When the config headers carry the default
 * identifier, it is appended to the call-level user agent instead. A
 * user-specified provider-level User-Agent keeps its current behavior.
 */
export function combineHeadersWithUserAgent(
  configHeaders: Record<string, string | undefined>,
  callHeaders: Record<string, string | undefined> | undefined,
  userAgentSuffix = `ai-sdk/openrouter/${VERSION}`,
): Record<string, string | undefined> {
  const combined = combineHeaders(configHeaders, callHeaders);
  const configUserAgent = getUserAgent(configHeaders);
  const callUserAgent = getUserAgent(callHeaders);

  if (
    configUserAgent !== userAgentSuffix ||
    !callUserAgent?.trim() ||
    callUserAgent.includes(userAgentSuffix)
  ) {
    return combined;
  }

  return {
    ...Object.fromEntries(
      Object.entries(combined).filter(
        ([key]) => key.toLowerCase() !== 'user-agent',
      ),
    ),
    'user-agent': `${callUserAgent} ${userAgentSuffix}`,
  };
}

function getUserAgent(
  headers: Record<string, string | undefined> | undefined,
): string | undefined {
  let userAgent: string | undefined;
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (key.toLowerCase() === 'user-agent') {
      userAgent = value;
    }
  }
  return userAgent;
}
