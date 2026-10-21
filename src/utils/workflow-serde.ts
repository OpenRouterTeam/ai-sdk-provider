import { loadApiKey } from '@ai-sdk/provider-utils';

// Headers that carry credentials and must never be written to durable
// workflow storage.
const CREDENTIAL_HEADERS = new Set(['authorization', 'x-provider-api-keys']);

/**
 * Removes credential headers from resolved headers before they are persisted
 * at a workflow step boundary.
 */
export function omitCredentialHeaders(
  headers: unknown,
): Record<string, string | undefined> {
  if (headers == null || typeof headers !== 'object') {
    return {};
  }
  return Object.fromEntries(
    Object.entries(headers as Record<string, string | undefined>).filter(
      ([key]) => !CREDENTIAL_HEADERS.has(key.toLowerCase()),
    ),
  );
}

/**
 * Rebuilds the headers closure for a deserialized model. The API key is
 * re-resolved from `OPENROUTER_API_KEY` at request time instead of being
 * restored from storage.
 */
export function withEnvironmentApiKey(
  headers: Record<string, string | undefined> | undefined,
): () => Record<string, string | undefined> {
  return () => ({
    Authorization: `Bearer ${loadApiKey({
      apiKey: undefined,
      environmentVariableName: 'OPENROUTER_API_KEY',
      description: 'OpenRouter',
    })}`,
    ...headers,
  });
}
