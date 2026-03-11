import type { ChatErrorError } from '../types/openrouter-api-types';

import { createJsonErrorResponseHandler } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export const OpenRouterErrorResponseSchema = z
  .object({
    error: z
      .object({
        code: z
          .union([z.string(), z.number()])
          .nullable()
          .optional()
          .default(null),
        message: z.string(),
        type: z.string().nullable().optional().default(null),
        param: z.any().nullable().optional().default(null),
      })
      .passthrough() satisfies z.ZodType<
      Omit<ChatErrorError, 'code'> & { code: string | number | null }
    >,
  })
  .passthrough();

export type OpenRouterErrorData = z.infer<typeof OpenRouterErrorResponseSchema>;

/**
 * Extract a human-readable error message from the error response.
 * The top-level `error.message` is often generic (e.g. "Provider returned error"),
 * while `error.metadata.raw` contains the actual upstream provider error details.
 */
export function extractErrorMessage(data: OpenRouterErrorData): string {
  const error = data.error as Record<string, unknown>;
  const metadata = error.metadata as Record<string, unknown> | undefined;

  if (!metadata) {
    return data.error.message;
  }

  const parts: string[] = [];

  // Include the provider name for context when available
  if (typeof metadata.provider_name === 'string' && metadata.provider_name) {
    parts.push(`[${metadata.provider_name}]`);
  }

  // Extract meaningful message from the raw upstream error
  const raw = metadata.raw;
  const rawMessage = extractRawMessage(raw);

  if (rawMessage && rawMessage !== data.error.message) {
    parts.push(rawMessage);
  } else {
    parts.push(data.error.message);
  }

  return parts.join(' ');
}

/**
 * Recursively extract a message string from the raw upstream error.
 * The raw field can be a string, a JSON string, or a nested object.
 */
function extractRawMessage(raw: unknown): string | undefined {
  if (typeof raw === 'string') {
    // Try parsing as JSON in case it's a stringified error object
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return extractRawMessage(parsed);
      }
      return raw;
    } catch {
      return raw;
    }
  }

  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }

  const obj = raw as Record<string, unknown>;

  // Check common error message fields
  for (const field of ['message', 'error', 'detail', 'details', 'msg']) {
    const value = obj[field];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
    // Handle nested error objects (e.g. { error: { message: "..." } })
    if (typeof value === 'object' && value !== null) {
      const nested = extractRawMessage(value);
      if (nested) {
        return nested;
      }
    }
  }

  return undefined;
}

export const openrouterFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: OpenRouterErrorResponseSchema,
  errorToMessage: extractErrorMessage,
});
