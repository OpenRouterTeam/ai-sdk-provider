import { createJsonErrorResponseHandler } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

/**
 * Zod schema for the error response from the OpenRouter API.
 */
export const OpenRouterErrorResponseSchema = z.object({
  error: z.object({
    code: z.union([z.string(), z.number()]).nullable().optional().default(null),
    message: z.string(),
    type: z.string().nullable().optional().default(null),
    param: z.any().nullable().optional().default(null),
  }),
});

/**
 * Type for the error data from the OpenRouter API.
 */
export type OpenRouterErrorData = z.infer<typeof OpenRouterErrorResponseSchema>;

/**
 * A failed response handler for the OpenRouter API.
 * It uses the `OpenRouterErrorResponseSchema` to parse the error response
 * and extracts the error message.
 */
export const openrouterFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: OpenRouterErrorResponseSchema,
  errorToMessage: (data: OpenRouterErrorData) => data.error.message,
});
