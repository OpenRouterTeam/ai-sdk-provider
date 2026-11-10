import type { JSONValue } from '@ai-sdk/provider';
import type { DecisionModelV4Input } from './types';

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
      instructions?: DecisionModelV4Input | null;
      criteria?: {
        true?: DecisionModelV4Input | null;
        false?: DecisionModelV4Input | null;
      };
    }
  | {
      type: 'choice';
      instructions?: DecisionModelV4Input | null;
      criteria: Readonly<Record<string, DecisionModelV4Input | null>>;
    }
  | {
      type: 'score';
      instructions?: DecisionModelV4Input | null;
      criteria: readonly DecisionModelV4Input[];
    }
  | {
      type: 'box';
      instructions: DecisionModelV4Input;
    };

export type OpenRouterDecisionsRequest = Record<string, unknown> & {
  model: string;
  state: DecisionModelV4Input;
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
  confidence: z.number().optional(),
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

const OpenRouterDecisionsBoxAnswerSchema = z.object({
  type: z.literal('box'),
  box: z.object({
    top: z.number(),
    bottom: z.number(),
    left: z.number(),
    right: z.number(),
  }),
  confidence: z.number().optional(),
});

const OpenRouterDecisionsRefusalAnswerSchema = z.object({
  type: z.literal('refusal'),
});

export const OpenRouterDecisionsAnswerSchema = z.discriminatedUnion('type', [
  OpenRouterDecisionsNoulAnswerSchema,
  OpenRouterDecisionsChoiceAnswerSchema,
  OpenRouterDecisionsScoreAnswerSchema,
  OpenRouterDecisionsBoxAnswerSchema,
  OpenRouterDecisionsRefusalAnswerSchema,
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
  annotations: z.array(JsonValueSchema).nullish(),
  usage: z
    .object({
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
      cost: z.number().nullish(),
      cost_details: z
        .object({
          upstream_inference_cost: z.number().nullish(),
          upstream_inference_prompt_cost: z.number().nullish(),
          upstream_inference_completions_cost: z.number().nullish(),
          server_tool_cost: z.number().nullish(),
        })
        .nullish(),
      input_tokens_details: z
        .object({
          cached_tokens: z.number().nullish(),
        })
        .nullish(),
      is_byok: z.boolean().nullish(),
    })
    .optional(),
});

export type OpenRouterDecisionsResponse = z.infer<
  typeof OpenRouterDecisionsResponseSchema
>;
