import { z } from 'zod/v4';

export const OpenRouterImageResponseSchema = z
  .object({
    id: z.string().optional(),
    object: z.string().optional(),
    created: z.number().optional(),
    model: z.string(),
    choices: z.array(
      z
        .object({
          index: z.number(),
          message: z
            .object({
              role: z.string(),
              content: z.string().nullable().optional(),
              images: z
                .array(
                  z
                    .object({
                      type: z.literal('image_url'),
                      image_url: z.object({
                        url: z.string(),
                      }),
                    })
                    .passthrough(),
                )
                .optional(),
            })
            .passthrough(),
          finish_reason: z.string().nullable().optional(),
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
