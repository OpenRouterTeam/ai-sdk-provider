import { z } from 'zod/v4';

const OpenRouterImageDataSchema = z
  .object({
    b64_json: z.string().optional(),
    url: z.string().min(1).optional(),
    media_type: z.string().optional(),
  })
  .passthrough()
  .refine((item) => item.b64_json !== undefined || item.url !== undefined, {
    message: 'Image response item must include either b64_json or url',
  });

export const OpenRouterImageResponseSchema = z
  .object({
    created: z.number().optional(),
    data: z.array(OpenRouterImageDataSchema),
    expires_at: z.number().optional(),
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
