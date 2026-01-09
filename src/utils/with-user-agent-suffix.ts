import { removeUndefinedEntries } from '@/src/utils/remove-undefined';

/**
 * Adds SDK version information to headers.
 *
 * If a `user-agent` header is NOT provided by the user, the SDK version is set as the user-agent.
 * If a `user-agent` header IS provided by the user, it is preserved unchanged, and the SDK
 * version is added via the `X-OpenRouter-SDK-Version` header instead.
 *
 * This ensures user-specified headers are never silently modified.
 *
 * @param headers - The original headers.
 * @param sdkVersion - The SDK version string (e.g., "ai-sdk/openrouter/1.5.4").
 * @returns The new headers with SDK version information added.
 */
export function withUserAgentSuffix(
  headers: HeadersInit | Record<string, string | undefined> | undefined,
  sdkVersion: string,
): Record<string, string> {
  const cleanedHeaders = removeUndefinedEntries(
    (headers as Record<string, string | undefined>) ?? {},
  );

  const userProvidedUserAgent = cleanedHeaders['user-agent'];

  if (userProvidedUserAgent) {
    // User provided their own user-agent, don't modify it
    // Add SDK version as a separate header instead
    return {
      ...cleanedHeaders,
      'X-OpenRouter-SDK-Version': sdkVersion,
    };
  }

  // No user-agent provided, use SDK version as the user-agent
  return {
    ...cleanedHeaders,
    'user-agent': sdkVersion,
  };
}
