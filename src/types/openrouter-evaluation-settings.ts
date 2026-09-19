// https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-questions-and-answers-request
export type OpenRouterEvaluationModelId = string;

export type OpenRouterEvaluationSettings = {
  /**
   * A unique identifier representing your end-user, which can help OpenRouter to
   * monitor and detect abuse.
   */
  user?: string;

  /**
   * Provider routing preferences to control request routing behavior
   */
  provider?: {
    /**
     * List of provider slugs to try in order (e.g. ["typesafe"])
     */
    order?: string[];
    /**
     * Whether to allow backup providers when primary is unavailable (default: true)
     */
    allow_fallbacks?: boolean;
    /**
     * Only use providers that support all parameters in your request (default: false)
     */
    require_parameters?: boolean;
    /**
     * Control whether to use providers that may store data
     */
    data_collection?: 'allow' | 'deny';
    /**
     * List of provider slugs to allow for this request
     */
    only?: string[];
    /**
     * List of provider slugs to skip for this request
     */
    ignore?: string[];
    /**
     * Sort providers by price, throughput, or latency
     */
    sort?: 'price' | 'throughput' | 'latency';
    /**
     * Maximum pricing you want to pay for this request
     */
    max_price?: {
      prompt?: number | string;
      completion?: number | string;
      request?: number | string;
    };
  };

  /**
   * Groups related requests (e.g. one agent workflow) for observability.
   * Maximum of 256 characters.
   */
  session_id?: string;

  /**
   * Tracing metadata forwarded to configured broadcast destinations.
   */
  trace?: {
    trace_id?: string;
    trace_name?: string;
    span_name?: string;
    generation_name?: string;
    parent_span_id?: string;
    [key: string]: unknown;
  };

  /**
   * Extra fields merged into the Decisions request body. Fields set here are
   * overridden by the typed settings above, by call-level
   * `providerOptions.openrouter`, and never replace `model`, `state`, or
   * `questions`.
   */
  extraBody?: Record<string, unknown>;
};
