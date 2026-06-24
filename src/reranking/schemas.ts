import { z } from 'zod/v4';

export const OpenRouterRerankingResponseSchema = z
  .object({
    id: z.string().optional(),
    model: z.string().optional(),
    provider: z.string().optional(),
    results: z.array(
      z
        .object({
          index: z.number(),
          relevance_score: z.number(),
        })
        .passthrough(),
    ),
    usage: z
      .object({
        prompt_tokens: z.number().optional(),
        total_tokens: z.number().optional(),
        cost: z.number().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type OpenRouterRerankingResponse = z.infer<
  typeof OpenRouterRerankingResponseSchema
>;
