import type { JSONValue } from '@ai-sdk/provider';
import type { EvaluationModelV4Input } from './types';

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

/**
 * Decisions API request contract.
 * https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-questions-and-answers-request
 */
export type OpenRouterDecisionsQuestion =
  | {
      type: 'noul';
      instructions: EvaluationModelV4Input;
      criteria?: {
        true: EvaluationModelV4Input;
        false: EvaluationModelV4Input;
      };
    }
  | {
      type: 'choice';
      instructions: EvaluationModelV4Input;
      criteria: Readonly<Record<string, EvaluationModelV4Input | null>>;
    }
  | {
      type: 'score';
      instructions: EvaluationModelV4Input;
      criteria: readonly EvaluationModelV4Input[];
    };

export type OpenRouterDecisionsRequest = Record<string, unknown> & {
  model: string;
  state: EvaluationModelV4Input;
  questions: Record<string, OpenRouterDecisionsQuestion>;
};

/**
 * Call-level `providerOptions.openrouter` accepted by the evaluation model.
 * Known Decisions request fields are typed; unknown keys pass through to the
 * request body. `model`, `state`, and `questions` are owned by the call and
 * cannot be overridden here.
 */
export const OpenRouterDecisionsProviderOptionsSchema = z
  .object({
    user: z.string().optional(),
    provider: z.record(z.string(), JsonValueSchema).optional(),
    session_id: z.string().optional(),
    trace: z.record(z.string(), JsonValueSchema).optional(),
  })
  .loose();

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

/**
 * Only `answers` is needed to build a result; every other field is optional so
 * a completed, billed evaluation is never rejected for missing metadata.
 */
export const OpenRouterDecisionsResponseSchema = z.object({
  id: z.string().optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
  answers: z.record(z.string(), OpenRouterDecisionsAnswerSchema),
  usage: z
    .object({
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
      cost: z.number().optional(),
    })
    .optional(),
});

export type OpenRouterDecisionsResponse = z.infer<
  typeof OpenRouterDecisionsResponseSchema
>;
