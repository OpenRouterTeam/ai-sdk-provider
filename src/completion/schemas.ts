import { z } from 'zod/v4';
import { OpenRouterErrorResponseSchema } from '../schemas/error-response';
import { ReasoningDetailArraySchema } from '../schemas/reasoning-details';

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
export const OpenRouterCompletionChunkSchema = z.union([
  z
    .object({
      id: z.string().optional(),
      model: z.string().optional(),
      provider: z.string().optional(),
      choices: z.array(
        z
          .object({
            text: z.string(),
            reasoning: z.string().nullish().optional(),
            reasoning_details: ReasoningDetailArraySchema.nullish(),

            finish_reason: z.string().nullish(),
            index: z.number().nullish(),
            logprobs: z
              .object({
                tokens: z.array(z.string()),
                token_logprobs: z.array(z.number()),
                top_logprobs: z
                  .array(z.record(z.string(), z.number()))
                  .nullable(),
              })
              .passthrough()
              .nullable()
              .optional(),
          })
          .passthrough(),
      ),
      usage: z
        .object({
          prompt_tokens: z.number(),
          prompt_tokens_details: z
            .object({
              cached_tokens: z.number(),
              cache_write_tokens: z.number().nullish(),
            })
            .passthrough()
            .nullish(),
          completion_tokens: z.number(),
          completion_tokens_details: z
            .object({
              reasoning_tokens: z.number(),
            })
            .passthrough()
            .nullish(),
          total_tokens: z.number(),
          cost: z.number().optional(),
          cost_details: z
            .object({
              upstream_inference_cost: z.number().nullish(),
            })
            .passthrough()
            .nullish(),
        })
        .passthrough()
        .nullish(),
    })
    .passthrough(),
  OpenRouterErrorResponseSchema,
]);
