import type {
  JSONObject,
  JSONValue,
  SharedV4Headers,
  SharedV4ProviderMetadata,
  SharedV4ProviderOptions,
  SharedV4Warning,
} from '@ai-sdk/provider';

/**
 * Copy of `Experimental_EvaluationModelV4*` from `@ai-sdk/provider@4.0.16`,
 * which older `ai@7` installs do not ship. `index.test.ts` asserts the copy
 * stays identical to upstream.
 */
export type EvaluationModelV4Input =
  | string
  | Readonly<JSONObject>
  | readonly JSONValue[];

export type EvaluationModelV4Question =
  | {
      readonly type: 'choice';
      readonly instructions: EvaluationModelV4Input;
      /** Nonempty map of option names to descriptions. Null means no description. */
      readonly criteria: Readonly<
        Record<string, EvaluationModelV4Input | null>
      >;
    }
  | {
      readonly type: 'score';
      readonly instructions: EvaluationModelV4Input;
      /** At least two ordered levels, indexed from zero. */
      readonly criteria: readonly (EvaluationModelV4Input | null)[];
    }
  | {
      readonly type: 'boolean';
      readonly instructions: EvaluationModelV4Input;
      readonly criteria?: {
        readonly true?: EvaluationModelV4Input | null;
        readonly false?: EvaluationModelV4Input | null;
      };
    };

export type EvaluationModelV4CallOptions = {
  /** One shared state, even when the value is an array. */
  state: EvaluationModelV4Input;
  questions: Readonly<Record<string, EvaluationModelV4Question>>;
  abortSignal?: AbortSignal;
  headers?: SharedV4Headers;
  providerOptions?: SharedV4ProviderOptions;
};

export type EvaluationModelV4Answer =
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
      type: 'boolean';
      /** Model-estimated P(true), in [0, 1]. Not confidence in either outcome. */
      probability: number;
    };

export type EvaluationModelV4Result = {
  /** Exactly one answer per question, under the original question IDs. */
  answers: Record<string, EvaluationModelV4Answer>;
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

export type EvaluationModelV4 = {
  readonly specificationVersion: 'v4';
  readonly provider: string;
  readonly modelId: string;
  /** Supported question types, used to reject unsupported calls before any I/O. */
  readonly supportedQuestionTypes: readonly EvaluationModelV4Question['type'][];
  /** Evaluate every question against the same state. No partial results. */
  doEvaluate(
    options: EvaluationModelV4CallOptions,
  ): PromiseLike<EvaluationModelV4Result>;
};
