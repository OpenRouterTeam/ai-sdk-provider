import { z } from 'zod/v4';

const openrouterEmbeddingUsageSchema = z.object({
  prompt_tokens: z.number(),
  total_tokens: z.number(),
  cost: z.number().optional(),
});

const openrouterEmbeddingDataSchema = z.object({
  object: z.literal('embedding'),
  embedding: z.array(z.number()),
  index: z.number().optional(),
});

export const OpenRouterEmbeddingResponseSchema = z.object({
  id: z.string().optional(),
  object: z.literal('list'),
  data: z.array(openrouterEmbeddingDataSchema),
  model: z.string(),
  provider: z.string().optional(),
  usage: openrouterEmbeddingUsageSchema.optional(),
});

export type OpenRouterEmbeddingResponse = z.infer<
  typeof OpenRouterEmbeddingResponseSchema
>;
