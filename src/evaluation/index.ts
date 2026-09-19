import type { JSONValue } from '@ai-sdk/provider';
import type {
  OpenRouterEvaluationModelId,
  OpenRouterEvaluationSettings,
} from '../types/openrouter-evaluation-settings';
import type {
  OpenRouterDecisionsAnswer,
  OpenRouterDecisionsQuestion,
  OpenRouterDecisionsRequest,
} from './schemas';
import type {
  EvaluationModelV4,
  EvaluationModelV4Answer,
  EvaluationModelV4CallOptions,
  EvaluationModelV4Question,
  EvaluationModelV4Result,
} from './types';

import { InvalidArgumentError } from '@ai-sdk/provider';
import {
  combineHeaders,
  createJsonResponseHandler,
  parseProviderOptions,
  postJsonToApi,
  removeUndefinedEntries,
} from '@ai-sdk/provider-utils';
import { openrouterFailedResponseHandler } from '../schemas/error-response';
import {
  OpenRouterDecisionsProviderOptionsSchema,
  OpenRouterDecisionsResponseSchema,
} from './schemas';

export type * from './types';

type OpenRouterEvaluationConfig = {
  headers: () => Record<string, string | undefined>;
  url: (options: { path: string }) => string;
  fetch?: typeof fetch;
  extraBody?: Record<string, unknown>;
};

/**
 * The Decisions API returns probabilities and scores rounded to two decimals,
 * so a score can differ from the exact probability-weighted mean by up to
 * half a unit in the last place.
 */
const DECISIONS_ROUNDING = {
  probabilityDecimals: 2,
  scoreDecimals: 2,
} as const;

/**
 * Evaluation model backed by the OpenRouter Decisions API.
 *
 * Maps AI SDK `choice`, `score`, and `boolean` questions onto OpenRouter
 * `choice`, `score`, and `noul` questions, and surfaces per-answer
 * `confidence` and score `legend` through `providerMetadata.openrouter`.
 */
export class OpenRouterEvaluationModel implements EvaluationModelV4 {
  readonly specificationVersion = 'v4' as const;
  readonly provider = 'openrouter';
  readonly modelId: OpenRouterEvaluationModelId;
  readonly settings: OpenRouterEvaluationSettings;
  readonly supportedQuestionTypes = ['choice', 'score', 'boolean'] as const;

  private readonly config: OpenRouterEvaluationConfig;

  constructor(
    modelId: OpenRouterEvaluationModelId,
    settings: OpenRouterEvaluationSettings,
    config: OpenRouterEvaluationConfig,
  ) {
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }

  async doEvaluate(
    options: EvaluationModelV4CallOptions,
  ): Promise<EvaluationModelV4Result> {
    const { state, questions, abortSignal, headers, providerOptions } = options;

    const decisionsQuestions = Object.fromEntries(
      Object.entries(questions).map(([id, question]) => [
        id,
        toDecisionsQuestion(id, question),
      ]),
    );

    const openrouterOptions = await parseProviderOptions({
      provider: 'openrouter',
      providerOptions,
      schema: OpenRouterDecisionsProviderOptionsSchema,
    });

    const { user, provider, session_id, trace, extraBody } = this.settings;

    const body: OpenRouterDecisionsRequest = {
      ...this.config.extraBody,
      ...extraBody,
      ...removeUndefinedEntries({ user, provider, session_id, trace }),
      ...openrouterOptions,
      model: this.modelId,
      state,
      questions: decisionsQuestions,
    };

    const { value: response, responseHeaders } = await postJsonToApi({
      url: this.config.url({ path: '/decisions' }),
      headers: combineHeaders(this.config.headers(), headers),
      body,
      failedResponseHandler: openrouterFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        OpenRouterDecisionsResponseSchema,
      ),
      abortSignal,
      fetch: this.config.fetch,
    });

    const answers = Object.fromEntries(
      Object.entries(response.answers).map(([id, answer]) => [
        id,
        toEvaluationAnswer(answer),
      ]),
    );

    const answerMetadata = Object.fromEntries(
      Object.entries(response.answers).map(([id, answer]) => [
        id,
        toAnswerMetadata(answer),
      ]),
    );

    return {
      answers,
      rounding: DECISIONS_ROUNDING,
      usage: response.usage
        ? {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          }
        : undefined,
      warnings: [],
      providerMetadata: {
        openrouter: {
          ...(response.provider != null ? { provider: response.provider } : {}),
          answers: answerMetadata,
          ...(response.usage?.cost != null
            ? { usage: { cost: response.usage.cost } }
            : {}),
        },
      },
      response: {
        id: response.id,
        modelId: response.model,
        headers: responseHeaders,
        body: response,
      },
    };
  }
}

/**
 * Converts one AI SDK question into its Decisions counterpart. Criteria the
 * Decisions API would reject (a `null` score level, a boolean with only one
 * side described) throw before any request is sent.
 */
function toDecisionsQuestion(
  id: string,
  question: EvaluationModelV4Question,
): OpenRouterDecisionsQuestion {
  switch (question.type) {
    case 'choice':
      return {
        type: 'choice',
        instructions: question.instructions,
        criteria: question.criteria,
      };
    case 'score':
      return {
        type: 'score',
        instructions: question.instructions,
        criteria: question.criteria.map((criterion, index) => {
          if (criterion == null) {
            throw new InvalidArgumentError({
              argument: `questions.${id}.criteria[${index}]`,
              message: `Question "${id}": the OpenRouter Decisions API requires a description for every score criterion.`,
            });
          }
          return criterion;
        }),
      };
    case 'boolean': {
      const trueCriterion = question.criteria?.true;
      const falseCriterion = question.criteria?.false;
      if (trueCriterion == null && falseCriterion == null) {
        return { type: 'noul', instructions: question.instructions };
      }
      if (trueCriterion == null || falseCriterion == null) {
        throw new InvalidArgumentError({
          argument: `questions.${id}.criteria`,
          message: `Question "${id}": the OpenRouter Decisions API requires both "true" and "false" descriptions when boolean criteria are given.`,
        });
      }
      return {
        type: 'noul',
        instructions: question.instructions,
        criteria: { true: trueCriterion, false: falseCriterion },
      };
    }
    default:
      return question satisfies never;
  }
}

function toEvaluationAnswer(
  answer: OpenRouterDecisionsAnswer,
): EvaluationModelV4Answer {
  switch (answer.type) {
    case 'noul':
      return { type: 'boolean', probability: answer.noul };
    case 'choice':
      return {
        type: 'choice',
        choice: answer.choice,
        probabilities: answer.probabilities,
      };
    case 'score':
      return {
        type: 'score',
        score: answer.score,
        probabilities: answer.probabilities,
      };
    default:
      return answer satisfies never;
  }
}

function toAnswerMetadata(answer: OpenRouterDecisionsAnswer): JSONValue {
  switch (answer.type) {
    case 'noul':
      return {};
    case 'choice':
      return answer.confidence != null ? { confidence: answer.confidence } : {};
    case 'score':
      return {
        ...(answer.confidence != null ? { confidence: answer.confidence } : {}),
        ...(answer.legend != null ? { legend: answer.legend } : {}),
      };
    default:
      return answer satisfies never;
  }
}
