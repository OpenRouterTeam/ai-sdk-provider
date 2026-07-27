import { z } from 'zod/v4';

export const OpenRouterRerankResponseSchema = z
  .object({
    id: z.string().optional(),
    model: z.string(),
    provider: z.string().optional(),
    results: z.array(
      z.object({
        document: z.object({ text: z.string() }),
        index: z.number(),
        relevance_score: z.number(),
      }),
    ),
    usage: z
      .object({
        cost: z.number().optional(),
        search_units: z.number().optional(),
        total_tokens: z.number().optional(),
      })
      .optional(),
  })
  .passthrough();
