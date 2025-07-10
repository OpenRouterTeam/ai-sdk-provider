import { createJsonErrorResponseHandler } from "@ai-sdk/provider-utils";
import { z } from "zod/v4";

export const OpenRouterErrorResponseSchema = z.object({
  error: z.object({
    code: z.union([z.string(), z.number()]).nullable(),
    message: z.string(),
    type: z.string().nullable(),
    param: z.any().nullable(),
  }),
});

export type OpenRouterErrorData = z.infer<typeof OpenRouterErrorResponseSchema>;

export const openrouterFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: OpenRouterErrorResponseSchema,
  errorToMessage: (data: OpenRouterErrorData) => data.error.message,
});
