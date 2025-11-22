import { z } from 'zod/v4';
import { ReasoningDetailUnionSchema } from './reasoning-details';

/**
 * Schema for OpenRouter provider metadata attached to responses
 */
export const OpenRouterProviderMetadataSchema = z
  .object({
    provider: z.string(),
    reasoning_details: z.array(ReasoningDetailUnionSchema).optional(),
    usage: z
      .object({
        promptTokens: z.number(),
        promptTokensDetails: z
          .object({
            cachedTokens: z.number(),
          })
          .passthrough()
          .optional(),
        completionTokens: z.number(),
        completionTokensDetails: z
          .object({
            reasoningTokens: z.number(),
          })
          .passthrough()
          .optional(),
        totalTokens: z.number(),
        cost: z.number().optional(),
        costDetails: z
          .object({
            upstreamInferenceCost: z.number(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough(),
  })
  .passthrough();

export type OpenRouterProviderMetadata = z.infer<
  typeof OpenRouterProviderMetadataSchema
>;

/**
 * Schema for parsing provider options that may contain reasoning_details
 */
export const OpenRouterProviderOptionsSchema = z
  .object({
    openrouter: z
      .object({
        reasoning_details: z.array(ReasoningDetailUnionSchema).optional(),
      })
      .optional(),
  })
  .optional();
