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

export const openrouterFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: OpenRouterErrorResponseSchema,
  errorToMessage: (data: OpenRouterErrorData) => data.error.message,
});
