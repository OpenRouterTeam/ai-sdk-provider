import type {
  JSONObject,
  JSONValue,
  LanguageModelV4FilePart,
  SharedV4Warning,
} from '@ai-sdk/provider';
import type {
  OpenRouterEvaluationModelId,
  OpenRouterEvaluationSettings,
} from '../types/openrouter-evaluation-settings';
import type {
  OpenRouterDecisionsAnswer,
  OpenRouterDecisionsQuestion,
  OpenRouterDecisionsRequest,
  OpenRouterDecisionsResponse,
} from './schemas';
import type {
  DecisionModelV4,
  DecisionModelV4Answer,
  DecisionModelV4CallOptions,
  DecisionModelV4Input,
  DecisionModelV4Question,
  DecisionModelV4Result,
  DecisionModelV4StatePart,
  EvaluationModelV4,
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
 * Call options across `ai@7` releases: the state parts `ai` 7.0.133 and later
 * produce, or the raw state older releases pass through.
 */
type OpenRouterDecisionCallOptions = Omit<
  DecisionModelV4CallOptions,
  'state'
> & {
  state: DecisionModelV4Input | readonly DecisionModelV4StatePart[];
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
 * Decision model backed by the OpenRouter Decisions API.
 *
 * Maps AI SDK `choice`, `score`, `box`, and `boolean` questions onto
 * OpenRouter `choice`, `score`, `box`, and `noul` questions, and surfaces
 * per-answer `confidence` and score `legend`, annotations, and usage
 * accounting through `providerMetadata.openrouter`.
 *
 * Which question types and inputs a request may use depends on the model
 * serving it; the API rejects unsupported combinations with an error.
 */
export class OpenRouterEvaluationModel
  implements DecisionModelV4, EvaluationModelV4
{
  readonly specificationVersion = 'v4' as const;
  readonly provider = 'openrouter';
  readonly modelId: OpenRouterEvaluationModelId;
  readonly settings: OpenRouterEvaluationSettings;
  readonly supportedQuestionTypes = [
    'choice',
    'score',
    'box',
    'boolean',
  ] as const;

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

  /** @deprecated `ai` releases before 7.0.133 call this; use `doDecide`. */
  doEvaluate(
    options: OpenRouterDecisionCallOptions,
  ): Promise<DecisionModelV4Result> {
    return this.doDecide(options);
  }

  async doDecide(
    options: OpenRouterDecisionCallOptions,
  ): Promise<DecisionModelV4Result> {
    const {
      questions,
      maxOutputTokens,
      reasoning,
      abortSignal,
      headers,
      providerOptions,
    } = options;
    const state = toDecisionsState(options.state);

    const warnings: SharedV4Warning[] = [];
    if (maxOutputTokens != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'maxOutputTokens',
        details: 'The OpenRouter Decisions API has no output token limit.',
      });
    }
    if (reasoning != null && reasoning !== 'provider-default') {
      warnings.push({
        type: 'unsupported',
        feature: 'reasoning',
        details: 'The OpenRouter Decisions API has no reasoning setting.',
      });
    }

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
        toDecisionAnswer(answer),
      ]),
    );

    const answerMetadata = Object.fromEntries(
      Object.entries(response.answers).map(([id, answer]) => [
        id,
        toAnswerMetadata(answer),
      ]),
    );

    const usageMetadata = toUsageMetadata(response.usage);

    return {
      answers,
      rounding: DECISIONS_ROUNDING,
      usage: response.usage
        ? {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          }
        : undefined,
      warnings,
      providerMetadata: {
        openrouter: {
          ...(response.provider != null ? { provider: response.provider } : {}),
          answers: answerMetadata,
          ...(response.annotations != null && response.annotations.length > 0
            ? { annotations: response.annotations }
            : {}),
          ...(usageMetadata != null ? { usage: usageMetadata } : {}),
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

function isStatePart(value: unknown): value is DecisionModelV4StatePart {
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
  state: OpenRouterDecisionCallOptions['state'],
): DecisionModelV4Input {
  if (!Array.isArray(state) || state.length === 0) {
    return state as DecisionModelV4Input;
  }
  const parts: readonly unknown[] = state;
  if (!parts.every(isStatePart)) {
    return state as DecisionModelV4Input;
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
 * Converts one AI SDK question into its Decisions counterpart. Missing or
 * `null` instructions and descriptions are left out of the request: whether a
 * question may omit them depends on the model serving it, so the API decides.
 * Only what the API rejects for every model (a `null` score level, a box
 * question without instructions) throws before a request is sent.
 */
function toDecisionsQuestion(
  id: string,
  question: DecisionModelV4Question,
): OpenRouterDecisionsQuestion {
  const instructions =
    question.instructions != null
      ? { instructions: question.instructions }
      : {};

  switch (question.type) {
    case 'choice':
      return { type: 'choice', ...instructions, criteria: question.criteria };
    case 'score':
      return {
        type: 'score',
        ...instructions,
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
    case 'box':
      if (question.instructions == null) {
        throw new InvalidArgumentError({
          argument: `questions.${id}.instructions`,
          message: `Question "${id}": the OpenRouter Decisions API requires instructions for box questions.`,
        });
      }
      return { type: 'box', instructions: question.instructions };
    case 'boolean': {
      const criteria = {
        ...(question.criteria?.true != null
          ? { true: question.criteria.true }
          : {}),
        ...(question.criteria?.false != null
          ? { false: question.criteria.false }
          : {}),
      };
      return {
        type: 'noul',
        ...instructions,
        ...(Object.keys(criteria).length > 0 ? { criteria } : {}),
      };
    }
    default:
      return question satisfies never;
  }
}

function toDecisionAnswer(
  answer: OpenRouterDecisionsAnswer,
): DecisionModelV4Answer {
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
    case 'box':
      return { type: 'box', box: answer.box };
    case 'refusal':
      return { type: 'refusal' };
    default:
      return answer satisfies never;
  }
}

function toAnswerMetadata(answer: OpenRouterDecisionsAnswer): JSONValue {
  switch (answer.type) {
    case 'noul':
    case 'choice':
    case 'box':
      return answer.confidence != null ? { confidence: answer.confidence } : {};
    case 'score':
      return {
        ...(answer.confidence != null ? { confidence: answer.confidence } : {}),
        ...(answer.legend != null ? { legend: answer.legend } : {}),
      };
    case 'refusal':
      return {};
    default:
      return answer satisfies never;
  }
}

/** Usage accounting beyond token counts, or undefined when none was returned. */
function toUsageMetadata(
  usage: OpenRouterDecisionsResponse['usage'],
): JSONObject | undefined {
  const upstreamInferenceCost = usage?.cost_details?.upstream_inference_cost;
  const cachedTokens = usage?.input_tokens_details?.cached_tokens;
  const metadata: JSONObject = {
    ...(usage?.cost != null ? { cost: usage.cost } : {}),
    ...(upstreamInferenceCost != null
      ? { costDetails: { upstreamInferenceCost } }
      : {}),
    ...(cachedTokens != null ? { inputTokensDetails: { cachedTokens } } : {}),
    ...(usage?.is_byok != null ? { isByok: usage.is_byok } : {}),
  };
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}
