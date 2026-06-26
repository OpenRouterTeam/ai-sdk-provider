import { z } from 'zod/v4';

export const OpenRouterImageResponseSchema = z
  .object({
    created: z.number().optional(),
    data: z.array(
      z
        .object({
          b64_json: z.string(),
        })
        .passthrough(),
    ),
    usage: z
      .object({
        prompt_tokens: z.number(),
        completion_tokens: z.number(),
        total_tokens: z.number(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type OpenRouterImageResponse = z.infer<
  typeof OpenRouterImageResponseSchema
>;
