import { z } from 'zod/v4';

const openrouterRerankingUsageSchema = z.object({
  search_units: z.number().optional(),
  total_tokens: z.number().optional(),
  cost: z.number().optional(),
});

export const OpenRouterRerankingResponseSchema = z.object({
  id: z.string().optional(),
  model: z.string(),
  provider: z.string().optional(),
  results: z.array(
    z.object({
      index: z.number(),
      relevance_score: z.number(),
      document: z.record(z.string(), z.any()).optional(),
    }),
  ),
  usage: openrouterRerankingUsageSchema.optional(),
});

export type OpenRouterRerankingResponse = z.infer<
  typeof OpenRouterRerankingResponseSchema
>;
