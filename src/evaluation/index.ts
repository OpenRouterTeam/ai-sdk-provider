import type {
  JSONValue,
  LanguageModelV4FilePart,
  LanguageModelV4TextPart,
} from '@ai-sdk/provider';
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
  EvaluationModelV4Input,
  EvaluationModelV4Question,
  EvaluationModelV4Result,
} from './types';

import {
  InvalidArgumentError,
  UnsupportedFunctionalityError,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  createJsonResponseHandler,
  parseProviderOptions,
  postJsonToApi,
  removeUndefinedEntries,
} from '@ai-sdk/provider-utils';
import { getFileUrl } from '../chat/file-url-utils';
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
 * A part of the state as `ai` 7.0.133 and later pass it: the SDK normalizes
 * every state into an ordered array of these before calling a provider.
 */
type OpenRouterDecisionStatePart =
  | LanguageModelV4TextPart
  | LanguageModelV4FilePart
  | { type: 'json'; value: JSONValue };

/**
 * `doEvaluate` options across `ai@7` releases: the raw state older releases
 * pass through, or the state parts newer ones produce.
 */
type OpenRouterEvaluationCallOptions = Omit<
  EvaluationModelV4CallOptions,
  'state'
> & {
  state: EvaluationModelV4Input | readonly OpenRouterDecisionStatePart[];
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
    options: OpenRouterEvaluationCallOptions,
  ): Promise<EvaluationModelV4Result> {
    const { questions, abortSignal, headers, providerOptions } = options;
    const state = toDecisionsState(options.state);

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

    const {
      value: response,
      rawValue,
      responseHeaders,
    } = await postJsonToApi({
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
        body: rawValue,
      },
    };
  }
}

function isStatePart(value: unknown): value is OpenRouterDecisionStatePart {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return false;
  }
  switch (value.type) {
    case 'text':
      return 'text' in value && typeof value.text === 'string';
    case 'json':
      return 'value' in value;
    case 'file':
      return (
        'mediaType' in value &&
        typeof value.mediaType === 'string' &&
        'data' in value
      );
    default:
      return false;
  }
}

/**
 * Returns the state the Decisions API expects. `ai` 7.0.133 and later wrap the
 * caller's state in typed parts, which would otherwise be forwarded as the
 * state itself; older releases pass the raw value, which is returned as is.
 *
 * A single text or json part becomes its value, so the request matches what
 * older releases send for the same call. Several parts become an array of
 * their values, in order, with image files as `image_url` entries. A raw array
 * whose every element happens to be part-shaped cannot be told apart from SDK
 * parts and is unwrapped too.
 */
function toDecisionsState(
  state: OpenRouterEvaluationCallOptions['state'],
): EvaluationModelV4Input {
  if (!Array.isArray(state) || state.length === 0) {
    return state as EvaluationModelV4Input;
  }
  const parts: readonly unknown[] = state;
  if (!parts.every(isStatePart)) {
    return state as EvaluationModelV4Input;
  }

  const values = parts.map((part): JSONValue => {
    switch (part.type) {
      case 'text':
        return part.text;
      case 'json':
        return part.value;
      case 'file':
        return toImageUrlEntry(part);
      default:
        return part satisfies never;
    }
  });

  const [only] = values;
  if (
    parts.length === 1 &&
    parts[0]?.type !== 'file' &&
    (typeof only === 'string' || (typeof only === 'object' && only !== null))
  ) {
    return only;
  }
  return values;
}

/** The Decisions API takes images in state as chat-style `image_url` entries. */
function toImageUrlEntry(part: LanguageModelV4FilePart): JSONValue {
  if (!part.mediaType.startsWith('image/')) {
    throw new UnsupportedFunctionalityError({
      functionality: `${part.mediaType} files in decision state`,
    });
  }
  return {
    type: 'image_url',
    image_url: {
      // mediaType is always set on file parts, so no default ever applies.
      url: getFileUrl({ part, defaultMediaType: part.mediaType }),
    },
  };
}

/**
 * Converts one AI SDK question into its Decisions counterpart. Inputs the
 * Decisions API would reject (missing `instructions`, a `null` score level, a
 * boolean with only one side described) throw before any request is sent.
 */
function toDecisionsQuestion(
  id: string,
  question: EvaluationModelV4Question,
): OpenRouterDecisionsQuestion {
  // Newer `ai` releases make `instructions` optional and nullable, but the
  // Decisions API requires it for every question type.
  const instructions = question.instructions;
  if (instructions == null) {
    throw new InvalidArgumentError({
      argument: `questions.${id}.instructions`,
      message: `Question "${id}": the OpenRouter Decisions API requires \`instructions\` for every question.`,
    });
  }

  switch (question.type) {
    case 'choice':
      return {
        type: 'choice',
        instructions,
        criteria: question.criteria,
      };
    case 'score':
      return {
        type: 'score',
        instructions,
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
        return { type: 'noul', instructions };
      }
      if (trueCriterion == null || falseCriterion == null) {
        throw new InvalidArgumentError({
          argument: `questions.${id}.criteria`,
          message: `Question "${id}": the OpenRouter Decisions API requires both "true" and "false" descriptions when boolean criteria are given.`,
        });
      }
      return {
        type: 'noul',
        instructions,
        criteria: { true: trueCriterion, false: falseCriterion },
      };
    }
    case 'box':
      // Not in supportedQuestionTypes, so the AI SDK rejects it first.
      throw new UnsupportedFunctionalityError({
        functionality: 'box questions',
      });
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
