import type { JSONValue } from '@ai-sdk/provider';

import { z } from 'zod/v4';

const JsonValueSchema: z.ZodType<JSONValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

const OpenRouterDecisionsTextSchema = z.union([
  z.string(),
  z.record(z.string(), JsonValueSchema),
  z.array(JsonValueSchema),
]);

const OpenRouterDecisionsNoulAnswerSchema = z.object({
  type: z.literal('noul'),
  noul: z.number(),
});

const OpenRouterDecisionsChoiceAnswerSchema = z.object({
  type: z.literal('choice'),
  choice: z.string(),
  probabilities: z.record(z.string(), z.number()).optional(),
  confidence: z.number().optional(),
});

const OpenRouterDecisionsScoreAnswerSchema = z.object({
  type: z.literal('score'),
  score: z.number(),
  legend: z.record(z.string(), OpenRouterDecisionsTextSchema).optional(),
  probabilities: z.record(z.string(), z.number()).optional(),
  confidence: z.number().optional(),
});

export const OpenRouterDecisionsAnswerSchema = z.discriminatedUnion('type', [
  OpenRouterDecisionsNoulAnswerSchema,
  OpenRouterDecisionsChoiceAnswerSchema,
  OpenRouterDecisionsScoreAnswerSchema,
]);

export type OpenRouterDecisionsAnswer = z.infer<
  typeof OpenRouterDecisionsAnswerSchema
>;

export const OpenRouterDecisionsResponseSchema = z.object({
  id: z.string().optional(),
  model: z.string(),
  provider: z.string().optional(),
  answers: z.record(z.string(), OpenRouterDecisionsAnswerSchema),
  usage: z
    .object({
      input_tokens: z.number(),
      output_tokens: z.number(),
      cost: z.number().optional(),
    })
    .optional(),
});

export type OpenRouterDecisionsResponse = z.infer<
  typeof OpenRouterDecisionsResponseSchema
>;
