import type {
  Experimental_EvaluationModelV4 as EvaluationModelV4,
  Experimental_EvaluationModelV4Answer as EvaluationModelV4Answer,
  Experimental_EvaluationModelV4CallOptions as EvaluationModelV4CallOptions,
  Experimental_EvaluationModelV4Input as EvaluationModelV4Input,
  Experimental_EvaluationModelV4Question as EvaluationModelV4Question,
  Experimental_EvaluationModelV4Result as EvaluationModelV4Result,
  JSONValue,
  SharedV4Warning,
} from '@ai-sdk/provider';
import type {
  OpenRouterEvaluationModelId,
  OpenRouterEvaluationSettings,
} from '../types/openrouter-evaluation-settings';
import type { OpenRouterDecisionsAnswer } from './schemas';

import { InvalidArgumentError } from '@ai-sdk/provider';
import {
  combineHeaders,
  createJsonResponseHandler,
  postJsonToApi,
} from '@ai-sdk/provider-utils';
import { openrouterFailedResponseHandler } from '../schemas/error-response';
import { OpenRouterDecisionsResponseSchema } from './schemas';

type OpenRouterEvaluationConfig = {
  provider: string;
  headers: () => Record<string, string | undefined>;
  url: (options: { modelId: string; path: string }) => string;
  fetch?: typeof fetch;
  extraBody?: Record<string, unknown>;
};

type OpenRouterDecisionsQuestion =
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
      criteria: Record<string, EvaluationModelV4Input | null>;
    }
  | {
      type: 'score';
      instructions: EvaluationModelV4Input;
      criteria: EvaluationModelV4Input[];
    };

/**
 * Evaluation model backed by the OpenRouter Decisions API (`/api/alpha/decisions`).
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
    const warnings: SharedV4Warning[] = [];

    const decisionsQuestions = Object.fromEntries(
      Object.entries(questions).map(([id, question]) => [
        id,
        toDecisionsQuestion(id, question, warnings),
      ]),
    );

    const args = {
      model: this.modelId,
      state,
      questions: decisionsQuestions,
      user: this.settings.user,
      provider: this.settings.provider,
      ...this.config.extraBody,
      ...this.settings.extraBody,
      ...providerOptions?.openrouter,
    };

    const { value: response, responseHeaders } = await postJsonToApi({
      url: this.config.url({ path: '/decisions', modelId: this.modelId }),
      headers: combineHeaders(this.config.headers(), headers),
      body: args,
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
      usage: response.usage
        ? {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          }
        : undefined,
      warnings,
      providerMetadata: {
        openrouter: {
          provider: response.provider ?? '',
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

function toDecisionsQuestion(
  id: string,
  question: EvaluationModelV4Question,
  warnings: SharedV4Warning[],
): OpenRouterDecisionsQuestion {
  switch (question.type) {
    case 'choice':
      return {
        type: 'choice',
        instructions: question.instructions,
        criteria: { ...question.criteria },
      };
    case 'score':
      return {
        type: 'score',
        instructions: question.instructions,
        criteria: question.criteria.map((criterion, index) => {
          if (criterion === null) {
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
      const hasBothCriteria = trueCriterion != null && falseCriterion != null;
      if (question.criteria != null && !hasBothCriteria) {
        warnings.push({
          type: 'other',
          message: `Question "${id}": boolean criteria require both "true" and "false" descriptions and were omitted.`,
        });
      }
      return {
        type: 'noul',
        instructions: question.instructions,
        ...(hasBothCriteria
          ? { criteria: { true: trueCriterion, false: falseCriterion } }
          : {}),
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
