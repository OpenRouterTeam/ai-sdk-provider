import { z } from 'zod/v4';

import { LLMGatewayErrorResponseSchema } from '../schemas/error-response';
import { ReasoningDetailArraySchema } from '../schemas/reasoning-details';
import { ImageResponseArraySchema } from '../schemas/image';

const LLMGatewayChatCompletionBaseResponseSchema = z.object({
  id: z.string().optional(),
  model: z.string().optional(),
  usage: z
    .object({
      prompt_tokens: z.number(),
      prompt_tokens_details: z
        .object({
          cached_tokens: z.number(),
        })
        .nullish(),
      completion_tokens: z.number(),
      completion_tokens_details: z
        .object({
          reasoning_tokens: z.number(),
        })
        .nullish(),
      total_tokens: z.number(),
      cost: z.number().optional(),
      cost_details: z
        .object({
          upstream_inference_cost: z.number().nullish(),
        })
        .nullish(),
    })
    .nullish(),
});
// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
export const LLMGatewayNonStreamChatCompletionResponseSchema =
  LLMGatewayChatCompletionBaseResponseSchema.extend({
    choices: z.array(
      z.object({
        message: z.object({
          role: z.literal('assistant'),
          content: z.string().nullable().optional(),
          reasoning: z.string().nullable().optional(),
          reasoningText: z.string().nullable().optional(),
          reasoning_details: ReasoningDetailArraySchema.nullish(),
          images: ImageResponseArraySchema.nullish(),

          tool_calls: z
            .array(
              z.object({
                id: z.string().optional().nullable(),
                type: z.literal('function'),
                function: z.object({
                  name: z.string(),
                  arguments: z.string(),
                }),
              }),
            )
            .optional(),
        }),
        index: z.number().nullish(),
        logprobs: z
          .object({
            content: z
              .array(
                z.object({
                  token: z.string(),
                  logprob: z.number(),
                  top_logprobs: z.array(
                    z.object({
                      token: z.string(),
                      logprob: z.number(),
                    }),
                  ),
                }),
              )
              .nullable(),
          })
          .nullable()
          .optional(),
        finish_reason: z.string().optional().nullable(),
      }),
    ),
  });
// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
export const LLMGatewayStreamChatCompletionChunkSchema = z.union([
  LLMGatewayChatCompletionBaseResponseSchema.extend({
    choices: z.array(
      z.object({
        delta: z
          .object({
            role: z.enum(['assistant']).optional(),
            content: z.string().nullish(),
            reasoning: z.string().nullish().optional(),
            reasoningText: z.string().nullish().optional(),
            reasoning_details: ReasoningDetailArraySchema.nullish(),
            images: ImageResponseArraySchema.nullish(),
            tool_calls: z
              .array(
                z.object({
                  index: z.number().nullish(),
                  id: z.string().nullish(),
                  type: z.literal('function').optional(),
                  function: z.object({
                    name: z.string().nullish(),
                    arguments: z.string().nullish(),
                  }),
                }),
              )
              .nullish(),
          })
          .nullish(),
        logprobs: z
          .object({
            content: z
              .array(
                z.object({
                  token: z.string(),
                  logprob: z.number(),
                  top_logprobs: z.array(
                    z.object({
                      token: z.string(),
                      logprob: z.number(),
                    }),
                  ),
                }),
              )
              .nullable(),
          })
          .nullish(),
        finish_reason: z.string().nullable().optional(),
        index: z.number().nullish(),
      }),
    ),
  }),
  LLMGatewayErrorResponseSchema,
]);
