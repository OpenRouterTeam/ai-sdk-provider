import { z } from 'zod/v4';
import { OpenRouterErrorResponseSchema } from '../schemas/error-response';
import { ImageResponseArraySchema } from '../schemas/image';
import { ReasoningDetailArraySchema } from '../schemas/reasoning-details';

const OpenRouterChatCompletionBaseResponseSchema = z
  .object({
    id: z.string().optional(),
    model: z.string().optional(),
    provider: z.string().optional(),
    usage: z
      .object({
        prompt_tokens: z.number(),
        prompt_tokens_details: z
          .object({
            cached_tokens: z.number(),
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
  .passthrough();
// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
export const OpenRouterNonStreamChatCompletionResponseSchema = z.union([
  // Success response with choices
  OpenRouterChatCompletionBaseResponseSchema.extend({
    choices: z.array(
      z
        .object({
          message: z
            .object({
              role: z.literal('assistant'),
              content: z.string().nullable().optional(),
              reasoning: z.string().nullable().optional(),
              reasoning_details: ReasoningDetailArraySchema.nullish(),
              images: ImageResponseArraySchema.nullish(),

              tool_calls: z
                .array(
                  z
                    .object({
                      id: z.string().optional().nullable(),
                      type: z.literal('function'),
                      function: z
                        .object({
                          name: z.string(),
                          arguments: z.string().optional(),
                        })
                        .passthrough(),
                    })
                    .passthrough(),
                )
                .optional(),

              annotations: z
                .array(
                  z.union([
                    // URL citation from web search
                    // title, start_index, end_index are optional as some upstream providers may omit them
                    z
                      .object({
                        type: z.literal('url_citation'),
                        url_citation: z
                          .object({
                            url: z.string(),
                            title: z.string().optional(),
                            start_index: z.number().optional(),
                            end_index: z.number().optional(),
                            content: z.string().optional(),
                          })
                          .passthrough(),
                      })
                      .passthrough(),
                    // File annotation from FileParserPlugin (old format)
                    z
                      .object({
                        type: z.literal('file_annotation'),
                        file_annotation: z
                          .object({
                            file_id: z.string(),
                            quote: z.string().optional(),
                          })
                          .passthrough(),
                      })
                      .passthrough(),
                    // File annotation from FileParserPlugin (new format)
                    z
                      .object({
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
                                  .passthrough(),
                              )
                              .optional(),
                          })
                          .passthrough(),
                      })
                      .passthrough(),
                  ]),
                )
                .nullish(),
            })
            .passthrough(),
          index: z.number().nullish(),
          logprobs: z
            .object({
              content: z
                .array(
                  z
                    .object({
                      token: z.string(),
                      logprob: z.number(),
                      top_logprobs: z.array(
                        z
                          .object({
                            token: z.string(),
                            logprob: z.number(),
                          })
                          .passthrough(),
                      ),
                    })
                    .passthrough(),
                )
                .nullable(),
            })
            .passthrough()
            .nullable()
            .optional(),
          finish_reason: z.string().optional().nullable(),
        })
        .passthrough(),
    ),
  }),
  // Error response (HTTP 200 with error payload)
  OpenRouterErrorResponseSchema.extend({
    user_id: z.string().optional(),
  }),
]);
// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
export const OpenRouterStreamChatCompletionChunkSchema = z.union([
  OpenRouterChatCompletionBaseResponseSchema.extend({
    choices: z.array(
      z
        .object({
          delta: z
            .object({
              role: z.enum(['assistant']).optional(),
              content: z.string().nullish(),
              reasoning: z.string().nullish().optional(),
              reasoning_details: ReasoningDetailArraySchema.nullish(),
              images: ImageResponseArraySchema.nullish(),
              tool_calls: z
                .array(
                  z
                    .object({
                      index: z.number().nullish(),
                      id: z.string().nullish(),
                      type: z.literal('function').optional(),
                      function: z
                        .object({
                          name: z.string().nullish(),
                          arguments: z.string().nullish(),
                        })
                        .passthrough(),
                    })
                    .passthrough(),
                )
                .nullish(),

              annotations: z
                .array(
                  z.union([
                    // URL citation from web search
                    // title, start_index, end_index are optional as some upstream providers may omit them
                    z
                      .object({
                        type: z.literal('url_citation'),
                        url_citation: z
                          .object({
                            url: z.string(),
                            title: z.string().optional(),
                            start_index: z.number().optional(),
                            end_index: z.number().optional(),
                            content: z.string().optional(),
                          })
                          .passthrough(),
                      })
                      .passthrough(),
                    // File annotation from FileParserPlugin (old format)
                    z
                      .object({
                        type: z.literal('file_annotation'),
                        file_annotation: z
                          .object({
                            file_id: z.string(),
                            quote: z.string().optional(),
                          })
                          .passthrough(),
                      })
                      .passthrough(),
                    // File annotation from FileParserPlugin (new format)
                    z
                      .object({
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
                                  .passthrough(),
                              )
                              .optional(),
                          })
                          .passthrough(),
                      })
                      .passthrough(),
                  ]),
                )
                .nullish(),
            })
            .passthrough()
            .nullish(),
          logprobs: z
            .object({
              content: z
                .array(
                  z
                    .object({
                      token: z.string(),
                      logprob: z.number(),
                      top_logprobs: z.array(
                        z
                          .object({
                            token: z.string(),
                            logprob: z.number(),
                          })
                          .passthrough(),
                      ),
                    })
                    .passthrough(),
                )
                .nullable(),
            })
            .passthrough()
            .nullish(),
          finish_reason: z.string().nullable().optional(),
          index: z.number().nullish(),
        })
        .passthrough(),
    ),
  }),
  OpenRouterErrorResponseSchema,
]);
