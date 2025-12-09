import { z } from 'zod/v4';
import { ReasoningDetailUnionSchema } from './reasoning-details';

/**
 * A number schema that accepts NaN as a valid value.
 *
 * Used for cost/price fields where NaN acts as a "Poison Pill":
 * - Miscalculating money is dangerous and must be explicit
 * - NaN poisons arithmetic (100 + NaN = NaN), forcing explicit handling
 *
 * Token counts use regular z.number() with 0 fallback (safe).
 */
const numberOrNaN = z.union([z.number(), z.nan()]);

/**
 * Schema for file annotations from FileParserPlugin
 */
export const FileAnnotationSchema = z.object({
  type: z.literal('file'),
  file: z
    .object({
      hash: z.string(),
      name: z.string(),
      content: z
        .array(
          z
            .object({
              type: z.string(),
              text: z.string().optional(),
            })
            .catchall(z.any()),
        )
        .optional(),
    })
    .catchall(z.any()),
});

export type FileAnnotation = z.infer<typeof FileAnnotationSchema>;

/**
 * Schema for OpenRouter provider metadata attached to responses
 *
 * Uses .catchall(z.any()) instead of .passthrough() to generate types
 * compatible with Record<string, JSONValue> without manual casting.
 */
export const OpenRouterProviderMetadataSchema = z
  .object({
    provider: z.string(),
    reasoning_details: z.array(ReasoningDetailUnionSchema).optional(),
    annotations: z.array(FileAnnotationSchema).optional(),
    usage: z
      .object({
        // Token counts: 0 fallback is safe
        promptTokens: z.number(),
        promptTokensDetails: z
          .object({
            cachedTokens: z.number(),
          })
          .catchall(z.any())
          .optional(),
        completionTokens: z.number(),
        completionTokensDetails: z
          .object({
            reasoningTokens: z.number(),
          })
          .catchall(z.any())
          .optional(),
        totalTokens: z.number(),
        // Cost fields: optional or NaN poison pill (money miscalculation is dangerous)
        cost: z.number().optional(),
        costDetails: z
          .object({
            upstreamInferenceCost: numberOrNaN,
          })
          .catchall(z.any())
          .optional(),
      })
      .catchall(z.any()),
  })
  .catchall(z.any());

export type OpenRouterProviderMetadata = z.infer<
  typeof OpenRouterProviderMetadataSchema
>;

/**
 * Schema for parsing provider options that may contain reasoning_details and annotations
 */
export const OpenRouterProviderOptionsSchema = z
  .object({
    openrouter: z
      .object({
        reasoning_details: z.array(ReasoningDetailUnionSchema).optional(),
        annotations: z.array(FileAnnotationSchema).optional(),
      })
      .optional(),
  })
  .optional();
