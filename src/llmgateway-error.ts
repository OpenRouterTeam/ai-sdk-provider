import { createJsonErrorResponseHandler } from '@ai-sdk/provider-utils';
import { z } from 'zod';

export const LLMGatewayErrorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string(),
    param: z.any().nullable(),
    code: z.string().nullable(),
  }),
});

export type LLMGatewayErrorData = z.infer<typeof LLMGatewayErrorResponseSchema>;

export const llmgatewayFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: LLMGatewayErrorResponseSchema,
  errorToMessage: (data) => data.error.message,
});
