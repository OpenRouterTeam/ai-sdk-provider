import type {
  JSONObject,
  JSONValue,
  LanguageModelV4CallOptions,
  LanguageModelV4FilePart,
  LanguageModelV4TextPart,
  SharedV4Headers,
  SharedV4ProviderMetadata,
  SharedV4ProviderOptions,
  SharedV4Warning,
} from '@ai-sdk/provider';

/**
 * Copy of `Experimental_DecisionModelV4*` from `@ai-sdk/provider@4.0.37`,
 * which older `ai@7` installs do not ship. `index.test.ts` asserts the copy
 * stays identical to upstream.
 */
export type DecisionModelV4Input =
  | string
  | Readonly<JSONObject>
  | readonly JSONValue[];

export type DecisionModelV4Question =
  | {
      readonly type: 'choice';
      /** May be omitted or null when supported by the provider and criteria define the judgment. */
      readonly instructions?: DecisionModelV4Input | null;
      /** Nonempty map of option names to descriptions. Null means no description. */
      readonly criteria: Readonly<Record<string, DecisionModelV4Input | null>>;
    }
  | {
      readonly type: 'score';
      /** May be omitted or null when supported by the provider and criteria define the judgment. */
      readonly instructions?: DecisionModelV4Input | null;
      /** At least one ordered level, indexed from zero. Providers may require more. */
      readonly criteria: readonly (DecisionModelV4Input | null)[];
    }
  | {
      readonly type: 'box';
      /** May be omitted or null when supported by the provider. */
      readonly instructions?: DecisionModelV4Input | null;
    }
  | {
      readonly type: 'boolean';
      /** May be omitted or null when supported by the provider and criteria define the judgment. */
      readonly instructions?: DecisionModelV4Input | null;
      /** At least one non-null description is required when instructions are absent. */
      readonly criteria?: {
        readonly true?: DecisionModelV4Input | null;
        readonly false?: DecisionModelV4Input | null;
      } | null;
    };

export type DecisionModelV4StatePart =
  | LanguageModelV4TextPart
  | LanguageModelV4FilePart
  | { type: 'json'; value: JSONValue };

export type DecisionModelV4State = readonly DecisionModelV4StatePart[];

export type DecisionModelV4CallOptions = {
  state: DecisionModelV4State;
  questions: Readonly<Record<string, DecisionModelV4Question>>;
  maxOutputTokens?: number;
  /** Reasoning effort for supported models. */
  reasoning?: LanguageModelV4CallOptions['reasoning'];
  abortSignal?: AbortSignal;
  headers?: SharedV4Headers;
  providerOptions?: SharedV4ProviderOptions;
};

export type DecisionModelV4Answer =
  | {
      type: 'choice';
      /** The selected option, with maximal probability when a distribution exists. */
      choice: string;
      /** Complete distribution over the question's options, when available. */
      probabilities?: Record<string, number>;
    }
  | {
      type: 'score';
      /** Fractional position in [0, number of levels - 1]. */
      score: number;
      /**
       * Complete distribution, keyed by zero-based level indices as strings.
       * When supplied, score is its probability-weighted mean.
       */
      probabilities?: Record<string, number>;
    }
  | {
      type: 'box';
      /** Edges in [0, 1], measured from the image's top-left corner. */
      box: {
        top: number;
        bottom: number;
        left: number;
        right: number;
      };
    }
  | {
      type: 'boolean';
      /** Model-estimated P(true), in [0, 1]. Not confidence in either outcome. */
      probability: number;
    }
  | {
      /** The model declined to answer this question. Valid for any question type. */
      type: 'refusal';
    };

export type DecisionModelV4Result = {
  /** Exactly one answer per question, under the original question IDs. */
  answers: Record<string, DecisionModelV4Answer>;
  /**
   * Decimal places used when the provider rounds its output. Omit for full
   * precision. Core allows half a unit in the last place per rounded value
   * when checking distribution sums and weighted scores.
   */
  rounding?: {
    probabilityDecimals?: number;
    scoreDecimals?: number;
  };
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  warnings: SharedV4Warning[];
  providerMetadata?: SharedV4ProviderMetadata;
  response?: {
    id?: string;
    timestamp?: Date;
    modelId?: string;
    headers?: SharedV4Headers;
    body?: unknown;
  };
};

export type DecisionModelV4 = {
  readonly specificationVersion: 'v4';
  readonly provider: string;
  readonly modelId: string;
  /** Supported question types, used to reject unsupported calls before any I/O. */
  readonly supportedQuestionTypes: readonly DecisionModelV4Question['type'][];
  /** Decide every answer against the same state. No partial results. */
  doDecide(
    options: DecisionModelV4CallOptions,
  ): PromiseLike<DecisionModelV4Result>;
};

/** @deprecated Implement `DecisionModelV4` with `doDecide` instead. */
export type EvaluationModelV4 = Omit<DecisionModelV4, 'doDecide'> & {
  doEvaluate: DecisionModelV4['doDecide'];
};
/** @deprecated Use `DecisionModelV4CallOptions` instead. */
export type EvaluationModelV4CallOptions = DecisionModelV4CallOptions;
/** @deprecated Use `DecisionModelV4Question` instead. */
export type EvaluationModelV4Question = DecisionModelV4Question;
/** @deprecated Use `DecisionModelV4Answer` instead. */
export type EvaluationModelV4Answer = DecisionModelV4Answer;
/** @deprecated Use `DecisionModelV4Result` instead. */
export type EvaluationModelV4Result = DecisionModelV4Result;
/** @deprecated Use `DecisionModelV4Input` instead. */
export type EvaluationModelV4Input = DecisionModelV4Input;
